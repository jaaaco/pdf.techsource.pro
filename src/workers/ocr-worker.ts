/**
 * OCR Worker - Tesseract WASM integration for optical character recognition
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { PDFDocument, PDFFont, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import { MemoryManager } from './shared/memory-manager';
import { MessageFactory, ToolWorkerMessage, ProcessedFile } from './shared/progress-protocol';
import { ErrorHandler } from '../lib/error-handler';
import { FileUtils } from '../lib/file-utils';

// Configure PDF.js worker
// We use a local path handled by Vite to ensure offline functionality and privacy
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * The text layer needs a font that can encode what Tesseract read.
 *
 * pdf-lib's built-in fonts are WinAnsi, which covers almost nothing: of the
 * Polish letters ąćęłńóśźż only ó encodes, and Cyrillic fails entirely. The
 * failures were silent - every word threw inside a swallowed catch and simply
 * vanished from the output.
 *
 * DejaVu Sans covers Latin, Latin Extended and Cyrillic. It is 750 kB, so it
 * is imported as a URL and fetched only when OCR actually runs, and pdf-lib
 * subsets it on save so the produced PDF carries only the glyphs it uses.
 */
import unicodeFontUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url';

/**
 * Canvas factory backed by OffscreenCanvas.
 *
 * pdf.js defaults to DOMCanvasFactory, which calls
 * `globalThis.document.createElement('canvas')`. There is no `document` in a
 * Web Worker, so any page that made pdf.js reach for a scratch canvas - which
 * it does for large images, and a 300 dpi A4 scan qualifies - died with
 * "Cannot read properties of undefined (reading 'createElement')".
 */
class OffscreenCanvasFactory {
  create(width: number, height: number) {
    const canvas = new OffscreenCanvas(Math.max(1, width), Math.max(1, height));
    return { canvas, context: canvas.getContext('2d') };
  }

  reset(canvasAndContext: { canvas: OffscreenCanvas | null }, width: number, height: number) {
    if (!canvasAndContext.canvas) throw new Error('Canvas is not specified');
    canvasAndContext.canvas.width = Math.max(1, width);
    canvasAndContext.canvas.height = Math.max(1, height);
  }

  destroy(canvasAndContext: { canvas: OffscreenCanvas | null; context: unknown }) {
    if (canvasAndContext.canvas) {
      canvasAndContext.canvas.width = 0;
      canvasAndContext.canvas.height = 0;
    }
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

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

interface RecognisedWord {
  text: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
}

/**
 * Pulls the word list out of a Tesseract result.
 *
 * This used to read `data.words`, which does not exist in tesseract.js v7 -
 * the field was removed and words now live nested under
 * blocks > paragraphs > lines > words. `(data.words || [])` therefore
 * evaluated to an empty array on every page, every guard downstream saw
 * zero words, and the "searchable" PDF shipped with no text layer at all
 * while reporting success. Recognition was working perfectly the whole time;
 * only this lookup was wrong.
 */
const extractWords = (data: unknown): RecognisedWord[] => {
  const page = data as {
    words?: unknown[]
    blocks?: Array<{ paragraphs?: Array<{ lines?: Array<{ words?: unknown[] }> }> }>
  };

  const raw: unknown[] =
    page.blocks?.flatMap(
      (block) => block.paragraphs?.flatMap((paragraph) => paragraph.lines?.flatMap((line) => line.words ?? []) ?? []) ?? [],
    ) ??
    // Kept as a fallback in case a future version restores the flat field.
    page.words ??
    [];

  return raw
    .map((entry) => entry as { text?: string; confidence?: number; bbox?: Record<string, number> })
    .filter((word) => word.text?.trim() && word.bbox)
    .map((word) => ({
      text: word.text as string,
      confidence: word.confidence ?? 0,
      bbox: {
        x: word.bbox!.x0,
        y: word.bbox!.y0,
        width: word.bbox!.x1 - word.bbox!.x0,
        height: word.bbox!.y1 - word.bbox!.y0,
      },
    }));
};

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

      // Load with PDF.js for rendering. The canvas factory is not optional
      // here - see OffscreenCanvasFactory above.
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        CanvasFactory: OffscreenCanvasFactory as never,
      });
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
      const page = await pdfJsDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });

      // Check for OffscreenCanvas support
      if (typeof OffscreenCanvas === 'undefined') {
        throw new Error('OffscreenCanvas is not supported in this browser environment.');
      }
      // Render to OffscreenCanvas
      const canvas = new OffscreenCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');

      if (!context) throw new Error('Failed to get canvas context');
      await page.render({
        canvasContext: context as any, // Type mismatch in some versions, cast to any
        viewport
      } as any).promise;
      const blob = await canvas.convertToBlob();
      // The third argument selects which outputs Tesseract produces, and
      // `blocks` is off by default (see
      // tesseract.js/src/worker-script/constants/defaultOutput.js). Without
      // asking for it, `data.blocks` comes back null and there are no word
      // boxes to build a text layer from - the field is present in the
      // result, just empty, which is why this looked like working code.
      const result = await this.tesseractWorker.recognize(blob, {}, { blocks: true });
      const data = result.data;

      if (!data) {
        return {
          text: '',
          confidence: 0,
          words: [],
          pageWidth: viewport.width,
          pageHeight: viewport.height,
          scale: scale
        };
      }

      return {
        text: data.text || '',
        confidence: data.confidence || 0,
        words: extractWords(data),
        pageWidth: viewport.width,
        pageHeight: viewport.height,
        scale: scale
      };

    } catch (error) {
      // Preserve the original error text. The wrapper used to hide whether
      // this was a bad document or a bug in here, and the classifier then
      // guessed "your PDF is corrupted" at the user.
      const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      throw new Error(`Failed to process page ${pageNumber}: ${detail}`);
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
      searchablePdf.registerFontkit(fontkit);

      // Fetched lazily and subset on save - see the import comment.
      const fontBytes = await (await fetch(unicodeFontUrl)).arrayBuffer();
      const font: PDFFont = await searchablePdf.embedFont(fontBytes, { subset: true });

      // Copy metadata
      const title = sourcePdf.getTitle();
      if (title) searchablePdf.setTitle(`${title} (OCR)`);
      searchablePdf.setProducer('PDF Toolkit OCR');
      searchablePdf.setCreationDate(new Date());

      // Copy pages
      const pageIndices = Array.from({ length: sourcePdf.getPageCount() }, (_, i) => i);
      const copiedPages = await searchablePdf.copyPages(sourcePdf, pageIndices);

      let written = 0;
      let skippedLowConfidence = 0;
      let skippedUnencodable = 0;
      let totalConfidence = 0;

      copiedPages.forEach((page, index) => {
        searchablePdf.addPage(page);
        const result = ocrResults[index];
        if (!result || result.words.length === 0) return;

        const { height } = page.getSize();

        result.words.forEach(word => {
          if (word.confidence < options.confidenceThreshold) {
            skippedLowConfidence += 1;
            return;
          }

          // Tesseract reports top-left origin in rendered pixels; PDF uses a
          // bottom-left origin in points, and recognition ran at `scale`.
          const pdfX = word.bbox.x / result.scale;
          const pdfY = height - (word.bbox.y / result.scale) - (word.bbox.height / result.scale);

          try {
            page.drawText(word.text, {
              x: pdfX,
              y: pdfY,
              size: word.bbox.height / result.scale, // Approximate font size
              font,
              color: rgb(0, 0, 0),
              opacity: 0, // Invisible - the scan underneath stays visible
            });
            written += 1;
            totalConfidence += word.confidence;
          } catch {
            // A glyph the font cannot encode. Counted rather than ignored:
            // this used to be a silent catch, which is how an entire
            // language could disappear from the output without a trace.
            skippedUnencodable += 1;
          }
        });
      });

      const pdfBytes = await searchablePdf.save();

      return {
        name: originalFileName.replace(/\.pdf$/i, '_ocr.pdf'),
        data: new Uint8Array(pdfBytes),
        size: pdfBytes.length,
        mimeType: 'application/pdf',
        metadata: {
          originalFileName,
          ocrLanguages: options.languages,
          totalPages: ocrResults.length,
          wordsWritten: written,
          skippedLowConfidence,
          skippedUnencodable,
          averageConfidence: written > 0 ? Math.round(totalConfidence / written) : 0
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