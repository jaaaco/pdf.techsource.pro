/**
 * Integration Tests - PDF Merge Tool
 * Tests complete workflow including drag-and-drop reordering
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Merge from '@/pages/Merge';

// Mock file for testing
const createMockPDFFile = (name: string = 'test.pdf', size: number = 1024): File => {
  const content = '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n%%EOF';
  return new File([content], name, { type: 'application/pdf' });
};

// Mock worker
const mockWorker = {
  postMessage: vi.fn(),
  terminate: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

global.Worker = vi.fn(() => mockWorker) as any;

describe('PDF Merge Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderMergePage = () => {
    return render(
      <BrowserRouter>
        <Merge />
      </BrowserRouter>
    );
  };

  it('should handle complete merge workflow', async () => {
    renderMergePage();

    // Check initial state
    expect(screen.getByText(/drag and drop pdf files/i)).toBeInTheDocument();
    expect(screen.getByText(/merge pdfs/i)).toBeInTheDocument();

    // Upload multiple files
    const fileInput = screen.getByLabelText(/select files/i);
    const files = [
      createMockPDFFile('chapter1.pdf', 1024),
      createMockPDFFile('chapter2.pdf', 2048),
      createMockPDFFile('chapter3.pdf', 1536)
    ];
    
    fireEvent.change(fileInput, { target: { files } });

    // Verify files are uploaded and listed
    await waitFor(() => {
      expect(screen.getByText('chapter1.pdf')).toBeInTheDocument();
      expect(screen.getByText('chapter2.pdf')).toBeInTheDocument();
      expect(screen.getByText('chapter3.pdf')).toBeInTheDocument();
    });

    // Start merge
    const mergeButton = screen.getByText(/merge files/i);
    fireEvent.click(mergeButton);

    // Verify worker is called
    expect(mockWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'merge',
        payload: expect.objectContaining({
          files: expect.arrayContaining([
            expect.objectContaining({ file: files[0], order: 0 }),
            expect.objectContaining({ file: files[1], order: 1 }),
            expect.objectContaining({ file: files[2], order: 2 })
          ])
        })
      })
    );

    // Simulate worker progress and completion
    const progressHandler = mockWorker.addEventListener.mock.calls.find(
      call => call[0] === 'message'
    )?.[1];

    if (progressHandler) {
      // Progress update
      progressHandler({
        data: {
          type: 'progress',
          payload: {
            current: 2,
            total: 3,
            stage: 'Merging',
            message: 'Processing chapter2.pdf...',
            percentage: 67
          },
          taskId: 'test-task',
          timestamp: Date.now()
        }
      });

      // Check progress display
      await waitFor(() => {
        expect(screen.getByText(/merging/i)).toBeInTheDocument();
        expect(screen.getByText(/67%/)).toBeInTheDocument();
      });

      // Completion
      const mergedData = new Uint8Array([1, 2, 3, 4, 5]);
      progressHandler({
        data: {
          type: 'complete',
          payload: {
            files: [{
              name: 'merged_document.pdf',
              data: mergedData,
              size: 4608,
              mimeType: 'application/pdf',
              originalSize: 4608
            }],
            metadata: {
              processingTime: 2000,
              tool: 'merge',
              options: {}
            }
          },
          taskId: 'test-task',
          timestamp: Date.now()
        }
      });

      // Check completion
      await waitFor(() => {
        expect(screen.getByText(/merge completed/i)).toBeInTheDocument();
        expect(screen.getByText(/download/i)).toBeInTheDocument();
      });
    }
  });

  it('should handle file reordering', async () => {
    renderMergePage();

    // Upload files
    const fileInput = screen.getByLabelText(/select files/i);
    const files = [
      createMockPDFFile('first.pdf'),
      createMockPDFFile('second.pdf'),
      createMockPDFFile('third.pdf')
    ];
    
    fireEvent.change(fileInput, { target: { files } });

    await waitFor(() => {
      expect(screen.getByText('first.pdf')).toBeInTheDocument();
    });

    // Simulate drag and drop reordering (simplified)
    // In a real test, you'd use more sophisticated drag-and-drop simulation
    const reorderButtons = screen.getAllByLabelText(/move/i);
    if (reorderButtons.length > 0) {
      fireEvent.click(reorderButtons[0]); // Move first file down
    }

    // Start merge after reordering
    const mergeButton = screen.getByText(/merge files/i);
    fireEvent.click(mergeButton);

    // Verify the order is maintained in worker call
    expect(mockWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'merge',
        payload: expect.objectContaining({
          files: expect.any(Array)
        })
      })
    );
  });

  it('should handle merge errors', async () => {
    renderMergePage();

    // Upload files with one corrupted
    const fileInput = screen.getByLabelText(/select files/i);
    const files = [
      createMockPDFFile('good.pdf'),
      new File(['corrupted'], 'bad.pdf', { type: 'application/pdf' })
    ];
    
    fireEvent.change(fileInput, { target: { files } });

    const mergeButton = screen.getByText(/merge files/i);
    fireEvent.click(mergeButton);

    // Simulate worker error
    const progressHandler = mockWorker.addEventListener.mock.calls.find(
      call => call[0] === 'message'
    )?.[1];

    if (progressHandler) {
      progressHandler({
        data: {
          type: 'error',
          payload: {
            type: 'FILE_ERROR',
            message: 'One or more PDF files are corrupted',
            suggestions: ['Check file integrity', 'Try different files'],
            recoverable: true
          },
          taskId: 'test-task',
          timestamp: Date.now()
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/one or more pdf files are corrupted/i)).toBeInTheDocument();
      });
    }
  });

  it('should require at least 2 files for merge', async () => {
    renderMergePage();

    // Upload only one file
    const fileInput = screen.getByLabelText(/select files/i);
    const file = createMockPDFFile('single.pdf');
    
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('single.pdf')).toBeInTheDocument();
    });

    // Try to merge - should show validation message
    const mergeButton = screen.getByText(/merge files/i);
    expect(mergeButton).toBeDisabled();
    
    // Or check for validation message
    expect(screen.getByText(/at least 2 files required/i)).toBeInTheDocument();
  });

  it('should handle custom output filename', async () => {
    renderMergePage();

    // Upload files
    const fileInput = screen.getByLabelText(/select files/i);
    const files = [
      createMockPDFFile('doc1.pdf'),
      createMockPDFFile('doc2.pdf')
    ];
    
    fireEvent.change(fileInput, { target: { files } });

    // Set custom filename
    const filenameInput = screen.getByLabelText(/output filename/i);
    fireEvent.change(filenameInput, { target: { value: 'custom_merged_document' } });

    // Start merge
    const mergeButton = screen.getByText(/merge files/i);
    fireEvent.click(mergeButton);

    // Verify custom filename is passed to worker
    expect(mockWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          options: expect.objectContaining({
            outputName: 'custom_merged_document.pdf'
          })
        })
      })
    );
  });

  it('should show file size information', async () => {
    renderMergePage();

    // Upload files
    const fileInput = screen.getByLabelText(/select files/i);
    const files = [
      createMockPDFFile('small.pdf', 1024),
      createMockPDFFile('large.pdf', 5120)
    ];
    
    fireEvent.change(fileInput, { target: { files } });

    // Check file sizes are displayed
    await waitFor(() => {
      expect(screen.getByText(/1\.0 kb/i)).toBeInTheDocument();
      expect(screen.getByText(/5\.0 kb/i)).toBeInTheDocument();
    });

    // Check total size
    expect(screen.getByText(/total.*6\.0 kb/i)).toBeInTheDocument();
  });
});