/**
 * ProgressBar Component - Real-time progress display with cancel functionality
 * Validates: Requirements 2.1, 2.5, 8.4
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  LinearProgress,
  Typography,
  Button,
  Paper,
  Chip,
  IconButton,
  Collapse,
  Alert,
} from '@mui/material';
import {
  Cancel as CancelIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { ProgressUpdate } from '@/workers/shared/progress-protocol';

export interface ProgressBarProps {
  progress: ProgressUpdate | null;
  onCancel?: () => void;
  showCancel?: boolean;
  showDetails?: boolean;
  className?: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'success' | 'warning' | 'error';
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  onCancel,
  showCancel = true,
  showDetails = true,
  className = '',
  size = 'medium',
  variant = 'default'
}) => {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);

  // Animate progress changes
  useEffect(() => {
    if (progress) {
      setIsVisible(true);
      const targetProgress = progress.percentage || 0;
      
      // Smooth animation
      const startProgress = animatedProgress;
      const progressDiff = targetProgress - startProgress;
      const duration = 300; // ms
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progressRatio = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const easeOutQuart = 1 - Math.pow(1 - progressRatio, 4);
        const currentProgress = startProgress + (progressDiff * easeOutQuart);
        
        setAnimatedProgress(currentProgress);
        
        if (progressRatio < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    } else {
      setIsVisible(false);
      setAnimatedProgress(0);
    }
  }, [progress, animatedProgress]);

  if (!isVisible || !progress) {
    return null;
  }

  // Get variant colors for MUI
  const getVariantColor = () => {
    switch (variant) {
      case 'success': return 'success';
      case 'warning': return 'warning';
      case 'error': return 'error';
      default: return 'primary';
    }
  };

  const getVariantSeverity = () => {
    switch (variant) {
      case 'success': return 'success';
      case 'warning': return 'warning';
      case 'error': return 'error';
      default: return 'info';
    }
  };

  return (
    <Paper 
      elevation={2}
      sx={{ 
        p: 3, 
        mb: 2,
        borderRadius: 2,
        backgroundColor: 'background.paper'
      }}
      className={className}
    >
      {/* Header with stage and cancel button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip 
            label={progress.stage} 
            color={getVariantColor()}
            size="small"
            sx={{ fontWeight: 600 }}
          />
          <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
            {Math.round(animatedProgress)}%
          </Typography>
        </Box>
        
        {showCancel && onCancel && (
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<CancelIcon />}
            onClick={onCancel}
            sx={{ minWidth: 'auto' }}
          >
            Cancel
          </Button>
        )}
      </Box>

      {/* Progress message */}
      {progress.message && (
        <Alert 
          severity={getVariantSeverity()} 
          sx={{ mb: 2, '& .MuiAlert-message': { width: '100%' } }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2">
              {progress.message}
            </Typography>
            {showDetails && (
              <IconButton
                size="small"
                onClick={() => setShowMoreDetails(!showMoreDetails)}
                sx={{ ml: 1 }}
              >
                {showMoreDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            )}
          </Box>
        </Alert>
      )}

      {/* Progress bar */}
      <Box sx={{ mb: 2 }}>
        <LinearProgress
          variant="determinate"
          value={animatedProgress}
          color={getVariantColor()}
          sx={{
            height: size === 'small' ? 4 : size === 'large' ? 12 : 8,
            borderRadius: 2,
            backgroundColor: 'grey.200',
            '& .MuiLinearProgress-bar': {
              borderRadius: 2,
            }
          }}
        />
      </Box>

      {/* Detailed progress info */}
      <Collapse in={showMoreDetails && showDetails}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          pt: 1,
          borderTop: 1,
          borderColor: 'divider'
        }}>
          <Typography variant="caption" color="text.secondary">
            Progress: {progress.current} of {progress.total}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {progress.current > 0 && progress.total > 0 && (
              `${((progress.current / progress.total) * 100).toFixed(1)}% complete`
            )}
          </Typography>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default ProgressBar;