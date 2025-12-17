/**
 * Modern Split Page - PDF split tool interface
 * Validates: Requirements 5.1, 5.5
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  Alert,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  useTheme,
  alpha,

} from '@mui/material';
import {
  CallSplit as SplitIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon,
  Description as FileIcon,
  CloudUpload as UploadIcon,
  Info as InfoIcon,
  CheckCircle as ValidIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import Layout from '@/components/Layout';
import ProgressBar from '@/components/ProgressBar';
import DownloadButton from '@/components/DownloadButton';
import { WorkerCommunicator, TaskIdGenerator } from '@/workers/shared/message-router';
import { ProgressUpdate, ProcessedFile } from '@/workers/shared/progress-protocol';
import { ErrorHandler } from '@/lib/error-handler';

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

const Split: React.FC = () => {
  const theme = useTheme();
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
        results: (message.payload as any).files,
      }));
    },
    onError: (message) => {
      const processedError = ErrorHandler.processError(new Error((message.payload as any).message));
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
        await workerCommunicator.initializeWorker(new URL('../workers/split-worker.ts', import.meta.url));
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
    if (files.length > 0) {
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
    }
  }, [workerCommunicator]);

  const validateRanges = useCallback((ranges: string, pageCount: number) => {
    if (!ranges.trim()) {
      return { isValid: false, message: 'Enter page ranges to validate' };
    }

    try {
      // Basic validation - check format
      const rangePattern = /^\s*(\d+(-\d+)?)\s*(,\s*(\d+(-\d+)?)\s*)*$/;
      if (!rangePattern.test(ranges)) {
        return { isValid: false, message: 'Invalid format. Use: 1-3, 5, 7-9' };
      }

      // Parse and validate ranges
      const parts = ranges.split(',').map(part => part.trim());
      for (const part of parts) {
        if (part.includes('-')) {
          const [start, end] = part.split('-').map(num => parseInt(num.trim()));
          if (start < 1 || end > pageCount || start > end) {
            return { isValid: false, message: `Range ${part} is invalid for ${pageCount} pages` };
          }
        } else {
          const page = parseInt(part);
          if (page < 1 || page > pageCount) {
            return { isValid: false, message: `Page ${page} is invalid for ${pageCount} pages` };
          }
        }
      }

      return { isValid: true, message: 'Valid page ranges' };
    } catch (error) {
      return { isValid: false, message: 'Invalid range format' };
    }
  }, []);

  const handleRangesChange = useCallback((ranges: string) => {
    setState(prev => {
      const validation = state.pdfInfo ?
        validateRanges(ranges, state.pdfInfo.pageCount) :
        { isValid: false, message: 'Load a PDF file first' };

      return {
        ...prev,
        options: { ...prev.options, ranges },
        rangeValidation: validation
      };
    });
  }, [state.pdfInfo, validateRanges]);

  const handleOptionsChange = useCallback((newOptions: Partial<SplitOptions>) => {
    setState(prev => ({
      ...prev,
      options: { ...prev.options, ...newOptions }
    }));
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getRangeExamples = () => {
    if (!state.pdfInfo) return [];
    const pageCount = state.pdfInfo.pageCount;
    return [
      '1-3',
      `1, 3, ${Math.min(5, pageCount)}`,
      `1-${Math.min(3, pageCount)}, ${Math.min(5, pageCount)}-${Math.min(7, pageCount)}`,
      pageCount > 1 ? `${pageCount}` : '1'
    ].filter(example => {
      const validation = validateRanges(example, pageCount);
      return validation.isValid;
    });
  };

  return (
    <Layout title="Split PDF" showBackButton>
      <Box sx={{ maxWidth: 800, mx: 'auto' }}>
        {/* Header */}
        <Paper sx={{ p: 3, mb: 3, textAlign: 'center' }}>
          <SplitIcon sx={{ fontSize: 48, color: 'warning.main', mb: 2 }} />
          <Typography variant="h4" gutterBottom>
            Split PDF File
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Extract specific pages or ranges from PDF documents with flexible options
          </Typography>
        </Paper>

        {/* Error Display */}
        {state.error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setState(prev => ({ ...prev, error: null }))}>
            {state.error}
          </Alert>
        )}

        {/* File Upload */}
        {!state.isProcessing && state.results.length === 0 && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box
                sx={{
                  border: 2,
                  borderColor: state.file ? 'warning.main' : 'grey.300',
                  borderStyle: 'dashed',
                  borderRadius: 2,
                  p: 4,
                  textAlign: 'center',
                  backgroundColor: alpha(theme.palette.warning.main, 0.02),
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.warning.main, 0.05),
                    borderColor: 'warning.main',
                  }
                }}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  accept=".pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files) {
                      handleFileSelected(Array.from(e.target.files));
                    }
                  }}
                />
                <UploadIcon sx={{ fontSize: 48, color: 'warning.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Drop a PDF file here or click to select
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Single PDF file • Up to 500MB • Extract pages or ranges
                </Typography>
              </Box>

              {/* File Info */}
              {state.file && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Selected File
                  </Typography>
                  <List>
                    <ListItem divider>
                      <ListItemIcon>
                        <FileIcon color="warning" />
                      </ListItemIcon>
                      <ListItemText
                        primary={state.file.name}
                        secondary={
                          <>
                            <Typography variant="caption" display="block">
                              Size: {formatFileSize(state.file.size)}
                            </Typography>
                            {state.pdfInfo && (
                              <Chip
                                label={`${state.pdfInfo.pageCount} pages`}
                                size="small"
                                color="warning"
                                sx={{ mt: 0.5 }}
                              />
                            )}
                          </>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton edge="end" onClick={handleReset}>
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  </List>
                </Box>
              )}
            </CardContent>
          </Card>
        )}

        {/* Split Options */}
        {state.file && state.pdfInfo && !state.isProcessing && state.results.length === 0 && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <SettingsIcon sx={{ mr: 1, color: 'warning.main' }} />
                <Typography variant="h6">Split Settings</Typography>
              </Box>

              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Page Ranges"
                    value={state.options.ranges}
                    onChange={(e) => handleRangesChange(e.target.value)}
                    error={state.options.ranges.length > 0 && !state.rangeValidation.isValid}
                    helperText={
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {state.rangeValidation.isValid ? (
                            <ValidIcon color="success" sx={{ fontSize: 16 }} />
                          ) : (
                            <ErrorIcon color="error" sx={{ fontSize: 16 }} />
                          )}
                          <Typography variant="caption">
                            {state.rangeValidation.message}
                          </Typography>
                        </Box>
                        <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                          Examples: {getRangeExamples().join(', ')}
                        </Typography>
                      </Box>
                    }
                    placeholder="e.g., 1-3, 5, 7-9"
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Output Prefix"
                    value={state.options.outputPrefix}
                    onChange={(e) => handleOptionsChange({ outputPrefix: e.target.value })}
                    helperText="Prefix for split file names"
                  />
                </Grid>

                <Grid item xs={12}>
                  <Alert severity="info" icon={<InfoIcon />}>
                    <Typography variant="body2">
                      <strong>Page Range Format:</strong><br />
                      • Single pages: 1, 3, 5<br />
                      • Page ranges: 1-3, 7-9<br />
                      • Mixed: 1-3, 5, 7-9<br />
                      • Document has {state.pdfInfo.pageCount} pages
                    </Typography>
                  </Alert>
                </Grid>

                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    size="large"
                    fullWidth
                    startIcon={<SplitIcon />}
                    onClick={handleSplit}
                    disabled={!state.rangeValidation.isValid}
                    color="warning"
                  >
                    Split PDF
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* Progress */}
        {state.isProcessing && state.progress && (
          <ProgressBar
            progress={state.progress}
            onCancel={handleCancel}
            showCancel={true}
            showDetails={true}
            variant="warning"
          />
        )}

        {/* Results */}
        {state.results.length > 0 && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h6">
                  Split Complete
                </Typography>
                <Button variant="outlined" onClick={handleReset}>
                  Split Another File
                </Button>
              </Box>

              <List>
                {state.results.map((result, index) => (
                  <ListItem key={index} divider>
                    <ListItemIcon>
                      <FileIcon color="warning" />
                    </ListItemIcon>
                    <ListItemText
                      primary={result.name}
                      secondary={
                        <>
                          <Typography variant="caption" display="block">
                            Size: {formatFileSize(result.size)}
                          </Typography>
                          <Chip
                            label={`Split ${index + 1} of ${state.results.length}`}
                            size="small"
                            color="warning"
                            sx={{ mt: 0.5 }}
                          />
                        </>
                      }
                    />
                    <ListItemSecondaryAction>
                      <DownloadButton
                        files={[result]}
                        variant="primary"
                        size="small"
                        showFileInfo={false}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>

              {/* Download All Button */}
              {state.results.length > 1 && (
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                  <DownloadButton
                    files={state.results}
                    variant="primary"
                    size="large"
                  />
                </Box>
              )}
            </CardContent>
          </Card>
        )}
      </Box>
    </Layout>
  );
};

export default Split;