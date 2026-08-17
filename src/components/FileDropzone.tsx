/**
 * FileDropzone Component - Drag-and-drop file selection
 *
 * Validation lives here rather than in each tool page: quick PDF sniffing,
 * size cap, extension check, count cap. A page gets either a list of files it
 * can trust or a message it can show, never a half-validated mix.
 *
 * The default body is deliberately plain. Tool pages pass `children` with the
 * copy from the design (headline, size note, a SELECT FILES slab) - that
 * inner "button" is a span on purpose, because the dropzone itself is already
 * the button and nesting two would give the keyboard two stops for one action.
 */

import React, { useCallback, useState, useRef } from 'react';
import { FileUtils } from '@/lib/file-utils';
import { PDFValidator } from '@/lib/pdf-validator';
import { UploadIcon } from './icons';

export interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  onValidationError: (error: string, suggestions?: string[]) => void;
  multiple?: boolean;
  maxFiles?: number;
  maxFileSize?: number; // in bytes
  disabled?: boolean;
  acceptedTypes?: string[];
  className?: string;
  children?: React.ReactNode;
}

export interface FileDropzoneState {
  isDragOver: boolean;
  isValidating: boolean;
  dragCounter: number;
}

const FileDropzone: React.FC<FileDropzoneProps> = ({
  onFilesSelected,
  onValidationError,
  multiple = false,
  maxFiles = 10,
  maxFileSize = 500 * 1024 * 1024, // 500MB default
  disabled = false,
  acceptedTypes = ['.pdf'],
  className = '',
  children
}) => {
  const [state, setState] = useState<FileDropzoneState>({
    isDragOver: false,
    isValidating: false,
    dragCounter: 0
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropzoneRef = useRef<HTMLDivElement>(null);

  /**
   * Validate selected files
   */
  const validateFiles = useCallback(async (files: FileList | File[]): Promise<File[]> => {
    setState(prev => ({ ...prev, isValidating: true }));

    try {
      const fileArray = Array.from(files);

      // Check file count
      if (!multiple && fileArray.length > 1) {
        onValidationError('Only one file is allowed', ['Select a single PDF file']);
        return [];
      }

      if (fileArray.length > maxFiles) {
        onValidationError(
          `Too many files selected. Maximum is ${maxFiles}`,
          [`Select up to ${maxFiles} files`, 'Process files in smaller batches']
        );
        return [];
      }

      // Validate each file
      const validFiles: File[] = [];
      const errors: string[] = [];

      for (const file of fileArray) {
        // Quick validation first
        const quickValidation = await PDFValidator.quickValidate(file);
        if (!quickValidation.isValid) {
          errors.push(`${file.name}: ${quickValidation.message}`);
          continue;
        }

        // Check file size
        if (file.size > maxFileSize) {
          errors.push(
            `${file.name}: File too large (${FileUtils.formatFileSize(file.size)}). ` +
            `Maximum size is ${FileUtils.formatFileSize(maxFileSize)}`
          );
          continue;
        }

        // Check file type
        const extension = FileUtils.getFileExtension(file.name);
        if (!acceptedTypes.some(type => type.toLowerCase().includes(extension))) {
          errors.push(
            `${file.name}: Unsupported file type (.${extension}). ` +
            `Accepted types: ${acceptedTypes.join(', ')}`
          );
          continue;
        }

        validFiles.push(file);
      }

      // Report errors if any
      if (errors.length > 0) {
        const suggestions = [
          'Ensure all files are valid PDF documents',
          'Check file sizes and formats',
          'Try selecting files individually'
        ];
        onValidationError(errors.join('\n'), suggestions);
      }

      return validFiles;

    } catch (error) {
      onValidationError(
        `File validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ['Try selecting the files again', 'Check if files are accessible']
      );
      return [];
    } finally {
      setState(prev => ({ ...prev, isValidating: false }));
    }
  }, [multiple, maxFiles, maxFileSize, acceptedTypes, onValidationError]);

  /**
   * Handle file selection from input
   */
  const handleFileInput = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const validFiles = await validateFiles(files);
    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }

    // Reset input value to allow selecting the same files again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [validateFiles, onFilesSelected]);

  /**
   * Handle drag enter
   */
  const handleDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (disabled) return;

    setState(prev => ({
      ...prev,
      dragCounter: prev.dragCounter + 1,
      isDragOver: true
    }));
  }, [disabled]);

  /**
   * Handle drag leave
   */
  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (disabled) return;

    setState(prev => {
      const newCounter = prev.dragCounter - 1;
      return {
        ...prev,
        dragCounter: newCounter,
        isDragOver: newCounter > 0
      };
    });
  }, [disabled]);

  /**
   * Handle drag over
   */
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (disabled) return;

    // Set drag effect
    event.dataTransfer.dropEffect = 'copy';
  }, [disabled]);

  /**
   * Handle file drop
   */
  const handleDrop = useCallback(async (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (disabled) return;

    setState(prev => ({
      ...prev,
      isDragOver: false,
      dragCounter: 0
    }));

    const files = event.dataTransfer.files;
    if (files.length === 0) return;

    const validFiles = await validateFiles(files);
    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  }, [disabled, validateFiles, onFilesSelected]);

  /**
   * Handle click to open file dialog
   */
  const handleClick = useCallback(() => {
    if (disabled || state.isValidating) return;
    fileInputRef.current?.click();
  }, [disabled, state.isValidating]);

  /**
   * Handle keyboard interaction
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  // Generate CSS classes
  const dropzoneClasses = [
    'dropzone',
    'file-dropzone',
    state.isDragOver ? 'file-dropzone--drag-over' : '',
    disabled ? 'file-dropzone--disabled' : '',
    state.isValidating ? 'file-dropzone--validating' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={dropzoneRef}
      className={dropzoneClasses}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
      role="button"
      aria-label={`Drop ${multiple ? 'files' : 'file'} here or click to select`}
      aria-disabled={disabled}
      data-dragover={state.isDragOver}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes.join(',')}
        multiple={multiple}
        onChange={handleFileInput}
        style={{ display: 'none' }}
        disabled={disabled}
      />

      {children || (
        <>
          {state.isValidating ? (
            <div className="cluster">
              <span className="spinner" aria-hidden="true" />
              <span>Validating files...</span>
            </div>
          ) : (
            <>
              <UploadIcon size={26} style={{ color: 'var(--color-accent)' }} />
              <div>
                <p className="dropzone-title" style={{ margin: 0 }}>
                  {state.isDragOver
                    ? `Drop ${multiple ? 'files' : 'file'} here`
                    : `Drag and drop ${multiple ? 'PDF files' : 'a PDF file'} here`
                  }
                </p>
                <p className="text-muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
                  or click to select {multiple ? 'files' : 'a file'}
                </p>
              </div>
              <p className="text-muted" style={{ margin: 0, fontSize: 12 }}>
                Accepted: {acceptedTypes.join(', ')} •{' '}
                Max size: {FileUtils.formatFileSize(maxFileSize)}
                {multiple && ` • Max files: ${maxFiles}`}
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default FileDropzone;
