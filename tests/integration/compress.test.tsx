/**
 * Integration Tests - PDF Compression Tool
 * Tests complete workflow from file upload to download
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Compress from '@/pages/Compress';

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

// Mock Worker constructor
global.Worker = vi.fn(() => mockWorker) as unknown as typeof Worker;

describe('PDF Compression Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderCompressPage = () => {
    return render(
      <BrowserRouter>
        <Compress />
      </BrowserRouter>
    );
  };

  it('should handle complete compression workflow', async () => {
    renderCompressPage();

    // Check initial state
    expect(screen.getByText(/drag and drop pdf files/i)).toBeInTheDocument();
    expect(screen.getByText(/compress pdf/i)).toBeInTheDocument();

    // Upload file
    const fileInput = screen.getByLabelText(/select files/i);
    const testFile = createMockPDFFile('document.pdf', 2048);
    
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    // Verify file is uploaded
    await waitFor(() => {
      expect(screen.getByText('document.pdf')).toBeInTheDocument();
    });

    // Select compression quality
    const qualitySelect = screen.getByLabelText(/quality preset/i);
    fireEvent.change(qualitySelect, { target: { value: 'screen' } });

    // Start compression
    const compressButton = screen.getByText(/compress files/i);
    fireEvent.click(compressButton);

    // Verify worker is called
    expect(mockWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'compress',
        payload: expect.objectContaining({
          files: [testFile],
          options: expect.objectContaining({
            quality: 'screen'
          })
        })
      })
    );

    // Simulate worker progress
    const progressHandler = mockWorker.addEventListener.mock.calls.find(
      call => call[0] === 'message'
    )?.[1];

    if (progressHandler) {
      // Simulate progress updates
      progressHandler({
        data: {
          type: 'progress',
          payload: {
            current: 50,
            total: 100,
            stage: 'Compressing',
            message: 'Processing document.pdf...',
            percentage: 50
          },
          taskId: 'test-task',
          timestamp: Date.now()
        }
      });

      // Check progress is displayed
      await waitFor(() => {
        expect(screen.getByText(/compressing/i)).toBeInTheDocument();
        expect(screen.getByText(/50%/)).toBeInTheDocument();
      });

      // Simulate completion
      const compressedData = new Uint8Array([1, 2, 3, 4]);
      progressHandler({
        data: {
          type: 'complete',
          payload: {
            files: [{
              name: 'document_compressed.pdf',
              data: compressedData,
              size: 1024,
              mimeType: 'application/pdf',
              originalSize: 2048,
              compressionRatio: 0.5
            }],
            metadata: {
              processingTime: 1000,
              tool: 'compress',
              options: { quality: 'screen' }
            }
          },
          taskId: 'test-task',
          timestamp: Date.now()
        }
      });

      // Check completion state
      await waitFor(() => {
        expect(screen.getByText(/compression completed/i)).toBeInTheDocument();
        expect(screen.getByText(/download/i)).toBeInTheDocument();
      });
    }
  });

  it('should handle compression errors gracefully', async () => {
    renderCompressPage();

    // Upload invalid file
    const fileInput = screen.getByLabelText(/select files/i);
    const invalidFile = new File(['invalid content'], 'invalid.pdf', { type: 'application/pdf' });
    
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    // Start compression
    const compressButton = screen.getByText(/compress files/i);
    fireEvent.click(compressButton);

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
            message: 'Invalid PDF file format',
            suggestions: ['Check if the file is corrupted', 'Try a different PDF file'],
            recoverable: true
          },
          taskId: 'test-task',
          timestamp: Date.now()
        }
      });

      // Check error is displayed
      await waitFor(() => {
        expect(screen.getByText(/invalid pdf file format/i)).toBeInTheDocument();
        expect(screen.getByText(/try a different pdf file/i)).toBeInTheDocument();
      });
    }
  });

  it('should handle cancellation correctly', async () => {
    renderCompressPage();

    // Upload file and start compression
    const fileInput = screen.getByLabelText(/select files/i);
    const testFile = createMockPDFFile();
    
    fireEvent.change(fileInput, { target: { files: [testFile] } });
    
    const compressButton = screen.getByText(/compress files/i);
    fireEvent.click(compressButton);

    // Simulate progress to show cancel button
    const progressHandler = mockWorker.addEventListener.mock.calls.find(
      call => call[0] === 'message'
    )?.[1];

    if (progressHandler) {
      progressHandler({
        data: {
          type: 'progress',
          payload: {
            current: 25,
            total: 100,
            stage: 'Processing',
            percentage: 25
          },
          taskId: 'test-task',
          timestamp: Date.now()
        }
      });

      // Click cancel button
      await waitFor(() => {
        const cancelButton = screen.getByText(/cancel/i);
        fireEvent.click(cancelButton);
      });

      // Verify cancel message sent to worker
      expect(mockWorker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'cancel'
        })
      );
    }
  });

  it('should validate file types correctly', async () => {
    renderCompressPage();

    // Try to upload non-PDF file
    const fileInput = screen.getByLabelText(/select files/i);
    const invalidFile = new File(['content'], 'document.txt', { type: 'text/plain' });
    
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    // Check validation error
    await waitFor(() => {
      expect(screen.getByText(/only pdf files are supported/i)).toBeInTheDocument();
    });
  });

  it('should handle multiple files compression', async () => {
    renderCompressPage();

    // Upload multiple files
    const fileInput = screen.getByLabelText(/select files/i);
    const files = [
      createMockPDFFile('doc1.pdf', 1024),
      createMockPDFFile('doc2.pdf', 2048),
      createMockPDFFile('doc3.pdf', 1536)
    ];
    
    fireEvent.change(fileInput, { target: { files } });

    // Verify all files are listed
    await waitFor(() => {
      expect(screen.getByText('doc1.pdf')).toBeInTheDocument();
      expect(screen.getByText('doc2.pdf')).toBeInTheDocument();
      expect(screen.getByText('doc3.pdf')).toBeInTheDocument();
    });

    // Start compression
    const compressButton = screen.getByText(/compress files/i);
    fireEvent.click(compressButton);

    // Verify worker receives all files
    expect(mockWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          files: expect.arrayContaining(files)
        })
      })
    );
  });
});