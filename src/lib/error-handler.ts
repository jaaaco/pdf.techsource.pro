/**
 * Error Handler - Centralized error handling and recovery strategies
 * Validates: Requirements 2.4, 10.5
 */

export interface ErrorContext {
  tool?: string;
  operation?: string;
  fileSize?: number;
  fileName?: string;
  memoryUsage?: number;
  timestamp: number;
  userAgent?: string;
}

export interface ErrorRecoveryStrategy {
  canRecover: boolean;
  suggestions: string[];
  autoRetry?: boolean;
  retryDelay?: number;
  maxRetries?: number;
}

export interface ProcessedError {
  type: string;
  message: string;
  originalError: Error;
  context: ErrorContext;
  recovery: ErrorRecoveryStrategy;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class ErrorHandler {
  private static errorCounts = new Map<string, number>();
  private static readonly MAX_ERROR_COUNT = 5;

  /**
   * Process and categorize errors with recovery strategies
   */
  static processError(error: Error, context: Partial<ErrorContext> = {}): ProcessedError {
    const fullContext: ErrorContext = {
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      ...context
    };

    const errorType = this.categorizeError(error);
    const recovery = this.getRecoveryStrategy(errorType, error, fullContext);
    const severity = this.determineSeverity(errorType, error, fullContext);

    // Track error frequency
    const errorKey = `${errorType}_${fullContext.tool || 'unknown'}`;
    const currentCount = this.errorCounts.get(errorKey) || 0;
    this.errorCounts.set(errorKey, currentCount + 1);

    return {
      type: errorType,
      message: this.generateUserFriendlyMessage(errorType, error, fullContext),
      originalError: error,
      context: fullContext,
      recovery,
      severity
    };
  }

  /**
   * Categorize error types
   */
  private static categorizeError(error: Error): string {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Memory-related errors
    if (message.includes('memory') || message.includes('allocation') || 
        name.includes('memory') || message.includes('out of memory')) {
      return 'MEMORY_LIMIT';
    }

    // File-related errors
    if (message.includes('file') || message.includes('read') || 
        message.includes('invalid pdf') || message.includes('corrupted')) {
      return 'FILE_ERROR';
    }

    // WASM-related errors
    if (message.includes('wasm') || message.includes('webassembly') || 
        message.includes('module') || name.includes('wasm')) {
      return 'WASM_ERROR';
    }

    // Network-related errors (shouldn't happen in our case, but good to handle)
    if (message.includes('network') || message.includes('fetch') || 
        message.includes('connection')) {
      return 'NETWORK_ERROR';
    }

    // Worker-related errors
    if (message.includes('worker') || name.includes('worker')) {
      return 'WORKER_ERROR';
    }

    // Processing-related errors
    if (message.includes('processing') || message.includes('compression') || 
        message.includes('merge') || message.includes('split') || message.includes('ocr')) {
      return 'PROCESSING_ERROR';
    }

    // Validation errors
    if (message.includes('validation') || message.includes('invalid') || 
        message.includes('format')) {
      return 'VALIDATION_ERROR';
    }

    // Browser compatibility errors
    if (message.includes('not supported') || message.includes('compatibility')) {
      return 'COMPATIBILITY_ERROR';
    }

    // Default to generic error
    return 'GENERIC_ERROR';
  }

  /**
   * Get recovery strategy based on error type
   */
  private static getRecoveryStrategy(
    errorType: string, 
    error: Error, 
    context: ErrorContext
  ): ErrorRecoveryStrategy {
    switch (errorType) {
      case 'MEMORY_LIMIT':
        return {
          canRecover: true,
          suggestions: [
            'Close other browser tabs to free memory',
            'Try processing smaller files',
            'Process files one at a time instead of in batch',
            'Restart your browser',
            'Try using a device with more RAM'
          ],
          autoRetry: false
        };

      case 'FILE_ERROR':
        return {
          canRecover: true,
          suggestions: [
            'Check if the PDF file is corrupted',
            'Try a different PDF file',
            'Ensure the file is not password protected',
            'Try saving the PDF from another application',
            'Check file permissions'
          ],
          autoRetry: false
        };

      case 'WASM_ERROR':
        return {
          canRecover: true,
          suggestions: [
            'Refresh the page to reload WASM modules',
            'Clear browser cache and try again',
            'Check if your browser supports WebAssembly',
            'Try using a different browser',
            'Disable browser extensions that might interfere'
          ],
          autoRetry: true,
          retryDelay: 2000,
          maxRetries: 2
        };

      case 'WORKER_ERROR':
        return {
          canRecover: true,
          suggestions: [
            'Refresh the page to restart workers',
            'Close other tabs that might be using workers',
            'Check if your browser supports Web Workers',
            'Try using a different browser'
          ],
          autoRetry: true,
          retryDelay: 1000,
          maxRetries: 1
        };

      case 'PROCESSING_ERROR':
        return {
          canRecover: true,
          suggestions: [
            'Try processing the file again',
            'Check if the PDF file is valid',
            'Try different processing settings',
            'Process smaller sections of the file',
            'Contact support if the problem persists'
          ],
          autoRetry: true,
          retryDelay: 1000,
          maxRetries: 2
        };

      case 'VALIDATION_ERROR':
        return {
          canRecover: false,
          suggestions: [
            'Check the file format and try again',
            'Ensure you\'re uploading a valid PDF file',
            'Try converting the file to PDF format',
            'Check if the file is corrupted'
          ],
          autoRetry: false
        };

      case 'COMPATIBILITY_ERROR':
        return {
          canRecover: false,
          suggestions: [
            'Update your browser to the latest version',
            'Try using a modern browser (Chrome, Firefox, Safari, Edge)',
            'Enable JavaScript if it\'s disabled',
            'Check browser compatibility requirements'
          ],
          autoRetry: false
        };

      case 'NETWORK_ERROR':
        return {
          canRecover: true,
          suggestions: [
            'Check your internet connection',
            'Try again in a few moments',
            'Refresh the page',
            'Clear browser cache'
          ],
          autoRetry: true,
          retryDelay: 3000,
          maxRetries: 3
        };

      default:
        return {
          canRecover: true,
          suggestions: [
            'Try the operation again',
            'Refresh the page if the problem persists',
            'Check browser console for more details',
            'Contact support if the issue continues'
          ],
          autoRetry: false
        };
    }
  }

  /**
   * Determine error severity
   */
  private static determineSeverity(
    errorType: string, 
    error: Error, 
    context: ErrorContext
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Critical errors that prevent any functionality
    if (errorType === 'COMPATIBILITY_ERROR' || errorType === 'WASM_ERROR') {
      return 'critical';
    }

    // High severity for memory issues or repeated errors
    const errorKey = `${errorType}_${context.tool || 'unknown'}`;
    const errorCount = this.errorCounts.get(errorKey) || 0;
    
    if (errorType === 'MEMORY_LIMIT' || errorCount >= this.MAX_ERROR_COUNT) {
      return 'high';
    }

    // Medium severity for processing and file errors
    if (errorType === 'PROCESSING_ERROR' || errorType === 'FILE_ERROR' || 
        errorType === 'WORKER_ERROR') {
      return 'medium';
    }

    // Low severity for validation and other errors
    return 'low';
  }

  /**
   * Generate user-friendly error messages
   */
  private static generateUserFriendlyMessage(
    errorType: string, 
    error: Error, 
    context: ErrorContext
  ): string {
    const toolName = context.tool ? ` ${context.tool}` : '';
    const fileName = context.fileName ? ` "${context.fileName}"` : '';

    switch (errorType) {
      case 'MEMORY_LIMIT':
        return `Not enough memory to process${fileName}. The file might be too large for your device.`;

      case 'FILE_ERROR':
        return `There's a problem with the PDF file${fileName}. It might be corrupted or in an unsupported format.`;

      case 'WASM_ERROR':
        return `The${toolName} processing engine failed to load. This might be a temporary issue.`;

      case 'WORKER_ERROR':
        return `The background processing system encountered an error. Please try again.`;

      case 'PROCESSING_ERROR':
        return `An error occurred while processing${fileName}. The operation could not be completed.`;

      case 'VALIDATION_ERROR':
        return `The file${fileName} is not valid or supported. Please check the file format.`;

      case 'COMPATIBILITY_ERROR':
        return `Your browser doesn't support all required features. Please update your browser or try a different one.`;

      case 'NETWORK_ERROR':
        return `A network error occurred. Please check your connection and try again.`;

      default:
        return `An unexpected error occurred${toolName ? ` in ${toolName}` : ''}. Please try again.`;
    }
  }

  /**
   * Check if error should trigger auto-retry
   */
  static shouldAutoRetry(processedError: ProcessedError): boolean {
    const errorKey = `${processedError.type}_${processedError.context.tool || 'unknown'}`;
    const errorCount = this.errorCounts.get(errorKey) || 0;
    
    return processedError.recovery.autoRetry === true && 
           errorCount <= (processedError.recovery.maxRetries || 1);
  }

  /**
   * Get retry delay for auto-retry
   */
  static getRetryDelay(processedError: ProcessedError): number {
    return processedError.recovery.retryDelay || 1000;
  }

  /**
   * Reset error count for a specific error type
   */
  static resetErrorCount(errorType: string, tool?: string): void {
    const errorKey = `${errorType}_${tool || 'unknown'}`;
    this.errorCounts.delete(errorKey);
  }

  /**
   * Clear all error counts
   */
  static clearErrorCounts(): void {
    this.errorCounts.clear();
  }

  /**
   * Get error statistics
   */
  static getErrorStats(): Map<string, number> {
    return new Map(this.errorCounts);
  }

  /**
   * Log error for debugging (in development)
   */
  static logError(processedError: ProcessedError): void {
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 ${processedError.type} (${processedError.severity})`);
      console.error('Original Error:', processedError.originalError);
      console.log('Context:', processedError.context);
      console.log('Recovery Strategy:', processedError.recovery);
      console.log('User Message:', processedError.message);
      console.groupEnd();
    }
  }

  /**
   * Create error report for support
   */
  static createErrorReport(processedError: ProcessedError): string {
    const report = {
      timestamp: new Date(processedError.context.timestamp).toISOString(),
      type: processedError.type,
      severity: processedError.severity,
      message: processedError.originalError.message,
      stack: processedError.originalError.stack,
      context: {
        tool: processedError.context.tool,
        operation: processedError.context.operation,
        fileSize: processedError.context.fileSize,
        memoryUsage: processedError.context.memoryUsage,
        userAgent: processedError.context.userAgent
      }
    };

    return JSON.stringify(report, null, 2);
  }
}