/**
 * WASM Loader - Utilities for loading and managing WebAssembly modules
 * Validates: Requirements 3.2, 6.2
 */

import { ErrorHandler } from '@/lib/error-handler';

export interface WASMModuleConfig {
  wasmPath: string;
  dataPath?: string;
  memoryInitialPages?: number;
  memoryMaximumPages?: number;
  allowMemoryGrowth?: boolean;
  preRun?: (() => void)[];
  postRun?: (() => void)[];
  onRuntimeInitialized?: () => void;
  locateFile?: (path: string, prefix: string) => string;
}

export interface WASMModuleInstance {
  module: any;
  FS: any;
  ready: Promise<void>;
  isReady: boolean;
  cleanup: () => void;
}

export class WASMLoadError extends Error {
  constructor(
    message: string,
    public moduleName: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'WASMLoadError';
  }
}

export class WASMLoader {
  private static loadedModules = new Map<string, WASMModuleInstance>();
  private static loadingPromises = new Map<string, Promise<WASMModuleInstance>>();

  /**
   * Load a WASM module with configuration
   */
  static async loadModule(
    moduleName: string,
    config: WASMModuleConfig
  ): Promise<WASMModuleInstance> {
    // Return cached module if already loaded
    const cached = this.loadedModules.get(moduleName);
    if (cached && cached.isReady) {
      return cached;
    }

    // Return existing loading promise if in progress
    const loadingPromise = this.loadingPromises.get(moduleName);
    if (loadingPromise) {
      return loadingPromise;
    }

    // Start new loading process
    const promise = this.loadModuleInternal(moduleName, config);
    this.loadingPromises.set(moduleName, promise);

    try {
      const instance = await promise;
      this.loadedModules.set(moduleName, instance);
      return instance;
    } catch (error) {
      this.loadingPromises.delete(moduleName);
      throw error;
    } finally {
      this.loadingPromises.delete(moduleName);
    }
  }

  /**
   * Internal module loading implementation
   */
  private static async loadModuleInternal(
    moduleName: string,
    config: WASMModuleConfig
  ): Promise<WASMModuleInstance> {
    try {
      // Check WebAssembly support
      if (!window.WebAssembly) {
        throw new WASMLoadError(
          'WebAssembly is not supported in this browser',
          moduleName
        );
      }

      // Prepare module configuration
      const moduleConfig = {
        locateFile: config.locateFile || ((path: string, prefix: string) => {
          if (path.endsWith('.wasm')) {
            return `/wasm-files/${path}`;
          }
          if (path.endsWith('.data')) {
            return config.dataPath ? `${config.dataPath}/${path}` : `/wasm-files/${path}`;
          }
          return prefix + path;
        }),
        
        // Memory configuration
        INITIAL_MEMORY: (config.memoryInitialPages || 256) * 64 * 1024, // 16MB default
        MAXIMUM_MEMORY: (config.memoryMaximumPages || 2048) * 64 * 1024, // 128MB default
        ALLOW_MEMORY_GROWTH: config.allowMemoryGrowth !== false,

        // Lifecycle hooks
        preRun: config.preRun || [],
        postRun: config.postRun || [],
        onRuntimeInitialized: config.onRuntimeInitialized,

        // Error handling
        onAbort: (what: any) => {
          throw new WASMLoadError(
            `WASM module aborted: ${what}`,
            moduleName
          );
        },

        // Disable automatic script loading for worker environment
        noInitialRun: false,
        noExitRuntime: true
      };

      // Load the WASM module
      let moduleFactory: any;
      
      try {
        // Dynamic import of the WASM module
        const moduleImport = await import(config.wasmPath);
        moduleFactory = moduleImport.default || moduleImport;
      } catch (error) {
        throw new WASMLoadError(
          `Failed to import WASM module from ${config.wasmPath}`,
          moduleName,
          error instanceof Error ? error : new Error(String(error))
        );
      }

      // Initialize the module
      let moduleInstance: any;
      let isReady = false;

      const readyPromise = new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new WASMLoadError(
            `WASM module initialization timeout (30s)`,
            moduleName
          ));
        }, 30000);

        moduleConfig.onRuntimeInitialized = () => {
          clearTimeout(timeoutId);
          isReady = true;
          config.onRuntimeInitialized?.();
          resolve();
        };

        // Handle initialization errors
        const originalOnAbort = moduleConfig.onAbort;
        moduleConfig.onAbort = (what: any) => {
          clearTimeout(timeoutId);
          originalOnAbort(what);
        };
      });

      // Create module instance
      if (typeof moduleFactory === 'function') {
        moduleInstance = await moduleFactory(moduleConfig);
      } else {
        throw new WASMLoadError(
          'Invalid WASM module factory',
          moduleName
        );
      }

      // Wait for initialization
      await readyPromise;

      // Create cleanup function
      const cleanup = () => {
        try {
          // Clean up file system if available
          if (moduleInstance.FS) {
            // Remove temporary files
            try {
              const tempFiles = moduleInstance.FS.readdir('/tmp').filter(
                (name: string) => name !== '.' && name !== '..'
              );
              tempFiles.forEach((file: string) => {
                try {
                  moduleInstance.FS.unlink(`/tmp/${file}`);
                } catch (e) {
                  // Ignore cleanup errors
                }
              });
            } catch (e) {
              // /tmp might not exist
            }
          }

          // Call module cleanup if available
          if (typeof moduleInstance._cleanup === 'function') {
            moduleInstance._cleanup();
          }
        } catch (error) {
          console.warn(`Cleanup error for ${moduleName}:`, error);
        }
      };

      const instance: WASMModuleInstance = {
        module: moduleInstance,
        FS: moduleInstance.FS,
        ready: readyPromise,
        isReady,
        cleanup
      };

      return instance;

    } catch (error) {
      const processedError = ErrorHandler.processError(
        error instanceof Error ? error : new Error(String(error)),
        { tool: moduleName, operation: 'wasm_load' }
      );

      throw new WASMLoadError(
        processedError.message,
        moduleName,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get loaded module instance
   */
  static getModule(moduleName: string): WASMModuleInstance | null {
    return this.loadedModules.get(moduleName) || null;
  }

  /**
   * Check if module is loaded and ready
   */
  static isModuleReady(moduleName: string): boolean {
    const instance = this.loadedModules.get(moduleName);
    return instance ? instance.isReady : false;
  }

  /**
   * Unload a module and free resources
   */
  static unloadModule(moduleName: string): void {
    const instance = this.loadedModules.get(moduleName);
    if (instance) {
      instance.cleanup();
      this.loadedModules.delete(moduleName);
    }
  }

  /**
   * Unload all modules
   */
  static unloadAllModules(): void {
    for (const [name, instance] of this.loadedModules) {
      instance.cleanup();
    }
    this.loadedModules.clear();
    this.loadingPromises.clear();
  }

  /**
   * Get loading status for all modules
   */
  static getLoadingStatus(): Record<string, 'not_loaded' | 'loading' | 'ready' | 'error'> {
    const status: Record<string, 'not_loaded' | 'loading' | 'ready' | 'error'> = {};
    
    for (const [name, instance] of this.loadedModules) {
      status[name] = instance.isReady ? 'ready' : 'loading';
    }
    
    for (const name of this.loadingPromises.keys()) {
      if (!status[name]) {
        status[name] = 'loading';
      }
    }
    
    return status;
  }

  /**
   * Preload modules for faster initialization
   */
  static async preloadModules(modules: Array<{ name: string; config: WASMModuleConfig }>): Promise<void> {
    const loadPromises = modules.map(({ name, config }) => 
      this.loadModule(name, config).catch(error => {
        console.warn(`Failed to preload module ${name}:`, error);
        return null;
      })
    );

    await Promise.all(loadPromises);
  }

  /**
   * Check browser WASM capabilities
   */
  static checkWASMSupport(): { 
    supported: boolean; 
    features: { 
      basic: boolean; 
      streaming: boolean; 
      threads: boolean; 
      simd: boolean; 
    } 
  } {
    const features = {
      basic: !!window.WebAssembly,
      streaming: !!(window.WebAssembly && WebAssembly.instantiateStreaming),
      threads: false, // Will be detected dynamically
      simd: false     // Will be detected dynamically
    };

    // Check for advanced features
    if (features.basic) {
      try {
        // Check for threads support (SharedArrayBuffer)
        features.threads = typeof SharedArrayBuffer !== 'undefined';
        
        // SIMD support is harder to detect, assume modern browsers support it
        features.simd = true;
      } catch (e) {
        // Feature detection failed, assume not supported
      }
    }

    return {
      supported: features.basic,
      features
    };
  }
}