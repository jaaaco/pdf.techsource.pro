/**
 * Modern Merge Page - PDF merge tool interface
 * Validates: Requirements 4.1, 4.5
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
  Tooltip,
} from '@mui/material';
import {
  MergeType as MergeIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon,
  Description as FileIcon,
  CloudUpload as UploadIcon,

  SwapVert as ReorderIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import Layout from '@/components/Layout';
import ProgressBar from '@/components/ProgressBar';
import DownloadButton from '@/components/DownloadButton';
import { WorkerCommunicator, TaskIdGenerator } from '@/workers/shared/message-router';
import { ProgressUpdate, ProcessedFile } from '@/workers/shared/progress-protocol';
import { ErrorHandler } from '@/lib/error-handler';

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
  const theme = useTheme();
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
        await workerCommunicator.initializeWorker(new URL('../workers/merge-worker.ts', import.meta.url));
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
    const filesWithOrder = files.map((file, index) => ({
      file,
      order: state.files.length + index
    }));
    setState(prev => ({
      ...prev,
      files: [...prev.files, ...filesWithOrder],
      error: null
    }));
  }, [state.files.length]);

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
      files: prev.files.filter((_, i) => i !== index)
    }));
  }, []);

  const moveFile = useCallback((fromIndex: number, toIndex: number) => {
    setState(prev => {
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getTotalSize = () => {
    return state.files.reduce((total, fileWithOrder) => total + fileWithOrder.file.size, 0);
  };

  return (
    <Layout title="Merge PDFs" showBackButton>
      <Box sx={{ maxWidth: 800, mx: 'auto' }}>
        {/* Header */}
        <Paper sx={{ p: 3, mb: 3, textAlign: 'center' }}>
          <MergeIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
          <Typography variant="h4" gutterBottom>
            Merge PDF Files
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Combine multiple PDF files into a single document with drag-and-drop ordering
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
                  borderColor: state.files.length > 0 ? 'success.main' : 'grey.300',
                  borderStyle: 'dashed',
                  borderRadius: 2,
                  p: 4,
                  textAlign: 'center',
                  backgroundColor: alpha(theme.palette.success.main, 0.02),
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.success.main, 0.05),
                    borderColor: 'success.main',
                  }
                }}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  multiple
                  accept=".pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files) {
                      handleFilesSelected(Array.from(e.target.files));
                    }
                  }}
                />
                <UploadIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Drop PDF files here or click to select
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Add multiple files • Drag to reorder • Minimum 2 files required
                </Typography>
                {state.files.length > 0 && (
                  <Chip
                    label={`${state.files.length} files selected`}
                    color="success"
                    sx={{ mt: 2 }}
                  />
                )}
              </Box>

              {/* File List with Reordering */}
              {state.files.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">
                      Files to Merge ({state.files.length})
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Total: {formatFileSize(getTotalSize())}
                      </Typography>
                      <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => document.getElementById('file-input')?.click()}
                      >
                        Add More
                      </Button>
                    </Box>
                  </Box>

                  <List>
                    {state.files.map((fileWithOrder, index) => (
                      <ListItem key={`${fileWithOrder.file.name}-${index}`} divider>
                        <ListItemIcon>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Chip
                              label={index + 1}
                              size="small"
                              color="success"
                              sx={{ mr: 1, minWidth: 32 }}
                            />
                            <FileIcon color="success" />
                          </Box>
                        </ListItemIcon>
                        <ListItemText
                          primary={fileWithOrder.file.name}
                          secondary={formatFileSize(fileWithOrder.file.size)}
                        />
                        <ListItemSecondaryAction>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {index > 0 && (
                              <Tooltip title="Move up">
                                <IconButton
                                  size="small"
                                  onClick={() => moveFile(index, index - 1)}
                                >
                                  <ReorderIcon sx={{ transform: 'rotate(180deg)' }} />
                                </IconButton>
                              </Tooltip>
                            )}
                            {index < state.files.length - 1 && (
                              <Tooltip title="Move down">
                                <IconButton
                                  size="small"
                                  onClick={() => moveFile(index, index + 1)}
                                >
                                  <ReorderIcon />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Remove file">
                              <IconButton
                                size="small"
                                onClick={() => removeFile(index)}
                                color="error"
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </CardContent>
          </Card>
        )}

        {/* Merge Options */}
        {state.files.length >= 2 && !state.isProcessing && state.results.length === 0 && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <SettingsIcon sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="h6">Merge Settings</Typography>
              </Box>

              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Output Filename"
                    value={state.options.outputName}
                    onChange={(e) => handleOptionsChange({ outputName: e.target.value })}
                    helperText="The name for your merged PDF file"
                  />
                </Grid>

                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    size="large"
                    fullWidth
                    startIcon={<MergeIcon />}
                    onClick={handleMerge}
                    disabled={state.files.length < 2}
                    color="success"
                  >
                    Merge {state.files.length} Files
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* Minimum Files Warning */}
        {state.files.length === 1 && (
          <Alert severity="info" sx={{ mb: 3 }}>
            Add at least one more PDF file to enable merging. You currently have {state.files.length} file selected.
          </Alert>
        )}

        {/* Progress */}
        {state.isProcessing && state.progress && (
          <ProgressBar
            progress={state.progress}
            onCancel={handleCancel}
            showCancel={true}
            showDetails={true}
            variant="success"
          />
        )}

        {/* Results */}
        {state.results.length > 0 && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h6">
                  Merge Complete
                </Typography>
                <Button variant="outlined" onClick={handleReset}>
                  Merge More Files
                </Button>
              </Box>

              <List>
                {state.results.map((result, index) => (
                  <ListItem key={index} divider>
                    <ListItemIcon>
                      <FileIcon color="success" />
                    </ListItemIcon>
                    <ListItemText
                      primary={result.name}
                      secondary={
                        <>
                          <Typography variant="caption" display="block">
                            Size: {formatFileSize(result.size)}
                          </Typography>
                          <Chip
                            label={`${state.files.length} files merged`}
                            size="small"
                            color="success"
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
            </CardContent>
          </Card>
        )}
      </Box>
    </Layout>
  );
};

export default Merge;