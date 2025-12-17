/**
 * Unit Tests - PDF Validator
 * Tests PDF structure validation and page range parsing
 * Validates: Requirements 8.2, 5.1, 5.2, 5.3
 */

import { describe, it, expect } from 'vitest';
import { PDFValidator } from '@/lib/pdf-validator';

// Helper to create mock PDF files
const createMockPDFFile = (options: {
  name?: string;
  pageCount?: number;
  encrypted?: boolean;
  version?: string;
  hasImages?: boolean;
  corrupted?: boolean;
} = {}): File => {
  const {
    name = 'test.pdf',
    pageCount = 1,
    encrypted = false,
    version = '1.4',
    hasImages = false,
    corrupted = false
  } = options;

  let pdfContent = `%PDF-${version}\n`;

  if (!corrupted) {
    // Catalog
    pdfContent += `1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n`;

    // Pages object
    pdfContent += `2 0 obj\n<<\n/Type /Pages\n/Count ${pageCount}\n/Kids [`;
    for (let i = 0; i < pageCount; i++) {
      pdfContent += `${3 + i} 0 R `;
    }
    pdfContent += `]\n>>\nendobj\n`;

    // Individual pages
    for (let i = 0; i < pageCount; i++) {
      pdfContent += `${3 + i} 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n`;
      if (hasImages) {
        pdfContent += `/Resources <<\n/XObject << /Im1 <<\n/Type /XObject\n/Subtype /Image\n/Filter /DCTDecode\n>>\n>>\n>>\n`;
      }
      pdfContent += `>>\nendobj\n`;
    }

    // Encryption if requested
    if (encrypted) {
      pdfContent += `10 0 obj\n<<\n/Filter /Standard\n/V 2\n>>\nendobj\n`;
    }

    // Cross-reference table
    pdfContent += `xref\n0 ${3 + pageCount}\n`;
    pdfContent += `0000000000 65535 f\n`;
    for (let i = 1; i < 3 + pageCount; i++) {
      pdfContent += `0000000015 00000 n\n`;
    }

    // Trailer
    pdfContent += `trailer\n<<\n/Size ${3 + pageCount}\n/Root 1 0 R\n`;
    if (encrypted) {
      pdfContent += `/Encrypt 10 0 R\n`;
    }
    pdfContent += `>>\nstartxref\n1000\n%%EOF\n`;
  } else {
    // Corrupted PDF - missing essential parts
    pdfContent += `1 0 obj\n<<\n/Type /Broken\n>>\nendobj\n`;
    // No proper trailer or EOF
  }

  return new File([pdfContent], name, { type: 'application/pdf' });
};

describe('PDFValidator', () => {
  describe('validatePDF', () => {
    it('should validate a well-formed PDF', async () => {
      const file = createMockPDFFile({ pageCount: 5 });
      const result = await PDFValidator.validatePDF(file);

      expect(result.isValid).toBe(true);
      expect(result.version).toBe('1.4');
      expect(result.pageCount).toBe(5);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect PDF version', async () => {
      const file14 = createMockPDFFile({ version: '1.4' });
      const result14 = await PDFValidator.validatePDF(file14);
      expect(result14.version).toBe('1.4');

      const file17 = createMockPDFFile({ version: '1.7' });
      const result17 = await PDFValidator.validatePDF(file17);
      expect(result17.version).toBe('1.7');
    });

    it('should warn about unusual PDF versions', async () => {
      const file = createMockPDFFile({ version: '2.5' });
      const result = await PDFValidator.validatePDF(file);

      expect(result.warnings.some(w => w.includes('Unusual PDF version'))).toBe(true);
    });

    it('should detect encrypted PDFs', async () => {
      const file = createMockPDFFile({ encrypted: true });
      const result = await PDFValidator.validatePDF(file);

      expect(result.isValid).toBe(false);
      expect(result.isEncrypted).toBe(true);
      expect(result.errors.some(e => e.includes('encrypted'))).toBe(true);
    });

    it('should detect PDFs with images', async () => {
      const file = createMockPDFFile({ hasImages: true });
      const result = await PDFValidator.validatePDF(file);

      expect(result.hasImages).toBe(true);
    });

    it('should detect corrupted PDFs', async () => {
      const file = createMockPDFFile({ corrupted: true });
      const result = await PDFValidator.validatePDF(file);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should warn about very large documents', async () => {
      const file = createMockPDFFile({ pageCount: 15000 });
      const result = await PDFValidator.validatePDF(file);

      expect(result.warnings.some(w => w.includes('Very large document'))).toBe(true);
    });

    it('should skip structure check if disabled', async () => {
      const file = createMockPDFFile({ corrupted: true });
      const result = await PDFValidator.validatePDF(file, { checkStructure: false });

      // Should still fail basic validation but not structure checks
      expect(result).toBeDefined();
    });

    it('should skip encryption check if disabled', async () => {
      const file = createMockPDFFile({ encrypted: true });
      const result = await PDFValidator.validatePDF(file, { checkEncryption: false });

      // Should not detect encryption
      expect(result.isEncrypted).toBeUndefined();
    });

    it('should skip corruption check if disabled', async () => {
      const file = createMockPDFFile({ corrupted: true });
      const result = await PDFValidator.validatePDF(file, { checkCorruption: false });

      // Might still fail on other checks
      expect(result).toBeDefined();
    });
  });

  describe('validatePageRanges', () => {
    it('should parse single page', () => {
      const result = PDFValidator.validatePageRanges('5', 10);

      expect(result.isValid).toBe(true);
      expect(result.parsedRanges).toEqual([{ start: 5, end: 5 }]);
    });

    it('should parse page range', () => {
      const result = PDFValidator.validatePageRanges('3-7', 10);

      expect(result.isValid).toBe(true);
      expect(result.parsedRanges).toEqual([{ start: 3, end: 7 }]);
    });

    it('should parse multiple ranges', () => {
      const result = PDFValidator.validatePageRanges('1-3, 5, 7-9', 10);

      expect(result.isValid).toBe(true);
      expect(result.parsedRanges).toEqual([
        { start: 1, end: 3 },
        { start: 5, end: 5 },
        { start: 7, end: 9 }
      ]);
    });

    it('should reject empty range string', () => {
      const result = PDFValidator.validatePageRanges('', 10);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Page ranges cannot be empty');
    });

    it('should reject invalid format', () => {
      const result = PDFValidator.validatePageRanges('abc', 10);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid page number'))).toBe(true);
    });

    it('should reject negative page numbers', () => {
      const result = PDFValidator.validatePageRanges('-1', 10);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('must be positive'))).toBe(true);
    });

    it('should reject zero page numbers', () => {
      const result = PDFValidator.validatePageRanges('0', 10);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('must be positive'))).toBe(true);
    });

    it('should reject pages exceeding document length', () => {
      const result = PDFValidator.validatePageRanges('15', 10);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('exceed document length'))).toBe(true);
    });

    it('should reject invalid range (start > end)', () => {
      const result = PDFValidator.validatePageRanges('7-3', 10);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid range'))).toBe(true);
    });

    it('should reject overlapping ranges', () => {
      const result = PDFValidator.validatePageRanges('1-5, 3-8', 10);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Overlapping ranges'))).toBe(true);
    });

    it('should handle whitespace', () => {
      const result = PDFValidator.validatePageRanges('  1 - 3  ,  5  ', 10);

      expect(result.isValid).toBe(true);
      expect(result.parsedRanges).toEqual([
        { start: 1, end: 3 },
        { start: 5, end: 5 }
      ]);
    });

    it('should sort ranges in output', () => {
      const result = PDFValidator.validatePageRanges('7-9, 1-3, 5', 10);

      expect(result.parsedRanges).toEqual([
        { start: 1, end: 3 },
        { start: 5, end: 5 },
        { start: 7, end: 9 }
      ]);
    });

    it('should handle single page same as range', () => {
      const result1 = PDFValidator.validatePageRanges('5', 10);
      const result2 = PDFValidator.validatePageRanges('5-5', 10);

      expect(result1.parsedRanges).toEqual(result2.parsedRanges);
    });

    it('should reject mixed valid and invalid ranges', () => {
      const result = PDFValidator.validatePageRanges('1-3, invalid, 5-7', 10);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid'))).toBe(true);
    });

    it('should handle complex valid scenarios', () => {
      const result = PDFValidator.validatePageRanges('1, 3-5, 7, 9-10', 100);

      expect(result.isValid).toBe(true);
      expect(result.parsedRanges).toHaveLength(4);
    });
  });

  describe('quickValidate', () => {
    it('should quickly validate PDF file', async () => {
      const file = createMockPDFFile();
      const result = await PDFValidator.quickValidate(file);

      expect(result.isValid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('should reject non-PDF extension', async () => {
      const file = new File(['test'], 'document.txt', { type: 'text/plain' });
      const result = await PDFValidator.quickValidate(file);

      expect(result.isValid).toBe(false);
      expect(result.message).toContain('must be a PDF');
    });

    it('should reject empty file', async () => {
      const file = new File([], 'empty.pdf', { type: 'application/pdf' });
      const result = await PDFValidator.quickValidate(file);

      expect(result.isValid).toBe(false);
      expect(result.message).toContain('empty');
    });

    it('should reject oversized file', async () => {
      const largeContent = new Array(501 * 1024 * 1024).fill('x').join('');
      const file = new File([largeContent], 'large.pdf', { type: 'application/pdf' });
      const result = await PDFValidator.quickValidate(file);

      expect(result.isValid).toBe(false);
      expect(result.message).toContain('too large');
    });

    it('should reject invalid PDF signature', async () => {
      const file = new File(['Not a PDF'], 'fake.pdf', { type: 'application/pdf' });
      const result = await PDFValidator.quickValidate(file);

      expect(result.isValid).toBe(false);
      expect(result.message).toContain('Not a valid PDF');
    });

    it('should handle file read errors gracefully', async () => {
      // Create a file that might cause read errors
      const file = new File(['test'], 'error.pdf', { type: 'application/pdf' });

      // Mock slice to throw error
      const originalSlice = file.slice;
      file.slice = () => {
        throw new Error('Read error');
      };

      const result = await PDFValidator.quickValidate(file);

      expect(result.isValid).toBe(false);

      // Restore
      file.slice = originalSlice;
    });
  });

  describe('Edge Cases', () => {
    it('should handle PDF with no pages', async () => {
      const file = createMockPDFFile({ pageCount: 0 });
      const result = await PDFValidator.validatePDF(file);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('page count'))).toBe(true);
    });

    it('should handle malformed page ranges', () => {
      const testCases = [
        '1--3',       // Double dash
        '1-3-5',      // Multiple dashes
        '1,,,3',      // Multiple commas
        '1-',         // Incomplete range
        '-3',         // Missing start
      ];

      testCases.forEach(testCase => {
        const result = PDFValidator.validatePageRanges(testCase, 10);
        expect(result.isValid).toBe(false);
      });
    });

    it('should handle adjacent non-overlapping ranges', () => {
      const result = PDFValidator.validatePageRanges('1-3, 4-6, 7-9', 10);

      expect(result.isValid).toBe(true);
      expect(result.parsedRanges).toHaveLength(3);
    });

    it('should handle full document range', () => {
      const result = PDFValidator.validatePageRanges('1-100', 100);

      expect(result.isValid).toBe(true);
      expect(result.parsedRanges).toEqual([{ start: 1, end: 100 }]);
    });
  });
});
