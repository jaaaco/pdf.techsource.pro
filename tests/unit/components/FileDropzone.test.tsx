/**
 * Unit Tests - FileDropzone Component
 * Tests file drag-and-drop and validation
 * Validates: Requirements 8.1, 8.2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FileDropzone from '@/components/FileDropzone';

// Mock the utilities
vi.mock('@/lib/pdf-validator', () => ({
  PDFValidator: {
    quickValidate: vi.fn(async (file: File) => {
      if (file.name.endsWith('.pdf')) {
        return { isValid: true };
      }
      return { isValid: false, message: 'Not a PDF file' };
    })
  }
}));

const createMockPDFFile = (name: string = 'test.pdf', size: number = 1024): File => {
  const content = '%PDF-1.4\ntest content';
  return new File([content], name, { type: 'application/pdf' });
};

describe('FileDropzone Component', () => {
  let onFilesSelected: ReturnType<typeof vi.fn>;
  let onValidationError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onFilesSelected = vi.fn();
    onValidationError = vi.fn();
  });

  describe('Rendering', () => {
    it('should render dropzone with default text', () => {
      render(
        <FileDropzone
          onFilesSelected={onFilesSelected}
          onValidationError={onValidationError}
        />
      );

      expect(screen.getByText(/drag and drop a pdf file here/i)).toBeInTheDocument();
      expect(screen.getByText(/or click to select a file/i)).toBeInTheDocument();
    });

    it('should render with multiple files text when multiple=true', () => {
      render(
        <FileDropzone
          onFilesSelected={onFilesSelected}
          onValidationError={onValidationError}
          multiple={true}
        />
      );

      expect(screen.getByText(/drag and drop pdf files here/i)).toBeInTheDocument();
      expect(screen.getByText(/or click to select files/i)).toBeInTheDocument();
    });

    it('should display file size and count limits', () => {
      render(
        <FileDropzone
          onFilesSelected={onFilesSelected}
          onValidationError={onValidationError}
          maxFiles={5}
          maxFileSize={10 * 1024 * 1024} // 10MB
          multiple={true}
        />
      );

      expect(screen.getByText(/max size: 10\.0 MB/i)).toBeInTheDocument();
      expect(screen.getByText(/max files: 5/i)).toBeInTheDocument();
    });

    it('should be disabled when disabled=true', () => {
      render(
        <FileDropzone
          onFilesSelected={onFilesSelected}
          onValidationError={onValidationError}
          disabled={true}
        />
      );

      const dropzone = screen.getByRole('button');
      expect(dropzone).toHaveAttribute('aria-disabled', 'true');
      expect(dropzone).toHaveStyle({ cursor: 'not-allowed' });
    });

    it('should render custom children when provided', () => {
      render(
        <FileDropzone
          onFilesSelected={onFilesSelected}
          onValidationError={onValidationError}
        >
          <div>Custom Content</div>
        </FileDropzone>
      );

      expect(screen.getByText('Custom Content')).toBeInTheDocument();
    });
  });

  describe('File Selection via Click', () => {
    it('should trigger file input on click', () => {
      render(
        <FileDropzone
          onFilesSelected={onFilesSelected}
          onValidationError={onValidationError}
        />
      );

      const dropzone = screen.getByRole('button');
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      const clickSpy = vi.spyOn(fileInput, 'click');

      fireEvent.click(dropzone);

      expect(clickSpy).toHaveBeenCalled();
    });

    it('should handle file selection from input', async () => {
      render(
        <FileDropzone
          onFilesSelected={onFilesSelected}
          onValidationError={onValidationError}
        />
      );

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const testFile = createMockPDFFile('test.pdf', 1024);

      fireEvent.change(fileInput, { target: { files: [testFile] } });

      await waitFor(() => {
        expect(onFilesSelected).toHaveBeenCalledWith([testFile]);
      });
    });

    it('should not open file input when disabled', () => {
      render(
        <FileDropzone
          onFilesSelected={onFilesSelected}
          onValidationError={onValidationError}
          disabled={true}
        />
      );

      const dropzone = screen.getByRole('button');
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      const clickSpy = vi.spyOn(fileInput, 'click');

      fireEvent.click(dropzone);

      expect(clickSpy).not.toHaveBeenCalled();
    });
  });

  describe('Drag and Drop', () => {
    it('should update state on drag enter', () => {
      render(
        <FileDropzone
          onFilesSelected={onFilesSelected}
          onValidationError={onValidationError}
        />
      );

      const dropzone = screen.getByRole('button');

      fireEvent.dragEnter(dropzone, {
        dataTransfer: { files: [] }
      });

      expect(dropzone).toHaveClass('file-dropzone--drag-over');
    });

    it('should reset state on drag leave', () => {
      render(
        <FileDropzone
          onFilesSelected={onFilesSelected}
          onValidationError={onValidationError}
        />
      );

      const dropzone = screen.getByRole('button');

      fireEvent.dragEnter(dropzone);
      fireEvent.dragLeave(dropzone);

      expect(dropzone).not.toHaveClass('file-dropzone--drag-over');
    });

    it('should handle file drop', async () => {
      render(
        <FileDropzone
          onFilesSelected={onFilesSelected}
          onValidationError={onValidationError}
        />
      );

      const dropzone = screen.getByRole('button');
      const testFile = createMockPDFFile('dropped.pdf', 2048);

      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [testFile]
        }
      });

      await waitFor(() => {
        expect(onFilesSelected).toHaveBeenCalledWith([testFile]);
      });
    });

    it('should not handle drop when disabled', async () => {
      render(
        <FileDropzone
          onFilesSelected={onFilesSelected}
          onValidationError={onValidationError}
          disabled={true}
        />
      );

      const dropzone = screen.getByRole('button');
      const testFile = createMockPDFFile('test.pdf', 1024);

      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [testFile]
        }
      });

      await waitFor(() => {
        expect(onFilesSelected).not.toHaveBeenCalled();
      });
    });
  });

  describe('Validation', () => {
    it('should validate file count for single file mode', async () => {
      render(
        <FileDropzone
          onFilesSelected={onFilesSelected}
          onValidationError={onValidationError}
          multiple={false}
        />
      );

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const files = [
        createMockPDFFile('file1.pdf'),
        createMockPDFFile('file2.pdf')
      ];

      fireEvent.change(fileInput, { target: { files } });

      await waitFor(() => {
        expect(onValidationError).toHaveBeenCalledWith(
          'Only one file is allowed',
          expect.any(Array)
        );
        expect(onFilesSelected).not.toHaveBeenCalled();
      });
    });

    it('should validate maximum file count', async () => {
      render(
        <FileDropzone
          onFilesSelected={onFilesSelected}
          onValidationError={onValidationError}
          multiple={true}
          maxFiles={2}
        />
      );

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const files = [
        createMockPDFFile('file1.pdf'),
        createMockPDFFile('file2.pdf'),
        createMockPDFFile('file3.pdf')
      ];

      fireEvent.change(fileInput, { target: { files } });

      await waitFor(() => {
        expect(onValidationError).toHaveBeenCalledWith(
          expect.stringContaining('Too many files'),
          expect.any(Array)
        );
      });
    });

    it('should validate file size', async () => {
      render(
        <FileDropzone
          onFilesSelected={onFilesSelected}
          onValidationError={onValidationError}
          maxFileSize={500} // 500 bytes
        />
      );

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const largeFile = createMockPDFFile('large.pdf', 1000);

      fireEvent.change(fileInput, { target: { files: [largeFile] } });

      await waitFor(() => {
        expect(onValidationError).toHaveBeenCalled();
      }, { timeout: 2000 });

      expect(onFilesSelected).not.toHaveBeenCalled();
    });

    it('should validate file type', async () => {
      render(
        <FileDropzone
          onFilesSelected={onFilesSelected}
          onValidationError={onValidationError}
        />
      );

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const invalidFile = new File(['content'], 'document.txt', { type: 'text/plain' });

      fireEvent.change(fileInput, { target: { files: [invalidFile] } });

      await waitFor(() => {
        expect(onValidationError).toHaveBeenCalled();
        expect(onFilesSelected).not.toHaveBeenCalled();
      });
    });

    it('should accept valid PDF files', async () => {
      render(
        <FileDropzone
          onFilesSelected={onFilesSelected}
          onValidationError={onValidationError}
        />
      );

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const validFile = createMockPDFFile('valid.pdf', 1024);

      fireEvent.change(fileInput, { target: { files: [validFile] } });

      await waitFor(() => {
        expect(onFilesSelected).toHaveBeenCalledWith([validFile]);
        expect(onValidationError).not.toHaveBeenCalled();
      });
    });

    it('should show validating state during validation', async () => {
      render(
        <FileDropzone
          onFilesSelected={onFilesSelected}
          onValidationError={onValidationError}
        />
      );

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const testFile = createMockPDFFile('test.pdf', 1024);

      fireEvent.change(fileInput, { target: { files: [testFile] } });

      // Should briefly show validating state
      await waitFor(() => {
        const dropzone = screen.getByRole('button');
        expect(dropzone.classList.contains('file-dropzone--validating') ||
               screen.queryByText(/validating/i)).toBeTruthy();
      }, { timeout: 100 });
    });
  });

  describe('Keyboard Accessibility', () => {
    it('should open file dialog on Enter key', () => {
      render(
        <FileDropzone
          onFilesSelected={onFilesSelected}
          onValidationError={onValidationError}
        />
      );

      const dropzone = screen.getByRole('button');
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      const clickSpy = vi.spyOn(fileInput, 'click');

      fireEvent.keyDown(dropzone, { key: 'Enter', code: 'Enter' });

      expect(clickSpy).toHaveBeenCalled();
    });

    it('should open file dialog on Space key', () => {
      render(
        <FileDropzone
          onFilesSelected={onFilesSelected}
          onValidationError={onValidationError}
        />
      );

      const dropzone = screen.getByRole('button');
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      const clickSpy = vi.spyOn(fileInput, 'click');

      fireEvent.keyDown(dropzone, { key: ' ', code: 'Space' });

      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe('Accessibility Attributes', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <FileDropzone
          onFilesSelected={onFilesSelected}
          onValidationError={onValidationError}
        />
      );

      const dropzone = screen.getByRole('button');

      expect(dropzone).toHaveAttribute('aria-label');
      expect(dropzone).toHaveAttribute('aria-disabled', 'false');
      expect(dropzone).toHaveAttribute('tabIndex', '0');
    });

    it('should update aria-disabled when disabled', () => {
      render(
        <FileDropzone
          onFilesSelected={onFilesSelected}
          onValidationError={onValidationError}
          disabled={true}
        />
      );

      const dropzone = screen.getByRole('button');

      expect(dropzone).toHaveAttribute('aria-disabled', 'true');
      expect(dropzone).toHaveAttribute('tabIndex', '-1');
    });
  });
});
