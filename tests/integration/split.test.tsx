/**
 * Integration Tests - PDF Split Tool
 * Tests page range parsing and split functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Split from '@/pages/Split';

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

global.Worker = vi.fn(() => mockWorker) as unknown as typeof Worker;

describe('PDF Split Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderSplitPage = () => {
    return render(
      <BrowserRouter>
        <Split />
      </BrowserRouter>
    );
  };

  it('should handle complete split workflow', async () => {
    renderSplitPage();

    // Check initial state
    expect(screen.getByText(/drag and drop a pdf file/i)).toBeInTheDocument();
    expect(screen.getByText(/split pdf/i)).toBeInTheDocument();

    // Upload file
    const fileInput = screen.getByLabelText(/select file/i);
    const testFile = createMockPDFFile('document.pdf', 2048);
    
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    // Verify file is uploaded
    await waitFor(() => {
      expect(screen.getByText('document.pdf')).toBeInTheDocument();
    });

    // Enter page ranges
    const rangeInput = screen.getByLabelText(/page ranges/i);
    fireEvent.change(rangeInput, { target: { value: '1-3, 5, 7-9' } });

    // Start split
    const splitButton = screen.getByText(/split pdf/i);
    fireEvent.click(splitButton);

    // Verify worker is called with correct ranges
    expect(mockWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'split',
        payload: expect.objectContaining({
          file: testFile,
          ranges: '1-3, 5, 7-9'
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
            stage: 'Splitting',
            message: 'Creating document_pages_7-9.pdf...',
            percentage: 67
          },
          taskId: 'test-task',
          timestamp: Date.now()
        }
      });

      // Check progress display
      await waitFor(() => {
        expect(screen.getByText(/splitting/i)).toBeInTheDocument();
        expect(screen.getByText(/67%/)).toBeInTheDocument();
      });

      // Completion with multiple files
      progressHandler({
        data: {
          type: 'complete',
          payload: {
            files: [
              {
                name: 'document_pages_1-3.pdf',
                data: new Uint8Array([1, 2, 3]),
                size: 1024,
                mimeType: 'application/pdf'
              },
              {
                name: 'document_pages_5.pdf',
                data: new Uint8Array([4, 5]),
                size: 512,
                mimeType: 'application/pdf'
              },
              {
                name: 'document_pages_7-9.pdf',
                data: new Uint8Array([6, 7, 8]),
                size: 768,
                mimeType: 'application/pdf'
              }
            ],
            metadata: {
              processingTime: 1500,
              tool: 'split',
              options: { ranges: '1-3, 5, 7-9' }
            }
          },
          taskId: 'test-task',
          timestamp: Date.now()
        }
      });

      // Check completion with multiple download links
      await waitFor(() => {
        expect(screen.getByText(/split completed/i)).toBeInTheDocument();
        expect(screen.getByText(/document_pages_1-3\.pdf/)).toBeInTheDocument();
        expect(screen.getByText(/document_pages_5\.pdf/)).toBeInTheDocument();
        expect(screen.getByText(/document_pages_7-9\.pdf/)).toBeInTheDocument();
      });
    }
  });

  it('should validate page ranges', async () => {
    renderSplitPage();

    // Upload file
    const fileInput = screen.getByLabelText(/select file/i);
    const testFile = createMockPDFFile('test.pdf');
    
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    // Test invalid range formats
    const rangeInput = screen.getByLabelText(/page ranges/i);
    
    // Invalid format
    fireEvent.change(rangeInput, { target: { value: 'invalid-range' } });
    fireEvent.blur(rangeInput);

    await waitFor(() => {
      expect(screen.getByText(/invalid page range format/i)).toBeInTheDocument();
    });

    // Valid format
    fireEvent.change(rangeInput, { target: { value: '1-5' } });
    fireEvent.blur(rangeInput);

    await waitFor(() => {
      expect(screen.queryByText(/invalid page range format/i)).not.toBeInTheDocument();
    });
  });

  it('should handle split errors', async () => {
    renderSplitPage();

    // Upload file
    const fileInput = screen.getByLabelText(/select file/i);
    const testFile = createMockPDFFile('corrupted.pdf');
    
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    // Enter valid range
    const rangeInput = screen.getByLabelText(/page ranges/i);
    fireEvent.change(rangeInput, { target: { value: '1-10' } });

    // Start split
    const splitButton = screen.getByText(/split pdf/i);
    fireEvent.click(splitButton);

    // Simulate worker error
    const progressHandler = mockWorker.addEventListener.mock.calls.find(
      call => call[0] === 'message'
    )?.[1];

    if (progressHandler) {
      progressHandler({
        data: {
          type: 'error',
          payload: {
            type: 'VALIDATION_ERROR',
            message: 'Page range 1-10 exceeds document length (5 pages)',
            suggestions: ['Check the document page count', 'Use valid page ranges'],
            recoverable: true
          },
          taskId: 'test-task',
          timestamp: Date.now()
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/page range 1-10 exceeds document length/i)).toBeInTheDocument();
      });
    }
  });

  it('should show page count information', async () => {
    renderSplitPage();

    // Upload file
    const fileInput = screen.getByLabelText(/select file/i);
    const testFile = createMockPDFFile('document.pdf');
    
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    // Simulate page count detection
    const progressHandler = mockWorker.addEventListener.mock.calls.find(
      call => call[0] === 'message'
    )?.[1];

    if (progressHandler) {
      // Simulate page count message
      progressHandler({
        data: {
          type: 'progress',
          payload: {
            current: 1,
            total: 1,
            stage: 'Analyzing',
            message: 'Document has 15 pages',
            percentage: 100
          },
          taskId: 'analyze-task',
          timestamp: Date.now()
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/15 pages/i)).toBeInTheDocument();
      });
    }
  });

  it('should handle single page extraction', async () => {
    renderSplitPage();

    // Upload file
    const fileInput = screen.getByLabelText(/select file/i);
    const testFile = createMockPDFFile('document.pdf');
    
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    // Enter single page
    const rangeInput = screen.getByLabelText(/page ranges/i);
    fireEvent.change(rangeInput, { target: { value: '5' } });

    // Start split
    const splitButton = screen.getByText(/split pdf/i);
    fireEvent.click(splitButton);

    // Verify worker receives single page range
    expect(mockWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          ranges: '5'
        })
      })
    );
  });

  it('should handle complex range patterns', async () => {
    renderSplitPage();

    // Upload file
    const fileInput = screen.getByLabelText(/select file/i);
    const testFile = createMockPDFFile('document.pdf');
    
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    // Test various range patterns
    const rangeInput = screen.getByLabelText(/page ranges/i);
    
    const testRanges = [
      '1-3, 5, 7-9, 12',
      '1, 3, 5-10',
      '2-5, 8-12, 15-20'
    ];

    for (const range of testRanges) {
      fireEvent.change(rangeInput, { target: { value: range } });
      fireEvent.blur(rangeInput);

      // Should not show validation error for valid ranges
      await waitFor(() => {
        expect(screen.queryByText(/invalid page range format/i)).not.toBeInTheDocument();
      });
    }
  });

  it('should require file before allowing split', async () => {
    renderSplitPage();

    // Try to split without file
    const splitButton = screen.getByText(/split pdf/i);
    expect(splitButton).toBeDisabled();

    // Enter ranges without file
    const rangeInput = screen.getByLabelText(/page ranges/i);
    fireEvent.change(rangeInput, { target: { value: '1-5' } });

    // Button should still be disabled
    expect(splitButton).toBeDisabled();

    // Upload file
    const fileInput = screen.getByLabelText(/select file/i);
    const testFile = createMockPDFFile('document.pdf');
    
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    // Now button should be enabled
    await waitFor(() => {
      expect(splitButton).not.toBeDisabled();
    });
  });
});