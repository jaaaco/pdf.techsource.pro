/**
 * Unit Tests - Memory Manager
 * Tests memory allocation tracking, limits, and cleanup
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryManager, MemoryError } from '@/workers/shared/memory-manager';

describe('MemoryManager', () => {
  let memoryManager: MemoryManager;

  beforeEach(() => {
    memoryManager = new MemoryManager(10); // 10MB limit for testing
  });

  describe('Allocation', () => {
    it('should allocate memory successfully when under limit', () => {
      const size = 5 * 1024 * 1024; // 5MB
      const result = memoryManager.allocate(size, 'test-allocation', 'file', 'test.pdf');

      expect(result).toBe(true);
      expect(memoryManager.getTotalAllocated()).toBe(size);
    });

    it('should throw error when allocation would exceed limit', () => {
      const size = 15 * 1024 * 1024; // 15MB (exceeds 10MB limit)

      expect(() => {
        memoryManager.allocate(size, 'too-large', 'file');
      }).toThrow(MemoryError);

      expect(() => {
        memoryManager.allocate(size, 'too-large', 'file');
      }).toThrow(/exceed memory limit/i);
    });

    it('should throw error for duplicate allocation IDs', () => {
      const size = 1024 * 1024; // 1MB
      memoryManager.allocate(size, 'duplicate-id', 'file');

      expect(() => {
        memoryManager.allocate(size, 'duplicate-id', 'file');
      }).toThrow(/already exists/i);
    });

    it('should track multiple allocations correctly', () => {
      memoryManager.allocate(1024 * 1024, 'alloc1', 'file');
      memoryManager.allocate(2 * 1024 * 1024, 'alloc2', 'processing');
      memoryManager.allocate(1.5 * 1024 * 1024, 'alloc3', 'temporary');

      expect(memoryManager.getTotalAllocated()).toBe(4.5 * 1024 * 1024);
    });

    it('should track allocation metadata', () => {
      const size = 1024 * 1024;
      const description = 'Test file allocation';
      memoryManager.allocate(size, 'test', 'file', description);

      const allocation = memoryManager.getAllocation('test');
      expect(allocation).toBeDefined();
      expect(allocation?.size).toBe(size);
      expect(allocation?.type).toBe('file');
      expect(allocation?.description).toBe(description);
      expect(allocation?.timestamp).toBeDefined();
    });
  });

  describe('Deallocation', () => {
    it('should deallocate memory successfully', () => {
      const size = 2 * 1024 * 1024;
      memoryManager.allocate(size, 'test', 'file');

      expect(memoryManager.getTotalAllocated()).toBe(size);

      const result = memoryManager.deallocate('test');

      expect(result).toBe(true);
      expect(memoryManager.getTotalAllocated()).toBe(0);
    });

    it('should return false for non-existent allocation', () => {
      const result = memoryManager.deallocate('non-existent');
      expect(result).toBe(false);
    });

    it('should deallocate by type', () => {
      memoryManager.allocate(1024 * 1024, 'file1', 'file');
      memoryManager.allocate(1024 * 1024, 'file2', 'file');
      memoryManager.allocate(1024 * 1024, 'proc1', 'processing');
      memoryManager.allocate(1024 * 1024, 'temp1', 'temporary');

      const deallocated = memoryManager.deallocateByType('file');

      expect(deallocated).toBe(2);
      expect(memoryManager.getTotalAllocated()).toBe(2 * 1024 * 1024);
    });

    it('should cleanup temporary allocations', () => {
      memoryManager.allocate(1024 * 1024, 'temp1', 'temporary');
      memoryManager.allocate(1024 * 1024, 'temp2', 'temporary');
      memoryManager.allocate(1024 * 1024, 'file1', 'file');

      const cleaned = memoryManager.cleanupTemporary();

      expect(cleaned).toBe(2);
      expect(memoryManager.getTotalAllocated()).toBe(1024 * 1024);
    });

    it('should cleanup old allocations', () => {
      // Allocate some memory
      memoryManager.allocate(1024 * 1024, 'old', 'file');

      // Mock old timestamp
      const allocation = memoryManager.getAllocation('old');
      if (allocation) {
        allocation.timestamp = Date.now() - 400000; // 400 seconds ago
      }

      memoryManager.allocate(1024 * 1024, 'new', 'file');

      const cleaned = memoryManager.cleanupOld(300000); // 5 minutes

      expect(cleaned).toBe(1);
      expect(memoryManager.getTotalAllocated()).toBe(1024 * 1024);
    });
  });

  describe('Memory Statistics', () => {
    it('should calculate total allocated memory', () => {
      memoryManager.allocate(2 * 1024 * 1024, 'a1', 'file');
      memoryManager.allocate(3 * 1024 * 1024, 'a2', 'processing');

      expect(memoryManager.getTotalAllocated()).toBe(5 * 1024 * 1024);
    });

    it('should calculate available memory', () => {
      memoryManager.allocate(4 * 1024 * 1024, 'a1', 'file');

      expect(memoryManager.getAvailableMemory()).toBe(6 * 1024 * 1024);
    });

    it('should calculate utilization percentage', () => {
      memoryManager.allocate(5 * 1024 * 1024, 'a1', 'file');

      expect(memoryManager.getUtilizationPercentage()).toBe(50);
    });

    it('should provide comprehensive memory stats', () => {
      memoryManager.allocate(2 * 1024 * 1024, 'a1', 'file');
      memoryManager.allocate(3 * 1024 * 1024, 'a2', 'processing');

      const stats = memoryManager.getMemoryStats();

      expect(stats.totalAllocated).toBe(5 * 1024 * 1024);
      expect(stats.availableMemory).toBe(5 * 1024 * 1024);
      expect(stats.memoryLimit).toBe(10 * 1024 * 1024);
      expect(stats.utilizationPercentage).toBe(50);
      expect(stats.allocations).toHaveLength(2);
    });
  });

  describe('Memory Warnings', () => {
    it('should return null when memory usage is low', () => {
      memoryManager.allocate(3 * 1024 * 1024, 'a1', 'file'); // 30% usage

      const warning = memoryManager.checkMemoryWarning();

      expect(warning).toBeNull();
    });

    it('should return low warning at 60% usage', () => {
      memoryManager.allocate(6 * 1024 * 1024, 'a1', 'file'); // 60% usage

      const warning = memoryManager.checkMemoryWarning();

      expect(warning).not.toBeNull();
      expect(warning?.level).toBe('low');
      expect(warning?.message).toContain('increasing');
    });

    it('should return medium warning at 75% usage', () => {
      memoryManager.allocate(7.5 * 1024 * 1024, 'a1', 'file'); // 75% usage

      const warning = memoryManager.checkMemoryWarning();

      expect(warning).not.toBeNull();
      expect(warning?.level).toBe('medium');
      expect(warning?.suggestions).toContain('Monitor memory usage');
    });

    it('should return high warning at 85% usage', () => {
      memoryManager.allocate(8.5 * 1024 * 1024, 'a1', 'file'); // 85% usage

      const warning = memoryManager.checkMemoryWarning();

      expect(warning).not.toBeNull();
      expect(warning?.level).toBe('high');
      expect(warning?.suggestions).toContain('Consider processing smaller files');
    });

    it('should return critical warning at 95% usage', () => {
      memoryManager.allocate(9.5 * 1024 * 1024, 'a1', 'file'); // 95% usage

      const warning = memoryManager.checkMemoryWarning();

      expect(warning).not.toBeNull();
      expect(warning?.level).toBe('critical');
      expect(warning?.message).toContain('Critical');
      expect(warning?.suggestions).toContain('Restart the browser');
    });
  });

  describe('Memory Estimation', () => {
    it('should estimate memory for compression', () => {
      const fileSize = 10 * 1024 * 1024; // 10MB
      const estimated = memoryManager.estimateProcessingMemory(fileSize, 'compress');

      expect(estimated).toBe(30 * 1024 * 1024); // 3x factor
    });

    it('should estimate memory for merge', () => {
      const fileSize = 10 * 1024 * 1024;
      const estimated = memoryManager.estimateProcessingMemory(fileSize, 'merge');

      expect(estimated).toBe(25 * 1024 * 1024); // 2.5x factor
    });

    it('should estimate memory for split', () => {
      const fileSize = 10 * 1024 * 1024;
      const estimated = memoryManager.estimateProcessingMemory(fileSize, 'split');

      expect(estimated).toBe(20 * 1024 * 1024); // 2x factor
    });

    it('should estimate memory for OCR', () => {
      const fileSize = 10 * 1024 * 1024;
      const estimated = memoryManager.estimateProcessingMemory(fileSize, 'ocr');

      expect(estimated).toBe(40 * 1024 * 1024); // 4x factor
    });

    it('should use default factor for unknown tools', () => {
      const fileSize = 10 * 1024 * 1024;
      const estimated = memoryManager.estimateProcessingMemory(fileSize, 'unknown');

      expect(estimated).toBe(20 * 1024 * 1024); // 2x default factor
    });
  });

  describe('Concurrent Operations', () => {
    it('should allow concurrent operation when memory is available', () => {
      memoryManager.allocate(2 * 1024 * 1024, 'existing', 'file');

      const canStart = memoryManager.canStartConcurrentOperation(3 * 1024 * 1024);

      expect(canStart).toBe(true); // 5MB total < 8MB safe limit (80% of 10MB)
    });

    it('should prevent concurrent operation when it would exceed safe limit', () => {
      memoryManager.allocate(5 * 1024 * 1024, 'existing', 'file');

      const canStart = memoryManager.canStartConcurrentOperation(4 * 1024 * 1024);

      expect(canStart).toBe(false); // 9MB total > 8MB safe limit
    });

    it('should use 80% limit for safety buffer', () => {
      // Safe limit is 80% of 10MB = 8MB
      memoryManager.allocate(4 * 1024 * 1024, 'existing', 'file');

      // 4MB + 4MB = 8MB which is exactly at the safe limit, so should return true
      // 4MB + 4.1MB = 8.1MB which exceeds the safe limit, so should return false
      expect(memoryManager.canStartConcurrentOperation(4 * 1024 * 1024)).toBe(true);
      expect(memoryManager.canStartConcurrentOperation(4.1 * 1024 * 1024)).toBe(false);
    });
  });

  describe('Update Allocation', () => {
    it('should update allocation size successfully', () => {
      memoryManager.allocate(2 * 1024 * 1024, 'test', 'file');

      const result = memoryManager.updateAllocation('test', 3 * 1024 * 1024);

      expect(result).toBe(true);
      expect(memoryManager.getTotalAllocated()).toBe(3 * 1024 * 1024);
    });

    it('should return false for non-existent allocation', () => {
      const result = memoryManager.updateAllocation('non-existent', 1024);

      expect(result).toBe(false);
    });

    it('should throw error if update would exceed limit', () => {
      memoryManager.allocate(5 * 1024 * 1024, 'test', 'file');

      expect(() => {
        memoryManager.updateAllocation('test', 15 * 1024 * 1024);
      }).toThrow(MemoryError);
    });

    it('should update timestamp when updating allocation', () => {
      memoryManager.allocate(1 * 1024 * 1024, 'test', 'file');

      const originalTimestamp = memoryManager.getAllocation('test')?.timestamp;

      // Small delay
      const start = Date.now();
      while (Date.now() - start < 10) {
        // Wait
      }

      memoryManager.updateAllocation('test', 2 * 1024 * 1024);

      const newTimestamp = memoryManager.getAllocation('test')?.timestamp;

      expect(newTimestamp).toBeGreaterThan(originalTimestamp!);
    });
  });

  describe('Check Allocation', () => {
    it('should correctly check if allocation is possible', () => {
      memoryManager.allocate(5 * 1024 * 1024, 'test', 'file');

      expect(memoryManager.canAllocate(4 * 1024 * 1024)).toBe(true);
      expect(memoryManager.canAllocate(6 * 1024 * 1024)).toBe(false);
    });

    it('should handle edge case at exact limit', () => {
      memoryManager.allocate(5 * 1024 * 1024, 'test', 'file');

      expect(memoryManager.canAllocate(5 * 1024 * 1024)).toBe(true);
      expect(memoryManager.canAllocate(5 * 1024 * 1024 + 1)).toBe(false);
    });
  });

  describe('Reset', () => {
    it('should clear all allocations', () => {
      memoryManager.allocate(2 * 1024 * 1024, 'a1', 'file');
      memoryManager.allocate(3 * 1024 * 1024, 'a2', 'processing');

      memoryManager.reset();

      expect(memoryManager.getTotalAllocated()).toBe(0);
      expect(memoryManager.getAllocation('a1')).toBeUndefined();
      expect(memoryManager.getAllocation('a2')).toBeUndefined();
    });
  });

  describe('Error Context', () => {
    it('should provide suggestions in MemoryError', () => {
      const size = 15 * 1024 * 1024; // Exceeds limit

      try {
        memoryManager.allocate(size, 'too-large', 'file');
        expect.fail('Should have thrown MemoryError');
      } catch (error) {
        expect(error).toBeInstanceOf(MemoryError);
        const memError = error as MemoryError;
        expect(memError.suggestions).toBeDefined();
        expect(memError.suggestions.length).toBeGreaterThan(0);
        expect(memError.currentUsage).toBeDefined();
        expect(memError.limit).toBe(10 * 1024 * 1024);
      }
    });

    it('should provide specific suggestions based on allocation state', () => {
      // Allocate multiple files
      memoryManager.allocate(2 * 1024 * 1024, 'file1', 'file');
      memoryManager.allocate(2 * 1024 * 1024, 'file2', 'file');

      try {
        memoryManager.allocate(10 * 1024 * 1024, 'too-large', 'file');
        expect.fail('Should have thrown MemoryError');
      } catch (error) {
        const memError = error as MemoryError;
        // Should suggest processing files individually
        expect(memError.suggestions.some(s => s.includes('individually'))).toBe(true);
      }
    });
  });
});
