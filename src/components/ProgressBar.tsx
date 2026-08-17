/**
 * ProgressBar Component - Real-time progress display with cancel
 *
 * The percentage is the loudest thing on the screen because it is the only
 * thing a visitor waiting on a 200-page OCR run actually wants. Stage and
 * message sit around it, the track underneath, cancel below that.
 *
 * Two changes from the version this replaces, both deliberate:
 *
 *   - The displayed value is seeded from the incoming percentage instead of
 *     animating up from zero on mount. The old one rendered "0%" for a frame
 *     every time a task started, which reads as a stall.
 *   - The `variant` prop is gone. It mapped to MUI's four palette colours;
 *     this design system has one accent, and a green progress bar on a page
 *     with no green anywhere else was never a deliberate choice.
 */

import React, { useEffect, useRef, useState } from 'react';
import { ProgressUpdate } from '@/workers/shared/progress-protocol';
import { CloseIcon } from './icons';

export interface ProgressBarProps {
  progress: ProgressUpdate | null;
  onCancel?: () => void;
  showCancel?: boolean;
  /** Shows the "5 of 10" step counter next to the percentage. */
  showDetails?: boolean;
  className?: string;
  size?: 'small' | 'medium' | 'large';
}

const clamp = (value: number) => Math.min(100, Math.max(0, value));

const TRACK_HEIGHT = { small: 6, medium: 10, large: 14 } as const;

const formatSeconds = (seconds: number): string => {
  if (seconds < 60) return `~${Math.max(1, Math.round(seconds))}s left`;
  const minutes = Math.floor(seconds / 60);
  return `~${minutes}m ${Math.round(seconds % 60)}s left`;
};

const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  onCancel,
  showCancel = true,
  showDetails = true,
  className = '',
  size = 'medium',
}) => {
  const target = clamp(progress?.percentage ?? 0);
  const [displayed, setDisplayed] = useState(target);
  const frame = useRef<number>();
  /**
   * Anchor for the time estimate: the first sample of this run. Extrapolating
   * from it is crude, but a job that reports pages is close enough to linear
   * for the number to be useful, and "~40s left" is the thing a person waiting
   * actually wants to know.
   */
  const anchor = useRef<{ time: number; percent: number } | null>(null);
  // Mirrors `displayed` so the animation can read where it is starting from
  // without listing it as a dependency, which would restart it every frame.
  const displayedRef = useRef(target);
  displayedRef.current = displayed;

  useEffect(() => {
    const from = displayedRef.current;

    // A jump under a percent arrives faster than the eye resolves it, so it
    // is not worth a frame loop.
    if (typeof requestAnimationFrame !== 'function' || Math.abs(target - from) < 1) {
      setDisplayed(target);
      return;
    }

    const start = performance.now();
    const distance = target - from;
    const duration = 300;

    // The elapsed time is read here rather than taken from the frame
    // callback's argument: some environments (jsdom's shimmed rAF among them)
    // invoke the callback with no timestamp, which turns the whole
    // calculation into NaN.
    const step = () => {
      const ratio = Math.min((performance.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - ratio, 4);
      setDisplayed(from + distance * eased);
      if (ratio < 1) frame.current = requestAnimationFrame(step);
    };

    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [target]);

  // A run that restarts, or one that has not been seen yet, resets the anchor.
  if (!anchor.current || target < anchor.current.percent) {
    anchor.current = { time: performance.now(), percent: target };
  }

  if (!progress) {
    anchor.current = null;
    return null;
  }

  const rounded = Math.round(displayed);

  const elapsed = performance.now() - anchor.current.time;
  const advanced = target - anchor.current.percent;
  const remaining =
    // Below a couple of seconds and a couple of percent the extrapolation is
    // noise, and a number that jumps between "2s" and "4m" is worse than none.
    elapsed > 2000 && advanced >= 2 && target < 100
      ? ((elapsed / advanced) * (100 - target)) / 1000
      : null;

  return (
    <section className={`section-tight section-ruled ${className}`.trim()} aria-live="polite">
      {/* One uppercase line - "PROCESSING - RENDERING PAGE 4/10" - rather than
          a chip plus a sentence, which is how the design sets it. */}
      <h2 className="label progress-stage">
        {progress.stage}
        {progress.message && <span className="progress-stage-detail"> - {progress.message}</span>}
      </h2>

      <div className="progress-head">
        {/* Number and sign are separate elements because they are set at
            different sizes; the wrapper keeps them one string for anything
            reading the value rather than the layout. */}
        <span className="progress-value">
          <span className="progress-number">{rounded}</span>
          <span className="progress-percent">%</span>
        </span>
        {remaining !== null ? (
          <span
            className="text-muted"
            style={{ marginLeft: 'auto', fontSize: 12, paddingBottom: 6 }}
          >
            {formatSeconds(remaining)}
          </span>
        ) : (
          showDetails &&
          progress.total > 0 && (
            <span
              className="text-muted"
              style={{ marginLeft: 'auto', fontSize: 12, paddingBottom: 6 }}
            >
              {progress.current} of {progress.total}
            </span>
          )
        )}
      </div>

      {/* The number above already announces the percentage, so the meter is
          hidden rather than announcing it a second time. */}
      <div className="progress-track" style={{ height: TRACK_HEIGHT[size] }} aria-hidden="true">
        <div className="progress-fill" style={{ width: `${clamp(displayed)}%` }} />
      </div>

      {showCancel && onCancel && (
        <div className="progress-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            <CloseIcon size={16} />
            Cancel
          </button>
        </div>
      )}
    </section>
  );
};

export default ProgressBar;
