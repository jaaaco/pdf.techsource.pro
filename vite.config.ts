import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/components': resolve(__dirname, './src/components'),
      '@/workers': resolve(__dirname, './src/workers'),
      '@/lib': resolve(__dirname, './src/lib'),
      '@/pages': resolve(__dirname, './src/pages'),
    },
  },
  worker: {
    format: 'es',
    plugins: () => [react()]
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'pdf-lib': ['pdf-lib'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'workers': [
            './src/workers/compress-worker.ts',
            './src/workers/merge-worker.ts', 
            './src/workers/split-worker.ts',
            './src/workers/ocr-worker.ts'
          ]
        },
        // Optimize chunk naming for caching
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop().replace('.ts', '') : 'chunk';
          return `assets/${facadeModuleId}-[hash].js`;
        },
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/\.(wasm)$/.test(assetInfo.name)) {
            return `wasm/[name]-[hash].${ext}`;
          }
          if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(assetInfo.name)) {
            return `images/[name]-[hash].${ext}`;
          }
          return `assets/[name]-[hash].${ext}`;
        }
      }
    },
    // Optimize for large WASM files
    chunkSizeWarningLimit: 2000,
    assetsInlineLimit: 0 // Don't inline WASM files
  },
  // Optimize for static hosting
  base: './',
  // WASM and Worker support
  optimizeDeps: {
    exclude: ['@/workers/*']
  },
  // Headers for WASM and SharedArrayBuffer
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
    fs: {
      allow: ['..']
    }
  },
  preview: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    }
  },
  test: {
    globals: true,
    environment: 'jsdom'
  }
})