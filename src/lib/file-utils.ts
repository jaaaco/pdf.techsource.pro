/**
 * File Utilities - File handling, validation, and processing utilities
 * Validates: Requirements 8.2, 5.1
 */

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  fileType?: string;
  size?: number;
  pageCount?: number;
}

export interface PDFInfo {
  pageCount: number;
  title?: string;
  author?: string;
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
  fileSize: number;
  version?: string;
}

export class FileValidationError extends Error {
  constructor(
    message: string,
    public fileType?: string,
    public suggestions: string[] = []
  ) {
    super(message);
    this.name = 'FileValidationError';
  }
}

export class FileUtils {
  // PDF file signature (magic bytes)
  private static readonly PDF_SIGNATURES = [
    new Uint8Array([0x25, 0x50, 0x44, 0x46]), // %PDF
  ];

  // Maximum file size (500MB)
  private static readonly MAX_FILE_SIZE = 500 * 1024 * 1024;

  /**
   * Validate if file is a valid PDF
   */
  static async validatePDFFile(file: File): Promise<FileValidationResult> {
    try {
      // Check file extension
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        return {
          isValid: false,
          error: 'File must have .pdf extension',
          fileType: this.getFileExtension(file.name)
        };
      }

      // Check file size
      if (file.size === 0) {
        return {
          isValid: false,
          error: 'File is empty',
          size: file.size
        };
      }

      if (file.size > this.MAX_FILE_SIZE) {
        return {
          isValid: false,
          error: `File too large. Maximum size is ${this.formatFileSize(this.MAX_FILE_SIZE)}`,
          size: file.size
        };
      }

      // Check PDF signature
      const isValidPDF = await this.checkPDFSignature(file);
      if (!isValidPDF) {
        return {
          isValid: false,
          error: 'File is not a valid PDF document',
          fileType: 'unknown'
        };
      }

      // Try to get basic PDF info
      const pdfInfo = await this.getPDFInfo(file);
      
      return {
        isValid: true,
        fileType: 'pdf',
        size: file.size,
        pageCount: pdfInfo?.pageCount
      };

    } catch (error) {
      return {
        isValid: false,
        error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        size: file.size
      };
    }
  }

  /**
   * Check PDF file signature (magic bytes)
   */
  private static async checkPDFSignature(file: File): Promise<boolean> {
    try {
      const buffer = await this.readFileBytes(file, 0, 4);
      const signature = new Uint8Array(buffer);
      
      return this.PDF_SIGNATURES.some(pdfSig => 
        signature.length >= pdfSig.length &&
        pdfSig.every((byte, index) => signature[index] === byte)
      );
    } catch {
      return false;
    }
  }

  /**
   * Read specific bytes from file
   */
  private static readFileBytes(file: File, start: number, length: number): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const blob = file.slice(start, start + length);
      
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read file as ArrayBuffer'));
        }
      };
      
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
  }

  /**
   * Get basic PDF information
   */
  static async getPDFInfo(file: File): Promise<PDFInfo | null> {
    try {
      // This is a simplified PDF info extraction
      // In a real implementation, you'd use a PDF library like pdf-lib
      const arrayBuffer = await this.fileToArrayBuffer(file);
      const text = new TextDecoder('latin1').decode(arrayBuffer.slice(0, 2048));
      
      // Extract page count using simple regex (not reliable for all PDFs)
      const pageCountMatch = text.match(/\/Count\s+(\d+)/);
      const pageCount = pageCountMatch ? parseInt(pageCountMatch[1], 10) : 1;
      
      // Extract version
      const versionMatch = text.match(/%PDF-(\d+\.\d+)/);
      const version = versionMatch ? versionMatch[1] : undefined;
      
      return {
        pageCount,
        fileSize: file.size,
        version
      };
    } catch (error) {
      console.warn('Failed to extract PDF info:', error);
      return {
        pageCount: 1, // Default fallback
        fileSize: file.size
      };
    }
  }

  /**
   * Convert File to ArrayBuffer
   */
  static fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read file as ArrayBuffer'));
        }
      };
      
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Convert ArrayBuffer to Uint8Array
   */
  static arrayBufferToUint8Array(buffer: ArrayBuffer): Uint8Array {
    return new Uint8Array(buffer);
  }

  /**
   * Create File from Uint8Array
   */
  static uint8ArrayToFile(data: Uint8Array, filename: string, mimeType: string = 'application/pdf'): File {
    const blob = new Blob([data], { type: mimeType });
    return new File([blob], filename, { type: mimeType });
  }

  /**
   * Create download URL for file data
   */
  static createDownloadURL(data: Uint8Array, mimeType: string = 'application/pdf'): string {
    const blob = new Blob([data], { type: mimeType });
    return URL.createObjectURL(blob);
  }

  /**
   * Trigger file download
   */
  static downloadFile(data: Uint8Array, filename: string, mimeType: string = 'application/pdf'): void {
    const url = this.createDownloadURL(data, mimeType);
    const link = document.createElement('a');
    
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  /**
   * Format file size to human-readable string
   */
  static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Get file extension from filename
   */
  static getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.slice(lastDot + 1).toLowerCase() : '';
  }

  /**
   * Generate safe filename
   */
  static generateSafeFilename(originalName: string, suffix?: string): string {
    // Remove extension
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
    
    // Clean filename (remove special characters)
    const cleanName = nameWithoutExt.replace(/[^a-zA-Z0-9\-_\s]/g, '');
    
    // Add suffix if provided
    const finalName = suffix ? `${cleanName}_${suffix}` : cleanName;
    
    // Add PDF extension
    return `${finalName}.pdf`;
  }

  /**
   * Validate multiple files
   */
  static async validateMultipleFiles(files: File[]): Promise<FileValidationResult[]> {
    const results: FileValidationResult[] = [];
    
    for (const file of files) {
      const result = await this.validatePDFFile(file);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Check if files are valid for merging
   */
  static validateFilesForMerging(files: File[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (files.length < 2) {
      errors.push('At least 2 files are required for merging');
    }
    
    if (files.length > 50) {
      errors.push('Too many files selected. Maximum is 50 files');
    }
    
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > this.MAX_FILE_SIZE * 2) { // Allow larger total for merging
      errors.push(`Total file size too large. Maximum is ${this.formatFileSize(this.MAX_FILE_SIZE * 2)}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Estimate processing time based on file size and operation
   */
  static estimateProcessingTime(fileSize: number, operation: 'compress' | 'merge' | 'split' | 'ocr'): number {
    // Rough estimates in seconds per MB
    const timePerMB = {
      compress: 2,  // 2 seconds per MB
      merge: 0.5,   // 0.5 seconds per MB
      split: 0.3,   // 0.3 seconds per MB
      ocr: 10       // 10 seconds per MB (OCR is slow)
    };
    
    const fileSizeMB = fileSize / (1024 * 1024);
    return Math.ceil(fileSizeMB * timePerMB[operation]);
  }

  /**
   * Check browser compatibility for PDF processing
   */
  static checkBrowserCompatibility(): { isCompatible: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Check for required APIs
    if (!window.Worker) {
      issues.push('Web Workers not supported');
    }
    
    if (!window.WebAssembly) {
      issues.push('WebAssembly not supported');
    }
    
    if (!window.FileReader) {
      issues.push('FileReader API not supported');
    }
    
    if (!window.Blob) {
      issues.push('Blob API not supported');
    }
    
    if (!window.URL || !window.URL.createObjectURL) {
      issues.push('URL.createObjectURL not supported');
    }
    
    return {
      isCompatible: issues.length === 0,
      issues
    };
  }
}