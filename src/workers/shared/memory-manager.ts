/**
 * Memory Manager - Handles memory allocation tracking and limits
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4
 */

export interface MemoryAllocation {
  id: string;
  size: number;
  type: 'file' | 'processing' | 'wasm' | 'temporary';
  timestamp: number;
  description?: string;
}

export interface MemoryStats {
  totalAllocated: number;
  allocations: MemoryAllocation[];
  availableMemory: number;
  memoryLimit: number;
  utilizationPercentage: number;
}

export interface MemoryWarning {
  level: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  suggestions: string[];
  currentUsage: number;
  limit: number;
}

export class MemoryError extends Error {
  constructor(
    message: string,
    public currentUsage: number,
    public limit: number,
    public suggestions: string[] = []
  ) {
    super(message);
    this.name = 'MemoryError';
  }
}

export class MemoryManager {
  private allocations: Map<string, MemoryAllocation> = new Map();
  private readonly memoryLimit: number;
  private readonly warningThresholds = {
    low: 0.6,      // 60%
    medium: 0.75,  // 75%
    high: 0.85,    // 85%
    critical: 0.95 // 95%
  };

  constructor(memoryLimitMB: number = 1024) {
    this.memoryLimit = memoryLimitMB * 1024 * 1024; // Convert MB to bytes
  }

  /**
   * Allocate memory for a specific purpose
   */
  allocate(
    size: number,
    id: string,
    type: MemoryAllocation['type'] = 'temporary',
    description?: string
  ): boolean {
    // Check if allocation would exceed limit
    const totalAfterAllocation = this.getTotalAllocated() + size;
    if (totalAfterAllocation > this.memoryLimit) {
      const suggestions = this.generateMemorySuggestions();
      throw new MemoryError(
        `Allocation would exceed memory limit: ${this.formatBytes(totalAfterAllocation)} > ${this.formatBytes(this.memoryLimit)}`,
        totalAfterAllocation,
        this.memoryLimit,
        suggestions
      );
    }

    // Check for duplicate allocation ID
    if (this.allocations.has(id)) {
      throw new Error(`Memory allocation with ID '${id}' already exists`);
    }

    // Create allocation record
    const allocation: MemoryAllocation = {
      id,
      size,
      type,
      timestamp: Date.now(),
      description
    };

    this.allocations.set(id, allocation);
    return true;
  }

  /**
   * Deallocate memory by ID
   */
  deallocate(id: string): boolean {
    return this.allocations.delete(id);
  }

  /**
   * Deallocate all memory of a specific type
   */
  deallocateByType(type: MemoryAllocation['type']): number {
    let deallocatedCount = 0;
    
    for (const [id, allocation] of this.allocations) {
      if (allocation.type === type) {
        this.allocations.delete(id);
        deallocatedCount++;
      }
    }
    
    return deallocatedCount;
  }

  /**
   * Clean up all temporary allocations
   */
  cleanupTemporary(): number {
    return this.deallocateByType('temporary');
  }

  /**
   * Clean up old allocations (older than specified age in milliseconds)
   */
  cleanupOld(maxAge: number = 300000): number { // Default 5 minutes
    let cleanedCount = 0;
    const now = Date.now();
    
    for (const [id, allocation] of this.allocations) {
      if (now - allocation.timestamp > maxAge) {
        this.allocations.delete(id);
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  }

  /**
   * Get total allocated memory in bytes
   */
  getTotalAllocated(): number {
    return Array.from(this.allocations.values())
      .reduce((total, allocation) => total + allocation.size, 0);
  }

  /**
   * Get available memory in bytes
   */
  getAvailableMemory(): number {
    return Math.max(0, this.memoryLimit - this.getTotalAllocated());
  }

  /**
   * Get memory utilization percentage
   */
  getUtilizationPercentage(): number {
    return (this.getTotalAllocated() / this.memoryLimit) * 100;
  }

  /**
   * Get current memory statistics
   */
  getMemoryStats(): MemoryStats {
    const totalAllocated = this.getTotalAllocated();
    
    return {
      totalAllocated,
      allocations: Array.from(this.allocations.values()),
      availableMemory: this.getAvailableMemory(),
      memoryLimit: this.memoryLimit,
      utilizationPercentage: this.getUtilizationPercentage()
    };
  }

  /**
   * Check if memory usage requires a warning
   */
  checkMemoryWarning(): MemoryWarning | null {
    const utilization = this.getUtilizationPercentage() / 100;
    const currentUsage = this.getTotalAllocated();

    if (utilization >= this.warningThresholds.critical) {
      return {
        level: 'critical',
        message: 'Critical memory usage! Processing may fail.',
        suggestions: [
          'Close other browser tabs',
          'Process smaller files',
          'Split large files before processing',
          'Restart the browser'
        ],
        currentUsage,
        limit: this.memoryLimit
      };
    } else if (utilization >= this.warningThresholds.high) {
      return {
        level: 'high',
        message: 'High memory usage detected.',
        suggestions: [
          'Consider processing smaller files',
          'Close unnecessary browser tabs',
          'Monitor memory usage closely'
        ],
        currentUsage,
        limit: this.memoryLimit
      };
    } else if (utilization >= this.warningThresholds.medium) {
      return {
        level: 'medium',
        message: 'Moderate memory usage.',
        suggestions: [
          'Monitor memory usage',
          'Consider processing files individually'
        ],
        currentUsage,
        limit: this.memoryLimit
      };
    } else if (utilization >= this.warningThresholds.low) {
      return {
        level: 'low',
        message: 'Memory usage is increasing.',
        suggestions: [
          'Keep an eye on memory usage'
        ],
        currentUsage,
        limit: this.memoryLimit
      };
    }

    return null;
  }

  /**
   * Check if a new allocation would be safe
   */
  canAllocate(size: number): boolean {
    return (this.getTotalAllocated() + size) <= this.memoryLimit;
  }

  /**
   * Estimate memory needed for file processing
   */
  estimateProcessingMemory(fileSize: number, tool: string): number {
    // Estimation factors based on tool type
    const factors = {
      compress: 3.0,  // Compression needs input + output + working memory
      merge: 2.5,     // Merge needs all inputs + output
      split: 2.0,     // Split needs input + multiple outputs
      ocr: 4.0        // OCR needs input + image processing + text data
    };

    const factor = factors[tool as keyof typeof factors] || 2.0;
    return Math.ceil(fileSize * factor);
  }

  /**
   * Prevent concurrent operations that would exceed memory limits
   */
  canStartConcurrentOperation(estimatedMemory: number): boolean {
    const currentUsage = this.getTotalAllocated();
    const projectedUsage = currentUsage + estimatedMemory;
    
    // Leave 20% buffer for safety
    const safeLimit = this.memoryLimit * 0.8;
    
    return projectedUsage <= safeLimit;
  }

  /**
   * Generate memory optimization suggestions
   */
  private generateMemorySuggestions(): string[] {
    const suggestions = [
      'Close other browser tabs to free memory',
      'Process smaller files or split large files',
      'Try processing files one at a time',
      'Restart your browser to clear memory'
    ];

    const stats = this.getMemoryStats();
    
    // Add specific suggestions based on allocation types
    const fileAllocations = stats.allocations.filter(a => a.type === 'file');
    if (fileAllocations.length > 1) {
      suggestions.unshift('Process files individually instead of in batch');
    }

    const tempAllocations = stats.allocations.filter(a => a.type === 'temporary');
    if (tempAllocations.length > 5) {
      suggestions.unshift('Clear temporary data and try again');
    }

    return suggestions;
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
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
   * Reset all allocations (use with caution)
   */
  reset(): void {
    this.allocations.clear();
  }

  /**
   * Get allocation by ID
   */
  getAllocation(id: string): MemoryAllocation | undefined {
    return this.allocations.get(id);
  }

  /**
   * Update allocation size (for dynamic allocations)
   */
  updateAllocation(id: string, newSize: number): boolean {
    const allocation = this.allocations.get(id);
    if (!allocation) {
      return false;
    }

    // Check if update would exceed limit
    const currentTotal = this.getTotalAllocated();
    const sizeChange = newSize - allocation.size;
    
    if (currentTotal + sizeChange > this.memoryLimit) {
      throw new MemoryError(
        `Allocation update would exceed memory limit`,
        currentTotal + sizeChange,
        this.memoryLimit,
        this.generateMemorySuggestions()
      );
    }

    allocation.size = newSize;
    allocation.timestamp = Date.now();
    return true;
  }
}