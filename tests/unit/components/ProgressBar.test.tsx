/**
 * Unit Tests - ProgressBar Component
 * Tests progress display and cancel functionality
 * Validates: Requirements 2.1, 2.5, 8.4
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

  describe('Rendering', () => {
    it('should not render when progress is null', () => {
      const { container } = render(
        <ProgressBar progress={null} />
      );

      expect(container).toBeEmptyDOMElement();
    });

    it('should render with progress data', () => {
      const progress = createProgressUpdate();

      render(<ProgressBar progress={progress} />);

      expect(screen.getByText('Processing')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getByText('Processing file 5 of 10')).toBeInTheDocument();
    });

    it('should display stage as a chip', () => {
      const progress = createProgressUpdate({ stage: 'Compressing' });

      render(<ProgressBar progress={progress} />);

      const chip = screen.getByText('Compressing');
      expect(chip).toBeInTheDocument();
      expect(chip.tagName).toBe('SPAN'); // MUI Chip renders as span
    });

    it('should show percentage', () => {
      const progress = createProgressUpdate({ percentage: 75 });

      render(<ProgressBar progress={progress} />);

      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('should render without message if not provided', () => {
      const progress = createProgressUpdate({ message: undefined });

      render(<ProgressBar progress={progress} />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Cancel Functionality', () => {
    it('should show cancel button when onCancel is provided', () => {
      const progress = createProgressUpdate();

      render(
        <ProgressBar
          progress={progress}
          onCancel={onCancel}
          showCancel={true}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeInTheDocument();
    });

    it('should not show cancel button when showCancel is false', () => {
      const progress = createProgressUpdate();

      render(
        <ProgressBar
          progress={progress}
          onCancel={onCancel}
          showCancel={false}
        />
      );

      const cancelButton = screen.queryByRole('button', { name: /cancel/i });
      expect(cancelButton).not.toBeInTheDocument();
    });

    it('should not show cancel button when onCancel is not provided', () => {
      const progress = createProgressUpdate();

      render(
        <ProgressBar
          progress={progress}
          showCancel={true}
        />
      );

      const cancelButton = screen.queryByRole('button', { name: /cancel/i });
      expect(cancelButton).not.toBeInTheDocument();
    });

    it('should call onCancel when cancel button is clicked', () => {
      const progress = createProgressUpdate();

      render(
        <ProgressBar
          progress={progress}
          onCancel={onCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Detailed Information', () => {
    it('should show details button when showDetails is true', () => {
      const progress = createProgressUpdate();

      render(
        <ProgressBar
          progress={progress}
          showDetails={true}
        />
      );

      // Look for expand/collapse button
      const expandButton = screen.getByRole('button', { name: '' }); // Icon button
      expect(expandButton).toBeInTheDocument();
    });

    it('should toggle details on button click', async () => {
      const progress = createProgressUpdate();

      render(
        <ProgressBar
          progress={progress}
          showDetails={true}
        />
      );

      const expandButton = screen.getAllByRole('button').find(
        btn => btn.querySelector('svg') !== null && !btn.textContent?.includes('Cancel')
      );

      expect(expandButton).toBeDefined();

      // Click to expand
      fireEvent.click(expandButton!);

      await waitFor(() => {
        expect(screen.getByText(/progress: 5 of 10/i)).toBeInTheDocument();
      });

      // Click to collapse
      fireEvent.click(expandButton!);

      await waitFor(() => {
        expect(screen.queryByText(/progress: 5 of 10/i)).not.toBeVisible();
      });
    });

    it('should show progress details when expanded', async () => {
      const progress = createProgressUpdate({ current: 7, total: 10 });

      render(
        <ProgressBar
          progress={progress}
          showDetails={true}
        />
      );

      const expandButton = screen.getAllByRole('button').find(
        btn => btn.querySelector('svg') !== null && !btn.textContent?.includes('Cancel')
      );

      fireEvent.click(expandButton!);

      await waitFor(() => {
        expect(screen.getByText(/7 of 10/)).toBeInTheDocument();
        expect(screen.getByText(/70\.0% complete/i)).toBeInTheDocument();
      });
    });
  });

  describe('Progress Bar Size', () => {
    it('should apply small size', () => {
      const progress = createProgressUpdate();

      const { container } = render(
        <ProgressBar
          progress={progress}
          size="small"
        />
      );

      const progressBar = container.querySelector('.MuiLinearProgress-root');
      expect(progressBar).toHaveStyle({ height: '4px' });
    });

    it('should apply medium size', () => {
      const progress = createProgressUpdate();

      const { container } = render(
        <ProgressBar
          progress={progress}
          size="medium"
        />
      );

      const progressBar = container.querySelector('.MuiLinearProgress-root');
      expect(progressBar).toHaveStyle({ height: '8px' });
    });

    it('should apply large size', () => {
      const progress = createProgressUpdate();

      const { container } = render(
        <ProgressBar
          progress={progress}
          size="large"
        />
      );

      const progressBar = container.querySelector('.MuiLinearProgress-root');
      expect(progressBar).toHaveStyle({ height: '12px' });
    });
  });

  describe('Variants', () => {
    it('should apply default variant', () => {
      const progress = createProgressUpdate();

      render(
        <ProgressBar
          progress={progress}
          variant="default"
        />
      );

      expect(screen.getByRole('progressbar')).toHaveClass('MuiLinearProgress-colorPrimary');
    });

    it('should apply success variant', () => {
      const progress = createProgressUpdate();

      render(
        <ProgressBar
          progress={progress}
          variant="success"
        />
      );

      expect(screen.getByRole('progressbar')).toHaveClass('MuiLinearProgress-colorSuccess');
    });

    it('should apply warning variant', () => {
      const progress = createProgressUpdate();

      render(
        <ProgressBar
          progress={progress}
          variant="warning"
        />
      );

      expect(screen.getByRole('progressbar')).toHaveClass('MuiLinearProgress-colorWarning');
    });

    it('should apply error variant', () => {
      const progress = createProgressUpdate();

      render(
        <ProgressBar
          progress={progress}
          variant="error"
        />
      );

      expect(screen.getByRole('progressbar')).toHaveClass('MuiLinearProgress-colorError');
    });
  });

  describe('Progress Animation', () => {
    it('should update progress smoothly', async () => {
      const { rerender } = render(
        <ProgressBar progress={createProgressUpdate({ percentage: 25 })} />
      );

      expect(screen.getByText('25%')).toBeInTheDocument();

      // Update to higher percentage
      rerender(
        <ProgressBar progress={createProgressUpdate({ percentage: 75 })} />
      );

      // Animation should eventually show new percentage
      await waitFor(() => {
        expect(screen.getByText('75%')).toBeInTheDocument();
      }, { timeout: 500 });
    });

    it('should handle progress from 0 to 100', () => {
      const { rerender } = render(
        <ProgressBar progress={createProgressUpdate({ percentage: 0 })} />
      );

      expect(screen.getByText('0%')).toBeInTheDocument();

      rerender(
        <ProgressBar progress={createProgressUpdate({ percentage: 100 })} />
      );

      // Should eventually show 100%
      waitFor(() => {
        expect(screen.getByText('100%')).toBeInTheDocument();
      });
    });
  });

  describe('Visibility', () => {
    it('should become visible when progress is provided', () => {
      const { rerender, container } = render(
        <ProgressBar progress={null} />
      );

      expect(container).toBeEmptyDOMElement();

      rerender(
        <ProgressBar progress={createProgressUpdate()} />
      );

      expect(container).not.toBeEmptyDOMElement();
    });

    it('should become hidden when progress is set to null', async () => {
      const { rerender, container } = render(
        <ProgressBar progress={createProgressUpdate()} />
      );

      expect(screen.getByText('Processing')).toBeInTheDocument();

      rerender(
        <ProgressBar progress={null} />
      );

      await waitFor(() => {
        expect(container).toBeEmptyDOMElement();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle percentage of 0', () => {
      const progress = createProgressUpdate({ percentage: 0, current: 0 });

      render(<ProgressBar progress={progress} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should handle percentage of 100', () => {
      const progress = createProgressUpdate({ percentage: 100, current: 10, total: 10 });

      render(<ProgressBar progress={progress} />);

      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('should handle missing percentage field', () => {
      const progress = createProgressUpdate({ percentage: undefined });

      render(<ProgressBar progress={progress} />);

      // Should default to 0
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const progress = createProgressUpdate();

      const { container } = render(
        <ProgressBar
          progress={progress}
          className="custom-progress"
        />
      );

      expect(container.querySelector('.custom-progress')).toBeInTheDocument();
    });
  });
});
