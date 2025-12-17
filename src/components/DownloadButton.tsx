/**
 * DownloadButton Component - Download functionality using Blob APIs
 * Validates: Requirements 1.3, 8.5
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Collapse,
  Stack,
  CircularProgress,
  Divider,
  Chip
} from '@mui/material';
import {
  Download as DownloadIcon,
  Description as FileIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as SuccessIcon,
  FileDownload as FileDownloadIcon
} from '@mui/icons-material';
import { FileUtils } from '@/lib/file-utils';
import { ProcessedFile } from '@/workers/shared/progress-protocol';

export interface DownloadButtonProps {
  files: ProcessedFile[];
  onDownloadStart?: (filename: string) => void;
  onDownloadComplete?: (filename: string) => void;
  onDownloadError?: (error: string) => void;
  disabled?: boolean;
  className?: string; // Kept for compatibility but unused
  variant?: 'primary' | 'secondary' | 'outline'; // Mapped to MUI variants
  size?: 'small' | 'medium' | 'large';
  showFileInfo?: boolean;
  autoDownload?: boolean;
}

const DownloadButton: React.FC<DownloadButtonProps> = ({
  files,
  onDownloadStart,
  onDownloadComplete,
  onDownloadError,
  disabled = false,
  showFileInfo = true,
  autoDownload = false
}) => {
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);

  // Auto-download effect
  React.useEffect(() => {
    if (autoDownload && files.length > 0 && !disabled) {
      handleDownloadAll();
    }
  }, [autoDownload, files, disabled]);

  /**
   * Download a single file
   */
  const downloadFile = useCallback(async (file: ProcessedFile): Promise<void> => {
    try {
      setDownloadingFiles(prev => new Set(prev).add(file.name));
      onDownloadStart?.(file.name);

      // Create download using FileUtils
      FileUtils.downloadFile(file.data, file.name, file.mimeType);

      onDownloadComplete?.(file.name);
    } catch (error) {
      const errorMessage = `Failed to download ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      onDownloadError?.(errorMessage);
    } finally {
      setDownloadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(file.name);
        return newSet;
      });
    }
  }, [onDownloadStart, onDownloadComplete, onDownloadError]);

  /**
   * Download all files
   */
  const handleDownloadAll = useCallback(async (): Promise<void> => {
    if (files.length === 0) return;

    try {
      // Download files sequentially
      for (const file of files) {
        await downloadFile(file);
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      onDownloadError?.(
        `Failed to download files: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }, [files, downloadFile, onDownloadError]);

  if (files.length === 0) {
    return null;
  }

  // Calculate stats
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const totalOriginalSize = files.reduce((sum, file) => sum + (file.originalSize || file.size), 0);
  const compressionRatio = totalOriginalSize > 0 ? (totalOriginalSize - totalSize) / totalOriginalSize : 0;
  const showSavings = compressionRatio > 0.01; // Only show if > 1% savings

  const isDownloadingAll = downloadingFiles.size > 0;

  return (
    <Card variant="outlined" sx={{ bgcolor: 'background.paper', borderRadius: 2, overflow: 'hidden' }}>
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} flexWrap="wrap">
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
              <SuccessIcon color="success" />
              <Typography variant="h6" fontWeight="bold">
                Ready for Download
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {files.length} file{files.length !== 1 && 's'} • {FileUtils.formatFileSize(totalSize)}
              {showSavings && (
                <Typography component="span" variant="body2" color="success.main" fontWeight="medium" sx={{ ml: 1 }}>
                  (Saved {FileUtils.formatFileSize(totalOriginalSize - totalSize)})
                </Typography>
              )}
            </Typography>
          </Box>

          <Box>
            <Button
              variant="contained"
              size="large"
              startIcon={isDownloadingAll ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
              onClick={handleDownloadAll}
              disabled={disabled || isDownloadingAll}
              sx={{ px: 4, py: 1.5, borderRadius: 2 }}
            >
              {isDownloadingAll
                ? `Downloading...`
                : `Download ${files.length > 1 ? 'All' : 'File'}`
              }
            </Button>
          </Box>
        </Stack>

        {showFileInfo && files.length > 1 && (
          <Box mt={3}>
            <Button
              size="small"
              onClick={() => setExpanded(!expanded)}
              endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              sx={{ mb: 1 }}
            >
              View individual files
            </Button>
            <Collapse in={expanded}>
              <Paper variant="outlined" sx={{ mt: 1, borderRadius: 1 }}>
                <List dense disablePadding>
                  {files.map((file, index) => {
                    const isDownloading = downloadingFiles.has(file.name);
                    return (
                      <React.Fragment key={index}>
                        {index > 0 && <Divider component="li" />}
                        <ListItem>
                          <ListItemIcon sx={{ minWidth: 40 }}>
                            <FileIcon color="action" />
                          </ListItemIcon>
                          <ListItemText
                            primary={file.name}
                            secondary={
                              <Stack direction="row" spacing={1} alignItems="center" component="span">
                                <span>{FileUtils.formatFileSize(file.size)}</span>
                                {file.originalSize && file.originalSize > file.size && (
                                  <Chip
                                    label={`-${Math.round((1 - file.size / file.originalSize) * 100)}%`}
                                    size="small"
                                    color="success"
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: '0.7em' }}
                                  />
                                )}
                              </Stack>
                            }
                          />
                          <ListItemSecondaryAction>
                            <IconButton
                              edge="end"
                              onClick={() => downloadFile(file)}
                              disabled={disabled || isDownloading}
                              color="primary"
                            >
                              {isDownloading ? <CircularProgress size={20} /> : <FileDownloadIcon />}
                            </IconButton>
                          </ListItemSecondaryAction>
                        </ListItem>
                      </React.Fragment>
                    );
                  })}
                </List>
              </Paper>
            </Collapse>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default DownloadButton;