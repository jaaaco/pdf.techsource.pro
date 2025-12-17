/**
 * Unit Tests - File Utilities
 * Tests file handling, validation, and conversion utilities
 * Validates: Requirements 8.2, 5.1
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FileUtils, FileValidationError } from '@/lib/file-utils';

// Helper to create mock PDF files
const createMockPDFFile = (name: string = 'test.pdf', size: number = 1024): File => {
  const pdfContent = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Count 1\n/Kids [3 0 R]\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n100 100 Td\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000015 00000 n\n0000000068 00000 n\n0000000125 00000 n\n0000000214 00000 n\ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n307\n%%EOF';

  // Pad to requested size
  const padding = size > pdfContent.length ? '\n'.repeat(size - pdfContent.length) : '';
  const content = pdfContent + padding;

  return new File([content.slice(0, size)], name, { type: 'application/pdf' });
};

describe('FileUtils', () => {
  describe('validatePDFFile', () => {
    it('should validate a valid PDF file', async () => {
      const file = createMockPDFFile('valid.pdf', 2048);
      const result = await FileUtils.validatePDFFile(file);

      expect(result.isValid).toBe(true);
      expect(result.fileType).toBe('pdf');
      expect(result.size).toBe(2048);
    });

    it('should reject files without .pdf extension', async () => {
      const file = new File(['test'], 'document.txt', { type: 'text/plain' });
      const result = await FileUtils.validatePDFFile(file);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('.pdf extension');
    });

    it('should reject empty files', async () => {
      const file = new File([], 'empty.pdf', { type: 'application/pdf' });
      const result = await FileUtils.validatePDFFile(file);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject files exceeding maximum size', async () => {
      // Create a file larger than 500MB
      const largeSize = 501 * 1024 * 1024;
      const file = createMockPDFFile('large.pdf', largeSize);
      const result = await FileUtils.validatePDFFile(file);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('too large');
    });

    it('should reject files without PDF signature', async () => {
      const file = new File(['Not a PDF content'], 'fake.pdf', { type: 'application/pdf' });
      const result = await FileUtils.validatePDFFile(file);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('not a valid PDF');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(FileUtils.formatFileSize(0)).toBe('0.0 B');
      expect(FileUtils.formatFileSize(100)).toBe('100.0 B');
      expect(FileUtils.formatFileSize(1023)).toBe('1023.0 B');
    });

    it('should format kilobytes correctly', () => {
      expect(FileUtils.formatFileSize(1024)).toBe('1.0 KB');
      expect(FileUtils.formatFileSize(1536)).toBe('1.5 KB');
      expect(FileUtils.formatFileSize(10240)).toBe('10.0 KB');
    });

    it('should format megabytes correctly', () => {
      expect(FileUtils.formatFileSize(1024 * 1024)).toBe('1.0 MB');
      expect(FileUtils.formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
      expect(FileUtils.formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
    });

    it('should format gigabytes correctly', () => {
      expect(FileUtils.formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
      expect(FileUtils.formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
    });
  });

  describe('getFileExtension', () => {
    it('should extract file extension', () => {
      expect(FileUtils.getFileExtension('document.pdf')).toBe('pdf');
      expect(FileUtils.getFileExtension('image.PNG')).toBe('png');
      expect(FileUtils.getFileExtension('archive.tar.gz')).toBe('gz');
    });

    it('should handle files without extension', () => {
      expect(FileUtils.getFileExtension('noextension')).toBe('');
      expect(FileUtils.getFileExtension('')).toBe('');
    });

    it('should handle files with dots in name', () => {
      expect(FileUtils.getFileExtension('file.name.with.dots.pdf')).toBe('pdf');
    });
  });

  describe('generateSafeFilename', () => {
    it('should generate safe filename from original', () => {
      const result = FileUtils.generateSafeFilename('My Document.pdf');
      expect(result).toBe('My Document.pdf');
    });

    it('should add suffix when provided', () => {
      const result = FileUtils.generateSafeFilename('document.pdf', 'compressed');
      expect(result).toBe('document_compressed.pdf');
    });

    it('should remove special characters', () => {
      const result = FileUtils.generateSafeFilename('doc@#$%ument!.pdf');
      expect(result).toBe('document.pdf');
    });

    it('should preserve hyphens and underscores', () => {
      const result = FileUtils.generateSafeFilename('my-document_v2.pdf');
      expect(result).toBe('my-document_v2.pdf');
    });
  });

  describe('arrayBufferToUint8Array', () => {
    it('should convert ArrayBuffer to Uint8Array', () => {
      const buffer = new ArrayBuffer(10);
      const uint8 = FileUtils.arrayBufferToUint8Array(buffer);

      expect(uint8).toBeInstanceOf(Uint8Array);
      expect(uint8.length).toBe(10);
    });
  });

  describe('uint8ArrayToFile', () => {
    it('should create File from Uint8Array', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const file = FileUtils.uint8ArrayToFile(data, 'test.pdf', 'application/pdf');

      expect(file).toBeInstanceOf(File);
      expect(file.name).toBe('test.pdf');
      expect(file.type).toBe('application/pdf');
    });

    it('should use default mime type', () => {
      const data = new Uint8Array([1, 2, 3]);
      const file = FileUtils.uint8ArrayToFile(data, 'test.pdf');

      expect(file.type).toBe('application/pdf');
    });
  });

  describe('createDownloadURL', () => {
    it('should create object URL from data', () => {
      const data = new Uint8Array([1, 2, 3]);
      const url = FileUtils.createDownloadURL(data, 'application/pdf');

      expect(url).toBe('mock-blob-url');
    });
  });

  describe('downloadFile', () => {
    it('should trigger file download', () => {
      const data = new Uint8Array([1, 2, 3]);

      // Mock document methods
      const mockLink = {
        href: '',
        download: '',
        style: { display: '' },
        click: vi.fn()
      };

      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);

      FileUtils.downloadFile(data, 'test.pdf', 'application/pdf');

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(mockLink.click).toHaveBeenCalled();
      expect(mockLink.download).toBe('test.pdf');

      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });
  });

  describe('validateMultipleFiles', () => {
    it('should validate multiple PDF files', async () => {
      const files = [
        createMockPDFFile('doc1.pdf', 1024),
        createMockPDFFile('doc2.pdf', 2048),
        createMockPDFFile('doc3.pdf', 3072)
      ];

      const results = await FileUtils.validateMultipleFiles(files);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.isValid).toBe(true);
      });
    });

    it('should detect invalid files in batch', async () => {
      const files = [
        createMockPDFFile('valid.pdf', 1024),
        new File(['fake'], 'invalid.pdf', { type: 'application/pdf' }),
        createMockPDFFile('valid2.pdf', 2048)
      ];

      const results = await FileUtils.validateMultipleFiles(files);

      expect(results).toHaveLength(3);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(false);
      expect(results[2].isValid).toBe(true);
    });
  });

  describe('validateFilesForMerging', () => {
    it('should validate files suitable for merging', () => {
      const files = [
        createMockPDFFile('doc1.pdf', 1024),
        createMockPDFFile('doc2.pdf', 2048)
      ];

      const result = FileUtils.validateFilesForMerging(files);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject when less than 2 files', () => {
      const files = [createMockPDFFile('doc1.pdf', 1024)];
      const result = FileUtils.validateFilesForMerging(files);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least 2 files are required for merging');
    });

    it('should reject when more than 50 files', () => {
      const files = Array.from({ length: 51 }, (_, i) =>
        createMockPDFFile(`doc${i}.pdf`, 1024)
      );

      const result = FileUtils.validateFilesForMerging(files);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Too many files'))).toBe(true);
    });

    it('should reject when total size too large', () => {
      // Create files that exceed the total size limit
      const files = [
        createMockPDFFile('large1.pdf', 600 * 1024 * 1024),
        createMockPDFFile('large2.pdf', 600 * 1024 * 1024)
      ];

      const result = FileUtils.validateFilesForMerging(files);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Total file size'))).toBe(true);
    });
  });

  describe('estimateProcessingTime', () => {
    it('should estimate time for compression', () => {
      const fileSize = 10 * 1024 * 1024; // 10MB
      const time = FileUtils.estimateProcessingTime(fileSize, 'compress');

      expect(time).toBe(20); // 2 seconds per MB * 10MB
    });

    it('should estimate time for merging', () => {
      const fileSize = 10 * 1024 * 1024; // 10MB
      const time = FileUtils.estimateProcessingTime(fileSize, 'merge');

      expect(time).toBe(5); // 0.5 seconds per MB * 10MB
    });

    it('should estimate time for splitting', () => {
      const fileSize = 10 * 1024 * 1024; // 10MB
      const time = FileUtils.estimateProcessingTime(fileSize, 'split');

      expect(time).toBe(3); // 0.3 seconds per MB * 10MB
    });

    it('should estimate time for OCR', () => {
      const fileSize = 10 * 1024 * 1024; // 10MB
      const time = FileUtils.estimateProcessingTime(fileSize, 'ocr');

      expect(time).toBe(100); // 10 seconds per MB * 10MB
    });

    it('should round up to nearest second', () => {
      const fileSize = 100 * 1024; // 0.1MB
      const time = FileUtils.estimateProcessingTime(fileSize, 'merge');

      expect(time).toBeGreaterThanOrEqual(1); // Should round up
    });
  });

  describe('checkBrowserCompatibility', () => {
    it('should detect compatible browser', () => {
      const result = FileUtils.checkBrowserCompatibility();

      expect(result.isCompatible).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect missing Worker API', () => {
      const originalWorker = global.Worker;
      delete (global as any).Worker;

      const result = FileUtils.checkBrowserCompatibility();

      expect(result.isCompatible).toBe(false);
      expect(result.issues).toContain('Web Workers not supported');

      global.Worker = originalWorker;
    });

    it('should detect missing WebAssembly', () => {
      const originalWasm = global.WebAssembly;
      delete (global as any).WebAssembly;

      const result = FileUtils.checkBrowserCompatibility();

      expect(result.isCompatible).toBe(false);
      expect(result.issues).toContain('WebAssembly not supported');

      global.WebAssembly = originalWasm;
    });

    it('should detect multiple missing APIs', () => {
      const originalWorker = global.Worker;
      const originalWasm = global.WebAssembly;

      delete (global as any).Worker;
      delete (global as any).WebAssembly;

      const result = FileUtils.checkBrowserCompatibility();

      expect(result.isCompatible).toBe(false);
      expect(result.issues.length).toBeGreaterThan(1);

      global.Worker = originalWorker;
      global.WebAssembly = originalWasm;
    });
  });

  describe('getPDFInfo', () => {
    it('should extract PDF information', async () => {
      const file = createMockPDFFile('test.pdf', 4096);
      const info = await FileUtils.getPDFInfo(file);

      expect(info).not.toBeNull();
      expect(info?.fileSize).toBe(4096);
      expect(info?.pageCount).toBeGreaterThan(0);
      expect(info?.version).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      const badFile = new File(['bad content'], 'bad.pdf', { type: 'application/pdf' });
      const info = await FileUtils.getPDFInfo(badFile);

      // Should return fallback info instead of throwing
      expect(info).not.toBeNull();
      expect(info?.pageCount).toBe(1); // Default fallback
    });
  });

  describe('fileToArrayBuffer', () => {
    it('should convert File to ArrayBuffer', async () => {
      const file = createMockPDFFile('test.pdf', 1024);
      const buffer = await FileUtils.fileToArrayBuffer(file);

      expect(buffer).toBeInstanceOf(ArrayBuffer);
      expect(buffer.byteLength).toBe(1024);
    });

    it('should handle read errors', async () => {
      const badFile = new File([], 'empty.pdf', { type: 'application/pdf' });

      await expect(FileUtils.fileToArrayBuffer(badFile)).resolves.toBeDefined();
    });
  });
});
