/**
 * Split - extract pages or ranges from one PDF
 *
 * The range box and the page grid are two views of the same selection: typing
 * "1-3, 7" lights those thumbnails, tapping a thumbnail rewrites the box. The
 * grid exists because "which page was the signature on" is a question you
 * answer by looking, not by counting.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import AppShell from '@/components/AppShell';
import FileDropzone from '@/components/FileDropzone';
import ToolHero from '@/components/ToolHero';
import SeoSection from '@/components/SeoSection';
import RelatedGuides from '@/components/RelatedGuides';
import ProgressBar from '@/components/ProgressBar';
import DownloadButton from '@/components/DownloadButton';
import { getRoute } from '@/seo/manifest';
import useDocumentMeta from '@/seo/useDocumentMeta';
import { WorkerCommunicator, TaskIdGenerator } from '@/workers/shared/message-router';
import { ProgressUpdate, ProcessedFile } from '@/workers/shared/progress-protocol';
import { ErrorHandler } from '@/lib/error-handler';
import { FileUtils } from '@/lib/file-utils';
import {
  AlertIcon,
  ArrowRightIcon,
  FileIcon,
  InfoIcon,
  SplitIcon,
  TrashIcon,
  UploadIcon,
} from '@/components/icons';

interface SplitOptions {
  ranges: string;
  outputPrefix?: string;
}

interface PDFInfo {
  pageCount: number;
  title?: string;
  author?: string;
  fileSize: number;
}

interface SplitState {
  file: File | null;
  pdfInfo: PDFInfo | null;
  options: SplitOptions;
  isProcessing: boolean;
  progress: ProgressUpdate | null;
  results: ProcessedFile[];
  error: string | null;
  rangeValidation: {
    isValid: boolean;
    message: string;
  };
}

/**
 * The grid is a way to point at a page, not a document viewer. A screenful is
 * enough to find "the signature is on 7"; past that the range box is faster,
 * so the rest stay behind one tap.
 */
const PREVIEW_INITIAL = 12;
const PREVIEW_LIMIT = 60;

const RANGE_PATTERN = /^\s*(\d+(-\d+)?)\s*(,\s*(\d+(-\d+)?)\s*)*$/;

/** "1-3, 7, 12-20" -> [1,2,3,7,12..20]. Returns null on anything malformed. */
const parseRanges = (ranges: string, pageCount: number): number[] | null => {
  if (!RANGE_PATTERN.test(ranges)) return null;

  const pages = new Set<number>();
  for (const part of ranges.split(',').map((value) => value.trim())) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map((value) => parseInt(value.trim(), 10));
      if (start < 1 || end > pageCount || start > end) return null;
      for (let page = start; page <= end; page += 1) pages.add(page);
    } else {
      const page = parseInt(part, 10);
      if (page < 1 || page > pageCount) return null;
      pages.add(page);
    }
  }

  return [...pages].sort((a, b) => a - b);
};

/** [1,2,3,7] -> "1-3, 7". The inverse of parseRanges, for the page grid. */
const formatRanges = (pages: number[]): string => {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const parts: string[] = [];

  let index = 0;
  while (index < sorted.length) {
    const start = sorted[index];
    let end = start;
    while (index + 1 < sorted.length && sorted[index + 1] === end + 1) {
      index += 1;
      end = sorted[index];
    }
    parts.push(start === end ? `${start}` : `${start}-${end}`);
    index += 1;
  }

  return parts.join(', ');
};

const Split: React.FC = () => {
  const route = getRoute('/split')!;
  const location = useLocation();
  useDocumentMeta({
    title: route.title,
    description: route.description,
    path: route.path,
    locale: route.locale,
  });
  const [showAllPages, setShowAllPages] = useState(false);
  const [state, setState] = useState<SplitState>({
    file: null,
    pdfInfo: null,
    options: {
      ranges: '',
      outputPrefix: 'split_document',
    },
    isProcessing: false,
    progress: null,
    results: [],
    error: null,
    rangeValidation: {
      isValid: false,
      message: 'Enter page ranges to validate'
    }
  });

  // Worker communicator
  const [workerCommunicator] = useState(() => new WorkerCommunicator({
    onProgress: (message) => {
      setState(prev => ({ ...prev, progress: message.payload as ProgressUpdate }));
    },
    onComplete: (message) => {
      setState(prev => ({
        ...prev,
        isProcessing: false,
        progress: null,
        results: (message.payload as { files: ProcessedFile[] }).files,
      }));
    },
    onError: (message) => {
      const processedError = ErrorHandler.processError(
        new Error((message.payload as { message?: string }).message),
      );
      setState(prev => ({
        ...prev,
        isProcessing: false,
        progress: null,
        error: processedError.message,
      }));
    }
  }));

  // Initialize worker
  useEffect(() => {
    const initWorker = async () => {
      try {
        await workerCommunicator.initializeWorker(() =>
          new Worker(new URL('../workers/split-worker.ts', import.meta.url), { type: 'module' })
        );
      } catch (error) {
        console.error('Failed to initialize split worker:', error);
        setState(prev => ({
          ...prev,
          error: 'Failed to initialize background processing system. Please refresh the page.'
        }));
      }
    };

    // Register custom handler for PDF info
    workerCommunicator.registerHandler('pdfInfo', (message) => {
      setState(prev => ({
        ...prev,
        pdfInfo: message.payload as PDFInfo,
      }));
    });

    initWorker();

    // Cleanup worker on unmount
    return () => {
      workerCommunicator.terminateWorker();
    };
  }, [workerCommunicator]);

  const handleFileSelected = useCallback((files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];

    setState(prev => ({
      ...prev,
      file,
      error: null,
      pdfInfo: null,
      results: []
    }));

    // Get PDF info
    const taskId = TaskIdGenerator.generateForTool('split');
    workerCommunicator.sendMessage({
      type: 'getPDFInfo',
      payload: { file },
      taskId,
      timestamp: Date.now()
    });
  }, [workerCommunicator]);

  // A file handed over from the homepage dropzone arrives in router state.
  useEffect(() => {
    const handoff = (location.state as { files?: File[] } | null)?.files;
    if (handoff?.length) handleFileSelected(handoff.slice(0, 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRangesChange = useCallback((ranges: string) => {
    setState(prev => {
      if (!prev.pdfInfo) {
        return {
          ...prev,
          options: { ...prev.options, ranges },
          rangeValidation: { isValid: false, message: 'Load a PDF file first' },
        };
      }

      if (!ranges.trim()) {
        return {
          ...prev,
          options: { ...prev.options, ranges },
          rangeValidation: { isValid: false, message: 'Enter page ranges to validate' },
        };
      }

      const pages = parseRanges(ranges, prev.pdfInfo.pageCount);
      return {
        ...prev,
        options: { ...prev.options, ranges },
        rangeValidation: pages
          ? { isValid: true, message: `${pages.length} of ${prev.pdfInfo.pageCount} pages selected` }
          : {
              isValid: false,
              message: `Use pages 1 to ${prev.pdfInfo.pageCount}, like 1-3, 7, 12-20`,
            },
      };
    });
  }, []);

  const handleSplit = useCallback(async () => {
    if (!state.file || !state.rangeValidation.isValid || state.isProcessing) return;

    setState(prev => ({
      ...prev,
      isProcessing: true,
      progress: null,
      results: [],
      error: null
    }));

    try {
      const taskId = TaskIdGenerator.generateForTool('split');

      workerCommunicator.sendMessage({
        type: 'split',
        payload: {
          file: state.file,
          ranges: state.options.ranges,
          options: state.options
        },
        taskId,
        timestamp: Date.now()
      });
    } catch (error) {
      const processedError = ErrorHandler.processError(error instanceof Error ? error : new Error(String(error)));
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: processedError.message
      }));
    }
  }, [state.file, state.options, state.rangeValidation.isValid, state.isProcessing, workerCommunicator]);

  const handleCancel = useCallback(() => {
    workerCommunicator.cancelCurrentTask();
    setState(prev => ({
      ...prev,
      isProcessing: false,
      progress: null
    }));
  }, [workerCommunicator]);

  const handleReset = useCallback(() => {
    setState(prev => ({
      ...prev,
      file: null,
      pdfInfo: null,
      results: [],
      error: null,
      progress: null,
      options: { ...prev.options, ranges: '' },
      rangeValidation: { isValid: false, message: 'Enter page ranges to validate' }
    }));
  }, []);

  const pageCount = state.pdfInfo?.pageCount ?? 0;

  const selectedPages = useMemo(
    () => (pageCount > 0 ? parseRanges(state.options.ranges, pageCount) ?? [] : []),
    [state.options.ranges, pageCount],
  );

  const togglePage = useCallback(
    (page: number) => {
      const next = selectedPages.includes(page)
        ? selectedPages.filter((value) => value !== page)
        : [...selectedPages, page];
      handleRangesChange(formatRanges(next));
    },
    [selectedPages, handleRangesChange],
  );

  const quickRanges = useMemo(() => {
    if (pageCount === 0) return [];
    const odd = Array.from({ length: pageCount }, (_, i) => i + 1).filter((page) => page % 2 === 1);
    const even = Array.from({ length: pageCount }, (_, i) => i + 1).filter((page) => page % 2 === 0);

    return [
      { label: 'First page', value: '1' },
      { label: 'Last page', value: `${pageCount}` },
      { label: 'All pages', value: `1-${pageCount}` },
      { label: 'Odd', value: formatRanges(odd) },
      { label: 'Even', value: formatRanges(even) },
    ].filter((entry) => entry.value.length > 0);
  }, [pageCount]);

  const shownPages = showAllPages
    ? Math.min(pageCount, PREVIEW_LIMIT)
    : Math.min(pageCount, PREVIEW_INITIAL);

  const isEditing = !state.isProcessing && state.results.length === 0;
  const summary = state.file
    ? `${state.file.name} · ${pageCount > 0 ? `${pageCount} pages` : FileUtils.formatFileSize(state.file.size)}`
    : null;

  return (
    <AppShell
      active="split"
      tool={{ title: 'Split', meta: summary && <span className="tag tag-accent">{summary}</span> }}
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
            <span className="dropzone-title">Drop the PDF you want to cut up</span>
            <span className="text-muted" style={{ fontSize: 12 }}>
              One file · up to 500 MB · stays on this device
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
                  {pageCount > 0 ? ` · ${pageCount} pages` : ' · reading page count…'}
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

          <section className="section-tight">
            <div className="field">
              <label htmlFor="split-ranges">Pages</label>
              <input
                id="split-ranges"
                className={`input input-display${
                  state.options.ranges && !state.rangeValidation.isValid ? ' input-invalid' : ''
                }`}
                value={state.options.ranges}
                placeholder="1-3, 7, 12-20"
                onChange={(event) => handleRangesChange(event.target.value)}
                aria-describedby="split-ranges-help"
              />
            </div>

            {quickRanges.length > 0 && (
              <div className="chips" style={{ marginTop: 'var(--space-3)' }}>
                {quickRanges.map((entry) => (
                  <button
                    key={entry.label}
                    type="button"
                    className="chip chip-outline"
                    onClick={() => handleRangesChange(entry.value)}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            )}

            <p id="split-ranges-help" className="text-muted" style={{ fontSize: 12, margin: 'var(--space-3) 0 0' }}>
              {state.rangeValidation.message}
              {state.rangeValidation.isValid && ' → 1 file'}
            </p>
          </section>

          {pageCount > 0 && (
            <section className="section-tight section-ruled">
              <h2 className="label">
                Preview
              </h2>

              <div className="page-grid">
                {Array.from({ length: shownPages }, (_, index) => index + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    className="page-thumb"
                    aria-pressed={selectedPages.includes(page)}
                    aria-label={`Page ${page}`}
                    onClick={() => togglePage(page)}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <div className="cluster" style={{ marginTop: 'var(--space-3)' }}>
                <p className="text-muted" style={{ fontSize: 11, margin: 0 }}>
                  Tap a page to add or remove it from the range.
                </p>
                {shownPages < Math.min(pageCount, PREVIEW_LIMIT) && (
                  <button
                    type="button"
                    className="chip chip-outline"
                    onClick={() => setShowAllPages(true)}
                  >
                    + {Math.min(pageCount, PREVIEW_LIMIT) - shownPages} more
                  </button>
                )}
                {pageCount > PREVIEW_LIMIT && showAllPages && (
                  <span className="text-muted" style={{ fontSize: 11 }}>
                    Showing {PREVIEW_LIMIT} of {pageCount} - type a range above for the rest.
                  </span>
                )}
              </div>
            </section>
          )}

          <section className="section-tight">
            <div className="field">
              <label htmlFor="split-prefix">Output prefix</label>
              <input
                id="split-prefix"
                className="input"
                value={state.options.outputPrefix}
                onChange={(event) =>
                  setState(prev => ({
                    ...prev,
                    options: { ...prev.options, outputPrefix: event.target.value },
                  }))
                }
              />
            </div>

            <p className="note" style={{ marginTop: 'var(--space-4)' }}>
              <InfoIcon size={18} />
              <span className="text-muted">
                Pages are copied verbatim, so nothing is re-encoded and nothing degrades. Your
                original file is left untouched.
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
            Split another file
          </button>
        </DownloadButton>
      )}

      {isEditing && state.file && (
        <div className="actionbar">
          <button
            type="button"
            className="btn btn-primary btn-block btn-lg"
            onClick={handleSplit}
            disabled={!state.rangeValidation.isValid}
            style={{ marginTop: 0 }}
          >
            <SplitIcon size={18} />
            {selectedPages.length > 0
              ? `Extract ${selectedPages.length} page${selectedPages.length === 1 ? '' : 's'}`
              : 'Extract pages'}
          </button>
        </div>
      )}

      <SeoSection route={route} />
      <RelatedGuides tag="split" limit={2} />
    </AppShell>
  );
};

export default Split;
