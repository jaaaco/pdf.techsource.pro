/**
 * Unit Tests - ProgressBar Component
 * Tests progress display and cancel functionality
 * Validates: Requirements 2.1, 2.5, 8.4
 *
 * Rewritten when the site moved off Material-UI. The old suite asserted
 * MUI internals - `.MuiLinearProgress-root`, `MuiLinearProgress-colorSuccess`,
 * an expand/collapse icon button - none of which describe behaviour anyone
 * depends on. What survives is what a visitor can actually observe: the
 * percentage, the stage, the message, the step counter, the cancel button,
 * and the width of the filled track.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProgressBar from '@/components/ProgressBar';
import { ProgressUpdate } from '@/workers/shared/progress-protocol';

describe('ProgressBar Component', () => {
  let onCancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onCancel = vi.fn();
  });

  const createProgressUpdate = (overrides?: Partial<ProgressUpdate>): ProgressUpdate => ({
    current: 5,
    total: 10,
    stage: 'Processing',
    message: 'Processing file 5 of 10',
    percentage: 50,
    ...overrides
  });

  const fill = (container: HTMLElement) =>
    container.querySelector('.progress-fill') as HTMLElement | null;

  /**
   * The value is drawn as "50" and "%" at two different sizes, so it is two
   * elements with one string between them - read it off the wrapper rather
   * than through getByText, which only sees an element's own text nodes.
   */
  const percentText = (container: HTMLElement) =>
    container.querySelector('.progress-value')?.textContent;

  const stageLine = (container: HTMLElement) =>
    container.querySelector('.progress-stage')?.textContent ?? '';

  describe('Rendering', () => {
    it('should not render when progress is null', () => {
      const { container } = render(<ProgressBar progress={null} />);

      expect(container).toBeEmptyDOMElement();
    });

    it('should render with progress data', () => {
      const { container } = render(<ProgressBar progress={createProgressUpdate()} />);

      expect(stageLine(container)).toContain('Processing');
      expect(percentText(container)).toBe('50%');
      expect(stageLine(container)).toContain('Processing file 5 of 10');
    });

    it('should show the stage in the heading line', () => {
      const { container } = render(
        <ProgressBar progress={createProgressUpdate({ stage: 'Compressing' })} />,
      );

      const stage = container.querySelector('.progress-stage');
      expect(stage).toBeInTheDocument();
      expect(stage?.textContent).toContain('Compressing');
    });

    it('should show percentage', () => {
      const { container } = render(<ProgressBar progress={createProgressUpdate({ percentage: 75 })} />);

      expect(percentText(container)).toBe('75%');
    });

    it('should render without a message if none is provided', () => {
      const { container } = render(
        <ProgressBar progress={createProgressUpdate({ message: undefined })} />
      );

      expect(stageLine(container)).not.toMatch(/processing file/i);
      // The percentage is still there - a message is optional, progress is not.
      expect(percentText(container)).toBe('50%');
    });

    it('should fill the track in proportion to the percentage', () => {
      const { container } = render(<ProgressBar progress={createProgressUpdate({ percentage: 25 })} />);

      expect(fill(container)).toHaveStyle({ width: '25%' });
    });
  });

  describe('Cancel Functionality', () => {
    it('should show cancel button when onCancel is provided', () => {
      render(<ProgressBar progress={createProgressUpdate()} onCancel={onCancel} showCancel />);

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should not show cancel button when showCancel is false', () => {
      render(
        <ProgressBar progress={createProgressUpdate()} onCancel={onCancel} showCancel={false} />
      );

      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    });

    it('should not show cancel button when onCancel is not provided', () => {
      render(<ProgressBar progress={createProgressUpdate()} showCancel />);

      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    });

    it('should call onCancel when cancel button is clicked', () => {
      render(<ProgressBar progress={createProgressUpdate()} onCancel={onCancel} />);

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Step Counter', () => {
    it('should show the current step when showDetails is true', () => {
      render(<ProgressBar progress={createProgressUpdate({ current: 7, total: 10 })} showDetails />);

      expect(screen.getByText('7 of 10')).toBeInTheDocument();
    });

    it('should hide the step counter when showDetails is false', () => {
      render(
        <ProgressBar progress={createProgressUpdate({ current: 7, total: 10 })} showDetails={false} />
      );

      expect(screen.queryByText('7 of 10')).not.toBeInTheDocument();
    });

    it('should hide the step counter when the total is unknown', () => {
      render(<ProgressBar progress={createProgressUpdate({ current: 0, total: 0 })} showDetails />);

      expect(screen.queryByText(/of 0/)).not.toBeInTheDocument();
    });
  });

  describe('Track Height', () => {
    const heightOf = (size: 'small' | 'medium' | 'large') => {
      const { container } = render(<ProgressBar progress={createProgressUpdate()} size={size} />);
      return (container.querySelector('.progress-track') as HTMLElement).style.height;
    };

    it('should apply small size', () => {
      expect(heightOf('small')).toBe('6px');
    });

    it('should apply medium size', () => {
      expect(heightOf('medium')).toBe('10px');
    });

    it('should apply large size', () => {
      expect(heightOf('large')).toBe('14px');
    });
  });

  describe('Progress Animation', () => {
    it('should show the incoming percentage on first render, not zero', () => {
      const { container } = render(<ProgressBar progress={createProgressUpdate({ percentage: 42 })} />);

      expect(percentText(container)).toBe('42%');
    });

    it('should update progress smoothly', async () => {
      const { rerender, container } = render(
        <ProgressBar progress={createProgressUpdate({ percentage: 25 })} />
      );

      expect(percentText(container)).toBe('25%');

      rerender(<ProgressBar progress={createProgressUpdate({ percentage: 75 })} />);

      // Animation should eventually land on the new percentage
      await waitFor(() => {
        expect(percentText(container)).toBe('75%');
      }, { timeout: 1000 });
    });

    it('should handle progress from 0 to 100', async () => {
      const { rerender, container } = render(
        <ProgressBar progress={createProgressUpdate({ percentage: 0 })} />
      );

      expect(percentText(container)).toBe('0%');

      rerender(<ProgressBar progress={createProgressUpdate({ percentage: 100 })} />);

      await waitFor(() => {
        expect(percentText(container)).toBe('100%');
      }, { timeout: 1000 });
    });
  });

  describe('Visibility', () => {
    it('should become visible when progress is provided', () => {
      const { rerender, container } = render(<ProgressBar progress={null} />);

      expect(container).toBeEmptyDOMElement();

      rerender(<ProgressBar progress={createProgressUpdate()} />);

      expect(container).not.toBeEmptyDOMElement();
    });

    it('should become hidden when progress is set to null', async () => {
      const { rerender, container } = render(<ProgressBar progress={createProgressUpdate()} />);

      expect(container.querySelector('.progress-stage')).toBeInTheDocument();

      rerender(<ProgressBar progress={null} />);

      await waitFor(() => {
        expect(container).toBeEmptyDOMElement();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle percentage of 0', () => {
      const { container } = render(
        <ProgressBar progress={createProgressUpdate({ percentage: 0, current: 0 })} />
      );

      expect(percentText(container)).toBe('0%');
    });

    it('should handle percentage of 100', () => {
      const { container } = render(
        <ProgressBar progress={createProgressUpdate({ percentage: 100, current: 10, total: 10 })} />
      );

      expect(percentText(container)).toBe('100%');
    });

    it('should handle missing percentage field', () => {
      const { container } = render(
        <ProgressBar progress={createProgressUpdate({ percentage: undefined })} />
      );

      // Should default to 0
      expect(percentText(container)).toBe('0%');
    });

    it('should clamp a percentage above 100', () => {
      const { container } = render(
        <ProgressBar progress={createProgressUpdate({ percentage: 140 })} />
      );

      expect(percentText(container)).toBe('100%');
      expect(fill(container)).toHaveStyle({ width: '100%' });
    });

    it('should apply custom className', () => {
      const { container } = render(
        <ProgressBar progress={createProgressUpdate()} className="custom-progress" />
      );

      expect(container.querySelector('.custom-progress')).toBeInTheDocument();
    });
  });
});
