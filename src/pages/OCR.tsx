/**
 * OCR - turn a scan into a searchable document
 *
 * Languages are toggles rather than a multi-select: picking two is the common
 * case (a Polish contract with English annexes) and a <select multiple> makes
 * that a fight on a phone.
 */

import React, { useState, useCallback, useEffect } from 'react';
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
  FileIcon,
  InfoIcon,
  OcrIcon,
  TrashIcon,
  UploadIcon,
} from '@/components/icons';

interface OCROptions {
  languages: string[];
  outputFormat: 'searchable-pdf' | 'text-only';
  preserveFormatting?: boolean;
  confidenceThreshold?: number;
}

interface OCRState {
  file: File | null;
  options: OCROptions;
  isProcessing: boolean;
  progress: ProgressUpdate | null;
  results: ProcessedFile[];
  error: string | null;
  estimatedTime: number | null;
  debugLogs: string[];
}

/**
 * Limited to what the text layer can actually encode.
 *
 * The searchable PDF embeds DejaVu Sans, which covers Latin, Latin Extended
 * and Cyrillic. Japanese, Chinese, Arabic and Hindi used to be offered here
 * and could never produce a text layer - every word failed to encode and was
 * dropped by a silent catch, so the tool reported success and returned a PDF
 * with nothing in it. Offering them again needs a font that covers them.
 */
const LANGUAGES = [
  { code: 'eng', name: 'English' },
  { code: 'pol', name: 'Polish' },
  { code: 'deu', name: 'German' },
  { code: 'fra', name: 'French' },
  { code: 'spa', name: 'Spanish' },
  { code: 'ita', name: 'Italian' },
  { code: 'por', name: 'Portuguese' },
  { code: 'nld', name: 'Dutch' },
  { code: 'ces', name: 'Czech' },
  { code: 'rus', name: 'Russian' },
  { code: 'ukr', name: 'Ukrainian' },
];

const OUTPUT_FORMATS = [
  {
    value: 'searchable-pdf' as const,
    title: 'Searchable PDF',
    note: 'Original pages, with an invisible text layer underneath. Recommended.',
  },
  {
    value: 'text-only' as const,
    title: 'Plain text (.txt)',
    note: 'Just the recognised words, with no layout.',
  },
];

const estimateProcessingTime = (fileSize: number): number =>
  Math.round((fileSize / (1024 * 1024)) * 30);

const formatTime = (seconds: number) => {
  if (seconds < 60) return `~${seconds}s`;
  return `~${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

const OCR: React.FC = () => {
  const route = getRoute('/ocr')!;
  const location = useLocation();
  useDocumentMeta({
    title: route.title,
    description: route.description,
    path: route.path,
    locale: route.locale,
  });
  const [isDebugVisible] = useDebugConsole();
  const [showAllLanguages, setShowAllLanguages] = useState(false);

  const [state, setState] = useState<OCRState>({
    file: null,
    options: {
      languages: ['eng'],
      outputFormat: 'searchable-pdf',
      preserveFormatting: true,
      confidenceThreshold: 50,
    },
    isProcessing: false,
    progress: null,
    results: [],
    error: null,
    estimatedTime: null,
    debugLogs: [],
  });

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
      const files = (message.payload as { files: ProcessedFile[] }).files;
      setState(prev => ({
        ...prev,
        isProcessing: false,
        progress: null,
        results: files,
        debugLogs: [...prev.debugLogs, `[${new Date().toISOString().split('T')[1].slice(0, -1)}] Complete: Received ${files.length} file(s)`]
      }));
    },
    onError: (message) => {
      // Log the raw message payload for debugging
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

  // Initialize worker
  useEffect(() => {
    let isMounted = true;

    const initWorker = async () => {
      if (isMounted) addLog('Initializing OCR worker...');
      try {
        await workerCommunicator.initializeWorker(() => {
          const worker = new Worker(new URL('../workers/ocr-worker.ts', import.meta.url), { type: 'module' });
          if (isMounted) addLog('Worker script resolved via Vite bundler');
          return worker;
        });

        if (isMounted) addLog('Worker initialized successfully');
      } catch (error) {
        if (!isMounted) return;
        console.error('Failed to initialize OCR worker:', error);
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
      workerCommunicator.terminateWorker();
    };
  }, [workerCommunicator, addLog]);

  const handleFileSelected = useCallback((files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    setState(prev => ({
      ...prev,
      file,
      error: null,
      results: [],
      estimatedTime: estimateProcessingTime(file.size),
      debugLogs: [...prev.debugLogs, `[${timestamp}] File selected: ${file.name} (${FileUtils.formatFileSize(file.size)})`]
    }));
  }, []);

  // A file handed over from the homepage dropzone arrives in router state.
  useEffect(() => {
    const handoff = (location.state as { files?: File[] } | null)?.files;
    if (handoff?.length) handleFileSelected(handoff.slice(0, 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleLanguage = useCallback((code: string) => {
    setState(prev => {
      const selected = prev.options.languages.includes(code)
        ? prev.options.languages.filter((value) => value !== code)
        : [...prev.options.languages, code];

      // Recognition with no language is not a state the engine can run in.
      return {
        ...prev,
        options: { ...prev.options, languages: selected.length > 0 ? selected : [code] },
      };
    });
  }, []);

  const handleOCR = useCallback(async () => {
    if (!state.file || state.isProcessing) return;

    addLog(`Starting OCR for ${state.file.name}`);
    addLog(`Options: ${JSON.stringify(state.options)}`);

    setState(prev => ({
      ...prev,
      isProcessing: true,
      progress: null,
      results: [],
      error: null
    }));

    try {
      const taskId = TaskIdGenerator.generateForTool('ocr');
      addLog(`Created Task ID: ${taskId}`);

      workerCommunicator.sendMessage({
        type: 'ocr',
        payload: {
          file: state.file,
          options: state.options
        },
        taskId,
        timestamp: Date.now()
      });
      addLog('Message sent to worker');
    } catch (error) {
      const errorMsg = String(error);
      addLog(`Error sending message: ${errorMsg}`);
      const processedError = ErrorHandler.processError(error instanceof Error ? error : new Error(errorMsg));
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: processedError.message
      }));
    }
  }, [state.file, state.options, state.isProcessing, workerCommunicator, addLog]);

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
      file: null,
      results: [],
      error: null,
      progress: null,
      estimatedTime: null
    }));
  }, []);

  // The four most-requested up front; the rest arrive on demand, plus any
  // already selected so a chosen language never hides itself.
  const visibleLanguages = showAllLanguages
    ? LANGUAGES
    : LANGUAGES.filter(
        (language, index) => index < 4 || state.options.languages.includes(language.code),
      );

  const isEditing = !state.isProcessing && state.results.length === 0;
  const summary = state.file
    ? `${state.file.name} · ${FileUtils.formatFileSize(state.file.size)}`
    : null;

  return (
    <AppShell
      active="ocr"
      tool={{ title: 'OCR', meta: summary && <span className="tag tag-accent">{summary}</span> }}
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

      {isEditing && !state.file && (
        <div className="section-tight section-ruled">
          <FileDropzone
            onFilesSelected={handleFileSelected}
            onValidationError={(message) => setState(prev => ({ ...prev, error: message }))}
          >
            <UploadIcon size={26} style={{ color: 'var(--color-accent)' }} />
            <span className="dropzone-title">Drop a scanned PDF</span>
            <span className="text-muted" style={{ fontSize: 12 }}>
              One file · recognition runs on this device
            </span>
            <span className="btn btn-primary btn-block" aria-hidden="true">
              Select a file
              <ArrowRightIcon size={18} className="btn-arrow" />
            </span>
          </FileDropzone>
        </div>
      )}

      {isEditing && state.file && (
        <>
          <div className="rows">
            <div className="row row-last">
              <FileIcon size={22} />
              <span className="row-body">
                <span className="row-name" title={state.file.name}>{state.file.name}</span>
                <span className="row-meta text-muted">
                  {FileUtils.formatFileSize(state.file.size)}
                  {state.estimatedTime ? ` · ${formatTime(state.estimatedTime)} estimated` : ''}
                </span>
              </span>
              <span className="row-actions">
                <button
                  type="button"
                  className="btn btn-icon row-remove"
                  onClick={handleReset}
                  aria-label="Remove file"
                >
                  <TrashIcon size={18} />
                </button>
              </span>
            </div>
          </div>

          {state.file.size > 50 * 1024 * 1024 && (
            <div className="section-tight">
              <p className="callout">
                <strong>That is a large file.</strong> OCR is the slowest of the four tools and this
                may take several minutes. Splitting the document first is usually faster.
              </p>
            </div>
          )}

          <section className="section-tight">
            <h2 className="label">
              Language
            </h2>
            <div className="chips" role="group" aria-label="Recognition languages">
              {visibleLanguages.map((language) => (
                <button
                  key={language.code}
                  type="button"
                  className="chip"
                  aria-pressed={state.options.languages.includes(language.code)}
                  onClick={() => toggleLanguage(language.code)}
                >
                  {language.name}
                </button>
              ))}
              {!showAllLanguages && LANGUAGES.length > visibleLanguages.length && (
                <button
                  type="button"
                  className="chip chip-outline"
                  onClick={() => setShowAllLanguages(true)}
                >
                  + {LANGUAGES.length - visibleLanguages.length} more
                </button>
              )}
            </div>

            <p className="callout" style={{ marginTop: 'var(--space-4)' }}>
              The first run downloads the recognition engine and the language data from a public
              CDN. Your document is not part of that request. After one successful run everything is
              cached and OCR works with the network off.
            </p>
          </section>

          <section className="section-tight section-ruled">
            <h2 className="label">
              Output
            </h2>
            <div className="stack-tight">
              {OUTPUT_FORMATS.map((format) => (
                <label className="radio" key={format.value}>
                  <input
                    type="radio"
                    name="ocr-output"
                    value={format.value}
                    checked={state.options.outputFormat === format.value}
                    onChange={() =>
                      setState(prev => ({
                        ...prev,
                        options: { ...prev.options, outputFormat: format.value },
                      }))
                    }
                  />
                  <span className="dot" />
                  <span>
                    {format.title} <span className="text-muted">{format.note}</span>
                  </span>
                </label>
              ))}
            </div>

            <p className="note" style={{ marginTop: 'var(--space-4)' }}>
              <InfoIcon size={18} />
              <span className="text-muted">
                Best results come from scans at 300 dpi or better. Select every language present in
                the document - the recognised text goes in as an invisible layer, so the page images
                you see are untouched.
              </span>
            </p>
          </section>
        </>
      )}

      {state.isProcessing && state.progress && (
        <ProgressBar progress={state.progress} onCancel={handleCancel} />
      )}

      {state.results.length > 0 && (
        <DownloadButton files={state.results}>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={handleReset}
            style={{ marginTop: 'var(--space-3)' }}
          >
            Process another file
          </button>
        </DownloadButton>
      )}

      {isEditing && state.file && (
        <div className="actionbar">
          <button
            type="button"
            className="btn btn-primary btn-block btn-lg"
            onClick={handleOCR}
            style={{ marginTop: 0 }}
          >
            <OcrIcon size={18} />
            Recognise text
            {state.estimatedTime !== null && (
              <span className="btn-note">{formatTime(state.estimatedTime)}</span>
            )}
          </button>
        </div>
      )}

      <DebugConsole visible={isDebugVisible} logs={state.debugLogs} />

      <SeoSection route={route} />
      <RelatedGuides tag="ocr" limit={2} />
    </AppShell>
  );
};

export default OCR;
