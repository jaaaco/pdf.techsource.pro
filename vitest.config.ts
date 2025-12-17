import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
      'src/**/*.test.ts',
      'src/**/*.test.tsx'
    ],
    exclude: [
      'node_modules',
      'dist',
      '.git',
      '.cache'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/workers/**/*.ts', // Workers are harder to test with coverage
        'src/wasm/**/*.ts'     // WASM configs are mostly interfaces
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      }
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 5000
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/components': resolve(__dirname, './src/components'),
      '@/workers': resolve(__dirname, './src/workers'),
      '@/lib': resolve(__dirname, './src/lib'),
      '@/pages': resolve(__dirname, './src/pages'),
    },
  },
})