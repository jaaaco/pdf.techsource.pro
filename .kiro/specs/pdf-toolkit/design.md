# PDF Toolkit Design Document

## Overview

The PDF Toolkit is a client-side web application that provides privacy-first PDF processing capabilities through WebAssembly-powered tools. The system uses a modular architecture where each tool (compress, merge, split, OCR) operates independently within Web Workers, ensuring non-blocking UI operations and complete data privacy.

The application follows a hub-and-spoke model with a central dashboard routing to specialized tool pages, each leveraging shared infrastructure for file handling, progress reporting, and WASM engine management.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Static Host (Netlify/CF)                 │
├─────────────────────────────────────────────────────────────┤
│  Dashboard (/)     │  Tools (/compress, /merge, /split, /ocr) │
├─────────────────────────────────────────────────────────────┤
│                    Shared UI Components                     │
├─────────────────────────────────────────────────────────────┤
│     Tool Workers    │    Progress Protocol    │   File API   │
├─────────────────────────────────────────────────────────────┤
│  WASM Engines: Ghostscript, Tesseract, PDF-lib             │
├─────────────────────────────────────────────────────────────┤
│              Emscripten MEMFS (Virtual Filesystem)          │
└─────────────────────────────────────────────────────────────┘
```

### Repository Structure

```
pdf-toolkit/
├── src/
│   ├── components/           # Shared React components
│   │   ├── FileDropzone.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── ToolLayout.tsx
│   │   └── DownloadButton.tsx
│   ├── workers/             # Web Worker implementations
│   │   ├── compress-worker.ts
│   │   ├── merge-worker.ts
│   │   ├── split-worker.ts
│   │   ├── ocr-worker.ts
│   │   └── shared/
│   │       ├── progress-protocol.ts
│   │       ├── wasm-loader.ts
│   │       └── memory-manager.ts
│   ├── pages/               # Route components
│   │   ├── Dashboard.tsx
│   │   ├── Compress.tsx
│   │   ├── Merge.tsx
│   │   ├── Split.tsx
│   │   └── OCR.tsx
│   ├── lib/                 # Shared utilities
│   │   ├── file-utils.ts
│   │   ├── pdf-validator.ts
│   │   └── error-handler.ts
│   └── wasm/               # WASM binaries and bindings
│       ├── ghostscript/
│       ├── tesseract/
│       └── pdf-lib/
├── public/
│   ├── wasm-files/         # WASM binary assets
│   └── tesseract-data/     # OCR language data
├── docs/
│   ├── LICENSES.md
│   ├── ATTRIBUTION.md
│   └── ARCHITECTURE.md
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

## Components and Interfaces

### Core Interfaces

```typescript
interface ToolWorkerMessage {
  type: 'progress' | 'complete' | 'error' | 'init';
  payload: ProgressUpdate | ProcessingResult | ErrorInfo | InitConfig;
  taskId: string;
}

interface ProgressUpdate {
  current: number;
  total: number;
  stage: string;
  message?: string;
}

interface ProcessingResult {
  files: ProcessedFile[];
  metadata: ProcessingMetadata;
}

interface ProcessedFile {
  name: string;
  data: Uint8Array;
  size: number;
  mimeType: string;
}
```

### Worker Architecture

Each tool worker follows a standardized pattern:

```typescript
// Base Worker Class
abstract class PDFToolWorker {
  protected wasmModule: any;
  protected memfs: EmscriptenFS;
  
  abstract initialize(): Promise<void>;
  abstract process(files: File[], options: any): Promise<ProcessingResult>;
  
  protected reportProgress(update: ProgressUpdate): void {
    self.postMessage({
      type: 'progress',
      payload: update,
      taskId: this.currentTaskId
    });
  }
}
```

### Memory Management

```typescript
class MemoryManager {
  private allocatedMemory: Map<string, number> = new Map();
  private readonly MAX_MEMORY = 1024 * 1024 * 1024; // 1GB limit
  
  allocate(size: number, id: string): boolean {
    const total = this.getTotalAllocated() + size;
    if (total > this.MAX_MEMORY) {
      throw new MemoryError(`Allocation would exceed limit: ${total}MB`);
    }
    this.allocatedMemory.set(id, size);
    return true;
  }
  
  deallocate(id: string): void {
    this.allocatedMemory.delete(id);
  }
}
```

## Data Models

### File Processing Pipeline

```typescript
interface FileProcessingPipeline {
  input: FileInput[];
  stages: ProcessingStage[];
  output: FileOutput[];
  metadata: PipelineMetadata;
}

interface FileInput {
  file: File;
  id: string;
  validation: ValidationResult;
}

interface ProcessingStage {
  name: string;
  estimatedDuration: number;
  memoryRequirement: number;
  dependencies: string[];
}

interface FileOutput {
  originalId: string;
  processedData: Uint8Array;
  filename: string;
  compressionRatio?: number;
  processingTime: number;
}
```

### Tool-Specific Models

```typescript
// Compression Tool
interface CompressionOptions {
  preset: 'screen' | 'ebook' | 'printer' | 'prepress';
  customDPI?: number;
  colorSpace?: 'RGB' | 'CMYK' | 'Gray';
  imageQuality?: number; // 1-100
}

// Merge Tool
interface MergeOptions {
  fileOrder: string[]; // Array of file IDs in desired order
  bookmarks: boolean;
  metadata: PDFMetadata;
}

// Split Tool
interface SplitOptions {
  ranges: PageRange[];
  outputNaming: 'sequential' | 'range-based' | 'custom';
}

interface PageRange {
  start: number;
  end: number;
  outputName?: string;
}

// OCR Tool
interface OCROptions {
  languages: string[]; // ISO language codes
  outputFormat: 'searchable-pdf' | 'pdf-text-overlay';
  confidence: number; // Minimum confidence threshold
  preprocessing: {
    deskew: boolean;
    denoise: boolean;
    enhance: boolean;
  };
}
```
#
# Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, several properties can be consolidated to eliminate redundancy:

- Progress reporting properties (2.1, 2.2, 3.4, 4.3, 6.3) can be unified into a single comprehensive progress property
- File processing properties (1.1, 1.2, 1.3) can be combined into a privacy-preserving processing property
- Memory management properties (10.1, 10.3, 10.4) can be consolidated into a comprehensive memory safety property

### Core Properties

**Property 1: Privacy-preserving processing**
*For any* PDF file uploaded to the toolkit, all processing operations should occur entirely within the browser using in-memory virtual filesystem, with results provided via Blob APIs and no network transmission of file data
**Validates: Requirements 1.1, 1.2, 1.3**

**Property 2: Offline functionality**
*For any* PDF processing operation, the toolkit should function normally even when network connectivity is unavailable
**Validates: Requirements 1.5**

**Property 3: Real-time progress reporting**
*For any* long-running PDF operation, progress updates should be based on actual processing steps (pages, files, OCR operations) and communicated via the standardized Progress_Protocol
**Validates: Requirements 2.1, 2.2, 2.3, 3.4, 4.3, 6.3**

**Property 4: Error handling with context**
*For any* processing error that occurs, the system should provide specific error messages with contextual information about the failure
**Validates: Requirements 2.4**

**Property 5: Cancellation capability**
*For any* long-running operation, the system should provide functional cancel capability that properly terminates processing and cleans up resources
**Validates: Requirements 2.5**

**Property 6: WASM engine usage**
*For any* compression operation, the system should use Ghostscript WASM engine, and for any OCR operation, the system should use Tesseract WASM engine
**Validates: Requirements 3.2, 6.2**

**Property 7: Memory overflow prevention**
*For any* large PDF file processing, the system should handle the operation without memory overflow by implementing appropriate memory management strategies
**Validates: Requirements 3.3**

**Property 8: File size reporting**
*For any* compression operation, the system should display both original and compressed file sizes upon completion
**Validates: Requirements 3.5**

**Property 9: File order preservation**
*For any* merge operation, the output PDF should contain pages in exactly the same order as specified by the user
**Validates: Requirements 4.2, 4.4**

**Property 10: Page dimension preservation**
*For any* merge operation involving files with different page sizes, the output should preserve the original dimensions of each page
**Validates: Requirements 4.5**

**Property 11: Page count accuracy**
*For any* PDF file uploaded for splitting, the system should display the correct total page count
**Validates: Requirements 5.1**

**Property 12: Page range validation**
*For any* split operation, the system should validate that specified page ranges are within the document bounds and provide appropriate error messages for invalid ranges
**Validates: Requirements 5.2**

**Property 13: Range format support**
*For any* split operation, the system should correctly parse and handle both individual pages and page ranges in various formats (e.g., "1-5, 8, 10-12")
**Validates: Requirements 5.3**

**Property 14: Split output correctness**
*For any* split operation, the system should create exactly the number of output files corresponding to the specified ranges, with each file containing the correct pages
**Validates: Requirements 5.4, 5.5**

**Property 15: Searchable PDF output**
*For any* OCR operation, the output should be a valid PDF with an embedded searchable text layer
**Validates: Requirements 6.4**

**Property 16: Low-confidence text inclusion**
*For any* OCR operation where text recognition confidence is below threshold, the recognized text should still be included in the output with appropriate confidence indicators
**Validates: Requirements 6.5**

**Property 17: Protocol compliance**
*For any* worker communication, messages should conform to the standardized Progress_Protocol format
**Validates: Requirements 7.3**

**Property 18: File type validation**
*For any* file upload, the system should validate file types and display appropriate error messages when non-PDF files are uploaded
**Validates: Requirements 8.2**

**Property 19: Progress UI display**
*For any* running operation, the system should display visible progress bars and status messages
**Validates: Requirements 8.4**

**Property 20: Download availability**
*For any* completed processing operation, the system should provide accessible download functionality for all result files
**Validates: Requirements 8.5**

**Property 21: Memory management**
*For any* PDF processing operation, the system should implement streaming processing for large files, clean up temporary allocations upon completion, and prevent concurrent operations that could exceed memory limits
**Validates: Requirements 10.1, 10.3, 10.4**

**Property 22: Memory limit warnings**
*For any* operation approaching browser memory limits, the system should provide warnings and alternative processing options
**Validates: Requirements 10.2**

**Property 23: Memory allocation error handling**
*For any* memory allocation failure, the system should provide clear error messages with suggested solutions
**Validates: Requirements 10.5**

## Error Handling

### Error Categories

1. **File Validation Errors**
   - Invalid file format (non-PDF)
   - Corrupted PDF files
   - Password-protected PDFs
   - Unsupported PDF versions

2. **Processing Errors**
   - WASM module loading failures
   - Memory allocation failures
   - Processing timeouts
   - Invalid processing parameters

3. **System Errors**
   - Browser compatibility issues
   - Insufficient memory
   - Web Worker initialization failures
   - WASM compilation errors

### Error Recovery Strategies

```typescript
class ErrorHandler {
  static handleProcessingError(error: ProcessingError): ErrorResponse {
    switch (error.type) {
      case 'MEMORY_LIMIT':
        return {
          message: 'File too large for available memory',
          suggestions: ['Try splitting the file first', 'Close other browser tabs'],
          recoverable: true
        };
      case 'WASM_LOAD_FAILED':
        return {
          message: 'Processing engine failed to load',
          suggestions: ['Refresh the page', 'Check browser compatibility'],
          recoverable: true
        };
      case 'INVALID_PDF':
        return {
          message: 'Invalid or corrupted PDF file',
          suggestions: ['Try a different file', 'Check file integrity'],
          recoverable: false
        };
    }
  }
}
```

## Testing Strategy

### Dual Testing Approach

The PDF Toolkit requires both unit testing and property-based testing to ensure comprehensive coverage:

- **Unit tests** verify specific examples, edge cases, and error conditions
- **Property tests** verify universal properties that should hold across all inputs
- Together they provide comprehensive coverage: unit tests catch concrete bugs, property tests verify general correctness

### Unit Testing Requirements

Unit tests will cover:
- Specific file processing examples with known inputs and outputs
- Error condition handling with invalid inputs
- UI component behavior with mock data
- Integration points between components
- WASM module loading and initialization

### Property-Based Testing Requirements

The system will use **fast-check** as the property-based testing library for JavaScript/TypeScript. Each property-based test will:
- Run a minimum of 100 iterations to ensure thorough coverage
- Be tagged with comments explicitly referencing the correctness property from this design document
- Use the format: `**Feature: pdf-toolkit, Property {number}: {property_text}**`
- Each correctness property will be implemented by a SINGLE property-based test

Example property test structure:
```typescript
// **Feature: pdf-toolkit, Property 1: Privacy-preserving processing**
test('PDF processing occurs entirely in browser without network calls', () => {
  fc.assert(fc.property(
    fc.uint8Array({ minLength: 1000, maxLength: 10000 }), // PDF-like data
    (pdfData) => {
      const networkCalls = [];
      const originalFetch = global.fetch;
      global.fetch = (...args) => {
        networkCalls.push(args);
        return originalFetch(...args);
      };
      
      // Process PDF
      const result = processPDF(pdfData);
      
      // Restore fetch
      global.fetch = originalFetch;
      
      // Assert no network calls were made
      expect(networkCalls).toHaveLength(0);
      expect(result).toBeDefined();
    }
  ), { numRuns: 100 });
});
```

### Test Data Generation

Property tests will use intelligent generators that:
- Generate valid PDF-like binary data for file processing tests
- Create realistic page ranges for split operations
- Generate various file size combinations for merge operations
- Simulate different memory pressure scenarios
- Create edge cases like empty files, single-page documents, and maximum-size files

### Performance Testing

While not part of the core property testing, the system will include:
- Memory usage monitoring during large file processing
- Processing time benchmarks for different file sizes
- Browser compatibility testing across major browsers
- Mobile device performance validation