/**
 * Progress Protocol - Standardized messaging system between Web Workers and UI
 * Validates: Requirements 2.3, 7.3
 */

export interface ProgressUpdate {
  current: number;
  total: number;
  stage: string;
  message?: string;
  percentage?: number;
}

export interface ProcessingResult {
  files: ProcessedFile[];
  metadata: ProcessingMetadata;
}

export interface ProcessedFile {
  name: string;
  data: Uint8Array;
  size: number;
  mimeType: string;
  originalSize?: number;
  compressionRatio?: number;
  metadata?: Record<string, any>;
}

export interface ProcessingMetadata {
  processingTime: number;
  totalPages?: number;
  tool: 'compress' | 'merge' | 'split' | 'ocr';
  options: Record<string, any>;
}

export interface ErrorInfo {
  type: 'MEMORY_LIMIT' | 'WASM_LOAD_FAILED' | 'INVALID_PDF' | 'PROCESSING_ERROR' | 'VALIDATION_ERROR' | 'WASM_ERROR' | 'WORKER_ERROR' | 'NETWORK_ERROR' | 'COMPATIBILITY_ERROR' | 'GENERIC_ERROR' | 'FILE_ERROR';
  message: string;
  suggestions?: string[];
  recoverable: boolean;
  details?: Record<string, any>;
}

export interface InitConfig {
  wasmPath?: string;
  memoryLimit?: number;
  options?: Record<string, any>;
}

export interface ToolWorkerMessage {
  type: 'progress' | 'complete' | 'error' | 'init' | 'cancel' | 'compress' | 'merge' | 'split' | 'ocr' | 'getPDFInfo' | 'validateRanges';
  payload: ProgressUpdate | ProcessingResult | ErrorInfo | InitConfig | any | null;
  taskId: string;
  timestamp: number;
}

/**
 * Message validation utilities
 */
export class MessageValidator {
  static validateWorkerMessage(message: any): message is ToolWorkerMessage {
    if (!message || typeof message !== 'object') {
      return false;
    }

    const { type, payload, taskId, timestamp } = message;

    // Validate required fields
    if (!type || !taskId || !timestamp) {
      return false;
    }

    // Validate message type
    const validTypes = ['progress', 'complete', 'error', 'init', 'cancel'];
    if (!validTypes.includes(type)) {
      return false;
    }

    // Validate payload based on type
    switch (type) {
      case 'progress':
        return this.validateProgressUpdate(payload);
      case 'complete':
        return this.validateProcessingResult(payload);
      case 'error':
        return this.validateErrorInfo(payload);
      case 'init':
        return this.validateInitConfig(payload);
      case 'cancel':
        return payload === null;
      default:
        return false;
    }
  }

  static validateProgressUpdate(payload: any): payload is ProgressUpdate {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    const { current, total, stage } = payload;
    return (
      typeof current === 'number' &&
      typeof total === 'number' &&
      typeof stage === 'string' &&
      current >= 0 &&
      total > 0 &&
      current <= total
    );
  }

  static validateProcessingResult(payload: any): payload is ProcessingResult {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    const { files, metadata } = payload;
    return (
      Array.isArray(files) &&
      files.every(this.validateProcessedFile) &&
      this.validateProcessingMetadata(metadata)
    );
  }

  static validateProcessedFile(file: any): file is ProcessedFile {
    if (!file || typeof file !== 'object') {
      return false;
    }

    const { name, data, size, mimeType } = file;
    return (
      typeof name === 'string' &&
      data instanceof Uint8Array &&
      typeof size === 'number' &&
      typeof mimeType === 'string' &&
      size >= 0
    );
  }

  static validateProcessingMetadata(metadata: any): metadata is ProcessingMetadata {
    if (!metadata || typeof metadata !== 'object') {
      return false;
    }

    const { processingTime, tool, options } = metadata;
    const validTools = ['compress', 'merge', 'split', 'ocr'];
    
    return (
      typeof processingTime === 'number' &&
      validTools.includes(tool) &&
      typeof options === 'object' &&
      processingTime >= 0
    );
  }

  static validateErrorInfo(payload: any): payload is ErrorInfo {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    const { type, message, recoverable } = payload;
    const validErrorTypes = ['MEMORY_LIMIT', 'WASM_LOAD_FAILED', 'INVALID_PDF', 'PROCESSING_ERROR', 'VALIDATION_ERROR', 'WASM_ERROR', 'WORKER_ERROR', 'NETWORK_ERROR', 'COMPATIBILITY_ERROR', 'GENERIC_ERROR', 'FILE_ERROR'];
    
    return (
      validErrorTypes.includes(type) &&
      typeof message === 'string' &&
      typeof recoverable === 'boolean'
    );
  }

  static validateInitConfig(payload: any): payload is InitConfig {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    // All fields are optional for InitConfig
    return true;
  }
}

/**
 * Message creation utilities
 */
export class MessageFactory {
  static createProgressMessage(
    taskId: string,
    current: number,
    total: number,
    stage: string,
    message?: string
  ): ToolWorkerMessage {
    const percentage = Math.round((current / total) * 100);
    
    return {
      type: 'progress',
      payload: {
        current,
        total,
        stage,
        message,
        percentage
      },
      taskId,
      timestamp: Date.now()
    };
  }

  static createCompleteMessage(
    taskId: string,
    files: ProcessedFile[],
    metadata: ProcessingMetadata
  ): ToolWorkerMessage {
    return {
      type: 'complete',
      payload: {
        files,
        metadata
      },
      taskId,
      timestamp: Date.now()
    };
  }

  static createErrorMessage(
    taskId: string,
    errorType: ErrorInfo['type'],
    message: string,
    suggestions?: string[],
    recoverable: boolean = true,
    details?: Record<string, any>
  ): ToolWorkerMessage {
    return {
      type: 'error',
      payload: {
        type: errorType,
        message,
        suggestions,
        recoverable,
        details
      },
      taskId,
      timestamp: Date.now()
    };
  }

  static createInitMessage(
    taskId: string,
    config?: InitConfig
  ): ToolWorkerMessage {
    return {
      type: 'init',
      payload: config || {},
      taskId,
      timestamp: Date.now()
    };
  }

  static createCancelMessage(taskId: string): ToolWorkerMessage {
    return {
      type: 'cancel',
      payload: null,
      taskId,
      timestamp: Date.now()
    };
  }
}

/**
 * Progress calculation utilities
 */
export class ProgressCalculator {
  static calculateFileProgress(
    currentFile: number,
    totalFiles: number,
    currentPage: number,
    totalPages: number
  ): number {
    if (totalFiles === 1) {
      return Math.round((currentPage / totalPages) * 100);
    }

    const fileProgress = currentFile / totalFiles;
    const pageProgress = (currentPage / totalPages) / totalFiles;
    return Math.round((fileProgress + pageProgress) * 100);
  }

  static calculateStageProgress(
    stages: string[],
    currentStage: string,
    stageProgress: number
  ): number {
    const stageIndex = stages.indexOf(currentStage);
    if (stageIndex === -1) return 0;

    const baseProgress = (stageIndex / stages.length) * 100;
    const currentStageProgress = (stageProgress / stages.length);
    
    return Math.round(baseProgress + currentStageProgress);
  }
}