/**
 * Modern OCR Page - PDF OCR tool interface
 * Validates: Requirements 6.1, 6.5
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
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

  SelectChangeEvent,
} from '@mui/material';
import {
  TextFields as OCRIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon,
  Description as FileIcon,
  CloudUpload as UploadIcon,
  Language as LanguageIcon,
  Visibility as PreviewIcon,

  Speed as SpeedIcon,
  HighQuality as QualityIcon,
} from '@mui/icons-material';
import Layout from '@/components/Layout';
import ProgressBar from '@/components/ProgressBar';
import DownloadButton from '@/components/DownloadButton';
import { WorkerCommunicator, TaskIdGenerator } from '@/workers/shared/message-router';
import { ProgressUpdate, ProcessedFile } from '@/workers/shared/progress-protocol';
import { ErrorHandler } from '@/lib/error-handler';
import { useDebugConsole } from '@/hooks/useDebugConsole';

interface OCROptions {
  languages: string[];
  outputFormat: 'searchable-pdf' | 'text-only' | 'pdf-with-text';
  preserveFormatting?: boolean;
  confidenceThreshold?: number;
}

// ... imports remain the same

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

const OCR: React.FC = () => {
  const theme = useTheme();
  const [isDebugVisible] = useDebugConsole();

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    setState(prev => ({
      ...prev,
      debugLogs: [...prev.debugLogs, `[${timestamp}] ${message}`]
    }));
  };

  const [state, setState] = useState<OCRState>({
    file: null,
    options: {
      languages: ['eng'],
      outputFormat: 'searchable-pdf',
      preserveFormatting: true,
      confidenceThreshold: 70,
    },
    isProcessing: false,
    progress: null,
    results: [],
    error: null,
    estimatedTime: null,
    debugLogs: [],
  });

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
      setState(prev => ({
        ...prev,
        isProcessing: false,
        progress: null,
        results: (message.payload as any).files,
        debugLogs: [...prev.debugLogs, `[${new Date().toISOString().split('T')[1].slice(0, -1)}] Complete: Received ${(message.payload as any).files.length} file(s)`]
      }));
    },
    onError: (message) => {
      // Log the raw message payload for debugging
      const rawError = message.payload as any;
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
        const workerUrl = new URL('../workers/ocr-worker.ts', import.meta.url);
        if (isMounted) addLog(`Worker URL: ${workerUrl.toString()}`);

        await workerCommunicator.initializeWorker(workerUrl);

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
      addLog('Terminating worker instance (cleanup)...');
      workerCommunicator.terminateWorker();
    };
  }, [workerCommunicator]);

  // ... (handleFileSelected, estimateProcessingTime, handleLanguageChange, handleOptionsChange remain same)

  const handleFileSelected = useCallback((files: File[]) => {
    if (files.length > 0) {
      const file = files[0];
      const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
      setState(prev => ({
        ...prev,
        file,
        error: null,
        results: [],
        estimatedTime: estimateProcessingTime(file.size),
        debugLogs: [...prev.debugLogs, `[${timestamp}] File selected: ${file.name} (${formatFileSize(file.size)})`]
      }));
    }
  }, []);

  // ... handleLanguageChange, handleOptionsChange ...
  const handleLanguageChange = useCallback((event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    const languages = typeof value === 'string' ? value.split(',') : value;
    setState(prev => ({
      ...prev,
      options: { ...prev.options, languages }
    }));
  }, []);

  const handleOptionsChange = useCallback((newOptions: Partial<OCROptions>) => {
    setState(prev => ({
      ...prev,
      options: { ...prev.options, ...newOptions }
    }));
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
  }, [state.file, state.options, state.isProcessing, workerCommunicator]);

  // ... handleCancel, handleReset ...
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

  // ... helper functions (formatFileSize, formatTime, getLanguageOptions, getOutputFormatDescription) ...
  const estimateProcessingTime = (fileSize: number): number => {
    const sizeInMB = fileSize / (1024 * 1024);
    return Math.round(sizeInMB * 30);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds} seconds`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getLanguageOptions = () => [
    { code: 'eng', name: 'English' },
    { code: 'spa', name: 'Spanish' },
    { code: 'fra', name: 'French' },
    { code: 'deu', name: 'German' },
    { code: 'ita', name: 'Italian' },
    { code: 'por', name: 'Portuguese' },
    { code: 'rus', name: 'Russian' },
    { code: 'jpn', name: 'Japanese' },
    { code: 'chi_sim', name: 'Chinese (Simplified)' },
    { code: 'chi_tra', name: 'Chinese (Traditional)' },
    { code: 'ara', name: 'Arabic' },
    { code: 'hin', name: 'Hindi' },
  ];

  const getOutputFormatDescription = (format: string) => {
    switch (format) {
      case 'searchable-pdf': return 'PDF with invisible text layer (recommended)';
      case 'text-only': return 'Plain text file with extracted content';
      case 'pdf-with-text': return 'PDF with visible text overlay';
      default: return '';
    }
  };

  return (
    <Layout title="OCR PDF" showBackButton>
      <Box sx={{ maxWidth: 800, mx: 'auto' }}>
        {/* ... Header, Error Display, File Upload, OCR Options, Progress, Results ... */}
        {/* Keeping existing JSX for the top part, just ensuring the logic above replaces the state management.
            The below JSX needs to be preserved or matching the original file. 
            I'll focus on replacing the content from the start of the component loop down to the end properly.
        */}

        {/* Header */}
        <Paper sx={{ p: 3, mb: 3, textAlign: 'center' }}>
          <OCRIcon sx={{ fontSize: 48, color: 'secondary.main', mb: 2 }} />
          <Typography variant="h4" gutterBottom>
            OCR PDF Processing
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Convert scanned documents to searchable PDFs with optical character recognition
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
                  borderColor: state.file ? 'secondary.main' : 'grey.300',
                  borderStyle: 'dashed',
                  borderRadius: 2,
                  p: 4,
                  textAlign: 'center',
                  backgroundColor: alpha(theme.palette.secondary.main, 0.02),
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.secondary.main, 0.05),
                    borderColor: 'secondary.main',
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
                <UploadIcon sx={{ fontSize: 48, color: 'secondary.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Drop a scanned PDF here or click to select
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Single PDF file • Up to 500MB • Scanned documents or images
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
                        <FileIcon color="secondary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={state.file.name}
                        secondary={
                          <>
                            <Typography variant="caption" display="block">
                              Size: {formatFileSize(state.file.size)}
                            </Typography>
                            {state.estimatedTime && (
                              <Chip
                                label={`Est. processing time: ${formatTime(state.estimatedTime)}`}
                                size="small"
                                color="secondary"
                                icon={<SpeedIcon />}
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

                  {/* Large File Warning */}
                  {state.file.size > 50 * 1024 * 1024 && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      Large file detected. OCR processing may take several minutes.
                      Consider splitting the document for faster processing.
                    </Alert>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        )}

        {/* OCR Options */}
        {state.file && !state.isProcessing && state.results.length === 0 && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <SettingsIcon sx={{ mr: 1, color: 'secondary.main' }} />
                <Typography variant="h6">OCR Settings</Typography>
              </Box>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Languages</InputLabel>
                    <Select
                      multiple
                      value={state.options.languages}
                      label="Languages"
                      onChange={handleLanguageChange}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.map((value) => {
                            const lang = getLanguageOptions().find(l => l.code === value);
                            return (
                              <Chip
                                key={value}
                                label={lang?.name || value}
                                size="small"
                                icon={<LanguageIcon />}
                              />
                            );
                          })}
                        </Box>
                      )}
                    >
                      {getLanguageOptions().map((lang) => (
                        <MenuItem key={lang.code} value={lang.code}>
                          {lang.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Output Format</InputLabel>
                    <Select
                      value={state.options.outputFormat}
                      label="Output Format"
                      onChange={(e) => handleOptionsChange({ outputFormat: e.target.value as any })}
                    >
                      <MenuItem value="searchable-pdf">
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <QualityIcon sx={{ mr: 1 }} />
                          Searchable PDF
                        </Box>
                      </MenuItem>
                      <MenuItem value="text-only">
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <FileIcon sx={{ mr: 1 }} />
                          Text Only
                        </Box>
                      </MenuItem>
                      <MenuItem value="pdf-with-text">
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <PreviewIcon sx={{ mr: 1 }} />
                          PDF with Text Overlay
                        </Box>
                      </MenuItem>
                    </Select>
                  </FormControl>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    {getOutputFormatDescription(state.options.outputFormat)}
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <Alert severity="info">
                    <Typography variant="body2">
                      <strong>OCR Tips:</strong><br />
                      • Best results with high-quality scans (300+ DPI)<br />
                      • Select all languages present in your document<br />
                      • Searchable PDF format preserves original appearance<br />
                      • Processing time depends on document size and complexity
                    </Typography>
                  </Alert>
                </Grid>

                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    size="large"
                    fullWidth
                    startIcon={<OCRIcon />}
                    onClick={handleOCR}
                    disabled={!state.file}
                    color="secondary"
                  >
                    Start OCR Processing
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* Progress */}
        {state.isProcessing && state.progress && (
          <Box sx={{ mb: 3 }}>
            <ProgressBar
              progress={state.progress}
              onCancel={handleCancel}
              showCancel={true}
              showDetails={true}
              variant="default"
            />

            {/* Processing Info */}
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  OCR Processing Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Languages: {state.options.languages.map(lang => {
                        const langObj = getLanguageOptions().find(l => l.code === lang);
                        return langObj?.name || lang;
                      }).join(', ')}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Output: {getOutputFormatDescription(state.options.outputFormat)}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* Results */}
        {state.results.length > 0 && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h6">
                  OCR Complete
                </Typography>
                <Button variant="outlined" onClick={handleReset}>
                  Process Another File
                </Button>
              </Box>

              <List>
                {state.results.map((result, index) => (
                  <ListItem key={index} divider>
                    <ListItemIcon>
                      <FileIcon color="secondary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={result.name}
                      secondary={
                        <>
                          <Typography variant="caption" display="block">
                            Size: {formatFileSize(result.size)}
                          </Typography>
                          <span style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                            <Chip
                              label="OCR Processed"
                              size="small"
                              color="secondary"
                            />
                            {result.metadata?.averageConfidence && (
                              <Chip
                                label={`${Math.round(result.metadata.averageConfidence * 100)}% confidence`}
                                size="small"
                                color={result.metadata.averageConfidence > 0.8 ? 'success' : 'warning'}
                              />
                            )}
                          </span>
                        </>
                      }
                    />
                    <ListItemSecondaryAction>
                      <DownloadButton
                        files={[result]}
                        variant="secondary"
                        size="small"
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        )}

        {/* Debug Console (Toggle with Ctrl+Shift+D) */}
        {isDebugVisible && (
          <Card sx={{ mt: 4, bgcolor: '#0d1117', color: '#c9d1d9' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: '#fff' }}>
                Debug Console <Chip label="Ctrl+Shift+D to toggle" size="small" sx={{ ml: 1 }} />
              </Typography>
              <Box sx={{
                maxHeight: 200,
                overflowY: 'auto',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                p: 1,
                bgcolor: 'rgba(255,255,255,0.05)',
                borderRadius: 1
              }}>
                {state.debugLogs.length === 0 ? (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    No logs yet (start a task to see logs)
                  </Typography>
                ) : (
                  state.debugLogs.map((log, i) => (
                    <div key={i} style={{ marginBottom: 4 }}>{log}</div>
                  ))
                )}
              </Box>
            </CardContent>
          </Card>
        )}
      </Box>
    </Layout>
  );
};

export default OCR;