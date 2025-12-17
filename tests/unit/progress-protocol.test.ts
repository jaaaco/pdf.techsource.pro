/**
 * Unit Tests - Progress Protocol
 * Tests message validation and creation utilities
 * Validates: Requirements 2.3, 7.3
 */

import { describe, it, expect } from 'vitest';
import {
  MessageValidator,
  MessageFactory,
  ProgressCalculator,
  type ToolWorkerMessage,
  type ProgressUpdate,
  type ProcessingResult,
  type ErrorInfo,
} from '@/workers/shared/progress-protocol';

describe('Progress Protocol', () => {
  describe('MessageValidator', () => {
    describe('validateWorkerMessage', () => {
      it('should validate valid progress message', () => {
        const message: ToolWorkerMessage = {
          type: 'progress',
          payload: {
            current: 5,
            total: 10,
            stage: 'Processing',
            message: 'Processing page 5 of 10',
            percentage: 50
          },
          taskId: 'test-task-1',
          timestamp: Date.now()
        };

        expect(MessageValidator.validateWorkerMessage(message)).toBe(true);
      });

      it('should validate valid complete message', () => {
        const message: ToolWorkerMessage = {
          type: 'complete',
          payload: {
            files: [{
              name: 'output.pdf',
              data: new Uint8Array([1, 2, 3]),
              size: 1024,
              mimeType: 'application/pdf'
            }],
            metadata: {
              processingTime: 1000,
              tool: 'compress',
              options: {}
            }
          },
          taskId: 'test-task-1',
          timestamp: Date.now()
        };

        expect(MessageValidator.validateWorkerMessage(message)).toBe(true);
      });

      it('should validate valid error message', () => {
        const message: ToolWorkerMessage = {
          type: 'error',
          payload: {
            type: 'PROCESSING_ERROR',
            message: 'Failed to process file',
            recoverable: true,
            suggestions: ['Try again', 'Check file']
          },
          taskId: 'test-task-1',
          timestamp: Date.now()
        };

        expect(MessageValidator.validateWorkerMessage(message)).toBe(true);
      });

      it('should reject message with missing required fields', () => {
        const invalidMessage = {
          type: 'progress',
          payload: { current: 5, total: 10, stage: 'Processing' }
          // Missing taskId and timestamp
        };

        expect(MessageValidator.validateWorkerMessage(invalidMessage)).toBe(false);
      });

      it('should reject message with invalid type', () => {
        const invalidMessage = {
          type: 'invalid-type',
          payload: {},
          taskId: 'test',
          timestamp: Date.now()
        };

        expect(MessageValidator.validateWorkerMessage(invalidMessage)).toBe(false);
      });

      it('should reject non-object message', () => {
        expect(MessageValidator.validateWorkerMessage(null)).toBe(false);
        expect(MessageValidator.validateWorkerMessage(undefined)).toBe(false);
        expect(MessageValidator.validateWorkerMessage('string')).toBe(false);
        expect(MessageValidator.validateWorkerMessage(123)).toBe(false);
      });
    });

    describe('validateProgressUpdate', () => {
      it('should validate valid progress update', () => {
        const progress: ProgressUpdate = {
          current: 3,
          total: 10,
          stage: 'Merging',
          message: 'Merging file 3 of 10'
        };

        expect(MessageValidator.validateProgressUpdate(progress)).toBe(true);
      });

      it('should reject progress with negative current', () => {
        const invalid = {
          current: -1,
          total: 10,
          stage: 'Processing'
        };

        expect(MessageValidator.validateProgressUpdate(invalid)).toBe(false);
      });

      it('should reject progress with current > total', () => {
        const invalid = {
          current: 15,
          total: 10,
          stage: 'Processing'
        };

        expect(MessageValidator.validateProgressUpdate(invalid)).toBe(false);
      });

      it('should reject progress with zero or negative total', () => {
        expect(MessageValidator.validateProgressUpdate({
          current: 0,
          total: 0,
          stage: 'Test'
        })).toBe(false);

        expect(MessageValidator.validateProgressUpdate({
          current: 0,
          total: -5,
          stage: 'Test'
        })).toBe(false);
      });

      it('should reject progress with missing stage', () => {
        const invalid = {
          current: 5,
          total: 10
        };

        expect(MessageValidator.validateProgressUpdate(invalid)).toBe(false);
      });
    });

    describe('validateProcessingResult', () => {
      it('should validate valid processing result', () => {
        const result: ProcessingResult = {
          files: [{
            name: 'output.pdf',
            data: new Uint8Array([1, 2, 3]),
            size: 1024,
            mimeType: 'application/pdf'
          }],
          metadata: {
            processingTime: 2000,
            totalPages: 5,
            tool: 'merge',
            options: { bookmarks: true }
          }
        };

        expect(MessageValidator.validateProcessingResult(result)).toBe(true);
      });

      it('should validate result with multiple files', () => {
        const result: ProcessingResult = {
          files: [
            {
              name: 'output1.pdf',
              data: new Uint8Array([1]),
              size: 100,
              mimeType: 'application/pdf'
            },
            {
              name: 'output2.pdf',
              data: new Uint8Array([2]),
              size: 200,
              mimeType: 'application/pdf'
            }
          ],
          metadata: {
            processingTime: 1000,
            tool: 'split',
            options: {}
          }
        };

        expect(MessageValidator.validateProcessingResult(result)).toBe(true);
      });

      it('should reject result with invalid file', () => {
        const invalid = {
          files: [{
            name: 'output.pdf',
            data: 'not-uint8array', // Should be Uint8Array
            size: 1024,
            mimeType: 'application/pdf'
          }],
          metadata: {
            processingTime: 1000,
            tool: 'compress',
            options: {}
          }
        };

        expect(MessageValidator.validateProcessingResult(invalid)).toBe(false);
      });

      it('should reject result with invalid metadata', () => {
        const invalid = {
          files: [{
            name: 'output.pdf',
            data: new Uint8Array([1]),
            size: 1024,
            mimeType: 'application/pdf'
          }],
          metadata: {
            processingTime: -1000, // Negative time
            tool: 'compress',
            options: {}
          }
        };

        expect(MessageValidator.validateProcessingResult(invalid)).toBe(false);
      });
    });

    describe('validateErrorInfo', () => {
      it('should validate valid error info', () => {
        const error: ErrorInfo = {
          type: 'MEMORY_LIMIT',
          message: 'Out of memory',
          recoverable: true,
          suggestions: ['Close tabs', 'Use smaller file']
        };

        expect(MessageValidator.validateErrorInfo(error)).toBe(true);
      });

      it('should validate all error types', () => {
        const errorTypes = [
          'MEMORY_LIMIT',
          'WASM_LOAD_FAILED',
          'INVALID_PDF',
          'PROCESSING_ERROR',
          'VALIDATION_ERROR',
          'WASM_ERROR',
          'WORKER_ERROR',
          'NETWORK_ERROR',
          'COMPATIBILITY_ERROR',
          'GENERIC_ERROR',
          'FILE_ERROR'
        ];

        errorTypes.forEach(type => {
          const error = {
            type: type as ErrorInfo['type'],
            message: 'Test error',
            recoverable: false
          };

          expect(MessageValidator.validateErrorInfo(error)).toBe(true);
        });
      });

      it('should reject error with invalid type', () => {
        const invalid = {
          type: 'UNKNOWN_ERROR_TYPE',
          message: 'Test',
          recoverable: true
        };

        expect(MessageValidator.validateErrorInfo(invalid)).toBe(false);
      });

      it('should reject error with missing message', () => {
        const invalid = {
          type: 'GENERIC_ERROR',
          recoverable: true
        };

        expect(MessageValidator.validateErrorInfo(invalid)).toBe(false);
      });
    });
  });

  describe('MessageFactory', () => {
    describe('createProgressMessage', () => {
      it('should create valid progress message', () => {
        const message = MessageFactory.createProgressMessage(
          'task-1',
          5,
          10,
          'Processing',
          'Processing page 5'
        );

        expect(message.type).toBe('progress');
        expect(message.taskId).toBe('task-1');
        expect(message.payload).toEqual({
          current: 5,
          total: 10,
          stage: 'Processing',
          message: 'Processing page 5',
          percentage: 50
        });
        expect(message.timestamp).toBeGreaterThan(0);
      });

      it('should calculate percentage correctly', () => {
        const msg1 = MessageFactory.createProgressMessage('t1', 1, 4, 'Test');
        expect(msg1.payload.percentage).toBe(25);

        const msg2 = MessageFactory.createProgressMessage('t2', 3, 4, 'Test');
        expect(msg2.payload.percentage).toBe(75);

        const msg3 = MessageFactory.createProgressMessage('t3', 4, 4, 'Test');
        expect(msg3.payload.percentage).toBe(100);
      });

      it('should handle message parameter as optional', () => {
        const message = MessageFactory.createProgressMessage('task-1', 5, 10, 'Processing');

        expect(message.payload.message).toBeUndefined();
      });
    });

    describe('createCompleteMessage', () => {
      it('should create valid complete message', () => {
        const files = [{
          name: 'output.pdf',
          data: new Uint8Array([1, 2, 3]),
          size: 1024,
          mimeType: 'application/pdf'
        }];

        const metadata = {
          processingTime: 2000,
          tool: 'compress' as const,
          options: { preset: 'ebook' }
        };

        const message = MessageFactory.createCompleteMessage('task-1', files, metadata);

        expect(message.type).toBe('complete');
        expect(message.taskId).toBe('task-1');
        expect(message.payload.files).toEqual(files);
        expect(message.payload.metadata).toEqual(metadata);
        expect(message.timestamp).toBeGreaterThan(0);
      });
    });

    describe('createErrorMessage', () => {
      it('should create valid error message', () => {
        const message = MessageFactory.createErrorMessage(
          'task-1',
          'PROCESSING_ERROR',
          'Processing failed',
          ['Retry', 'Check file'],
          true,
          { errorCode: 500 }
        );

        expect(message.type).toBe('error');
        expect(message.taskId).toBe('task-1');
        expect(message.payload.type).toBe('PROCESSING_ERROR');
        expect(message.payload.message).toBe('Processing failed');
        expect(message.payload.suggestions).toEqual(['Retry', 'Check file']);
        expect(message.payload.recoverable).toBe(true);
        expect(message.payload.details).toEqual({ errorCode: 500 });
      });

      it('should default recoverable to true', () => {
        const message = MessageFactory.createErrorMessage(
          'task-1',
          'GENERIC_ERROR',
          'Error occurred'
        );

        expect(message.payload.recoverable).toBe(true);
      });
    });

    describe('createInitMessage', () => {
      it('should create valid init message', () => {
        const config = {
          wasmPath: '/wasm/ghostscript.wasm',
          memoryLimit: 1024 * 1024 * 1024
        };

        const message = MessageFactory.createInitMessage('task-1', config);

        expect(message.type).toBe('init');
        expect(message.taskId).toBe('task-1');
        expect(message.payload).toEqual(config);
      });

      it('should handle missing config', () => {
        const message = MessageFactory.createInitMessage('task-1');

        expect(message.payload).toEqual({});
      });
    });

    describe('createCancelMessage', () => {
      it('should create valid cancel message', () => {
        const message = MessageFactory.createCancelMessage('task-1');

        expect(message.type).toBe('cancel');
        expect(message.taskId).toBe('task-1');
        expect(message.payload).toBeNull();
        expect(message.timestamp).toBeGreaterThan(0);
      });
    });
  });

  describe('ProgressCalculator', () => {
    describe('calculateFileProgress', () => {
      it('should calculate progress for single file', () => {
        const progress = ProgressCalculator.calculateFileProgress(1, 1, 50, 100);

        expect(progress).toBe(50);
      });

      it('should calculate progress for multiple files', () => {
        // First file (file 0), page 50 of 100
        const prog1 = ProgressCalculator.calculateFileProgress(0, 3, 50, 100);
        expect(prog1).toBeGreaterThan(0);
        expect(prog1).toBeLessThan(34);

        // Second file (file 1), page 0 of 100
        const prog2 = ProgressCalculator.calculateFileProgress(1, 3, 0, 100);
        expect(prog2).toBeGreaterThanOrEqual(33);
        expect(prog2).toBeLessThanOrEqual(34);

        // Third file (file 2), page 100 of 100
        const prog3 = ProgressCalculator.calculateFileProgress(2, 3, 100, 100);
        expect(prog3).toBeGreaterThanOrEqual(99);
      });

      it('should return 100 when all files and pages are complete', () => {
        // When on last file (index 2 of 3 files) and all pages done
        const progress = ProgressCalculator.calculateFileProgress(2, 3, 100, 100);

        expect(progress).toBeGreaterThanOrEqual(99);
        expect(progress).toBeLessThanOrEqual(100);
      });
    });

    describe('calculateStageProgress', () => {
      it('should calculate progress through stages', () => {
        const stages = ['Loading', 'Processing', 'Saving'];

        // First stage, 50% complete
        const prog1 = ProgressCalculator.calculateStageProgress(stages, 'Loading', 50);
        expect(prog1).toBeGreaterThan(0);
        expect(prog1).toBeLessThan(34);

        // Second stage, 0% complete
        const prog2 = ProgressCalculator.calculateStageProgress(stages, 'Processing', 0);
        expect(prog2).toBeGreaterThan(32);
        expect(prog2).toBeLessThan(34);

        // Third stage, 100% complete
        const prog3 = ProgressCalculator.calculateStageProgress(stages, 'Saving', 100);
        expect(prog3).toBeGreaterThan(99);
      });

      it('should return 0 for unknown stage', () => {
        const stages = ['Loading', 'Processing', 'Saving'];
        const progress = ProgressCalculator.calculateStageProgress(stages, 'Unknown', 50);

        expect(progress).toBe(0);
      });

      it('should handle single stage', () => {
        const stages = ['Processing'];
        const progress = ProgressCalculator.calculateStageProgress(stages, 'Processing', 75);

        expect(progress).toBe(75);
      });
    });
  });

  describe('Protocol Compliance', () => {
    it('should ensure all message factory outputs are valid', () => {
      const progressMsg = MessageFactory.createProgressMessage('t1', 1, 10, 'Test');
      expect(MessageValidator.validateWorkerMessage(progressMsg)).toBe(true);

      const completeMsg = MessageFactory.createCompleteMessage('t1', [{
        name: 'test.pdf',
        data: new Uint8Array([1]),
        size: 1,
        mimeType: 'application/pdf'
      }], {
        processingTime: 100,
        tool: 'compress',
        options: {}
      });
      expect(MessageValidator.validateWorkerMessage(completeMsg)).toBe(true);

      const errorMsg = MessageFactory.createErrorMessage('t1', 'GENERIC_ERROR', 'Error');
      expect(MessageValidator.validateWorkerMessage(errorMsg)).toBe(true);

      const initMsg = MessageFactory.createInitMessage('t1');
      expect(MessageValidator.validateWorkerMessage(initMsg)).toBe(true);

      const cancelMsg = MessageFactory.createCancelMessage('t1');
      expect(MessageValidator.validateWorkerMessage(cancelMsg)).toBe(true);
    });
  });
});
