/**
 * Unit Tests - Error Handler
 * Tests error categorization, recovery strategies, and user-friendly messages
 * Validates: Requirements 2.4, 10.5
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ErrorHandler } from '@/lib/error-handler';

describe('ErrorHandler', () => {
  beforeEach(() => {
    ErrorHandler.clearErrorCounts();
  });

  afterEach(() => {
    ErrorHandler.clearErrorCounts();
  });

  describe('Error Categorization', () => {
    it('should categorize memory errors', () => {
      const errors = [
        new Error('Out of memory'),
        new Error('Memory allocation failed'),
        new Error('Not enough memory available'),
      ];

      errors.forEach(error => {
        const processed = ErrorHandler.processError(error);
        expect(processed.type).toBe('MEMORY_LIMIT');
      });
    });

    it('should categorize file errors', () => {
      const errors = [
        new Error('Invalid PDF file'),
        new Error('File is corrupted'),
        new Error('Cannot read file'),
      ];

      errors.forEach(error => {
        const processed = ErrorHandler.processError(error);
        expect(processed.type).toBe('FILE_ERROR');
      });
    });

    it('should categorize WASM errors', () => {
      const errors = [
        new Error('WASM module failed to load'),
        new Error('WebAssembly compilation error'),
        new Error('Module instantiation failed'),
      ];

      errors.forEach(error => {
        const processed = ErrorHandler.processError(error);
        expect(processed.type).toBe('WASM_ERROR');
      });
    });

    it('should categorize worker errors', () => {
      const errors = [
        new Error('Worker terminated unexpectedly'),
        new Error('Worker communication failed'),
      ];

      errors.forEach(error => {
        const processed = ErrorHandler.processError(error);
        expect(processed.type).toBe('WORKER_ERROR');
      });
    });

    it('should categorize processing errors', () => {
      const errors = [
        new Error('PDF compression failed'),
        new Error('Merge operation encountered an error'),
        new Error('OCR processing failed'),
      ];

      errors.forEach(error => {
        const processed = ErrorHandler.processError(error);
        expect(processed.type).toBe('PROCESSING_ERROR');
      });
    });

    it('should categorize validation errors', () => {
      const errors = [
        new Error('Validation failed'),
        new Error('Invalid format'),
        new Error('Invalid page range'),
      ];

      errors.forEach(error => {
        const processed = ErrorHandler.processError(error);
        expect(processed.type).toBe('VALIDATION_ERROR');
      });
    });

    it('should categorize compatibility errors', () => {
      const errors = [
        new Error('Feature not supported in this browser'),
        new Error('Browser compatibility issue'),
      ];

      errors.forEach(error => {
        const processed = ErrorHandler.processError(error);
        expect(processed.type).toBe('COMPATIBILITY_ERROR');
      });
    });

    it('should categorize network errors', () => {
      const errors = [
        new Error('Network request failed'),
        new Error('Connection timeout'),
        new Error('Fetch error'),
      ];

      errors.forEach(error => {
        const processed = ErrorHandler.processError(error);
        expect(processed.type).toBe('NETWORK_ERROR');
      });
    });

    it('should categorize unknown errors as generic', () => {
      const error = new Error('Something unexpected happened');
      const processed = ErrorHandler.processError(error);

      expect(processed.type).toBe('GENERIC_ERROR');
    });
  });

  describe('Recovery Strategies', () => {
    it('should provide recovery strategy for memory errors', () => {
      const error = new Error('Out of memory');
      const processed = ErrorHandler.processError(error);

      expect(processed.recovery.canRecover).toBe(true);
      expect(processed.recovery.autoRetry).toBe(false);
      expect(processed.recovery.suggestions).toContain('Close other browser tabs to free memory');
    });

    it('should provide recovery strategy for file errors', () => {
      const error = new Error('Invalid PDF file');
      const processed = ErrorHandler.processError(error);

      expect(processed.recovery.canRecover).toBe(true);
      expect(processed.recovery.autoRetry).toBe(false);
      expect(processed.recovery.suggestions.length).toBeGreaterThan(0);
    });

    it('should provide auto-retry for WASM errors', () => {
      const error = new Error('WASM module failed to load');
      const processed = ErrorHandler.processError(error);

      expect(processed.recovery.canRecover).toBe(true);
      expect(processed.recovery.autoRetry).toBe(true);
      expect(processed.recovery.retryDelay).toBe(2000);
      expect(processed.recovery.maxRetries).toBe(2);
    });

    it('should provide auto-retry for worker errors', () => {
      const error = new Error('Worker failed');
      const processed = ErrorHandler.processError(error);

      expect(processed.recovery.autoRetry).toBe(true);
      expect(processed.recovery.retryDelay).toBe(1000);
      expect(processed.recovery.maxRetries).toBe(1);
    });

    it('should not allow recovery for validation errors', () => {
      const error = new Error('Validation failed');
      const processed = ErrorHandler.processError(error);

      expect(processed.recovery.canRecover).toBe(false);
      expect(processed.recovery.autoRetry).toBe(false);
    });

    it('should not allow recovery for compatibility errors', () => {
      const error = new Error('Feature not supported');
      const processed = ErrorHandler.processError(error);

      expect(processed.recovery.canRecover).toBe(false);
      expect(processed.recovery.autoRetry).toBe(false);
    });
  });

  describe('Error Severity', () => {
    it('should mark compatibility errors as critical', () => {
      const error = new Error('Browser not supported');
      const processed = ErrorHandler.processError(error);

      expect(processed.severity).toBe('critical');
    });

    it('should mark WASM errors as critical', () => {
      const error = new Error('WASM failed');
      const processed = ErrorHandler.processError(error);

      expect(processed.severity).toBe('critical');
    });

    it('should mark memory errors as high', () => {
      const error = new Error('Out of memory');
      const processed = ErrorHandler.processError(error);

      expect(processed.severity).toBe('high');
    });

    it('should mark processing errors as medium', () => {
      const error = new Error('Processing failed');
      const processed = ErrorHandler.processError(error);

      expect(processed.severity).toBe('medium');
    });

    it('should mark file errors as medium', () => {
      const error = new Error('Invalid file');
      const processed = ErrorHandler.processError(error);

      expect(processed.severity).toBe('medium');
    });

    it('should mark validation errors as low', () => {
      const error = new Error('Validation failed');
      const processed = ErrorHandler.processError(error);

      expect(processed.severity).toBe('low');
    });

    it('should increase severity for repeated errors', () => {
      const error = new Error('Processing failed');
      const context = { tool: 'compress' };

      // First 4 errors should be medium
      for (let i = 0; i < 4; i++) {
        const processed = ErrorHandler.processError(error, context);
        expect(processed.severity).toBe('medium');
      }

      // 5th error should still be medium (threshold is at 5 total)
      const processed5 = ErrorHandler.processError(error, context);
      expect(processed5.severity).toBe('medium');

      // 6th error should become high (exceeds MAX_ERROR_COUNT of 5)
      const finalProcessed = ErrorHandler.processError(error, context);
      expect(finalProcessed.severity).toBe('high');
    });
  });

  describe('User-Friendly Messages', () => {
    it('should generate message for memory errors', () => {
      const error = new Error('Out of memory');
      const processed = ErrorHandler.processError(error, { fileName: 'large.pdf' });

      expect(processed.message).toContain('memory');
      expect(processed.message).toContain('large.pdf');
    });

    it('should generate message for file errors', () => {
      const error = new Error('Invalid PDF');
      const processed = ErrorHandler.processError(error, { fileName: 'document.pdf' });

      expect(processed.message).toContain('problem');
      expect(processed.message).toContain('document.pdf');
    });

    it('should generate message for WASM errors', () => {
      const error = new Error('WASM failed');
      const processed = ErrorHandler.processError(error, { tool: 'compress' });

      expect(processed.message).toContain('compress');
      expect(processed.message).toContain('engine');
    });

    it('should generate message for processing errors', () => {
      const error = new Error('Processing failed');
      const processed = ErrorHandler.processError(error, { fileName: 'test.pdf' });

      expect(processed.message).toContain('processing');
      expect(processed.message).toContain('test.pdf');
    });

    it('should generate message for compatibility errors', () => {
      const error = new Error('Not supported');
      const processed = ErrorHandler.processError(error);

      expect(processed.message).toContain('browser');
      expect(processed.message).toContain('support');
    });
  });

  describe('Error Context', () => {
    it('should capture error context', () => {
      const error = new Error('Test error');
      const context = {
        tool: 'compress',
        operation: 'compression',
        fileSize: 1024 * 1024,
        fileName: 'test.pdf',
        memoryUsage: 500 * 1024 * 1024
      };

      const processed = ErrorHandler.processError(error, context);

      expect(processed.context.tool).toBe('compress');
      expect(processed.context.operation).toBe('compression');
      expect(processed.context.fileSize).toBe(1024 * 1024);
      expect(processed.context.fileName).toBe('test.pdf');
      expect(processed.context.memoryUsage).toBe(500 * 1024 * 1024);
      expect(processed.context.timestamp).toBeGreaterThan(0);
      expect(processed.context.userAgent).toBeDefined();
    });

    it('should use defaults for missing context', () => {
      const error = new Error('Test error');
      const processed = ErrorHandler.processError(error);

      expect(processed.context.timestamp).toBeGreaterThan(0);
      expect(processed.context.userAgent).toBeDefined();
    });
  });

  describe('Auto-Retry Logic', () => {
    it('should allow retry for errors with auto-retry enabled', () => {
      const error = new Error('WASM failed');
      const processed = ErrorHandler.processError(error);

      expect(ErrorHandler.shouldAutoRetry(processed)).toBe(true);
    });

    it('should not allow retry when max retries exceeded', () => {
      const error = new Error('WASM failed');
      const context = { tool: 'compress' };

      // Process error multiple times to exceed max retries
      let processed;
      for (let i = 0; i < 5; i++) {
        processed = ErrorHandler.processError(error, context);
      }

      expect(ErrorHandler.shouldAutoRetry(processed!)).toBe(false);
    });

    it('should not allow retry for non-retryable errors', () => {
      const error = new Error('Validation failed');
      const processed = ErrorHandler.processError(error);

      expect(ErrorHandler.shouldAutoRetry(processed)).toBe(false);
    });

    it('should return correct retry delay', () => {
      const wasmError = new Error('WASM failed');
      const wasmProcessed = ErrorHandler.processError(wasmError);
      expect(ErrorHandler.getRetryDelay(wasmProcessed)).toBe(2000);

      const workerError = new Error('Worker failed');
      const workerProcessed = ErrorHandler.processError(workerError);
      expect(ErrorHandler.getRetryDelay(workerProcessed)).toBe(1000);

      const processingError = new Error('Processing failed');
      const processingProcessed = ErrorHandler.processError(processingError);
      expect(ErrorHandler.getRetryDelay(processingProcessed)).toBe(1000);
    });
  });

  describe('Error Tracking', () => {
    it('should track error counts', () => {
      const error = new Error('Processing failed');
      const context = { tool: 'compress' };

      ErrorHandler.processError(error, context);
      ErrorHandler.processError(error, context);
      ErrorHandler.processError(error, context);

      const stats = ErrorHandler.getErrorStats();
      expect(stats.get('PROCESSING_ERROR_compress')).toBe(3);
    });

    it('should track errors separately by tool', () => {
      const error = new Error('Processing failed');

      ErrorHandler.processError(error, { tool: 'compress' });
      ErrorHandler.processError(error, { tool: 'compress' });
      ErrorHandler.processError(error, { tool: 'merge' });

      const stats = ErrorHandler.getErrorStats();
      expect(stats.get('PROCESSING_ERROR_compress')).toBe(2);
      expect(stats.get('PROCESSING_ERROR_merge')).toBe(1);
    });

    it('should reset error count for specific type', () => {
      const error = new Error('Processing failed');
      ErrorHandler.processError(error, { tool: 'compress' });
      ErrorHandler.processError(error, { tool: 'compress' });

      ErrorHandler.resetErrorCount('PROCESSING_ERROR', 'compress');

      const stats = ErrorHandler.getErrorStats();
      expect(stats.get('PROCESSING_ERROR_compress')).toBeUndefined();
    });

    it('should clear all error counts', () => {
      ErrorHandler.processError(new Error('Error 1'), { tool: 'compress' });
      ErrorHandler.processError(new Error('Error 2'), { tool: 'merge' });

      ErrorHandler.clearErrorCounts();

      const stats = ErrorHandler.getErrorStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('Error Reporting', () => {
    it('should create error report', () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      const context = {
        tool: 'compress',
        operation: 'compression',
        fileSize: 1024,
        memoryUsage: 512
      };

      const processed = ErrorHandler.processError(error, context);
      const report = ErrorHandler.createErrorReport(processed);

      expect(report).toContain('Test error');
      expect(report).toContain('compress');
      expect(report).toContain('compression');
      expect(report).toContain('1024');

      // Should be valid JSON
      const parsed = JSON.parse(report);
      expect(parsed.type).toBe(processed.type);
      expect(parsed.severity).toBe(processed.severity);
    });
  });

  describe('Edge Cases', () => {
    it('should handle errors with no message', () => {
      const error = new Error();
      const processed = ErrorHandler.processError(error);

      expect(processed.type).toBe('GENERIC_ERROR');
      expect(processed.message).toBeDefined();
    });

    it('should handle errors with empty stack', () => {
      const error = new Error('Test');
      delete error.stack;

      const processed = ErrorHandler.processError(error);
      const report = ErrorHandler.createErrorReport(processed);

      expect(report).toBeDefined();
    });

    it('should handle context with undefined values', () => {
      const error = new Error('Test');
      const context = {
        tool: undefined,
        fileName: undefined
      };

      const processed = ErrorHandler.processError(error, context);

      expect(processed.context.tool).toBeUndefined();
      expect(processed.context.fileName).toBeUndefined();
      expect(processed.message).toBeDefined();
    });
  });
});
