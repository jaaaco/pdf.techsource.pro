/**
 * PDF Validator - Specialized PDF validation and analysis
 * Validates: Requirements 8.2, 5.1
 */

import { FileUtils } from './file-utils';

export interface PDFValidationOptions {
  checkStructure?: boolean;
  checkEncryption?: boolean;
  checkCorruption?: boolean;
  maxFileSize?: number;
}

export interface PDFStructureInfo {
  isValid: boolean;
  version?: string;
  pageCount?: number;
  isEncrypted?: boolean;
  hasImages?: boolean;
  hasText?: boolean;
  fileSize: number;
  errors: string[];
  warnings: string[];
}

export class PDFValidator {
  private static readonly PDF_VERSION_REGEX = /%PDF-(\d+\.\d+)/;
  private static readonly PAGE_COUNT_PATTERNS = [
    /\/Count\s+(\d+)/g,
    /\/N\s+(\d+)/g,
    /\/Kids\s*\[\s*([^\]]+)\]/g
  ];

  /**
   * Comprehensive PDF validation
   */
  static async validatePDF(
    file: File, 
    options: PDFValidationOptions = {}
  ): Promise<PDFStructureInfo> {
    const result: PDFStructureInfo = {
      isValid: false,
      fileSize: file.size,
      errors: [],
      warnings: []
    };

    try {
      // Basic file validation first
      const basicValidation = await FileUtils.validatePDFFile(file);
      if (!basicValidation.isValid) {
        result.errors.push(basicValidation.error || 'Invalid PDF file');
        return result;
      }

      // Read file content for structure analysis
      const arrayBuffer = await FileUtils.fileToArrayBuffer(file);
      const content = new TextDecoder('latin1').decode(arrayBuffer);

      // Check PDF structure if requested
      if (options.checkStructure !== false) {
        await this.checkPDFStructure(content, result);
      }

      // Check encryption if requested
      if (options.checkEncryption !== false) {
        this.checkEncryption(content, result);
      }

      // Check for corruption if requested
      if (options.checkCorruption !== false) {
        this.checkCorruption(content, result);
      }

      // Set overall validity
      result.isValid = result.errors.length === 0;

    } catch (error) {
      result.errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Check PDF structure and extract metadata
   */
  private static async checkPDFStructure(content: string, result: PDFStructureInfo): Promise<void> {
    try {
      // Extract PDF version
      const versionMatch = content.match(this.PDF_VERSION_REGEX);
      if (versionMatch) {
        result.version = versionMatch[1];
        
        // Check if version is supported (1.0 to 2.0)
        const version = parseFloat(versionMatch[1]);
        if (version < 1.0 || version > 2.0) {
          result.warnings.push(`Unusual PDF version: ${versionMatch[1]}`);
        }
      } else {
        result.errors.push('PDF version not found or invalid');
        return;
      }

      // Extract page count
      result.pageCount = this.extractPageCount(content);
      if (result.pageCount === 0) {
        result.errors.push('Could not determine page count');
      } else if (result.pageCount > 10000) {
        result.warnings.push(`Very large document: ${result.pageCount} pages`);
      }

      // Check for content types
      result.hasImages = this.hasImages(content);
      result.hasText = this.hasText(content);

      // Validate essential PDF structures
      this.validatePDFStructures(content, result);

    } catch (error) {
      result.errors.push(`Structure analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract page count from PDF content
   */
  private static extractPageCount(content: string): number {
    // Try multiple patterns to find page count
    for (const pattern of this.PAGE_COUNT_PATTERNS) {
      const matches = Array.from(content.matchAll(pattern));
      
      if (pattern === this.PAGE_COUNT_PATTERNS[0]) { // /Count pattern
        for (const match of matches) {
          const count = parseInt(match[1], 10);
          if (count > 0) return count;
        }
      } else if (pattern === this.PAGE_COUNT_PATTERNS[2]) { // /Kids pattern
        // Count individual page references
        let maxCount = 0;
        for (const match of matches) {
          const kids = match[1].split(/\s+/).filter(k => k.includes('R')).length;
          maxCount = Math.max(maxCount, kids);
        }
        if (maxCount > 0) return maxCount;
      }
    }

    // Fallback: count page objects
    const pageObjectMatches = content.match(/\/Type\s*\/Page[^s]/g);
    return pageObjectMatches ? pageObjectMatches.length : 1;
  }

  /**
   * Check if PDF contains images
   */
  private static hasImages(content: string): boolean {
    const imagePatterns = [
      /\/Type\s*\/XObject/,
      /\/Subtype\s*\/Image/,
      /\/Filter\s*\/DCTDecode/,
      /\/Filter\s*\/JPXDecode/,
      /\/Filter\s*\/CCITTFaxDecode/
    ];

    return imagePatterns.some(pattern => pattern.test(content));
  }

  /**
   * Check if PDF contains text
   */
  private static hasText(content: string): boolean {
    const textPatterns = [
      /\/Type\s*\/Font/,
      /BT\s+.*?ET/s,
      /Tj\s*$/m,
      /TJ\s*$/m
    ];

    return textPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Check for PDF encryption
   */
  private static checkEncryption(content: string, result: PDFStructureInfo): void {
    const encryptionPatterns = [
      /\/Encrypt\s+\d+\s+\d+\s+R/,
      /\/Filter\s*\/Standard/,
      /\/V\s+[1-4]/
    ];

    result.isEncrypted = encryptionPatterns.some(pattern => pattern.test(content));
    
    if (result.isEncrypted) {
      result.errors.push('PDF is encrypted/password protected');
    }
  }

  /**
   * Check for PDF corruption
   */
  private static checkCorruption(content: string, result: PDFStructureInfo): void {
    const corruptionChecks = [
      {
        test: () => !content.startsWith('%PDF-'),
        error: 'Missing PDF header'
      },
      {
        test: () => !content.includes('%%EOF'),
        error: 'Missing PDF footer'
      },
      {
        test: () => !content.includes('/Root'),
        error: 'Missing document catalog'
      },
      {
        test: () => content.includes('null') && content.split('null').length > 100,
        warning: 'Many null objects detected (possible corruption)'
      },
      {
        test: () => {
          const xrefMatches = content.match(/xref/g);
          return !xrefMatches || xrefMatches.length === 0;
        },
        warning: 'Cross-reference table not found'
      }
    ];

    for (const check of corruptionChecks) {
      if (check.test()) {
        if ('error' in check) {
          result.errors.push(check.error);
        } else if ('warning' in check) {
          result.warnings.push(check.warning);
        }
      }
    }
  }

  /**
   * Validate essential PDF structures
   */
  private static validatePDFStructures(content: string, result: PDFStructureInfo): void {
    const requiredStructures = [
      { pattern: /\/Type\s*\/Catalog/, name: 'Document Catalog' },
      { pattern: /\/Type\s*\/Pages/, name: 'Page Tree' },
      { pattern: /\/Type\s*\/Page[^s]/, name: 'Page Objects' }
    ];

    for (const structure of requiredStructures) {
      if (!structure.pattern.test(content)) {
        result.errors.push(`Missing required structure: ${structure.name}`);
      }
    }
  }

  /**
   * Validate page ranges for splitting
   */
  static validatePageRanges(ranges: string, totalPages: number): { isValid: boolean; errors: string[]; parsedRanges: Array<{start: number, end: number}> } {
    const errors: string[] = [];
    const parsedRanges: Array<{start: number, end: number}> = [];

    if (!ranges.trim()) {
      errors.push('Page ranges cannot be empty');
      return { isValid: false, errors, parsedRanges };
    }

    // Split by comma and process each range
    const rangeParts = ranges.split(',').map(part => part.trim());

    for (const part of rangeParts) {
      if (!part) continue;

      // Check if it's a single page or range
      if (part.includes('-')) {
        // Range format: "1-5"
        const [startStr, endStr] = part.split('-').map(s => s.trim());
        
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);

        if (isNaN(start) || isNaN(end)) {
          errors.push(`Invalid range format: "${part}"`);
          continue;
        }

        if (start < 1 || end < 1) {
          errors.push(`Page numbers must be positive: "${part}"`);
          continue;
        }

        if (start > totalPages || end > totalPages) {
          errors.push(`Page numbers exceed document length (${totalPages}): "${part}"`);
          continue;
        }

        if (start > end) {
          errors.push(`Invalid range (start > end): "${part}"`);
          continue;
        }

        parsedRanges.push({ start, end });
      } else {
        // Single page
        const page = parseInt(part, 10);

        if (isNaN(page)) {
          errors.push(`Invalid page number: "${part}"`);
          continue;
        }

        if (page < 1) {
          errors.push(`Page numbers must be positive: "${part}"`);
          continue;
        }

        if (page > totalPages) {
          errors.push(`Page number exceeds document length (${totalPages}): "${part}"`);
          continue;
        }

        parsedRanges.push({ start: page, end: page });
      }
    }

    // Check for overlapping ranges
    const sortedRanges = parsedRanges.sort((a, b) => a.start - b.start);
    for (let i = 1; i < sortedRanges.length; i++) {
      const prev = sortedRanges[i - 1];
      const curr = sortedRanges[i];
      
      if (curr.start <= prev.end) {
        errors.push(`Overlapping ranges detected: ${prev.start}-${prev.end} and ${curr.start}-${curr.end}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      parsedRanges: sortedRanges
    };
  }

  /**
   * Quick validation for file drop/selection
   */
  static async quickValidate(file: File): Promise<{ isValid: boolean; message?: string }> {
    // Quick checks without full content analysis
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return { isValid: false, message: 'File must be a PDF' };
    }

    if (file.size === 0) {
      return { isValid: false, message: 'File is empty' };
    }

    if (file.size > 500 * 1024 * 1024) { // 500MB
      return { isValid: false, message: 'File too large (max 500MB)' };
    }

    // Check PDF signature
    try {
      const buffer = await file.slice(0, 4).arrayBuffer();
      const signature = new Uint8Array(buffer);
      const isPDF = signature[0] === 0x25 && signature[1] === 0x50 && 
                   signature[2] === 0x44 && signature[3] === 0x46; // %PDF

      if (!isPDF) {
        return { isValid: false, message: 'Not a valid PDF file' };
      }
    } catch {
      return { isValid: false, message: 'Could not read file' };
    }

    return { isValid: true };
  }
}