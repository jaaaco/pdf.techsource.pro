/**
 * Message Router - Handles routing and processing of worker messages
 * Validates: Requirements 2.3, 7.3
 */

import { ToolWorkerMessage, MessageValidator } from './progress-protocol';

export type MessageHandler = (message: ToolWorkerMessage) => void;

export interface MessageRouterConfig {
  onProgress?: MessageHandler;
  onComplete?: MessageHandler;
  onError?: MessageHandler;
  onInit?: MessageHandler;
  onCancel?: MessageHandler;
  validateMessages?: boolean;
}

export class MessageRouter {
  private handlers: Map<string, MessageHandler> = new Map();
  private validateMessages: boolean;

  constructor(config: MessageRouterConfig = {}) {
    this.validateMessages = config.validateMessages ?? true;

    // Register handlers
    if (config.onProgress) this.handlers.set('progress', config.onProgress);
    if (config.onComplete) this.handlers.set('complete', config.onComplete);
    if (config.onError) this.handlers.set('error', config.onError);
    if (config.onInit) this.handlers.set('init', config.onInit);
    if (config.onCancel) this.handlers.set('cancel', config.onCancel);
  }

  /**
   * Route incoming message to appropriate handler
   */
  routeMessage(message: any): boolean {
    try {
      // 3rd party libraries (like pdfjs-dist) running in the worker might post their own messages.
      // We silently ignore messages that don't follow our protocol (must have a string type).
      if (!message || typeof message.type !== 'string') {
        return false;
      }

      // Check if we have a handler for this message type first
      const handler = this.handlers.get(message.type);

      if (handler) {
        // For custom message types, skip validation and call handler directly
        const customTypes = ['pdfInfo', 'rangeValidation'];
        if (customTypes.includes(message.type)) {
          handler(message as ToolWorkerMessage);
          return true;
        }

        // For standard message types, validate first
        if (this.validateMessages && !MessageValidator.validateWorkerMessage(message)) {
          console.error('Invalid message format:', message);
          return false;
        }

        const typedMessage = message as ToolWorkerMessage;
        handler(typedMessage);
        return true;
      } else {
        console.warn(`No handler registered for message type: ${message.type}`);
        return false;
      }
    } catch (error) {
      console.error('Error routing message:', error);
      return false;
    }
  }

  /**
   * Register a handler for a specific message type
   */
  registerHandler(type: ToolWorkerMessage['type'], handler: MessageHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Unregister a handler for a specific message type
   */
  unregisterHandler(type: ToolWorkerMessage['type']): void {
    this.handlers.delete(type);
  }

  /**
   * Clear all handlers
   */
  clearHandlers(): void {
    this.handlers.clear();
  }
}

/**
 * Worker communication manager for UI components
 */
export class WorkerCommunicator {
  private worker: Worker | null = null;
  private router: MessageRouter;
  private currentTaskId: string | null = null;

  constructor(config: MessageRouterConfig = {}) {
    this.router = new MessageRouter(config);
  }

  /**
   * Initialize worker with the given script path
   */
  async initializeWorker(workerScript: string | URL): Promise<void> {
    if (this.worker) {
      this.terminateWorker();
    }

    try {
      this.worker = new Worker(workerScript, { type: 'module' });
      this.worker.onmessage = (event) => {
        this.router.routeMessage(event.data);
      };

      this.worker.onerror = (error) => {
        console.error('Worker error:', error);
        this.handleWorkerError(error);
      };

    } catch (error) {
      throw new Error(`Failed to initialize worker: ${error}`);
    }
  }

  /**
   * Send message to worker
   */
  sendMessage(message: ToolWorkerMessage): void {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    this.worker.postMessage(message);
  }

  /**
   * Start a new task with the given ID
   */
  startTask(taskId: string, initConfig?: any): void {
    this.currentTaskId = taskId;

    if (initConfig) {
      this.sendMessage({
        type: 'init',
        payload: initConfig,
        taskId,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Cancel the current task
   */
  cancelCurrentTask(): void {
    if (this.currentTaskId) {
      this.sendMessage({
        type: 'cancel',
        payload: null,
        taskId: this.currentTaskId,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Terminate the worker
   */
  terminateWorker(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.currentTaskId = null;
    }
  }

  /**
   * Register message handlers
   */
  onProgress(handler: MessageHandler): void {
    this.router.registerHandler('progress', handler);
  }

  onComplete(handler: MessageHandler): void {
    this.router.registerHandler('complete', handler);
  }

  onError(handler: MessageHandler): void {
    this.router.registerHandler('error', handler);
  }

  /**
   * Register a handler for a specific message type
   */
  registerHandler(type: string, handler: MessageHandler): void {
    this.router.registerHandler(type as ToolWorkerMessage['type'], handler);
  }

  /**
   * Unregister a handler for a specific message type
   */
  unregisterHandler(type: string): void {
    this.router.unregisterHandler(type as ToolWorkerMessage['type']);
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(error: ErrorEvent): void {
    const errorMessage: ToolWorkerMessage = {
      type: 'error',
      payload: {
        type: 'PROCESSING_ERROR',
        message: `Worker error: ${error.message}`,
        recoverable: false
      },
      taskId: this.currentTaskId || 'unknown',
      timestamp: Date.now()
    };

    this.router.routeMessage(errorMessage);
  }

  /**
   * Get current task ID
   */
  getCurrentTaskId(): string | null {
    return this.currentTaskId;
  }

  /**
   * Check if worker is initialized
   */
  isWorkerReady(): boolean {
    return this.worker !== null;
  }
}

/**
 * Utility for generating unique task IDs
 */
export class TaskIdGenerator {
  private static counter = 0;

  static generate(prefix: string = 'task'): string {
    this.counter++;
    return `${prefix}_${Date.now()}_${this.counter}`;
  }

  static generateForTool(tool: string): string {
    return this.generate(tool);
  }
}