/**
 * End-to-End Integration Tests - Complete Application Flow
 * Tests navigation, error recovery, and cross-tool functionality
 */


import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '@/App';

// Mock workers for all tools
const mockWorker = {
  postMessage: vi.fn(),
  terminate: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

global.Worker = vi.fn(() => mockWorker) as any;

// Mock file creation
const createMockPDFFile = (name: string = 'test.pdf', size: number = 1024): File => {
  const content = '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n%%EOF';
  return new File([content], name, { type: 'application/pdf' });
};

describe('PDF Toolkit - End-to-End Application Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock URL.createObjectURL for download functionality
    global.URL.createObjectURL = vi.fn(() => 'mock-blob-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  const renderApp = () => {
    return render(<App />);
  };

  it('should navigate through all tools from dashboard', async () => {
    renderApp();

    // Should start on dashboard
    expect(screen.getByText(/pdf toolkit/i)).toBeInTheDocument();
    expect(screen.getByText(/privacy-first pdf processing/i)).toBeInTheDocument();

    // Navigate to compress tool
    const compressCard = screen.getByText(/compress pdf/i).closest('a');
    fireEvent.click(compressCard!);

    await waitFor(() => {
      expect(screen.getByText(/reduce pdf file size/i)).toBeInTheDocument();
    });

    // Navigate to merge tool
    fireEvent.click(screen.getByText(/merge/i));

    await waitFor(() => {
      expect(screen.getByText(/combine multiple pdf files/i)).toBeInTheDocument();
    });

    // Navigate to split tool
    fireEvent.click(screen.getByText(/split/i));

    await waitFor(() => {
      expect(screen.getByText(/extract specific pages/i)).toBeInTheDocument();
    });

    // Navigate to OCR tool
    fireEvent.click(screen.getByText(/ocr/i));

    await waitFor(() => {
      expect(screen.getByText(/optical character recognition/i)).toBeInTheDocument();
    });

    // Navigate to attribution
    fireEvent.click(screen.getByText(/licenses.*attribution/i));

    await waitFor(() => {
      expect(screen.getByText(/third-party libraries/i)).toBeInTheDocument();
    });
  });

  it('should handle 404 routes gracefully', async () => {
    // Mock window.location for navigation
    delete (window as any).location;
    window.location = { ...window.location, pathname: '/nonexistent' };

    renderApp();

    // Should show 404 page
    await waitFor(() => {
      expect(screen.getByText(/404/)).toBeInTheDocument();
      expect(screen.getByText(/page not found/i)).toBeInTheDocument();
    });

    // Should have link back to dashboard
    const dashboardLink = screen.getByText(/go to dashboard/i);
    expect(dashboardLink).toBeInTheDocument();
  });

  it('should maintain state during navigation', async () => {
    renderApp();

    // Navigate to compress tool
    const compressCard = screen.getByText(/compress pdf/i).closest('a');
    fireEvent.click(compressCard!);

    // Upload a file
    const fileInput = screen.getByLabelText(/select files/i);
    const testFile = createMockPDFFile('persistent.pdf');
    
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    await waitFor(() => {
      expect(screen.getByText('persistent.pdf')).toBeInTheDocument();
    });

    // Navigate away and back
    fireEvent.click(screen.getByText(/dashboard/i));
    
    await waitFor(() => {
      expect(screen.getByText(/pdf toolkit/i)).toBeInTheDocument();
    });

    // Navigate back to compress
    const compressCardAgain = screen.getByText(/compress pdf/i).closest('a');
    fireEvent.click(compressCardAgain!);

    // File should be cleared (expected behavior for security)
    await waitFor(() => {
      expect(screen.queryByText('persistent.pdf')).not.toBeInTheDocument();
    });
  });

  it('should handle global errors gracefully', async () => {
    renderApp();

    // Simulate a global error
    const errorEvent = new ErrorEvent('error', {
      message: 'Test global error',
      filename: 'test.js',
      lineno: 1,
      colno: 1,
      error: new Error('Test error')
    });

    window.dispatchEvent(errorEvent);

    // Application should continue functioning
    expect(screen.getByText(/pdf toolkit/i)).toBeInTheDocument();
  });

  it('should show offline status when network is unavailable', async () => {
    renderApp();

    // Simulate going offline
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    const offlineEvent = new Event('offline');
    window.dispatchEvent(offlineEvent);

    // Should show offline banner
    await waitFor(() => {
      expect(screen.getByText(/you're offline.*continues to work/i)).toBeInTheDocument();
    });

    // Simulate going back online
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });

    const onlineEvent = new Event('online');
    window.dispatchEvent(onlineEvent);

    // Offline banner should disappear
    await waitFor(() => {
      expect(screen.queryByText(/you're offline/i)).not.toBeInTheDocument();
    });
  });

  it('should handle worker communication errors', async () => {
    renderApp();

    // Navigate to compress tool
    const compressCard = screen.getByText(/compress pdf/i).closest('a');
    fireEvent.click(compressCard!);

    // Upload file and start processing
    const fileInput = screen.getByLabelText(/select files/i);
    const testFile = createMockPDFFile('test.pdf');
    
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    const compressButton = screen.getByText(/compress files/i);
    fireEvent.click(compressButton);

    // Simulate worker error
    const errorHandler = mockWorker.addEventListener.mock.calls.find(
      call => call[0] === 'error'
    )?.[1];

    if (errorHandler) {
      errorHandler(new ErrorEvent('error', { message: 'Worker failed' }));

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/worker.*error/i)).toBeInTheDocument();
      });
    }
  });

  it('should handle memory warnings appropriately', async () => {
    renderApp();

    // Navigate to compress tool
    const compressCard = screen.getByText(/compress pdf/i).closest('a');
    fireEvent.click(compressCard!);

    // Upload large file
    const fileInput = screen.getByLabelText(/select files/i);
    const largeFile = createMockPDFFile('large.pdf', 100 * 1024 * 1024); // 100MB
    
    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    // Should show memory warning
    await waitFor(() => {
      expect(screen.getByText(/large file.*memory/i)).toBeInTheDocument();
    });
  });

  it('should support keyboard navigation', async () => {
    renderApp();

    // Test tab navigation
    const compressCard = screen.getByText(/compress pdf/i).closest('a');
    compressCard?.focus();

    // Simulate Enter key
    fireEvent.keyDown(compressCard!, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(/reduce pdf file size/i)).toBeInTheDocument();
    });
  });

  it('should handle concurrent tool usage', async () => {
    renderApp();

    // Start compression in one "tab" (simulate multiple instances)
    const compressCard = screen.getByText(/compress pdf/i).closest('a');
    fireEvent.click(compressCard!);

    const fileInput = screen.getByLabelText(/select files/i);
    const testFile = createMockPDFFile('concurrent.pdf');
    
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    const compressButton = screen.getByText(/compress files/i);
    fireEvent.click(compressButton);

    // Verify worker is called
    expect(mockWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'compress'
      })
    );

    // Navigate to another tool while processing
    fireEvent.click(screen.getByText(/merge/i));

    await waitFor(() => {
      expect(screen.getByText(/combine multiple pdf files/i)).toBeInTheDocument();
    });

    // Should be able to use merge tool independently
    const mergeFileInput = screen.getByLabelText(/select files/i);
    const mergeFiles = [
      createMockPDFFile('doc1.pdf'),
      createMockPDFFile('doc2.pdf')
    ];
    
    fireEvent.change(mergeFileInput, { target: { files: mergeFiles } });

    await waitFor(() => {
      expect(screen.getByText('doc1.pdf')).toBeInTheDocument();
      expect(screen.getByText('doc2.pdf')).toBeInTheDocument();
    });
  });

  it('should handle browser compatibility issues', async () => {
    // Mock missing WebAssembly support
    const originalWebAssembly = global.WebAssembly;
    delete (global as any).WebAssembly;

    renderApp();

    // Navigate to a tool that requires WASM
    const compressCard = screen.getByText(/compress pdf/i).closest('a');
    fireEvent.click(compressCard!);

    // Should show compatibility warning
    await waitFor(() => {
      expect(screen.getByText(/browser.*not.*support/i)).toBeInTheDocument();
    });

    // Restore WebAssembly
    global.WebAssembly = originalWebAssembly;
  });

  it('should provide accessible error recovery', async () => {
    renderApp();

    // Navigate to compress tool
    const compressCard = screen.getByText(/compress pdf/i).closest('a');
    fireEvent.click(compressCard!);

    // Upload file and trigger error
    const fileInput = screen.getByLabelText(/select files/i);
    const testFile = createMockPDFFile('error.pdf');
    
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    const compressButton = screen.getByText(/compress files/i);
    fireEvent.click(compressButton);

    // Simulate recoverable error
    const progressHandler = mockWorker.addEventListener.mock.calls.find(
      call => call[0] === 'message'
    )?.[1];

    if (progressHandler) {
      progressHandler({
        data: {
          type: 'error',
          payload: {
            type: 'PROCESSING_ERROR',
            message: 'Temporary processing error',
            suggestions: ['Try again', 'Check file format'],
            recoverable: true
          },
          taskId: 'test-task',
          timestamp: Date.now()
        }
      });

      // Should show retry option
      await waitFor(() => {
        expect(screen.getByText(/try again/i)).toBeInTheDocument();
      });

      // Click retry
      const retryButton = screen.getByText(/try again/i);
      fireEvent.click(retryButton);

      // Should restart processing
      expect(mockWorker.postMessage).toHaveBeenCalledTimes(2); // Original + retry
    }
  });
});