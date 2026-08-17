/**
 * Compress - PDF compression tool interface
 *
 * The processing pipeline is untouched by the redesign: pages are rasterised
 * on the main thread (so they render with the fonts the DOM has) and streamed
 * into a worker that reassembles them into a PDF. Only the surface changed.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import AppShell from '@/components/AppShell';
import FileDropzone from '@/components/FileDropzone';
import ToolHero from '@/components/ToolHero';
import SeoSection from '@/components/SeoSection';
import RelatedGuides from '@/components/RelatedGuides';
import ProgressBar from '@/components/ProgressBar';
import DownloadButton from '@/components/DownloadButton';
import DebugConsole from '@/components/DebugConsole';
import { getRoute } from '@/seo/manifest';
import useDocumentMeta from '@/seo/useDocumentMeta';
import { WorkerCommunicator, TaskIdGenerator } from '@/workers/shared/message-router';
import { ProgressUpdate, ProcessedFile } from '@/workers/shared/progress-protocol';
import { ErrorHandler } from '@/lib/error-handler';
import { FileUtils } from '@/lib/file-utils';
import { useDebugConsole } from '@/hooks/useDebugConsole';
import {
  AlertIcon,
  ArrowRightIcon,
  CheckIcon,
  CompressIcon,
  FileIcon,
  InfoIcon,
  PlusIcon,
  TrashIcon,
  UploadIcon,
} from '@/components/icons';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface CompressionOptions {
  /**
   * Only the two rasterising presets remain. 'printer' and 'prepress' were
   * removed after the benchmark showed they returned the input unchanged in
   * 0.0s on every fixture in the corpus.
   */
  quality: 'screen' | 'ebook';
  colorSpace?: 'RGB' | 'CMYK' | 'Gray';
  imageQuality?: number;
  removeMetadata?: boolean;
  optimizeImages?: boolean;
}

interface CompressionState {
  files: File[];
  options: CompressionOptions;
  isProcessing: boolean;
  progress: ProgressUpdate | null;
  results: ProcessedFile[];
  error: string | null;
  debugLogs: string[];
}

/**
 * Figures from the benchmark corpus in the repository, quoted as what they
 * are: what these presets did to *those* fixtures. They are deliberately not
 * scaled to the file on screen - the ratio a scan gets and the ratio a Word
 * export gets differ by two orders of magnitude, so a per-file "estimate"
 * would be a number this tool cannot honestly predict.
 */
const QUALITY_PRESETS = [
  {
    value: 'ebook' as const,
    title: 'E-book · 150 DPI',
    note: 'Balanced and readable. Benchmark: a 3.95 MB 300 dpi scan came out at 0.47 MB.',
  },
  {
    value: 'screen' as const,
    title: 'Screen · 72 DPI',
    note: 'Smallest file, visibly softer at full zoom. Same scan: 0.17 MB, 96% smaller.',
  },
];

const stripCompressedSuffix = (name: string) => name.replace(/_compressed(?=\.[^.]+$)/, '');

/**
 * Refuses to hand back a file that got bigger, and records what it started as.
 *
 * Compression here works by rasterising each page, which is a large win on a
 * scan and a disaster on a PDF that was already vector text - measured at
 * 110x on a twenty-page Word export. Returning that from a button labelled
 * "Compress" is indefensible, so when the result is not actually smaller the
 * original is returned untouched and the UI says what happened.
 *
 * The page-assembly path in the worker emits `originalSize: 0` with a comment
 * saying the main thread should fill it in - which nothing ever did, so every
 * result rendered as a bare output size with no before-and-after. The
 * original bytes are only reachable here, so it is stamped on here.
 */
const keepSmallerResult = async (
  produced: ProcessedFile,
  sources: File[]
): Promise<ProcessedFile> => {
  const source = sources.find(file => file.name === stripCompressedSuffix(produced.name));
  if (!source) return produced;

  if (produced.size < source.size) {
    return {
      ...produced,
      originalSize: source.size,
      compressionRatio: (source.size - produced.size) / source.size,
    };
  }

  return {
    ...produced,
    name: source.name,
    data: new Uint8Array(await source.arrayBuffer()),
    size: source.size,
    originalSize: source.size,
    compressionRatio: 1,
    metadata: { ...produced.metadata, unchanged: true, attemptedSize: produced.size },
  };
};

const Compress: React.FC = () => {
  const route = getRoute('/compress')!;
  const location = useLocation();
  useDocumentMeta({
    title: route.title,
    description: route.description,
    path: route.path,
    locale: route.locale,
  });
  const [isDebugVisible] = useDebugConsole();
  const [state, setState] = useState<CompressionState>({
    files: [],
    options: {
      quality: 'ebook',
      removeMetadata: true,
      optimizeImages: true,
    },
    isProcessing: false,
    progress: null,
    results: [],
    error: null,
    debugLogs: [],
  });

  // The worker's completion callback is created once and lives outside the
  // render cycle, so it cannot read state.files. A ref keeps the originals
  // reachable for the size guard.
  const inputFilesRef = useRef<File[]>([]);
  useEffect(() => {
    inputFilesRef.current = state.files;
  }, [state.files]);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    setState(prev => ({
      ...prev,
      debugLogs: [...prev.debugLogs, `[${timestamp}] ${message}`]
    }));
  }, []);

  // Worker communicator
  const [workerCommunicator] = useState(() => new WorkerCommunicator({
    onProgress: (message) => {
      const payload = message.payload as ProgressUpdate;
      const progressPercent = payload.percentage ?? Math.round((payload.current / payload.total) * 100) ?? 0;
      setState(prev => ({
        ...prev,
        progress: payload,
        debugLogs: [...prev.debugLogs, `[${new Date().toISOString().split('T')[1].slice(0, -1)}] Progress: ${payload.stage} (${progressPercent}%) - ${payload.message || ''}`]
      }));
    },
    onComplete: (message) => {
      const produced = (message.payload as { files: ProcessedFile[] }).files;

      // The size guard has to read the original bytes, which is async, so the
      // state update waits for it rather than happening inline.
      void Promise.all(produced.map(file => keepSmallerResult(file, inputFilesRef.current)))
        .then(results => {
          const kept = results.filter(file => file.metadata?.unchanged).length;
          setState(prev => ({
            ...prev,
            isProcessing: false,
            progress: null,
            results,
            debugLogs: [
              ...prev.debugLogs,
              `[${new Date().toISOString().split('T')[1].slice(0, -1)}] Complete: Processed ${results.length} file(s)` +
                (kept > 0 ? ` (${kept} already optimal, left unchanged)` : '')
            ]
          }));
        });
    },
    onError: (message) => {
      const rawError = message.payload as { message?: string };
      const errorMsg = rawError.message || JSON.stringify(rawError);

      const processedError = ErrorHandler.processError(new Error(errorMsg));
      setState(prev => ({
        ...prev,
        isProcessing: false,
        progress: null,
        error: processedError.message,
        debugLogs: [...prev.debugLogs, `[${new Date().toISOString().split('T')[1].slice(0, -1)}] Error: ${errorMsg}`]
      }));
    }
  }));

  useEffect(() => {
    let isMounted = true;

    const initWorker = async () => {
      if (isMounted) addLog('Initializing Compress worker...');
      try {
        await workerCommunicator.initializeWorker(() => {
          const worker = new Worker(new URL('../workers/compress-worker.ts', import.meta.url), { type: 'module' });
          if (isMounted) addLog('Worker script resolved via Vite bundler');
          return worker;
        });

        if (isMounted) addLog('Worker initialized successfully');
      } catch (error) {
        if (!isMounted) return;
        console.error('Failed to initialize compress worker:', error);
        addLog(`Failed to initialize worker: ${String(error)}`);
        setState(prev => ({
          ...prev,
          error: 'Failed to initialize background processing system. Please refresh the page.'
        }));
      }
    };

    initWorker();

    // Cleanup worker on unmount
    return () => {
      isMounted = false;
      addLog('Terminating worker instance (cleanup)...');
      workerCommunicator.terminateWorker();
    };
  }, [workerCommunicator, addLog]);

  const handleFilesSelected = useCallback((files: File[]) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    setState(prev => ({
      ...prev,
      files: [...prev.files, ...files],
      error: null,
      debugLogs: [...prev.debugLogs, `[${timestamp}] Selected ${files.length} file(s): ${files.map(f => f.name).join(', ')}`]
    }));
  }, []);

  // Files handed over from the homepage dropzone arrive in router state.
  useEffect(() => {
    const handoff = (location.state as { files?: File[] } | null)?.files;
    if (handoff?.length) handleFilesSelected(handoff);
    // Only on arrival; re-running on every state change would re-add them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOptionsChange = useCallback((newOptions: Partial<CompressionOptions>) => {
    setState(prev => ({
      ...prev,
      options: { ...prev.options, ...newOptions }
    }));
  }, []);

  const handleCompress = useCallback(async () => {
    if (state.files.length === 0 || state.isProcessing) return;

    addLog(`Starting compression for ${state.files.length} file(s)`);
    addLog(`Options: ${JSON.stringify(state.options)}`);

    setState(prev => ({
      ...prev,
      isProcessing: true,
      progress: null,
      results: [],
      error: null
    }));

    const taskId = TaskIdGenerator.generateForTool('compress');
    addLog(`Created Task ID: ${taskId}`);

    try {
      // Rasterisation runs on the main thread so that pages render with the
      // system fonts the DOM has, rather than whatever a worker can resolve.
      addLog('Using Main Thread Rendering Strategy (High Compatibility)');

      for (let i = 0; i < state.files.length; i++) {
        const file = state.files[i];
        const assemblyId = `${taskId}_${i}`;

        // 1. Initialize Assembly in Worker
        workerCommunicator.sendMessage({
          type: 'start_assembly',
          taskId,
          payload: { assemblyId },
          timestamp: Date.now()
        });

        // 2. Load PDF
        addLog(`Loading PDF: ${file.name}`);
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
          cMapUrl: `https://unpkg.com/pdfjs-dist@5.4.449/cmaps/`,
          cMapPacked: true,
        });
        const pdfDoc = await loadingTask.promise;

        const scale = state.options.quality === 'screen' ? 1.0 : 1.5;
        const quality = state.options.quality === 'screen' ? 0.6 : 0.8;

        // 3. Render Pages
        for (let p = 1; p <= pdfDoc.numPages; p++) {
          const fileProgress = p / pdfDoc.numPages;
          const totalProgress = ((i + fileProgress) / state.files.length) * 100;
          const progressMsg = `Rendering page ${p}/${pdfDoc.numPages}...`;

          setState(prev => ({
            ...prev,
            progress: {
              taskId,
              current: i + 1,
              total: state.files.length,
              stage: 'Processing',
              message: progressMsg,
              percentage: Math.round(totalProgress)
            }
          }));

          if (p === 1 || p % 5 === 0 || p === pdfDoc.numPages) {
            addLog(`[Progress ${Math.round(totalProgress)}%] ${progressMsg}`);
          }

          const page = await pdfDoc.getPage(p);
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const context = canvas.getContext('2d');

          if (!context) throw new Error('Canvas Context Failed');

          await page.render({ canvasContext: context, viewport, canvas }).promise;

          // Convert to blob/bytes
          const blob = await new Promise<Blob | null>(resolve =>
            canvas.toBlob(resolve, 'image/jpeg', quality)
          );

          if (!blob) throw new Error('Image encoding failed');
          const arrayBuf = await blob.arrayBuffer();

          // 4. Send Page to Worker
          workerCommunicator.sendMessage({
            type: 'add_page_image',
            taskId,
            payload: {
              assemblyId,
              imageData: new Uint8Array(arrayBuf),
              width: viewport.width / scale, // PDF units
              height: viewport.height / scale
            },
            timestamp: Date.now()
          });

          // Allow UI to breathe
          await new Promise(r => setTimeout(r, 0));
        }

        // 5. Finish Assembly
        workerCommunicator.sendMessage({
          type: 'finish_assembly',
          taskId,
          payload: {
            assemblyId,
            originalFileName: file.name,
            options: state.options
          },
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Compression failed:', error);
      addLog(`Error: ${error}`);
      setState(prev => ({ ...prev, isProcessing: false, error: String(error) }));
    }
  }, [state.files, state.isProcessing, state.options, workerCommunicator, addLog]);

  const handleCancel = useCallback(() => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    workerCommunicator.cancelCurrentTask();
    setState(prev => ({
      ...prev,
      isProcessing: false,
      progress: null,
      debugLogs: [...prev.debugLogs, `[${timestamp}] Cancelled by user`]
    }));
  }, [workerCommunicator]);

  const handleReset = useCallback(() => {
    setState(prev => ({
      ...prev,
      files: [],
      results: [],
      error: null,
      progress: null
    }));
  }, []);

  const removeFile = useCallback((index: number) => {
    setState(prev => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index)
    }));
  }, []);

  const totalSize = state.files.reduce((sum, file) => sum + file.size, 0);
  const isEditing = !state.isProcessing && state.results.length === 0;
  const summary =
    state.files.length > 0
      ? `${state.files.length} file${state.files.length === 1 ? '' : 's'} · ${FileUtils.formatFileSize(totalSize)}`
      : null;

  return (
    <AppShell
      active="compress"
      tool={{ title: 'Compress', meta: summary && <span className="tag tag-accent">{summary}</span> }}
    >
      <ToolHero
        route={route}
        meta={summary && <span className="tag tag-accent desktop-only">{summary}</span>}
      />

      {state.error && (
        <div className="section-tight">
          <p className="callout callout-error" style={{ whiteSpace: 'pre-line' }}>
            <AlertIcon size={18} />
            <span>{state.error}</span>
          </p>
        </div>
      )}

      {isEditing && (
        <>
          {state.files.length === 0 ? (
            <div className="section-tight section-ruled">
              <FileDropzone
                multiple
                maxFiles={10}
                onFilesSelected={handleFilesSelected}
                onValidationError={(message) => setState(prev => ({ ...prev, error: message }))}
              >
                <UploadIcon size={26} style={{ color: 'var(--color-accent)' }} />
                <span className="dropzone-title">Drop a PDF, or pick one</span>
                <span className="text-muted" style={{ fontSize: 12 }}>
                  Up to 500 MB per file · stays on this device
                </span>
                <span className="btn btn-primary btn-block" aria-hidden="true">
                  Select files
                  <ArrowRightIcon size={18} className="btn-arrow" />
                </span>
              </FileDropzone>
            </div>
          ) : (
            <div className="rows">
              {state.files.map((file, index) => (
                <div className="row" key={`${file.name}-${index}`}>
                  <FileIcon size={22} />
                  <span className="row-body">
                    <span className="row-name" title={file.name}>{file.name}</span>
                    <span className="row-meta text-muted">{FileUtils.formatFileSize(file.size)}</span>
                  </span>
                  <span className="row-actions">
                    <button
                      type="button"
                      className="btn btn-icon row-remove"
                      onClick={() => removeFile(index)}
                      aria-label={`Remove ${file.name}`}
                    >
                      <TrashIcon size={18} />
                    </button>
                  </span>
                </div>
              ))}

              <AddMoreFiles onFilesSelected={handleFilesSelected} onError={(message) => setState(prev => ({ ...prev, error: message }))} />
            </div>
          )}

          {state.files.length > 0 && (
            <section className="section-tight">
              <h2 className="label">
                Quality
              </h2>

              <div className="options">
                {QUALITY_PRESETS.map((preset) => (
                  <label className="option" key={preset.value}>
                    <input
                      type="radio"
                      name="compress-quality"
                      value={preset.value}
                      checked={state.options.quality === preset.value}
                      onChange={() => handleOptionsChange({ quality: preset.value })}
                    />
                    <span className="option-mark">
                      <CheckIcon size={14} />
                    </span>
                    <span>
                      <span className="option-title">{preset.title}</span>
                      <span className="option-note text-muted">{preset.note}</span>
                    </span>
                  </label>
                ))}
              </div>

              <p className="text-muted" style={{ fontSize: 11, margin: 'var(--space-2) 0 0' }}>
                Numbers come from the public benchmark corpus in the repository, not from a guess.
              </p>

              <p className="note" style={{ marginTop: 'var(--space-4)' }}>
                <InfoIcon size={18} />
                <span className="text-muted">
                  A Word export comes back untouched - this tool never hands you a bigger file than
                  you gave it.
                </span>
              </p>
            </section>
          )}
        </>
      )}

      {state.isProcessing && state.progress && (
        <ProgressBar progress={state.progress} onCancel={handleCancel} />
      )}

      {state.results.length > 0 && (
        <>
          <DownloadButton files={state.results}>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={handleReset}
              style={{ marginTop: 'var(--space-3)' }}
            >
              Compress more files
            </button>
          </DownloadButton>

          {state.results.some((result) => result.metadata?.unchanged) && (
            <div className="section-tight">
              <p className="callout">
                <strong>Some files came back unchanged.</strong> They were already as small as this
                tool can make them - normal for PDFs exported from a word processor, where there
                are no scanned images to re-encode and the text is already compressed. You get your
                original back rather than a larger file.
              </p>
            </div>
          )}
        </>
      )}

      {isEditing && state.files.length > 0 && (
        <div className="actionbar">
          <button
            type="button"
            className="btn btn-primary btn-block btn-lg"
            onClick={handleCompress}
            style={{ marginTop: 0 }}
          >
            <CompressIcon size={18} />
            Compress {state.files.length} file{state.files.length === 1 ? '' : 's'}
            <span className="btn-note">{FileUtils.formatFileSize(totalSize)}</span>
          </button>
        </div>
      )}

      <DebugConsole visible={isDebugVisible} logs={state.debugLogs} />

      <SeoSection route={route} />
      <RelatedGuides tag="compress" limit={2} />
    </AppShell>
  );
};

/**
 * The "add another file" row is a dropzone with no chrome, so files can be
 * dropped onto it as well as picked - and it reuses the same validation as
 * the main one instead of a bare <input>.
 */
const AddMoreFiles: React.FC<{
  onFilesSelected: (files: File[]) => void;
  onError: (message: string) => void;
}> = ({ onFilesSelected, onError }) => (
  <FileDropzone
    multiple
    maxFiles={10}
    className="row-add"
    onFilesSelected={onFilesSelected}
    onValidationError={onError}
  >
    <PlusIcon size={16} />
    Add another file
  </FileDropzone>
);

export default Compress;
