import { MemoryManager } from './shared/memory-manager';
import { MessageFactory, ToolWorkerMessage, ProcessedFile } from './shared/progress-protocol';
import { UnifiedProgressReporter, StandardProgressStages } from './shared/unified-progress';
import { ErrorHandler } from '../lib/error-handler';
import { FileUtils } from '../lib/file-utils';
import { PDFDocument } from 'pdf-lib'; // Import PDFDocument here for type safety

export interface CompressionOptions {
  quality: 'screen' | 'ebook' | 'printer' | 'prepress';
  colorSpace?: 'RGB' | 'CMYK' | 'Gray';
  imageQuality?: number;
  removeMetadata?: boolean;
  optimizeImages?: boolean;
}

class CompressionWorker {
  private memoryManager: MemoryManager;
  private currentTaskId: string | null = null;
  private isProcessing = false;
  // Map of Assembly ID -> PDFDocument being built
  private assemblies: Map<string, PDFDocument> = new Map();

  constructor() {
    this.memoryManager = new MemoryManager(2048);
  }

  /**
   * Start a new PDF assembly task
   */
  async startAssembly(assemblyId: string): Promise<void> {
    const pdfDoc = await PDFDocument.create();
    this.assemblies.set(assemblyId, pdfDoc);
  }

  /**
   * Add a page image to an existing assembly
   */
  async addPageImage(assemblyId: string, imageData: Uint8Array, width: number, height: number): Promise<void> {
    const pdfDoc = this.assemblies.get(assemblyId);
    if (!pdfDoc) throw new Error(`Assembly ${assemblyId} not found`);

    const embeddedImage = await pdfDoc.embedJpg(imageData);
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: width,
      height: height,
    });
  }

  /**
   * Finish assembly and return processed file
   */
  async finishAssembly(assemblyId: string, originalFileName: string, options: CompressionOptions): Promise<ProcessedFile> {
    const pdfDoc = this.assemblies.get(assemblyId);
    if (!pdfDoc) throw new Error(`Assembly ${assemblyId} not found`);

    try {
      if (options.removeMetadata) {
        pdfDoc.setTitle('');
        pdfDoc.setAuthor('');
        pdfDoc.setProducer('PDF Toolkit');
      }

      const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
      const data = new Uint8Array(pdfBytes);

      // Cleanup
      this.assemblies.delete(assemblyId);

      return {
        name: originalFileName.replace('.pdf', '_compressed.pdf'),
        data: data,
        size: data.length,
        mimeType: 'application/pdf',
        originalSize: 0, // Main thread handles ratio calc if needed, or pass it in
        compressionRatio: 0, // Placeholder
        metadata: {
          originalName: originalFileName,
          compressionLevel: options.quality,
          method: 'rasterization_main_thread'
        }
      };
    } catch (e) {
      this.assemblies.delete(assemblyId);
      throw e;
    }
  }

  /**
   * Compress PDF files (Legacy/Structural Optimization Mode)
   */
  async compressFiles(
    files: File[],
    options: CompressionOptions,
    taskId: string
  ): Promise<void> {
    if (this.isProcessing) throw new Error('Compression already in progress');
    this.isProcessing = true;
    this.currentTaskId = taskId;

    const progressReporter = new UnifiedProgressReporter({
      taskId,
      stages: StandardProgressStages.COMPRESSION,
      totalItems: files.length
    });

    try {
      progressReporter.reportStageProgress(0, 'Initializing optimization engine...');
      const processedFiles: ProcessedFile[] = [];
      const startTime = Date.now();

      for (let i = 0; i < files.length; i++) {
        if (!this.isProcessing) break;
        const file = files[i];
        progressReporter.reportFileProgress(i + 1, files.length, 10, file.name);

        // Use logic based on quality.
        // Note: Screen/Ebook should now use Main Thread Orchestration, but if mistakenly sent here,
        // we will fallback to simple optimization or throw?
        // For now, we fallback to optimization to ensure *something* happens.
        const compressed = await this.compressByOptimization(await FileUtils.fileToArrayBuffer(file), options);

        processedFiles.push({
          name: file.name.replace('.pdf', '_opt.pdf'),
          data: compressed,
          size: compressed.length,
          mimeType: 'application/pdf',
          originalSize: file.size,
          compressionRatio: (file.size - compressed.length) / file.size,
          metadata: { originalName: file.name, method: 'optimization' }
        });

        progressReporter.reportFileProgress(i + 1, files.length, 100, file.name);
      }

      this.postMessage(MessageFactory.createCompleteMessage(
        taskId, processedFiles,
        { processingTime: Date.now() - startTime, tool: 'compress', options, totalPages: 0 }
      ));
    } catch (error) {
      // ... standard error handling ...
      const processedError = ErrorHandler.processError(
        error instanceof Error ? error : new Error(String(error)),
        { tool: 'compress', operation: 'compression' }
      );
      this.postMessage(MessageFactory.createErrorMessage(
        taskId, processedError.type as any, processedError.message, [], true
      ));
    } finally {
      this.isProcessing = false;
      this.cleanup();
    }
  }

  // ... compressByOptimization implementation ...
  private async compressByOptimization(data: ArrayBuffer, options: CompressionOptions): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(data);
    if (options.removeMetadata) {
      pdfDoc.setTitle('');
      pdfDoc.setProducer('PDF Toolkit');
    }
    return await pdfDoc.save({ useObjectStreams: true, objectsPerTick: 20 });
  }

  private postMessage(message: ToolWorkerMessage): void {
    self.postMessage(message);
  }

  private cleanup(): void {
    this.assemblies.clear();
    this.memoryManager.cleanupTemporary();
  }

  cancel(): void {
    this.isProcessing = false;
    this.cleanup();
    if (this.currentTaskId) {
      this.postMessage(MessageFactory.createCancelMessage(this.currentTaskId));
    }
    this.currentTaskId = null;
  }
}

// Worker instance
const worker = new CompressionWorker();

self.onmessage = async (event) => {
  const { type, payload, taskId } = event.data;

  try {
    switch (type) {
      case 'compress':
        await worker.compressFiles(payload.files, payload.options, taskId);
        break;

      case 'start_assembly':
        await worker.startAssembly(payload.assemblyId);
        self.postMessage({ type: 'assembly_started', taskId, assemblyId: payload.assemblyId });
        break;

      case 'add_page_image':
        await worker.addPageImage(payload.assemblyId, payload.imageData, payload.width, payload.height);
        self.postMessage({ type: 'page_added', taskId });
        break;

      case 'finish_assembly': {
        const result = await worker.finishAssembly(payload.assemblyId, payload.originalFileName, payload.options);
        self.postMessage(MessageFactory.createCompleteMessage(
          taskId, [result], { tool: 'compress', processingTime: 0, options: payload.options, totalPages: 0 }
        ));
        break;
      }

      case 'cancel':
        worker.cancel();
        break;

      default:
        if (!type) return;
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage(MessageFactory.createErrorMessage(
      taskId, 'PROCESSING_ERROR',
      error instanceof Error ? error.message : String(error), [], false
    ));
  }
};