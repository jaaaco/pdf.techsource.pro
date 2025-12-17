/**
 * Integration Tests - OCR Tool
 * Tests OCR processing with language selection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import OCR from '@/pages/OCR';

// Mock file for testing
const createMockPDFFile = (name: string = 'scanned.pdf', size: number = 1024): File => {
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

describe('OCR Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderOCRPage = () => {
    return render(
      <BrowserRouter>
        <OCR />
      </BrowserRouter>
    );
  };

  it('should handle complete OCR workflow', async () => {
    renderOCRPage();

    // Check initial state
    expect(screen.getByText(/drag and drop a pdf file/i)).toBeInTheDocument();
    expect(screen.getByText(/ocr pdf/i)).toBeInTheDocument();

    // Upload scanned PDF
    const fileInput = screen.getByLabelText(/select file/i);
    const testFile = createMockPDFFile('scanned_document.pdf', 3072);
    
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    // Verify file is uploaded
    await waitFor(() => {
      expect(screen.getByText('scanned_document.pdf')).toBeInTheDocument();
    });

    // Select language
    const languageSelect = screen.getByLabelText(/language/i);
    fireEvent.change(languageSelect, { target: { value: 'eng' } });

    // Start OCR
    const ocrButton = screen.getByText(/start ocr/i);
    fireEvent.click(ocrButton);

    // Verify worker is called
    expect(mockWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ocr',
        payload: expect.objectContaining({
          file: testFile,
          options: expect.objectContaining({
            languages: ['eng'],
            outputFormat: 'searchable-pdf'
          })
        })
      })
    );

    // Simulate worker progress and completion
    const progressHandler = mockWorker.addEventListener.mock.calls.find(
      call => call[0] === 'message'
    )?.[1];

    if (progressHandler) {
      // Progress updates
      progressHandler({
        data: {
          type: 'progress',
          payload: {
            current: 2,
            total: 5,
            stage: 'OCR Processing',
            message: 'Processing page 2 of 5...',
            percentage: 40
          },
          taskId: 'test-task',
          timestamp: Date.now()
        }
      });

      // Check progress display
      await waitFor(() => {
        expect(screen.getByText(/ocr processing/i)).toBeInTheDocument();
        expect(screen.getByText(/40%/)).toBeInTheDocument();
        expect(screen.getByText(/processing page 2 of 5/i)).toBeInTheDocument();
      });

      // Completion
      const searchableData = new Uint8Array([1, 2, 3, 4, 5, 6]);
      progressHandler({
        data: {
          type: 'complete',
          payload: {
            files: [{
              name: 'scanned_document_searchable.pdf',
              data: searchableData,
              size: 3584,
              mimeType: 'application/pdf',
              originalSize: 3072,
              metadata: {
                ocrLanguages: ['eng'],
                pagesProcessed: 5,
                averageConfidence: 0.87
              }
            }],
            metadata: {
              processingTime: 15000,
              tool: 'ocr',
              options: {
                languages: ['eng'],
                outputFormat: 'searchable-pdf'
              }
            }
          },
          taskId: 'test-task',
          timestamp: Date.now()
        }
      });

      // Check completion
      await waitFor(() => {
        expect(screen.getByText(/ocr completed/i)).toBeInTheDocument();
        expect(screen.getByText(/download/i)).toBeInTheDocument();
        expect(screen.getByText(/87%.*confidence/i)).toBeInTheDocument();
      });
    }
  });

  it('should handle multiple language selection', async () => {
    renderOCRPage();

    // Upload file
    const fileInput = screen.getByLabelText(/select file/i);
    const testFile = createMockPDFFile('multilingual.pdf');
    
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    // Select multiple languages
    const languageSelect = screen.getByLabelText(/language/i);
    
    // Simulate multi-select (implementation depends on UI component)
    fireEvent.change(languageSelect, { target: { value: 'eng+fra+deu' } });

    // Start OCR
    const ocrButton = screen.getByText(/start ocr/i);
    fireEvent.click(ocrButton);

    // Verify worker receives multiple languages
    expect(mockWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          options: expect.objectContaining({
            languages: expect.arrayContaining(['eng', 'fra', 'deu'])
          })
        })
      })
    );
  });

  it('should handle OCR errors gracefully', async () => {
    renderOCRPage();

    // Upload file
    const fileInput = screen.getByLabelText(/select file/i);
    const testFile = createMockPDFFile('problematic.pdf');
    
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    // Start OCR
    const ocrButton = screen.getByText(/start ocr/i);
    fireEvent.click(ocrButton);

    // Simulate worker error
    const progressHandler = mockWorker.addEventListener.mock.calls.find(
      call => call[0] === 'message'
    )?.[1];

    if (progressHandler) {
      progressHandler({
        data: {
          type: 'error',
          payload: {
            type: 'PROCESSING_ERROR',
            message: 'OCR engine failed to process page 3',
            suggestions: [
              'Try a different language setting',
              'Check if the document contains readable text',
              'Ensure the PDF is not password protected'
            ],
            recoverable: true
          },
          taskId: 'test-task',
          timestamp: Date.now()
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/ocr engine failed to process page 3/i)).toBeInTheDocument();
        expect(screen.getByText(/try a different language setting/i)).toBeInTheDocument();
      });
    }
  });

  it('should show confidence indicators', async () => {
    renderOCRPage();

    // Upload file
    const fileInput = screen.getByLabelText(/select file/i);
    const testFile = createMockPDFFile('document.pdf');
    
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    // Start OCR
    const ocrButton = screen.getByText(/start ocr/i);
    fireEvent.click(ocrButton);

    // Simulate progress with confidence info
    const progressHandler = mockWorker.addEventListener.mock.calls.find(
      call => call[0] === 'message'
    )?.[1];

    if (progressHandler) {
      progressHandler({
        data: {
          type: 'progress',
          payload: {
            current: 1,
            total: 3,
            stage: 'OCR Processing',
            message: 'Page 1: 92% confidence',
            percentage: 33
          },
          taskId: 'test-task',
          timestamp: Date.now()
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/92%.*confidence/i)).toBeInTheDocument();
      });
    }
  });

  it('should handle text-only output format', async () => {
    renderOCRPage();

    // Upload file
    const fileInput = screen.getByLabelText(/select file/i);
    const testFile = createMockPDFFile('document.pdf');
    
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    // Select text-only output
    const formatSelect = screen.getByLabelText(/output format/i);
    fireEvent.change(formatSelect, { target: { value: 'text-only' } });

    // Start OCR
    const ocrButton = screen.getByText(/start ocr/i);
    fireEvent.click(ocrButton);

    // Verify worker receives text-only format
    expect(mockWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          options: expect.objectContaining({
            outputFormat: 'text-only'
          })
        })
      })
    );

    // Simulate completion with text file
    const progressHandler = mockWorker.addEventListener.mock.calls.find(
      call => call[0] === 'message'
    )?.[1];

    if (progressHandler) {
      progressHandler({
        data: {
          type: 'complete',
          payload: {
            files: [{
              name: 'document_text.txt',
              data: new TextEncoder().encode('Extracted text content...'),
              size: 256,
              mimeType: 'text/plain'
            }],
            metadata: {
              processingTime: 8000,
              tool: 'ocr',
              options: { outputFormat: 'text-only' }
            }
          },
          taskId: 'test-task',
          timestamp: Date.now()
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/document_text\.txt/)).toBeInTheDocument();
      });
    }
  });

  it('should validate file type for OCR', async () => {
    renderOCRPage();

    // Try to upload non-PDF file
    const fileInput = screen.getByLabelText(/select file/i);
    const invalidFile = new File(['content'], 'image.jpg', { type: 'image/jpeg' });
    
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    // Check validation error
    await waitFor(() => {
      expect(screen.getByText(/only pdf files are supported/i)).toBeInTheDocument();
    });
  });

  it('should handle large file warnings', async () => {
    renderOCRPage();

    // Upload large file
    const fileInput = screen.getByLabelText(/select file/i);
    const largeFile = createMockPDFFile('large_document.pdf', 50 * 1024 * 1024); // 50MB
    
    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    // Check for large file warning
    await waitFor(() => {
      expect(screen.getByText(/large file.*may take longer/i)).toBeInTheDocument();
    });
  });

  it('should show processing time estimates', async () => {
    renderOCRPage();

    // Upload file
    const fileInput = screen.getByLabelText(/select file/i);
    const testFile = createMockPDFFile('document.pdf', 5 * 1024 * 1024); // 5MB
    
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    // Should show time estimate
    await waitFor(() => {
      expect(screen.getByText(/estimated.*processing time/i)).toBeInTheDocument();
    });
  });
});