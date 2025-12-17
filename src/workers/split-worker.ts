/**
 * PDF Split Worker - PDF-lib integration for splitting PDFs by page ranges
 * Validates: Requirements 5.2, 5.3, 5.4
 */

import { PDFDocument } from 'pdf-lib';
import { MemoryManager } from './shared/memory-manager';
import { MessageFactory, ToolWorkerMessage, ProcessedFile } from './shared/progress-protocol';
import { ErrorHandler } from '../lib/error-handler';
import { FileUtils } from '../lib/file-utils';
import { PDFValidator } from '../lib/pdf-validator';

export interface SplitOptions {
  ranges: string; // e.g., "1-5, 8, 10-12"
  outputNaming: 'sequential' | 'range-based' | 'custom';
  customPrefix?: string;
}

interface PageRange {
  start: number;
  end: number;
  outputName: string;
}

class SplitWorker {
  private memoryManager: MemoryManager;
  private currentTaskId: string | null = null;
  private isProcessing = false;

  constructor() {
    this.memoryManager = new MemoryManager(1024); // 1GB limit
  }

  /**
   * Split PDF file by page ranges
   */
  async splitFile(
    file: File,
    options: SplitOptions,
    taskId: string
  ): Promise<void> {
    if (this.isProcessing) {
      throw new Error('Split operation already in progress');
    }

    this.isProcessing = true;
    this.currentTaskId = taskId;

    try {
      const startTime = Date.now();

      // Step 1: Validate file and load PDF
      this.reportProgress(5, 100, 'Loading PDF', 'Reading and validating PDF file...');
      
      const arrayBuffer = await FileUtils.fileToArrayBuffer(file);
      const sourcePdf = await PDFDocument.load(arrayBuffer);
      const totalPages = sourcePdf.getPageCount();

      // Step 2: Parse and validate page ranges
      this.reportProgress(10, 100, 'Parsing ranges', 'Validating page ranges...');
      
      const rangeValidation = PDFValidator.validatePageRanges(options.ranges, totalPages);
      if (!rangeValidation.isValid) {
        throw new Error(`Invalid page ranges: ${rangeValidation.errors.join(', ')}`);
      }

      const pageRanges = this.createPageRanges(rangeValidation.parsedRanges, options, file.name);

      // Step 3: Estimate memory requirements
      const estimatedMemory = file.size * (pageRanges.length + 1); // Source + outputs
      if (!this.memoryManager.canAllocate(estimatedMemory)) {
        throw new Error('Insufficient memory for split operation');
      }

      // Step 4: Split PDF into separate documents
      this.reportProgress(20, 100, 'Splitting PDF', 'Creating split documents...');
      
      const processedFiles: ProcessedFile[] = [];
      
      for (let i = 0; i < pageRanges.length; i++) {
        // Check for cancellation
        if (!this.isProcessing) {
          return; // Exit early if cancelled
        }

        const range = pageRanges[i];
        
        this.reportProgress(
          20 + (i / pageRanges.length) * 70,
          100,
          'Creating documents',
          `Processing ${range.outputName}...`
        );

        const splitFile = await this.createSplitDocument(sourcePdf, range, file.name);
        processedFiles.push(splitFile);
      }

      // Step 5: Finalize
      this.reportProgress(95, 100, 'Finalizing', 'Completing split operation...');

      // Report completion
      this.postMessage(MessageFactory.createCompleteMessage(
        taskId,
        processedFiles,
        {
          processingTime: Date.now() - startTime,
          tool: 'split',
          options,
          totalPages: processedFiles.reduce((sum, f) => sum + (f.metadata?.pageCount || 0), 0)
        }
      ));

    } catch (error) {
      const processedError = ErrorHandler.processError(
        error instanceof Error ? error : new Error(String(error)),
        { 
          tool: 'split', 
          operation: 'split_file',
          fileSize: file.size,
          fileName: file.name
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
   * Create page ranges with output names
   */
  private createPageRanges(
    parsedRanges: Array<{start: number, end: number}>,
    options: SplitOptions,
    originalFileName: string
  ): PageRange[] {
    const baseName = originalFileName.replace(/\.pdf$/i, '');
    const ranges: PageRange[] = [];

    parsedRanges.forEach((range, index) => {
      let outputName: string;

      switch (options.outputNaming) {
        case 'sequential':
          outputName = `${baseName}_part_${index + 1}.pdf`;
          break;
        
        case 'range-based':
          if (range.start === range.end) {
            outputName = `${baseName}_page_${range.start}.pdf`;
          } else {
            outputName = `${baseName}_pages_${range.start}-${range.end}.pdf`;
          }
          break;
        
        case 'custom':
          const prefix = options.customPrefix || baseName;
          if (range.start === range.end) {
            outputName = `${prefix}_page_${range.start}.pdf`;
          } else {
            outputName = `${prefix}_pages_${range.start}-${range.end}.pdf`;
          }
          break;
        
        default:
          outputName = `${baseName}_split_${index + 1}.pdf`;
      }

      ranges.push({
        start: range.start,
        end: range.end,
        outputName: FileUtils.generateSafeFilename(outputName.replace('.pdf', ''))
      });
    });

    return ranges;
  }

  /**
   * Create a split document for a specific page range
   */
  private async createSplitDocument(
    sourcePdf: PDFDocument,
    range: PageRange,
    originalFileName: string
  ): Promise<ProcessedFile> {
    try {
      // Create new PDF document
      const splitPdf = await PDFDocument.create();

      // Copy metadata from source
      const title = sourcePdf.getTitle();
      const author = sourcePdf.getAuthor();
      const subject = sourcePdf.getSubject();

      if (title) {
        splitPdf.setTitle(`${title} (Pages ${range.start}-${range.end})`);
      }
      if (author) {
        splitPdf.setAuthor(author);
      }
      if (subject) {
        splitPdf.setSubject(`Split from: ${subject || originalFileName}`);
      }

      splitPdf.setProducer('PDF Toolkit - Privacy-First PDF Tools');
      splitPdf.setCreator('PDF Toolkit Split Tool');
      splitPdf.setCreationDate(new Date());

      // Calculate page indices (convert from 1-based to 0-based)
      const pageIndices: number[] = [];
      for (let i = range.start - 1; i < range.end; i++) {
        pageIndices.push(i);
      }

      // Copy pages
      const copiedPages = await splitPdf.copyPages(sourcePdf, pageIndices);
      copiedPages.forEach(page => splitPdf.addPage(page));

      // Generate PDF bytes
      const pdfBytes = await splitPdf.save();

      return {
        name: range.outputName,
        data: new Uint8Array(pdfBytes),
        size: pdfBytes.length,
        mimeType: 'application/pdf',
        metadata: {
          originalFileName,
          pageRange: `${range.start}-${range.end}`,
          pageCount: pageIndices.length,
          startPage: range.start,
          endPage: range.end
        }
      };

    } catch (error) {
      throw new Error(`Failed to create split document for pages ${range.start}-${range.end}: ${error}`);
    }
  }

  /**
   * Get PDF information including page count
   */
  async getPDFInfo(file: File): Promise<{ pageCount: number; title?: string; author?: string }> {
    try {
      const arrayBuffer = await FileUtils.fileToArrayBuffer(file);
      const pdf = await PDFDocument.load(arrayBuffer);
      
      return {
        pageCount: pdf.getPageCount(),
        title: pdf.getTitle() || undefined,
        author: pdf.getAuthor() || undefined
      };
    } catch (error) {
      throw new Error(`Failed to read PDF information: ${error}`);
    }
  }

  /**
   * Validate page ranges against document
   */
  validateRanges(ranges: string, totalPages: number): { isValid: boolean; errors: string[]; parsedRanges: Array<{start: number, end: number}> } {
    return PDFValidator.validatePageRanges(ranges, totalPages);
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
const worker = new SplitWorker();

// Message handler
self.onmessage = async (event) => {
  const { type, payload, taskId } = event.data;

  try {
    switch (type) {
      case 'split':
        const { file, options } = payload;
        await worker.splitFile(file, options, taskId);
        break;

      case 'getPDFInfo':
        const { file: infoFile } = payload;
        const info = await worker.getPDFInfo(infoFile);
        self.postMessage({
          type: 'pdfInfo',
          payload: info,
          taskId,
          timestamp: Date.now()
        });
        break;

      case 'validateRanges':
        const { ranges, totalPages } = payload;
        const validation = worker.validateRanges(ranges, totalPages);
        self.postMessage({
          type: 'rangeValidation',
          payload: validation,
          taskId,
          timestamp: Date.now()
        });
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
      { tool: 'split', operation: type }
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