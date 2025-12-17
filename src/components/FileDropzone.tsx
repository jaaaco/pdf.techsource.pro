/**
 * FileDropzone Component - Drag-and-drop file upload interface
 * Modern 2026 design system integration
 */

import React, { useCallback, useState, useRef } from 'react';
import {
  Box,
  Typography,
  alpha,
  useTheme,
  Paper,
  CircularProgress
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  CheckCircle as ValidIcon,
} from '@mui/icons-material';
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
  children
}) => {
  const [state, setState] = useState<FileDropzoneState>({
    isDragOver: false,
    isValidating: false,
    dragCounter: 0
  });

  const theme = useTheme();
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
   * Handle drag events
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

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    event.dataTransfer.dropEffect = 'copy';
  }, [disabled]);

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

  const handleClick = useCallback(() => {
    if (disabled || state.isValidating) return;
    fileInputRef.current?.click();
  }, [disabled, state.isValidating]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  return (
    <Paper
      ref={dropzoneRef}
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
      sx={{
        p: 6,
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: state.isDragOver
          ? alpha(theme.palette.primary.main, 0.05)
          : 'rgba(255, 255, 255, 0.4)',
        backdropFilter: 'blur(12px)',
        border: `2px dashed ${state.isDragOver ? theme.palette.primary.main : alpha(theme.palette.text.disabled, 0.3)}`,
        borderRadius: 6,
        opacity: disabled ? 0.6 : 1,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        minHeight: '240px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        transform: state.isDragOver ? 'scale(1.01)' : 'scale(1)',
        boxShadow: state.isDragOver
          ? `0 20px 25px -5px ${alpha(theme.palette.primary.main, 0.1)}`
          : '0 4px 6px -1px rgb(0 0 0 / 0.05)',
        '&:hover': {
          borderColor: theme.palette.primary.main,
          background: alpha(theme.palette.primary.main, 0.02),
        },
        '&:focus': {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: '4px',
        }
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
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={40} thickness={4} />
              <Typography variant="body1" fontWeight={600} color="text.secondary">
                Analyzing Documents...
              </Typography>
            </Box>
          ) : (
            <>
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 1,
                  color: 'primary.main',
                  transition: 'all 0.3s ease',
                  transform: state.isDragOver ? 'translateY(-10px)' : 'none'
                }}
              >
                {state.isDragOver ? <ValidIcon sx={{ fontSize: 40 }} /> : <UploadIcon sx={{ fontSize: 40 }} />}
              </Box>

              <Box>
                <Typography variant="h5" fontWeight={800} gutterBottom>
                  {state.isDragOver
                    ? `Release to Begin`
                    : `Drop your PDF${multiple ? 's' : ''} here`
                  }
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  or <span style={{ color: theme.palette.primary.main, fontWeight: 700, textDecoration: 'underline' }}>browse files</span> from your device
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Chip
                  label={`Max ${FileUtils.formatFileSize(maxFileSize)}`}
                  sx={{ fontWeight: 600, color: 'text.disabled', border: `1px solid ${alpha(theme.palette.text.disabled, 0.2)}` }}
                />
                <Chip
                  label="PDF Only"
                  sx={{ fontWeight: 600, color: 'text.disabled', border: `1px solid ${alpha(theme.palette.text.disabled, 0.2)}` }}
                />
              </Box>
            </>
          )}
        </>
      )}
    </Paper>
  );
};

interface ChipProps {
  label: string;
  sx: object;
}

const Chip: React.FC<ChipProps> = ({ label, sx }) => {
  return (
    <Box
      sx={{
        px: 1.5,
        py: 0.5,
        borderRadius: 2,
        fontSize: '0.75rem',
        ...sx
      }}
    >
      {label}
    </Box>
  );
};

export default FileDropzone;