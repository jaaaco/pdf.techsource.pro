/**
 * Merge - combine several PDFs into one
 *
 * Order is the whole interaction, so it is drag-first with arrow buttons
 * beside it. Drag alone would leave the feature unusable by keyboard, and
 * arrows alone are tedious past three files; both drive the same reorder.
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
import { getRoute } from '@/seo/manifest';
import useDocumentMeta from '@/seo/useDocumentMeta';
import { WorkerCommunicator, TaskIdGenerator } from '@/workers/shared/message-router';
import { ProgressUpdate, ProcessedFile } from '@/workers/shared/progress-protocol';
import { ErrorHandler } from '@/lib/error-handler';
import { FileUtils } from '@/lib/file-utils';
import {
  AlertIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloseIcon,
  GripIcon,
  InfoIcon,
  MergeIcon,
  PlusIcon,
  UploadIcon,
} from '@/components/icons';

interface MergeOptions {
  outputName?: string;
  preserveBookmarks?: boolean;
  preserveMetadata?: boolean;
  optimizeSize?: boolean;
}

interface FileWithOrder {
  file: File;
  order: number;
}

interface MergeState {
  files: FileWithOrder[];
  options: MergeOptions;
  isProcessing: boolean;
  progress: ProgressUpdate | null;
  results: ProcessedFile[];
  error: string | null;
}

const Merge: React.FC = () => {
  const route = getRoute('/merge')!;
  const location = useLocation();
  useDocumentMeta({
    title: route.title,
    description: route.description,
    path: route.path,
    locale: route.locale,
  });
  const [state, setState] = useState<MergeState>({
    files: [],
    options: {
      outputName: 'merged_document.pdf',
      preserveBookmarks: true,
      preserveMetadata: true,
      optimizeSize: false,
    },
    isProcessing: false,
    progress: null,
    results: [],
    error: null,
  });
  const dragIndex = useRef<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

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
          new Worker(new URL('../workers/merge-worker.ts', import.meta.url), { type: 'module' })
        );
      } catch (error) {
        console.error('Failed to initialize merge worker:', error);
        setState(prev => ({
          ...prev,
          error: 'Failed to initialize background processing system. Please refresh the page.'
        }));
      }
    };

    initWorker();

    // Cleanup worker on unmount
    return () => {
      workerCommunicator.terminateWorker();
    };
  }, [workerCommunicator]);

  const handleFilesSelected = useCallback((files: File[]) => {
    setState(prev => ({
      ...prev,
      files: [
        ...prev.files,
        ...files.map((file, index) => ({ file, order: prev.files.length + index })),
      ],
      error: null,
    }));
  }, []);

  // Files handed over from the homepage dropzone arrive in router state.
  useEffect(() => {
    const handoff = (location.state as { files?: File[] } | null)?.files;
    if (handoff?.length) handleFilesSelected(handoff);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOptionsChange = useCallback((newOptions: Partial<MergeOptions>) => {
    setState(prev => ({
      ...prev,
      options: { ...prev.options, ...newOptions }
    }));
  }, []);

  const handleMerge = useCallback(async () => {
    if (state.files.length < 2 || state.isProcessing) return;

    setState(prev => ({
      ...prev,
      isProcessing: true,
      progress: null,
      results: [],
      error: null
    }));

    try {
      const taskId = TaskIdGenerator.generateForTool('merge');

      workerCommunicator.sendMessage({
        type: 'merge',
        payload: {
          files: state.files.map(f => f.file),
          options: {
            ...state.options,
            fileOrder: state.files.map(f => f.file.name)
          }
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
  }, [state.files, state.options, state.isProcessing, workerCommunicator]);

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
      files: [],
      results: [],
      error: null,
      progress: null
    }));
  }, []);

  const removeFile = useCallback((index: number) => {
    setState(prev => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index).map((file, i) => ({ ...file, order: i }))
    }));
  }, []);

  const moveFile = useCallback((fromIndex: number, toIndex: number) => {
    setState(prev => {
      if (toIndex < 0 || toIndex >= prev.files.length) return prev;
      const newFiles = [...prev.files];
      const [movedFile] = newFiles.splice(fromIndex, 1);
      newFiles.splice(toIndex, 0, movedFile);

      // Update order numbers
      return {
        ...prev,
        files: newFiles.map((file, index) => ({ ...file, order: index }))
      };
    });
  }, []);

  const totalSize = state.files.reduce((total, entry) => total + entry.file.size, 0);
  const isEditing = !state.isProcessing && state.results.length === 0;
  const summary =
    state.files.length > 0
      ? `${state.files.length} file${state.files.length === 1 ? '' : 's'} · ${FileUtils.formatFileSize(totalSize)}`
      : null;

  return (
    <AppShell
      active="merge"
      tool={{ title: 'Merge', meta: summary && <span className="tag tag-accent">{summary}</span> }}
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
                maxFiles={20}
                onFilesSelected={handleFilesSelected}
                onValidationError={(message) => setState(prev => ({ ...prev, error: message }))}
              >
                <UploadIcon size={26} style={{ color: 'var(--color-accent)' }} />
                <span className="dropzone-title">Drop the PDFs you want joined</span>
                <span className="text-muted" style={{ fontSize: 12 }}>
                  Two or more files · order is set here, not by the file names
                </span>
                <span className="btn btn-primary btn-block" aria-hidden="true">
                  Select files
                  <ArrowRightIcon size={18} className="btn-arrow" />
                </span>
              </FileDropzone>
            </div>
          ) : (
            <ul className="rows" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {state.files.map((entry, index) => (
                <li
                  className="row"
                  key={`${entry.file.name}-${index}`}
                  draggable
                  data-dragging={draggingIndex === index}
                  onDragStart={() => {
                    dragIndex.current = index;
                    setDraggingIndex(index);
                  }}
                  onDragEnd={() => {
                    dragIndex.current = null;
                    setDraggingIndex(null);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragIndex.current !== null && dragIndex.current !== index) {
                      moveFile(dragIndex.current, index);
                    }
                    dragIndex.current = null;
                    setDraggingIndex(null);
                  }}
                >
                  <GripIcon size={18} className="row-grip" />
                  <span className="row-index">{index + 1}</span>
                  <span className="row-body">
                    <span className="row-name" title={entry.file.name}>{entry.file.name}</span>
                    <span className="row-meta text-muted">
                      {FileUtils.formatFileSize(entry.file.size)}
                    </span>
                  </span>
                  <span className="row-actions">
                    <button
                      type="button"
                      className="btn btn-icon"
                      onClick={() => moveFile(index, index - 1)}
                      disabled={index === 0}
                      aria-label={`Move ${entry.file.name} up`}
                    >
                      <ChevronUpIcon size={18} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-icon"
                      onClick={() => moveFile(index, index + 1)}
                      disabled={index === state.files.length - 1}
                      aria-label={`Move ${entry.file.name} down`}
                    >
                      <ChevronDownIcon size={18} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-icon row-remove"
                      onClick={() => removeFile(index)}
                      aria-label={`Remove ${entry.file.name}`}
                    >
                      <CloseIcon size={18} />
                    </button>
                  </span>
                </li>
              ))}

              <li>
                <FileDropzone
                  multiple
                  maxFiles={20}
                  className="row-add"
                  onFilesSelected={handleFilesSelected}
                  onValidationError={(message) => setState(prev => ({ ...prev, error: message }))}
                >
                  <PlusIcon size={16} />
                  Add files
                </FileDropzone>
              </li>
            </ul>
          )}

          {state.files.length > 0 && (
            <section className="section-tight">
              <h2 className="label">
                Output
              </h2>
              <div className="field">
                <label htmlFor="merge-output-name">File name</label>
                <input
                  id="merge-output-name"
                  className="input"
                  value={state.options.outputName}
                  onChange={(event) => handleOptionsChange({ outputName: event.target.value })}
                />
              </div>

              {state.files.length === 1 && (
                <p className="note" style={{ marginTop: 'var(--space-4)' }}>
                  <InfoIcon size={18} />
                  <span className="text-muted">
                    Add at least one more PDF to enable merging.
                  </span>
                </p>
              )}
            </section>
          )}
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
            Merge more files
          </button>
        </DownloadButton>
      )}

      {isEditing && state.files.length > 0 && (
        <div className="actionbar">
          <button
            type="button"
            className="btn btn-primary btn-block btn-lg"
            onClick={handleMerge}
            disabled={state.files.length < 2}
            style={{ marginTop: 0 }}
          >
            <MergeIcon size={18} />
            Merge {state.files.length} file{state.files.length === 1 ? '' : 's'}
            <span className="btn-note">{FileUtils.formatFileSize(totalSize)}</span>
          </button>
        </div>
      )}

      <SeoSection route={route} />
      <RelatedGuides tag="merge" limit={2} />
    </AppShell>
  );
};

export default Merge;
