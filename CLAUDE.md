# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PDF Toolkit is a privacy-first, client-side web application for PDF processing (compress, merge, split, OCR). All processing happens entirely in the browser using WebAssembly engines, with no server-side processing or file uploads.

## Development Commands

### Running the Application
```bash
npm run dev              # Start development server (Vite)
npm run build            # Production build (TypeScript + Vite)
npm run preview          # Preview production build locally
npm run type-check       # Run TypeScript type checking
```

### Testing
```bash
npm test                 # Run all tests once
npm run test:watch       # Run tests in watch mode
npm run test:ui          # Open Vitest UI
npm run test:coverage    # Run tests with coverage report
```

### Linting and Quality
```bash
npm run lint             # Run ESLint
npm run lint:fix         # Auto-fix ESLint issues
```

### Other Commands
```bash
npm run clean            # Clean build artifacts
npm run build:analyze    # Build with bundle size analysis
```

## Architecture

### High-Level Structure

The application follows a **hub-and-spoke architecture**:
- Central dashboard (`/`) routes to specialized tool pages
- Each tool (compress, merge, split, OCR) operates independently in Web Workers
- Shared infrastructure for file handling, progress reporting, and WASM management

### Key Architectural Patterns

1. **Web Worker Pattern**: Each PDF processing tool runs in a dedicated Web Worker to prevent blocking the UI. Workers communicate via the standardized Progress Protocol defined in `src/workers/shared/progress-protocol.ts`.

2. **Memory Management**: The `MemoryManager` class (`src/workers/shared/memory-manager.ts`) tracks allocations, enforces limits (default 1GB), and provides warnings at different thresholds (60%, 75%, 85%, 95%).

3. **Progress Protocol**: All worker-UI communication follows a standardized message format:
   - Message types: `progress`, `complete`, `error`, `init`, `cancel`
   - Messages include: `type`, `payload`, `taskId`, `timestamp`
   - See `src/workers/shared/progress-protocol.ts` for interfaces

4. **Error Handling**: Centralized error categorization and recovery strategies in `src/lib/error-handler.ts`:
   - Error types: `MEMORY_LIMIT`, `FILE_ERROR`, `WASM_ERROR`, `WORKER_ERROR`, etc.
   - Each error type has specific recovery strategies and user-friendly messages
   - Auto-retry logic for transient errors

### Directory Structure

```
src/
├── components/          # Shared React components (FileDropzone, ProgressBar, etc.)
├── workers/            # Web Worker implementations
│   ├── compress-worker.ts
│   ├── merge-worker.ts
│   ├── split-worker.ts
│   ├── ocr-worker.ts
│   └── shared/         # Shared worker infrastructure
│       ├── progress-protocol.ts    # Message format definitions
│       ├── memory-manager.ts       # Memory allocation tracking
│       ├── wasm-loader.ts          # WASM module loading
│       └── memfs-manager.ts        # Virtual filesystem manager
├── pages/              # Route components (Dashboard, Compress, Merge, Split, OCR)
├── lib/                # Shared utilities
│   ├── file-utils.ts
│   ├── pdf-validator.ts
│   └── error-handler.ts
└── wasm/               # WASM binaries and configuration
    ├── ghostscript/    # For compression
    └── tesseract/      # For OCR
```

### Path Aliases

The project uses TypeScript path aliases configured in `vite.config.ts`:
- `@/` → `./src/`
- `@/components` → `./src/components`
- `@/workers` → `./src/workers`
- `@/lib` → `./src/lib`
- `@/pages` → `./src/pages`

Always use these aliases instead of relative imports.

## Testing Strategy

### Dual Testing Approach

The codebase uses **both unit tests and property-based tests** (using fast-check):

1. **Unit Tests**: Located in `tests/` directory
   - Integration tests: `tests/integration/` (e.g., `merge.test.ts`)
   - E2E tests: `tests/e2e/`
   - Focus on specific examples, edge cases, and error conditions

2. **Property-Based Tests**: Required for correctness properties
   - Use fast-check library
   - Minimum 100 iterations per test
   - Tag format: `**Feature: pdf-toolkit, Property {number}: {property_text}**`
   - Properties defined in `.kiro/specs/pdf-toolkit/design.md`

### Testing Workers

Workers are mocked in tests using Vitest's `vi.fn()`:
```typescript
const mockWorker = {
  postMessage: vi.fn(),
  terminate: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};
global.Worker = vi.fn(() => mockWorker) as any;
```

### Running Specific Tests

```bash
npm test -- merge.test.ts          # Run specific test file
npm run test:watch -- --ui          # Watch mode with UI
```

## Key Constraints and Requirements

### Privacy-First
- **No network calls during processing**: All PDF operations must happen client-side
- Use in-memory Virtual Filesystem (MEMFS) for file operations
- No data should persist after browser close

### Offline Functionality
- Application must work completely offline
- Offline indicator shown in UI (see `App.tsx` - `OfflineBanner` component)

### Memory Management
- Default memory limit: 1GB
- Track all allocations by type: `file`, `processing`, `wasm`, `temporary`
- Clean up temporary allocations after processing
- Prevent concurrent operations that would exceed memory limits
- Memory estimation factors per tool:
  - Compress: 3.0x file size
  - Merge: 2.5x file size
  - Split: 2.0x file size
  - OCR: 4.0x file size

### Progress Reporting
- All long-running operations must report progress via Progress Protocol
- Progress based on actual processing steps (pages, files, OCR operations)
- Update percentage in real-time

### WASM Engines
- Ghostscript WASM for compression (AGPL license)
- Tesseract WASM for OCR (Apache license)
- pdf-lib for merge/split operations

## Build Configuration

### Vite Configuration (`vite.config.ts`)

Key settings:
- **Code splitting**: Manual chunks for `pdf-lib`, `react-vendor`, and workers
- **WASM handling**: Assets go to `wasm/[name]-[hash]` directory
- **Worker format**: ES modules
- **Headers**: COOP/COEP/CORP headers for SharedArrayBuffer support
- **Base path**: `./` for static hosting compatibility

### Cross-Origin Headers

Required for WASM and SharedArrayBuffer:
```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: cross-origin
```

These are configured in:
- `vite.config.ts` (dev/preview servers)
- `_headers` file (Netlify)
- `netlify.toml` (Netlify configuration)

## Common Patterns

### Creating a New Tool Page

1. Create page component in `src/pages/`
2. Create worker in `src/workers/`
3. Use `progress-protocol.ts` for messaging
4. Track memory with `MemoryManager`
5. Handle errors with `ErrorHandler`
6. Add route to `App.tsx`
7. Add manual chunk to `vite.config.ts`

### Worker Communication Pattern

```typescript
// In worker
import { MessageFactory } from '@/workers/shared/progress-protocol';

// Report progress
self.postMessage(
  MessageFactory.createProgressMessage(taskId, current, total, stage, message)
);

// Report completion
self.postMessage(
  MessageFactory.createCompleteMessage(taskId, files, metadata)
);

// Report error
self.postMessage(
  MessageFactory.createErrorMessage(taskId, errorType, message, suggestions, recoverable)
);
```

### Memory Management Pattern

```typescript
import { MemoryManager } from '@/workers/shared/memory-manager';

const memoryManager = new MemoryManager(1024); // 1GB limit

// Before processing
const estimatedMemory = memoryManager.estimateProcessingMemory(fileSize, 'compress');
if (!memoryManager.canAllocate(estimatedMemory)) {
  throw new Error('Insufficient memory');
}

// Allocate
memoryManager.allocate(fileSize, `file_${id}`, 'file', fileName);

// After processing
memoryManager.deallocate(`file_${id}`);
memoryManager.cleanupTemporary();
```

### Error Handling Pattern

```typescript
import { ErrorHandler } from '@/lib/error-handler';

try {
  // Processing logic
} catch (error) {
  const processedError = ErrorHandler.processError(error, {
    tool: 'compress',
    operation: 'compression',
    fileSize: file.size,
    fileName: file.name
  });

  ErrorHandler.logError(processedError);

  // Check for auto-retry
  if (ErrorHandler.shouldAutoRetry(processedError)) {
    const delay = ErrorHandler.getRetryDelay(processedError);
    // Implement retry logic
  }
}
```

## Important Notes

### License Compliance
- Ghostscript WASM: AGPL license (see `LICENSE.md`)
- Tesseract WASM: Apache license
- Attribution required: see `ATTRIBUTION.md` and `/attribution` route

### Material-UI Theme
- Custom theme defined in `src/theme/index.ts`
- Uses Emotion for styling
- CssBaseline applied globally in `App.tsx`

### Deployment
- Static hosting compatible (Netlify, Cloudflare Pages)
- Configuration files: `netlify.toml`, `_headers`, `_redirects`
- Docker support: `Dockerfile`, `docker-compose.yml`, `nginx.conf`

### Browser Compatibility
- Requires WebAssembly support
- Requires Web Workers support
- Requires modern ES modules support
- SharedArrayBuffer requires secure context (HTTPS) and COOP/COEP headers
