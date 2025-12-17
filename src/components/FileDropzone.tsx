/**
 * FileDropzone Component - Drag-and-drop file upload interface
 * Validates: Requirements 8.1, 8.2
 */

import React, { useCallback, useState, useRef } from 'react';
import { FileUtils } from '@/lib/file-utils';
import { PDFValidator } from '@/lib/pdf-validator';

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
      style={{
        border: '2px dashed #ccc',
        borderRadius: '8px',
        padding: '2rem',
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: state.isDragOver ? '#f0f8ff' : 'transparent',
        borderColor: state.isDragOver ? '#007bff' : '#ccc',
        opacity: disabled ? 0.6 : 1,
        transition: 'all 0.2s ease-in-out',
        minHeight: '120px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem'
      }}
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

      {/* Content */}
      {children || (
        <>
          {state.isValidating ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  border: '2px solid #007bff',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}
              />
              <span>Validating files...</span>
            </div>
          ) : (
            <>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                📄
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 'bold' }}>
                  {state.isDragOver
                    ? `Drop ${multiple ? 'files' : 'file'} here`
                    : `Drag and drop ${multiple ? 'PDF files' : 'a PDF file'} here`
                  }
                </p>
                <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.9rem' }}>
                  or click to select {multiple ? 'files' : 'a file'}
                </p>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#888' }}>
                <p style={{ margin: 0 }}>
                  Accepted: {acceptedTypes.join(', ')} • 
                  Max size: {FileUtils.formatFileSize(maxFileSize)}
                  {multiple && ` • Max files: ${maxFiles}`}
                </p>
              </div>
            </>
          )}
        </>
      )}

      {/* CSS Animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .file-dropzone {
          position: relative;
        }
        
        .file-dropzone:focus {
          outline: 2px solid #007bff;
          outline-offset: 2px;
        }
        
        .file-dropzone--drag-over {
          transform: scale(1.02);
        }
        
        .file-dropzone--disabled {
          cursor: not-allowed !important;
        }
        
        .file-dropzone--validating {
          pointer-events: none;
        }
      `}</style>
    </div>
  );
};

export default FileDropzone;