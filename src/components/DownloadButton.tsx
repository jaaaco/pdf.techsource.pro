/**
 * DownloadButton Component - the results block for every tool
 *
 * One component rather than four because the shape of a finished job is the
 * same everywhere: a list of files, each with a name, a size, sometimes a
 * before-and-after, and a way to get it onto disk. Compression is the only
 * one that carries `originalSize`, so the saving bar renders only there.
 *
 * Everything is held in memory - closing the tab loses it - which the footer
 * line says out loud, because "where did my file go" is otherwise a support
 * question this tool cannot answer.
 */

import React, { useState, useCallback } from 'react';
import { FileUtils } from '@/lib/file-utils';
import { ProcessedFile } from '@/workers/shared/progress-protocol';
import { ArrowRightIcon, CheckIcon, DownloadIcon } from './icons';

export interface DownloadButtonProps {
  files: ProcessedFile[];
  onDownloadStart?: (filename: string) => void;
  onDownloadComplete?: (filename: string) => void;
  onDownloadError?: (error: string) => void;
  disabled?: boolean;
  /** Extra action rendered under the per-file download, e.g. "Start over". */
  children?: React.ReactNode;
  autoDownload?: boolean;
}

const savingPercent = (file: ProcessedFile): number | null => {
  if (!file.originalSize || file.originalSize <= file.size) return null;
  return Math.round((1 - file.size / file.originalSize) * 100);
};

const DownloadButton: React.FC<DownloadButtonProps> = ({
  files,
  onDownloadStart,
  onDownloadComplete,
  onDownloadError,
  disabled = false,
  children,
  autoDownload = false,
}) => {
  const [downloading, setDownloading] = useState<Set<string>>(new Set());

  const downloadFile = useCallback(
    async (file: ProcessedFile): Promise<void> => {
      try {
        setDownloading((prev) => new Set(prev).add(file.name));
        onDownloadStart?.(file.name);
        FileUtils.downloadFile(file.data, file.name, file.mimeType);
        onDownloadComplete?.(file.name);
      } catch (error) {
        onDownloadError?.(
          `Failed to download ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      } finally {
        setDownloading((prev) => {
          const next = new Set(prev);
          next.delete(file.name);
          return next;
        });
      }
    },
    [onDownloadStart, onDownloadComplete, onDownloadError],
  );

  const handleDownloadAll = useCallback(async (): Promise<void> => {
    for (const file of files) {
      await downloadFile(file);
      // Browsers throttle a burst of programmatic downloads; the gap keeps
      // the later ones from being dropped silently.
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }, [files, downloadFile]);

  React.useEffect(() => {
    if (autoDownload && files.length > 0 && !disabled) {
      void handleDownloadAll();
    }
  }, [autoDownload, files, disabled, handleDownloadAll]);

  if (files.length === 0) return null;

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const busy = downloading.size > 0;

  return (
    <section className="section-tight section-ruled">
      <div className="cluster" style={{ marginBottom: 'var(--space-3)' }}>
        <CheckIcon size={20} style={{ color: 'var(--color-accent)' }} />
        <h2 className="label" style={{ margin: 0 }}>
          Done
        </h2>
        <span className="text-muted" style={{ fontSize: 12 }}>
          {files.length} file{files.length === 1 ? '' : 's'} · {FileUtils.formatFileSize(totalSize)}
        </span>
      </div>

      {files.length > 1 && (
        <button
          type="button"
          className="btn btn-primary btn-block btn-lg"
          onClick={handleDownloadAll}
          disabled={disabled || busy}
          style={{ marginTop: 0, marginBottom: 'var(--space-3)' }}
        >
          {busy ? 'Downloading…' : `Download all (${files.length})`}
          <DownloadIcon size={18} className="btn-arrow" />
        </button>
      )}

      <div className="stack">
        {files.map((file, index) => {
          const percent = savingPercent(file);
          const unchanged = Boolean(file.metadata?.unchanged);

          return (
            <div className="result-card" key={`${file.name}-${index}`}>
              <div className="result-name" title={file.name}>
                {file.name}
              </div>

              {percent !== null ? (
                <>
                  <div className="result-sizes">
                    <span className="result-before text-muted">
                      {FileUtils.formatFileSize(file.originalSize as number)}
                    </span>
                    <ArrowRightIcon size={16} />
                    <span className="result-after">{FileUtils.formatFileSize(file.size)}</span>
                  </div>
                  <div className="result-bar" aria-hidden="true">
                    <div
                      className="progress-fill"
                      style={{ width: `${Math.max(2, 100 - percent)}%` }}
                    />
                  </div>
                  <div className="text-positive" style={{ fontSize: 12, marginBottom: 14 }}>
                    {percent}% smaller
                  </div>
                </>
              ) : (
                <div className="result-sizes">
                  <span className="result-after">{FileUtils.formatFileSize(file.size)}</span>
                  {unchanged && <span className="tag tag-neutral">unchanged</span>}
                </div>
              )}

              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => downloadFile(file)}
                disabled={disabled || downloading.has(file.name)}
                style={{ marginTop: 0 }}
              >
                {downloading.has(file.name) ? 'Downloading…' : 'Download'}
                <DownloadIcon size={18} className="btn-arrow" />
              </button>
            </div>
          );
        })}
      </div>

      {children}

      <p className="text-muted" style={{ fontSize: 11, margin: 'var(--space-3) 0 0' }}>
        Results live in memory only. Closing the tab clears them, so download what you need.
      </p>
    </section>
  );
};

export default DownloadButton;
