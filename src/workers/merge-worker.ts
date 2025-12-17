/**
 * PDF Merge Worker - PDF-lib integration for merging multiple PDFs
 * Validates: Requirements 4.1, 4.2, 4.3, 4.5
 */

import { PDFDocument } from 'pdf-lib';
import { MemoryManager } from './shared/memory-manager';
import { MessageFactory, ToolWorkerMessage, ProcessedFile } from './shared/progress-protocol';
import { ErrorHandler } from '../lib/error-handler';
import { FileUtils } from '../lib/file-utils';

export interface MergeOptions {
  fileOrder: string[]; // Array of file names in desired order
  preserveBookmarks?: boolean;
  preserveMetadata?: boolean;
  outputName?: string;
}

interface FileWithOrder {
  file: File;
  order: number;
  originalIndex: number;
}

class MergeWorker {
  private memoryManager: MemoryManager;
  private currentTaskId: string | null = null;
  private isProcessing = false;

  constructor() {
    this.memoryManager = new MemoryManager(1024); // 1GB limit
  }

  /**
   * Merge multiple PDF files
   */
  async mergeFiles(
    files: File[],
    options: MergeOptions,
    taskId: string
  ): Promise<void> {
    if (this.isProcessing) {
      throw new Error('Merge operation already in progress');
    }

    this.isProcessing = true;
    this.currentTaskId = taskId;

    try {
      const startTime = Date.now();

      // Step 1: Validate and prepare files
      this.reportProgress(5, 100, 'Preparing files', 'Validating PDF files...');
      
      const orderedFiles = this.orderFiles(files, options.fileOrder);
      await this.validateFiles(orderedFiles);

      // Step 2: Estimate memory requirements
      const totalSize = orderedFiles.reduce((sum, f) => sum + f.file.size, 0);
      const estimatedMemory = totalSize * 3; // Rough estimate: input + processing + output
      
      if (!this.memoryManager.canAllocate(estimatedMemory)) {
        throw new Error('Insufficient memory for merge operation');
      }

      // Step 3: Create new PDF document
      this.reportProgress(10, 100, 'Initializing', 'Creating new PDF document...');
      
      const mergedPdf = await PDFDocument.create();
      
      // Set metadata if preserving
      if (options.preserveMetadata && orderedFiles.length > 0) {
        await this.setMergedMetadata(mergedPdf, orderedFiles);
      }

      // Step 4: Process each file
      let totalPages = 0;
      let processedPages = 0;

      // First pass: count total pages for accurate progress
      this.reportProgress(15, 100, 'Analyzing files', 'Counting pages...');
      
      for (const fileWithOrder of orderedFiles) {
        // Check for cancellation
        if (!this.isProcessing) {
          return; // Exit early if cancelled
        }
        
        const pageCount = await this.getPageCount(fileWithOrder.file);
        totalPages += pageCount;
      }

      // Second pass: merge files
      for (let i = 0; i < orderedFiles.length; i++) {
        // Check for cancellation
        if (!this.isProcessing) {
          return; // Exit early if cancelled
        }

        const fileWithOrder = orderedFiles[i];
        const file = fileWithOrder.file;
        
        this.reportProgress(
          20 + (i / orderedFiles.length) * 70,
          100,
          'Merging files',
          `Processing ${file.name}...`
        );

        const pages = await this.mergeFile(mergedPdf, file, processedPages, totalPages);
        processedPages += pages;
      }

      // Step 5: Generate output
      this.reportProgress(90, 100, 'Finalizing', 'Generating merged PDF...');
      
      const mergedBytes = await mergedPdf.save();
      const outputName = options.outputName || this.generateOutputName(orderedFiles);

      // Step 6: Create result
      const result: ProcessedFile = {
        name: outputName,
        data: new Uint8Array(mergedBytes),
        size: mergedBytes.length,
        mimeType: 'application/pdf',
        metadata: {
          originalFiles: orderedFiles.map(f => f.file.name),
          totalPages: processedPages,
          mergeOrder: options.fileOrder,
          processingTime: Date.now() - startTime
        }
      };

      this.reportProgress(100, 100, 'Complete', 'Merge completed successfully');

      // Report completion
      this.postMessage(MessageFactory.createCompleteMessage(
        taskId,
        [result],
        {
          processingTime: Date.now() - startTime,
          tool: 'merge',
          options,
          totalPages: processedPages
        }
      ));

    } catch (error) {
      const processedError = ErrorHandler.processError(
        error instanceof Error ? error : new Error(String(error)),
        { 
          tool: 'merge', 
          operation: 'merge_files',
          fileSize: files.reduce((sum, f) => sum + f.size, 0)
        }
      );

      this.postMessage(MessageFactory.createErrorMessage(
        taskId,
        processedError.type as any,
        processedError.message,
        processedError.recovery.suggestions,
        processedError.recovery.canRecover
      ));
    } finally {
      this.isProcessing = false;
      this.cleanup();
    }
  }

  /**
   * Order files according to specified order
   */
  private orderFiles(files: File[], fileOrder: string[]): FileWithOrder[] {
    const fileMap = new Map<string, File>();
    files.forEach(file => fileMap.set(file.name, file));

    const orderedFiles: FileWithOrder[] = [];
    
    // Add files in specified order
    fileOrder.forEach((fileName, index) => {
      const file = fileMap.get(fileName);
      if (file) {
        orderedFiles.push({
          file,
          order: index,
          originalIndex: files.indexOf(file)
        });
        fileMap.delete(fileName);
      }
    });

    // Add any remaining files that weren't in the order list
    fileMap.forEach((file, fileName) => {
      orderedFiles.push({
        file,
        order: orderedFiles.length,
        originalIndex: files.indexOf(file)
      });
    });

    return orderedFiles;
  }

  /**
   * Validate all files before processing
   */
  private async validateFiles(orderedFiles: FileWithOrder[]): Promise<void> {
    for (const fileWithOrder of orderedFiles) {
      const file = fileWithOrder.file;
      
      // Basic validation
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error(`File ${file.name} is not a PDF`);
      }

      if (file.size === 0) {
        throw new Error(`File ${file.name} is empty`);
      }

      // Try to load as PDF to validate structure
      try {
        const arrayBuffer = await FileUtils.fileToArrayBuffer(file);
        await PDFDocument.load(arrayBuffer);
      } catch (error) {
        throw new Error(`File ${file.name} is not a valid PDF: ${error}`);
      }
    }
  }

  /**
   * Get page count from PDF file
   */
  private async getPageCount(file: File): Promise<number> {
    try {
      const arrayBuffer = await FileUtils.fileToArrayBuffer(file);
      const pdf = await PDFDocument.load(arrayBuffer);
      return pdf.getPageCount();
    } catch (error) {
      console.warn(`Could not get page count for ${file.name}:`, error);
      return 1; // Fallback
    }
  }

  /**
   * Merge a single file into the main document
   */
  private async mergeFile(
    mergedPdf: PDFDocument,
    file: File,
    processedPages: number,
    totalPages: number
  ): Promise<number> {
    try {
      // Load source PDF
      const arrayBuffer = await FileUtils.fileToArrayBuffer(file);
      const sourcePdf = await PDFDocument.load(arrayBuffer);
      
      const pageCount = sourcePdf.getPageCount();
      const pageIndices = Array.from({ length: pageCount }, (_, i) => i);

      // Copy pages with progress reporting
      for (let i = 0; i < pageIndices.length; i++) {
        const pageIndex = pageIndices[i];
        
        // Report progress for individual pages
        if (totalPages > 10) { // Only report page-level progress for larger documents
          this.reportProgress(
            20 + ((processedPages + i) / totalPages) * 70,
            100,
            'Copying pages',
            `Page ${processedPages + i + 1} of ${totalPages}`
          );
        }

        // Copy page
        const [copiedPage] = await mergedPdf.copyPages(sourcePdf, [pageIndex]);
        mergedPdf.addPage(copiedPage);

        // Preserve page dimensions
        const sourcePage = sourcePdf.getPage(pageIndex);
        const { width, height } = sourcePage.getSize();
        copiedPage.setSize(width, height);
      }

      return pageCount;
    } catch (error) {
      throw new Error(`Failed to merge ${file.name}: ${error}`);
    }
  }

  /**
   * Set metadata for merged PDF
   */
  private async setMergedMetadata(mergedPdf: PDFDocument, orderedFiles: FileWithOrder[]): Promise<void> {
    try {
      // Get metadata from first file
      const firstFile = orderedFiles[0].file;
      const arrayBuffer = await FileUtils.fileToArrayBuffer(firstFile);
      const firstPdf = await PDFDocument.load(arrayBuffer);
      
      const title = firstPdf.getTitle();
      const author = firstPdf.getAuthor();
      const subject = firstPdf.getSubject();

      // Set merged metadata
      if (title) {
        mergedPdf.setTitle(`Merged: ${title}`);
      } else {
        mergedPdf.setTitle('Merged PDF Document');
      }

      if (author) {
        mergedPdf.setAuthor(author);
      }

      if (subject) {
        mergedPdf.setSubject(`Merged from ${orderedFiles.length} documents: ${subject}`);
      }

      mergedPdf.setProducer('PDF Toolkit - Privacy-First PDF Tools');
      mergedPdf.setCreator('PDF Toolkit Merge Tool');
      mergedPdf.setCreationDate(new Date());
      mergedPdf.setModificationDate(new Date());

    } catch (error) {
      console.warn('Could not set merged metadata:', error);
      // Continue without metadata - not critical
    }
  }

  /**
   * Generate output filename
   */
  private generateOutputName(orderedFiles: FileWithOrder[]): string {
    if (orderedFiles.length === 0) {
      return 'merged.pdf';
    }

    if (orderedFiles.length === 1) {
      return FileUtils.generateSafeFilename(orderedFiles[0].file.name, 'merged');
    }

    // Use first file name as base
    const baseName = orderedFiles[0].file.name.replace(/\.pdf$/i, '');
    return FileUtils.generateSafeFilename(baseName, `merged_${orderedFiles.length}_files`);
  }

  /**
   * Report progress to main thread
   */
  private reportProgress(current: number, total: number, stage: string, message?: string): void {
    if (this.currentTaskId) {
      this.postMessage(MessageFactory.createProgressMessage(
        this.currentTaskId,
        current,
        total,
        stage,
        message
      ));
    }
  }

  /**
   * Post message to main thread
   */
  private postMessage(message: ToolWorkerMessage): void {
    self.postMessage(message);
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    try {
      this.memoryManager.cleanupTemporary();
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  }

  /**
   * Handle cancellation
   */
  cancel(): void {
    if (this.isProcessing && this.currentTaskId) {
      this.isProcessing = false;
      
      // Send cancellation message
      this.postMessage(MessageFactory.createCancelMessage(this.currentTaskId));
      
      // Clean up resources
      this.cleanup();
      
      // Reset state
      this.currentTaskId = null;
    }
  }
}

// Worker instance
const worker = new MergeWorker();

// Message handler
self.onmessage = async (event) => {
  const { type, payload, taskId } = event.data;

  try {
    switch (type) {
      case 'merge':
        const { files, options } = payload;
        await worker.mergeFiles(files, options, taskId);
        break;

      case 'cancel':
        worker.cancel();
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    const processedError = ErrorHandler.processError(
      error instanceof Error ? error : new Error(String(error)),
      { tool: 'merge', operation: type }
    );

    self.postMessage(MessageFactory.createErrorMessage(
      taskId,
      processedError.type as any,
      processedError.message,
      processedError.recovery.suggestions,
      processedError.recovery.canRecover
    ));
  }
};