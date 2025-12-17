/**
 * MEMFS Manager - Virtual filesystem utilities for WASM modules
 * Validates: Requirements 1.2
 */

import { WASMModuleInstance } from './wasm-loader';
import { MemoryManager } from './memory-manager';

export interface FileSystemEntry {
  path: string;
  size: number;
  isDirectory: boolean;
  timestamp: number;
}

export interface VirtualFile {
  path: string;
  data: Uint8Array;
  mimeType?: string;
  metadata?: Record<string, any>;
}

export class MEMFSManager {
  private wasmInstance: WASMModuleInstance;
  private memoryManager: MemoryManager;
  private allocatedFiles = new Map<string, string>(); // path -> memory allocation ID

  constructor(wasmInstance: WASMModuleInstance, memoryManager: MemoryManager) {
    this.wasmInstance = wasmInstance;
    this.memoryManager = memoryManager;
    this.initializeFileSystem();
  }

  /**
   * Initialize the virtual file system
   */
  private initializeFileSystem(): void {
    const FS = this.wasmInstance.FS;
    if (!FS) {
      throw new Error('File system not available in WASM instance');
    }

    try {
      // Create standard directories
      const directories = ['/tmp', '/input', '/output', '/work'];
      
      directories.forEach(dir => {
        try {
          FS.mkdir(dir);
        } catch (error) {
          // Directory might already exist, ignore error
        }
      });

      // Set working directory
      FS.chdir('/work');
    } catch (error) {
      throw new Error(`Failed to initialize file system: ${error}`);
    }
  }

  /**
   * Write file to virtual file system
   */
  writeFile(path: string, data: Uint8Array, options: { 
    allocateMemory?: boolean;
    mimeType?: string;
  } = {}): void {
    const FS = this.wasmInstance.FS;
    
    try {
      // Allocate memory tracking if requested
      if (options.allocateMemory !== false) {
        const allocationId = `file_${path.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
        this.memoryManager.allocate(data.length, allocationId, 'file', `Virtual file: ${path}`);
        this.allocatedFiles.set(path, allocationId);
      }

      // Ensure directory exists
      const dirPath = path.substring(0, path.lastIndexOf('/'));
      if (dirPath && dirPath !== '/') {
        this.ensureDirectory(dirPath);
      }

      // Write file to MEMFS
      FS.writeFile(path, data);
    } catch (error) {
      // Clean up memory allocation on error
      const allocationId = this.allocatedFiles.get(path);
      if (allocationId) {
        this.memoryManager.deallocate(allocationId);
        this.allocatedFiles.delete(path);
      }
      
      throw new Error(`Failed to write file ${path}: ${error}`);
    }
  }

  /**
   * Read file from virtual file system
   */
  readFile(path: string): Uint8Array {
    const FS = this.wasmInstance.FS;
    
    try {
      return FS.readFile(path);
    } catch (error) {
      throw new Error(`Failed to read file ${path}: ${error}`);
    }
  }

  /**
   * Check if file exists
   */
  fileExists(path: string): boolean {
    const FS = this.wasmInstance.FS;
    
    try {
      FS.stat(path);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get file information
   */
  getFileInfo(path: string): FileSystemEntry | null {
    const FS = this.wasmInstance.FS;
    
    try {
      const stat = FS.stat(path);
      return {
        path,
        size: stat.size,
        isDirectory: FS.isDir(stat.mode),
        timestamp: stat.mtime.getTime()
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * List directory contents
   */
  listDirectory(path: string): FileSystemEntry[] {
    const FS = this.wasmInstance.FS;
    
    try {
      const entries = FS.readdir(path);
      const results: FileSystemEntry[] = [];
      
      for (const entry of entries) {
        if (entry === '.' || entry === '..') continue;
        
        const fullPath = path === '/' ? `/${entry}` : `${path}/${entry}`;
        const info = this.getFileInfo(fullPath);
        if (info) {
          results.push(info);
        }
      }
      
      return results;
    } catch (error) {
      throw new Error(`Failed to list directory ${path}: ${error}`);
    }
  }

  /**
   * Delete file from virtual file system
   */
  deleteFile(path: string): void {
    const FS = this.wasmInstance.FS;
    
    try {
      // Clean up memory allocation
      const allocationId = this.allocatedFiles.get(path);
      if (allocationId) {
        this.memoryManager.deallocate(allocationId);
        this.allocatedFiles.delete(path);
      }

      // Delete file from MEMFS
      FS.unlink(path);
    } catch (error) {
      throw new Error(`Failed to delete file ${path}: ${error}`);
    }
  }

  /**
   * Create directory
   */
  createDirectory(path: string): void {
    this.ensureDirectory(path);
  }

  /**
   * Ensure directory exists (create if necessary)
   */
  private ensureDirectory(path: string): void {
    const FS = this.wasmInstance.FS;
    
    try {
      // Check if directory already exists
      const stat = FS.stat(path);
      if (FS.isDir(stat.mode)) {
        return; // Directory exists
      }
    } catch (error) {
      // Directory doesn't exist, create it
    }

    // Create parent directories recursively
    const parts = path.split('/').filter(part => part.length > 0);
    let currentPath = '';
    
    for (const part of parts) {
      currentPath += '/' + part;
      try {
        FS.mkdir(currentPath);
      } catch (error) {
        // Directory might already exist, check if it's actually a directory
        try {
          const stat = FS.stat(currentPath);
          if (!FS.isDir(stat.mode)) {
            throw new Error(`Path ${currentPath} exists but is not a directory`);
          }
        } catch (statError) {
          throw new Error(`Failed to create directory ${currentPath}: ${error}`);
        }
      }
    }
  }

  /**
   * Copy file within virtual file system
   */
  copyFile(sourcePath: string, destPath: string): void {
    const data = this.readFile(sourcePath);
    this.writeFile(destPath, data);
  }

  /**
   * Move/rename file within virtual file system
   */
  moveFile(sourcePath: string, destPath: string): void {
    this.copyFile(sourcePath, destPath);
    this.deleteFile(sourcePath);
  }

  /**
   * Get total size of all files in virtual file system
   */
  getTotalSize(): number {
    return this.calculateDirectorySize('/');
  }

  /**
   * Calculate size of directory recursively
   */
  private calculateDirectorySize(path: string): number {
    let totalSize = 0;
    
    try {
      const entries = this.listDirectory(path);
      
      for (const entry of entries) {
        if (entry.isDirectory) {
          totalSize += this.calculateDirectorySize(entry.path);
        } else {
          totalSize += entry.size;
        }
      }
    } catch (error) {
      // Ignore errors for inaccessible directories
    }
    
    return totalSize;
  }

  /**
   * Clean up all files and memory allocations
   */
  cleanup(): void {
    const FS = this.wasmInstance.FS;
    
    try {
      // Clean up memory allocations
      for (const [path, allocationId] of this.allocatedFiles) {
        this.memoryManager.deallocate(allocationId);
      }
      this.allocatedFiles.clear();

      // Clean up temporary directories
      const tempDirs = ['/tmp', '/input', '/output', '/work'];
      
      for (const dir of tempDirs) {
        try {
          const entries = this.listDirectory(dir);
          for (const entry of entries) {
            if (entry.isDirectory) {
              this.removeDirectoryRecursive(entry.path);
            } else {
              FS.unlink(entry.path);
            }
          }
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    } catch (error) {
      console.warn('MEMFS cleanup error:', error);
    }
  }

  /**
   * Remove directory and all contents recursively
   */
  private removeDirectoryRecursive(path: string): void {
    const FS = this.wasmInstance.FS;
    
    try {
      const entries = this.listDirectory(path);
      
      for (const entry of entries) {
        if (entry.isDirectory) {
          this.removeDirectoryRecursive(entry.path);
        } else {
          FS.unlink(entry.path);
        }
      }
      
      FS.rmdir(path);
    } catch (error) {
      // Ignore errors during recursive removal
    }
  }

  /**
   * Create a virtual file from browser File object
   */
  async createVirtualFile(file: File, virtualPath: string): Promise<VirtualFile> {
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    
    this.writeFile(virtualPath, data, { 
      allocateMemory: true,
      mimeType: file.type 
    });

    return {
      path: virtualPath,
      data,
      mimeType: file.type,
      metadata: {
        originalName: file.name,
        originalSize: file.size,
        lastModified: file.lastModified
      }
    };
  }

  /**
   * Export virtual file as browser-compatible data
   */
  exportVirtualFile(path: string): VirtualFile {
    const data = this.readFile(path);
    const info = this.getFileInfo(path);
    
    return {
      path,
      data,
      metadata: {
        size: info?.size || data.length,
        timestamp: info?.timestamp || Date.now()
      }
    };
  }

  /**
   * Get memory usage statistics for virtual files
   */
  getMemoryUsage(): {
    totalFiles: number;
    totalSize: number;
    allocatedMemory: number;
  } {
    const totalSize = this.getTotalSize();
    const allocatedMemory = Array.from(this.allocatedFiles.values())
      .reduce((sum, allocationId) => {
        const allocation = this.memoryManager.getAllocation(allocationId);
        return sum + (allocation?.size || 0);
      }, 0);

    return {
      totalFiles: this.allocatedFiles.size,
      totalSize,
      allocatedMemory
    };
  }
}