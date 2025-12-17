/**
 * OCR Worker - Tesseract WASM integration for optical character recognition
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { PDFDocument, rgb } from 'pdf-lib';
import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import { MemoryManager } from './shared/memory-manager';
import { MessageFactory, ToolWorkerMessage, ProcessedFile } from './shared/progress-protocol';
import { ErrorHandler } from '../lib/error-handler';
import { FileUtils } from '../lib/file-utils';

// Configure PDF.js worker
// We use a local path handled by Vite to ensure offline functionality and privacy
// @ts-expect-error - Vite handles this import
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface OCROptions {
  languages: string[];
  outputFormat: 'searchable-pdf' | 'text-only';
  confidenceThreshold: number;
  preprocessing: {
    deskew: boolean;
    denoise: boolean;
    enhance: boolean;
  };
}

interface OCRResult {
  text: string;
  confidence: number;
  words: Array<{
    text: string;
    confidence: number;
    bbox: { x: number; y: number; width: number; height: number };
  }>;
  pageWidth: number;
  pageHeight: number;
  scale: number;
}

class OCRWorker {
  private memoryManager: MemoryManager;
  private currentTaskId: string | null = null;
  private isProcessing = false;
  private tesseractWorker: any = null;

  constructor() {
    this.memoryManager = new MemoryManager(2048); // 2GB limit for OCR
  }

  /**
   * Initialize Tesseract Worker
   */
  async initializeTesseract(languages: string[]): Promise<void> {
    try {
      if (this.tesseractWorker) {
        await this.tesseractWorker.terminate();
      }

      const langString = languages.join('+');
      this.tesseractWorker = await createWorker(langString);

      // Optionally set parameters based on options (e.g., tessedit_char_whitelist)
    } catch (error) {
      // Fallback for common error: "declarations" missing or network issue
      throw new Error(`Failed to initialize Tesseract: ${error}`);
    }
  }

  /**
   * Perform OCR on PDF file
   */
  async performOCR(
    file: File,
    options: OCROptions,
    taskId: string
  ): Promise<void> {
    if (this.isProcessing) {
      throw new Error('OCR operation already in progress');
    }

    this.isProcessing = true;
    this.currentTaskId = taskId;

    try {
      const startTime = Date.now();

      // Step 1: Initialize Tesseract
      this.reportProgress(5, 100, 'Initializing OCR', 'Loading Tesseract engine...');
      await this.initializeTesseract(options.languages);

      // Step 2: Load PDF for Rendering (PDF.js) and Manipulation (pdf-lib)
      this.reportProgress(10, 100, 'Loading PDF', 'Reading PDF structure...');
      const arrayBuffer = await FileUtils.fileToArrayBuffer(file);

      // Load with pdf-lib for output generation
      const sourcePdf = await PDFDocument.load(arrayBuffer);
      const pageCount = sourcePdf.getPageCount();

      // Load with PDF.js for rendering
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdfJsDoc = await loadingTask.promise;

      // Step 3: Process each page
      this.reportProgress(15, 100, 'Processing pages', 'Starting OCR analysis...');

      const ocrResults: OCRResult[] = [];
      const renderScale = 2.0; // Higher scale = better OCR accuracy

      for (let i = 0; i < pageCount; i++) {
        if (!this.isProcessing) return;

        this.reportProgress(
          15 + (i / pageCount) * 70,
          100,
          'OCR Processing',
          `Processing page ${i + 1} of ${pageCount}...`
        );

        const pageResult = await this.processPage(pdfJsDoc, i + 1, renderScale);
        ocrResults.push(pageResult);
      }

      // Step 4: Generate output
      this.reportProgress(90, 100, 'Generating output', 'Creating output file...');

      let result: ProcessedFile;

      if (options.outputFormat === 'searchable-pdf') {
        result = await this.createSearchablePDF(sourcePdf, ocrResults, file.name, options);
      } else {
        result = await this.createTextOutput(ocrResults, file.name);
      }

      // Step 5: Finalize
      this.reportProgress(100, 100, 'Complete', 'OCR completed successfully');

      this.postMessage(MessageFactory.createCompleteMessage(
        taskId,
        [result],
        {
          processingTime: Date.now() - startTime,
          tool: 'ocr',
          options,
          totalPages: pageCount
        }
      ));

    } catch (error) {
      const rawErrorMsg = error instanceof Error ? error.message : String(error);
      const processedError = ErrorHandler.processError(
        error instanceof Error ? error : new Error(String(error)),
        {
          tool: 'ocr',
          operation: 'ocr_processing',
          fileSize: file.size,
          fileName: file.name
        }
      );

      // Append raw error for debugging
      const debugMessage = `${processedError.message} (Raw: ${rawErrorMsg})`;

      this.postMessage(MessageFactory.createErrorMessage(
        taskId,
        processedError.type as any,
        debugMessage,
        processedError.recovery.suggestions,
        processedError.recovery.canRecover
      ));
    } finally {
      this.isProcessing = false;
      this.cleanup();
    }
  }

  /**
   * Process a single page: Render -> OCR
   */
  private async processPage(
    pdfJsDoc: pdfjsLib.PDFDocumentProxy,
    pageNumber: number,
    scale: number
  ): Promise<OCRResult> {
    try {
      this.reportProgress(0, 100, 'Debug', `Page ${pageNumber}: Getting page...`);
      const page = await pdfJsDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });

      // Check for OffscreenCanvas support
      if (typeof OffscreenCanvas === 'undefined') {
        throw new Error('OffscreenCanvas is not supported in this browser environment.');
      }

      this.reportProgress(0, 100, 'Debug', `Page ${pageNumber}: Creating canvas...`);
      // Render to OffscreenCanvas
      const canvas = new OffscreenCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');

      if (!context) throw new Error('Failed to get canvas context');

      this.reportProgress(0, 100, 'Debug', `Page ${pageNumber}: Rendering PDF...`);
      await page.render({
        canvasContext: context as any, // Type mismatch in some versions, cast to any
        viewport
      } as any).promise;

      this.reportProgress(0, 100, 'Debug', `Page ${pageNumber}: Converting to blob...`);
      const blob = await canvas.convertToBlob();

      this.reportProgress(0, 100, 'Debug', `Page ${pageNumber}: Running Tesseract...`);
      // Run Tesseract
      const result = await this.tesseractWorker.recognize(blob);
      const data = result.data;

      if (!data) {
        this.reportProgress(0, 100, 'Debug', `Page ${pageNumber}: No data returned from Tesseract`);
        return {
          text: '',
          confidence: 0,
          words: [],
          pageWidth: viewport.width,
          pageHeight: viewport.height,
          scale: scale
        };
      }

      this.reportProgress(0, 100, 'Debug', `Page ${pageNumber}: Page processed. Data keys: ${Object.keys(data).join(', ')}`);

      return {
        text: data.text || '',
        confidence: data.confidence || 0,
        words: (data.words || []).map((word: any) => ({
          text: word.text,
          confidence: word.confidence,
          bbox: {
            x: word.bbox.x0,
            y: word.bbox.y0,
            width: word.bbox.x1 - word.bbox.x0,
            height: word.bbox.y1 - word.bbox.y0
          }
        })),
        pageWidth: viewport.width,
        pageHeight: viewport.height,
        scale: scale
      };

    } catch (error) {
      throw new Error(`Failed to process page ${pageNumber}: ${error}`);
    }
  }

  /**
   * Create searchable PDF with invisible text overlay
   */
  private async createSearchablePDF(
    sourcePdf: PDFDocument,
    ocrResults: OCRResult[],
    originalFileName: string,
    options: OCROptions
  ): Promise<ProcessedFile> {
    try {
      const searchablePdf = await PDFDocument.create();

      // Copy metadata
      const title = sourcePdf.getTitle();
      if (title) searchablePdf.setTitle(`${title} (OCR)`);
      searchablePdf.setProducer('PDF Toolkit OCR');
      searchablePdf.setCreationDate(new Date());

      // Copy pages
      const pageIndices = Array.from({ length: sourcePdf.getPageCount() }, (_, i) => i);
      const copiedPages = await searchablePdf.copyPages(sourcePdf, pageIndices);

      copiedPages.forEach((page, index) => {
        searchablePdf.addPage(page);
        const result = ocrResults[index];

        if (result && result.words.length > 0) {
          const { height } = page.getSize();

          // Add text overlay
          result.words.forEach(word => {
            if (word.confidence < options.confidenceThreshold) return; // Skip low confidence

            // Convert coordinates
            // Tesseract: Top-Left origin, scaled pixels
            // PDF-lib: Bottom-Left origin, points (usually 72 dpi)

            // Adjust scale (Tesseract ran on scale * PDF points)
            // So convert back to points: value / scale

            const pdfX = word.bbox.x / result.scale;
            // Flip Y axis
            // y_pdf = pageHeight - (y_top / scale) - (height / scale)
            const pdfY = height - (word.bbox.y / result.scale) - (word.bbox.height / result.scale);

            try {
              page.drawText(word.text, {
                x: pdfX,
                y: pdfY,
                size: word.bbox.height / result.scale, // Approximate font size
                color: rgb(0, 0, 0),
                opacity: 0, // Invisible
              });
            } catch (e) {
              // Ignore drawing errors for specific words
            }
          });
        }
      });

      const pdfBytes = await searchablePdf.save();

      return {
        name: originalFileName.replace(/\.pdf$/i, '_ocr.pdf'),
        data: new Uint8Array(pdfBytes),
        size: pdfBytes.length,
        mimeType: 'application/pdf',
        metadata: {
          originalFileName,
          ocrLanguages: ['eng'], // Simplified
          totalPages: ocrResults.length
        }
      };

    } catch (error) {
      throw new Error(`Failed to create searchable PDF: ${error}`);
    }
  }

  /**
   * Create text-only output
   */
  private async createTextOutput(
    ocrResults: OCRResult[],
    originalFileName: string
  ): Promise<ProcessedFile> {
    const textContent = ocrResults
      .map((result, index) => `--- Page ${index + 1} ---\n${result.text}\n`)
      .join('\n');

    const textBytes = new TextEncoder().encode(textContent);

    return {
      name: originalFileName.replace(/\.pdf$/i, '_ocr.txt'),
      data: textBytes,
      size: textBytes.length,
      mimeType: 'text/plain',
      metadata: {
        originalFileName,
        totalPages: ocrResults.length
      }
    };
  }

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

  private postMessage(message: ToolWorkerMessage): void {
    self.postMessage(message);
  }

  private cleanup(): void {
    if (this.tesseractWorker) {
      this.tesseractWorker.terminate().catch(() => { });
      this.tesseractWorker = null;
    }
    this.memoryManager.cleanupTemporary();
  }

  cancel(): void {
    if (this.isProcessing) {
      this.isProcessing = false;
      this.cleanup();
      if (this.currentTaskId) {
        this.postMessage(MessageFactory.createCancelMessage(this.currentTaskId));
      }
      this.currentTaskId = null;
    }
  }
}

const worker = new OCRWorker();

self.onmessage = async (event) => {
  const { type, payload, taskId } = event.data;

  try {
    switch (type) {
      case 'ocr':
        const { file, options } = payload;
        await worker.performOCR(file, options, taskId);
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
      { tool: 'ocr', operation: type }
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