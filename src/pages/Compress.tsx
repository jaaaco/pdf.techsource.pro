/**
 * Modern Compress Page - PDF compression tool interface
 * Validates: Requirements 3.1, 3.5
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  Compress as CompressIcon,
  Settings as SettingsIcon,
  HighQuality as QualityIcon,
  Computer as ScreenIcon,
  Delete as DeleteIcon,
  Description as FileIcon,
  CloudUpload as UploadIcon,
} from '@mui/icons-material';
import Layout from '@/components/Layout';
import ToolHero from '@/components/ToolHero';
import SeoSection from '@/components/SeoSection';
import Footer from '@/components/Footer';
import { getRoute } from '@/seo/manifest';
import useDocumentMeta from '@/seo/useDocumentMeta';
import ProgressBar from '@/components/ProgressBar';
import DownloadButton from '@/components/DownloadButton';
import { WorkerCommunicator, TaskIdGenerator } from '@/workers/shared/message-router';
import { ProgressUpdate, ProcessedFile } from '@/workers/shared/progress-protocol';
import { ErrorHandler } from '@/lib/error-handler';
import { useDebugConsole } from '@/hooks/useDebugConsole';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface CompressionOptions {
  /**
   * Only the two rasterising presets remain. 'printer' and 'prepress' were
   * removed after the benchmark showed they returned the input unchanged in
   * 0.0s on every fixture in the corpus.
   */
  quality: 'screen' | 'ebook';
  colorSpace?: 'RGB' | 'CMYK' | 'Gray';
  imageQuality?: number;
  removeMetadata?: boolean;
  optimizeImages?: boolean;
}

// ... imports

interface CompressionState {
  files: File[];
  options: CompressionOptions;
  isProcessing: boolean;
  progress: ProgressUpdate | null;
  results: ProcessedFile[];
  error: string | null;
  debugLogs: string[];
}

const stripCompressedSuffix = (name: string) => name.replace(/_compressed(?=\.[^.]+$)/, '');

/**
 * Refuses to hand back a file that got bigger.
 *
 * Compression here works by rasterising each page, which is a large win on a
 * scan and a disaster on a PDF that was already vector text - measured at
 * 110x on a twenty-page Word export. Returning that from a button labelled
 * "Compress" is indefensible, so when the result is not actually smaller the
 * original is returned untouched and the UI says what happened.
 */
const keepSmallerResult = async (
  produced: ProcessedFile,
  sources: File[]
): Promise<ProcessedFile> => {
  const source = sources.find(file => file.name === stripCompressedSuffix(produced.name));
  if (!source || produced.size < source.size) return produced;

  return {
    ...produced,
    name: source.name,
    data: new Uint8Array(await source.arrayBuffer()),
    size: source.size,
    originalSize: source.size,
    compressionRatio: 1,
    metadata: { ...produced.metadata, unchanged: true, attemptedSize: produced.size },
  };
};

const Compress: React.FC = () => {
  const theme = useTheme();
  const route = getRoute('/compress')!;
  useDocumentMeta({
    title: route.title,
    description: route.description,
    path: route.path,
    locale: route.locale,
  });
  const [isDebugVisible] = useDebugConsole();
  const [state, setState] = useState<CompressionState>({
    files: [],
    options: {
      quality: 'ebook',
      removeMetadata: true,
      optimizeImages: true,
    },
    isProcessing: false,
    progress: null,
    results: [],
    error: null,
    debugLogs: [],
  });

  // The worker's completion callback is created once and lives outside the
  // render cycle, so it cannot read state.files. A ref keeps the originals
  // reachable for the size guard.
  const inputFilesRef = useRef<File[]>([]);
  useEffect(() => {
    inputFilesRef.current = state.files;
  }, [state.files]);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    setState(prev => ({
      ...prev,
      debugLogs: [...prev.debugLogs, `[${timestamp}] ${message}`]
    }));
  }, []);

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
      const produced = (message.payload as { files: ProcessedFile[] }).files;

      // The size guard has to read the original bytes, which is async, so the
      // state update waits for it rather than happening inline.
      void Promise.all(produced.map(file => keepSmallerResult(file, inputFilesRef.current)))
        .then(results => {
          const kept = results.filter(file => file.metadata?.unchanged).length;
          setState(prev => ({
            ...prev,
            isProcessing: false,
            progress: null,
            results,
            debugLogs: [
              ...prev.debugLogs,
              `[${new Date().toISOString().split('T')[1].slice(0, -1)}] Complete: Processed ${results.length} file(s)` +
                (kept > 0 ? ` (${kept} already optimal, left unchanged)` : '')
            ]
          }));
        });
    },
    onError: (message) => {
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

  useEffect(() => {
    let isMounted = true;

    const initWorker = async () => {
      if (isMounted) addLog('Initializing Compress worker...');
      try {
        await workerCommunicator.initializeWorker(() => {
          const worker = new Worker(new URL('../workers/compress-worker.ts', import.meta.url), { type: 'module' });
          if (isMounted) addLog('Worker script resolved via Vite bundler');
          return worker;
        });

        if (isMounted) addLog('Worker initialized successfully');
      } catch (error) {
        if (!isMounted) return;
        console.error('Failed to initialize compress worker:', error);
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
  }, [workerCommunicator, addLog]);

  const handleFilesSelected = useCallback((files: File[]) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    setState(prev => ({
      ...prev,
      files,
      error: null,
      debugLogs: [...prev.debugLogs, `[${timestamp}] Selected ${files.length} file(s): ${files.map(f => f.name).join(', ')}`]
    }));
  }, []);

  const handleOptionsChange = useCallback((newOptions: Partial<CompressionOptions>) => {
    setState(prev => ({
      ...prev,
      options: { ...prev.options, ...newOptions }
    }));
  }, []);

  const handleCompress = useCallback(async () => {
    if (state.files.length === 0 || state.isProcessing) return;

    addLog(`Starting compression for ${state.files.length} file(s)`);
    addLog(`Options: ${JSON.stringify(state.options)}`);

    setState(prev => ({
      ...prev,
      isProcessing: true,
      progress: null,
      results: [],
      error: null
    }));

    const taskId = TaskIdGenerator.generateForTool('compress');
    addLog(`Created Task ID: ${taskId}`);

    try {
      // Rasterisation runs on the main thread so that pages render with the
      // system fonts the DOM has, rather than whatever a worker can resolve.
      {
        addLog('Using Main Thread Rendering Strategy (High Compatibility)');

        for (let i = 0; i < state.files.length; i++) {
          const file = state.files[i];
          const assemblyId = `${taskId}_${i}`;

          // 1. Initialize Assembly in Worker
          workerCommunicator.sendMessage({
            type: 'start_assembly',
            taskId,
            payload: { assemblyId },
            timestamp: Date.now()
          });

          // 2. Load PDF
          addLog(`Loading PDF: ${file.name}`);
          const arrayBuffer = await file.arrayBuffer();
          const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(arrayBuffer),
            cMapUrl: `https://unpkg.com/pdfjs-dist@5.4.449/cmaps/`,
            cMapPacked: true,
          });
          const pdfDoc = await loadingTask.promise;

          const scale = state.options.quality === 'screen' ? 1.0 : 1.5;
          const quality = state.options.quality === 'screen' ? 0.6 : 0.8;

          // 3. Render Pages
          for (let p = 1; p <= pdfDoc.numPages; p++) {
            const fileProgress = p / pdfDoc.numPages;
            const totalProgress = ((i + fileProgress) / state.files.length) * 100;
            const progressMsg = `Rendering page ${p}/${pdfDoc.numPages}...`;

            // Update Progress Manually
            setState(prev => ({
              ...prev,
              progress: {
                taskId,
                current: i + 1,
                total: state.files.length,
                stage: 'Processing',
                message: progressMsg,
                percentage: Math.round(totalProgress)
              }
            }));

            // Add to debug log periodically (every 5 pages or first/last) to avoid spam, or just all?
            // User complained about NO logs. Let's log all for now or every 5.
            if (p === 1 || p % 5 === 0 || p === pdfDoc.numPages) {
              addLog(`[Progress ${Math.round(totalProgress)}%] ${progressMsg}`);
            }

            const page = await pdfDoc.getPage(p);
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const context = canvas.getContext('2d');

            if (!context) throw new Error('Canvas Context Failed');

            await page.render({ canvasContext: context, viewport, canvas }).promise;

            // Convert to blob/bytes
            const blob = await new Promise<Blob | null>(resolve =>
              canvas.toBlob(resolve, 'image/jpeg', quality)
            );

            if (!blob) throw new Error('Image encoding failed');
            const arrayBuf = await blob.arrayBuffer();

            // 4. Send Page to Worker
            workerCommunicator.sendMessage({
              type: 'add_page_image',
              taskId,
              payload: {
                assemblyId,
                imageData: new Uint8Array(arrayBuf),
                width: viewport.width / scale, // PDF units
                height: viewport.height / scale
              },
              timestamp: Date.now()
            });

            // Allow UI to breathe
            await new Promise(r => setTimeout(r, 0));
          }

          // 5. Finish Assembly
          workerCommunicator.sendMessage({
            type: 'finish_assembly',
            taskId,
            payload: {
              assemblyId,
              originalFileName: file.name,
              options: state.options
            },
            timestamp: Date.now()
          });
        }
      }

    } catch (error) {
      console.error('Compression failed:', error);
      addLog(`Error: ${error}`);
      setState(prev => ({ ...prev, isProcessing: false, error: String(error) }));
    }
  }, [state.files, state.isProcessing, state.options, workerCommunicator, addLog]);

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
      files: [],
      results: [],
      error: null,
      progress: null
    }));
  }, []);

  // ... removeFile, formatFileSize, getQualityDescription ...

  // (Keeping existing formatFileSize and getQualityDescription as they are fine/unchanged logic-wise, 
  // but I must ensure the replacement block covers up to handleCompress correctly)

  // WAIT, I need to output the REST of the component so the 'return' statement is included
  // or at least up to where the JSX structure is same.
  // The tool replaces a block. I will replace from `interface CompressionState` down to `handleCompress` end?
  // No, `handleCompress` is quite far down.
  // I will replace `interface CompressionState` through `useEffect`.
  // Then I will make a separate edit for `handleCompress` and `return`. 
  // Actually, I can replace the whole logic section if I'm careful.

  // Let's do it in chunks to be safe.
  // Chunk 1: Interfaces + State + Worker Init + Handlers

  // To avoid `replace_file_content` complexity with large chunks, I'll do:
  // 1. Types and State initialization.
  // 2. Worker logic.
  // 3. Render.

  // Actually, I'll try to replace from line 56 (Interface) to line 178 (handleCancel).
  const removeFile = useCallback((index: number) => {
    setState(prev => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index)
    }));
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getQualityDescription = (quality: string) => {
    switch (quality) {
      case 'screen': return 'Smallest file size, suitable for screen viewing (72 DPI)';
      case 'ebook': return 'Balanced compression for digital reading (150 DPI)';
      default: return '';
    }
  };

  return (
    <>
    <Layout title="Compress PDF" showBackButton>
      <Box sx={{ maxWidth: 800, mx: 'auto' }}>
        {/* ... Header, Error, FileUpload, FileList ... (Keep existing JSX logic) */}

        {/* Header */}
        <ToolHero route={route} icon={<CompressIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />} />

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
                  backgroundColor: alpha(theme.palette.primary.main, 0.02),
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.05),
                    borderColor: 'primary.main',
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
                <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Drop PDF files here or click to select
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Support for multiple files • Maximum 10 files • Up to 500MB per file
                </Typography>
              </Box>

              {/* File List */}
              {state.files.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Selected Files ({state.files.length})
                  </Typography>
                  <List>
                    {state.files.map((file, index) => (
                      <ListItem key={index} divider>
                        <ListItemIcon>
                          <FileIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary={file.name}
                          secondary={formatFileSize(file.size)}
                        />
                        <ListItemSecondaryAction>
                          <IconButton edge="end" onClick={() => removeFile(index)}>
                            <DeleteIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </CardContent>
          </Card>
        )}

        {/* Compression Options */}
        {state.files.length > 0 && !state.isProcessing && state.results.length === 0 && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <SettingsIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Compression Settings</Typography>
              </Box>

              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Quality Level</InputLabel>
                    <Select
                      value={state.options.quality}
                      label="Quality Level"
                      onChange={(e) => handleOptionsChange({ quality: e.target.value as any })}
                    >
                      <MenuItem value="screen">
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <ScreenIcon sx={{ mr: 1 }} />
                          Screen Quality
                        </Box>
                      </MenuItem>
                      <MenuItem value="ebook">
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <QualityIcon sx={{ mr: 1 }} />
                          E-book Quality
                        </Box>
                      </MenuItem>
                      {/* "Printer" and "Prepress" used to sit here. Measured
                          against the benchmark corpus they returned the input
                          byte-for-byte in 0.0s on every fixture - they routed
                          to a worker path that does no compression at all.
                          Offering a preset that does nothing is worse than
                          offering fewer presets. */}
                    </Select>
                  </FormControl>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    {getQualityDescription(state.options.quality)}
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    size="large"
                    fullWidth
                    startIcon={<CompressIcon />}
                    onClick={handleCompress}
                    disabled={state.files.length === 0}
                  >
                    Compress {state.files.length} File{state.files.length !== 1 ? 's' : ''}
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
            variant="default"
          />
        )}

        {/* Results */}
        {state.results.length > 0 && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h6">
                  Compression Complete
                </Typography>
                <Button variant="outlined" onClick={handleReset}>
                  Compress More Files
                </Button>
              </Box>

              {state.results.some(result => result.metadata?.unchanged) && (
                <Alert severity="info" sx={{ mb: 3 }}>
                  Some of these were already as small as this tool can make them, so you are getting
                  the original file back rather than a larger one. That is normal for PDFs exported
                  from a word processor: there are no scanned images to re-encode, and the text is
                  already compressed.
                </Alert>
              )}

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
                            {result.originalSize && (
                              <Chip
                                label={`${Math.round((1 - result.size / result.originalSize) * 100)}% smaller`}
                                size="small"
                                color="success"
                                sx={{ ml: 1 }}
                              />
                            )}
                          </Typography>
                        </>
                      }
                    />
                    <ListItemSecondaryAction>
                      <DownloadButton
                        files={[result]}
                        variant="primary"
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
        <SeoSection route={route} />
      </Box>
    </Layout>
    <Footer />
    </>
  );
};

export default Compress;
