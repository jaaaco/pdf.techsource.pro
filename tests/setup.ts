/**
 * Test Setup - Global test configuration and mocks
 */

import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock Web APIs that aren't available in jsdom
global.URL.createObjectURL = vi.fn(() => 'mock-blob-url');
global.URL.revokeObjectURL = vi.fn();

// Mock Worker constructor
global.Worker = vi.fn(() => ({
  postMessage: vi.fn(),
  terminate: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
})) as any;

// Mock WebAssembly
global.WebAssembly = {
  instantiate: vi.fn(),
  compile: vi.fn(),
  Module: vi.fn(),
  Instance: vi.fn(),
  Memory: vi.fn(),
  Table: vi.fn(),
  CompileError: Error,
  RuntimeError: Error,
  LinkError: Error,
} as any;

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  warn: vi.fn(),
  error: vi.fn(),
  log: vi.fn(),
};

// Mock performance API
global.performance = {
  ...performance,
  now: vi.fn(() => Date.now()),
};

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16));
global.cancelAnimationFrame = vi.fn();

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as any;

// Mock ResizeObserver
global.ResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as any;

// Mock File and FileReader
global.FileReader = class MockFileReader {
  result: string | ArrayBuffer | null = null;
  error: any = null;
  readyState: number = 0;
  
  onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
  onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
  onprogress: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;

  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn();

  readAsArrayBuffer(file: Blob) {
    setTimeout(() => {
      this.result = new ArrayBuffer(8);
      this.readyState = 2;
      if (this.onload) {
        this.onload({} as ProgressEvent<FileReader>);
      }
    }, 0);
  }

  readAsText(file: Blob) {
    setTimeout(() => {
      this.result = 'mock file content';
      this.readyState = 2;
      if (this.onload) {
        this.onload({} as ProgressEvent<FileReader>);
      }
    }, 0);
  }

  readAsDataURL(file: Blob) {
    setTimeout(() => {
      this.result = 'data:application/pdf;base64,mock-data';
      this.readyState = 2;
      if (this.onload) {
        this.onload({} as ProgressEvent<FileReader>);
      }
    }, 0);
  }

  abort() {
    this.readyState = 2;
  }
} as any;

// Mock Blob constructor
global.Blob = class MockBlob {
  size: number;
  type: string;
  
  constructor(parts: any[] = [], options: BlobPropertyBag = {}) {
    this.size = parts.reduce((size, part) => size + (part?.length || 0), 0);
    this.type = options.type || '';
  }

  slice(start?: number, end?: number, contentType?: string) {
    return new MockBlob([], { type: contentType });
  }

  stream() {
    return new ReadableStream();
  }

  text() {
    return Promise.resolve('mock blob text');
  }

  arrayBuffer() {
    return Promise.resolve(new ArrayBuffer(this.size));
  }
} as any;

// Suppress specific warnings in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render is no longer supported') ||
       args[0].includes('Warning: React.createFactory() is deprecated'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});