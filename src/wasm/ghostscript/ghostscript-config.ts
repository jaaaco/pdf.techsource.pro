/**
 * Ghostscript WASM Configuration
 * Validates: Requirements 3.2
 */

import { WASMModuleConfig } from '@/workers/shared/wasm-loader';

export interface GhostscriptConfig extends WASMModuleConfig {
  compressionLevel: 'screen' | 'ebook' | 'printer' | 'prepress';
  colorSpace?: 'RGB' | 'CMYK' | 'Gray';
  imageQuality?: number;
  customArgs?: string[];
}

export class GhostscriptWASM {
  /**
   * Get default Ghostscript WASM configuration
   */
  static getDefaultConfig(): GhostscriptConfig {
    return {
      wasmPath: '/wasm-files/ghostscript.js',
      memoryInitialPages: 512,  // 32MB initial
      memoryMaximumPages: 4096, // 256MB maximum
      allowMemoryGrowth: true,
      compressionLevel: 'ebook',
      colorSpace: 'RGB',
      imageQuality: 75,
      
      locateFile: (path: string, prefix: string) => {
        if (path.endsWith('.wasm')) {
          return '/wasm-files/ghostscript.wasm';
        }
        return prefix + path;
      },

      preRun: [
        function(this: any) {
          // Set up Ghostscript environment
          this.ENV = this.ENV || {};
          this.ENV['GS_LIB'] = '/usr/share/ghostscript/lib';
        }
      ]
    };
  }

  /**
   * Get compression arguments for different quality levels
   */
  static getCompressionArgs(config: GhostscriptConfig): string[] {
    const baseArgs = [
      'gs',
      '-sDEVICE=pdfwrite',
      '-dNOPAUSE',
      '-dBATCH',
      '-dSAFER',
      '-dCompatibilityLevel=1.4'
    ];

    // Quality-specific settings
    const qualitySettings = {
      screen: [
        '-dPDFSETTINGS=/screen',
        '-dDownsampleColorImages=true',
        '-dColorImageResolution=72',
        '-dDownsampleGrayImages=true',
        '-dGrayImageResolution=72',
        '-dDownsampleMonoImages=true',
        '-dMonoImageResolution=72'
      ],
      ebook: [
        '-dPDFSETTINGS=/ebook',
        '-dDownsampleColorImages=true',
        '-dColorImageResolution=150',
        '-dDownsampleGrayImages=true',
        '-dGrayImageResolution=150',
        '-dDownsampleMonoImages=true',
        '-dMonoImageResolution=150'
      ],
      printer: [
        '-dPDFSETTINGS=/printer',
        '-dDownsampleColorImages=true',
        '-dColorImageResolution=300',
        '-dDownsampleGrayImages=true',
        '-dGrayImageResolution=300',
        '-dDownsampleMonoImages=true',
        '-dMonoImageResolution=300'
      ],
      prepress: [
        '-dPDFSETTINGS=/prepress',
        '-dDownsampleColorImages=false',
        '-dDownsampleGrayImages=false',
        '-dDownsampleMonoImages=false'
      ]
    };

    const args = [...baseArgs, ...qualitySettings[config.compressionLevel]];

    // Add color space settings
    if (config.colorSpace && config.colorSpace !== 'RGB') {
      if (config.colorSpace === 'Gray') {
        args.push('-sColorConversionStrategy=Gray');
        args.push('-dProcessColorModel=/DeviceGray');
      } else if (config.colorSpace === 'CMYK') {
        args.push('-sColorConversionStrategy=CMYK');
        args.push('-dProcessColorModel=/DeviceCMYK');
      }
    }

    // Add image quality settings
    if (config.imageQuality !== undefined) {
      args.push(`-dColorImageDownsampleThreshold=1.0`);
      args.push(`-dGrayImageDownsampleThreshold=1.0`);
      args.push(`-dMonoImageDownsampleThreshold=1.0`);
    }

    // Add custom arguments
    if (config.customArgs) {
      args.push(...config.customArgs);
    }

    return args;
  }

  /**
   * Estimate memory requirements for compression
   */
  static estimateMemoryRequirement(fileSizeBytes: number, config: GhostscriptConfig): number {
    // Base memory requirement
    let memoryMB = 64; // 64MB base

    // Add memory based on file size
    const fileSizeMB = fileSizeBytes / (1024 * 1024);
    
    // Different compression levels have different memory requirements
    const memoryMultipliers = {
      screen: 2.0,    // Lower quality, less memory
      ebook: 2.5,     // Medium quality, medium memory
      printer: 3.0,   // High quality, more memory
      prepress: 4.0   // Highest quality, most memory
    };

    memoryMB += fileSizeMB * memoryMultipliers[config.compressionLevel];

    // Color space affects memory usage
    if (config.colorSpace === 'CMYK') {
      memoryMB *= 1.3; // CMYK uses more memory
    }

    return Math.ceil(memoryMB) * 1024 * 1024; // Convert to bytes
  }

  /**
   * Validate Ghostscript configuration
   */
  static validateConfig(config: GhostscriptConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check compression level
    const validLevels = ['screen', 'ebook', 'printer', 'prepress'];
    if (!validLevels.includes(config.compressionLevel)) {
      errors.push(`Invalid compression level: ${config.compressionLevel}`);
    }

    // Check color space
    if (config.colorSpace) {
      const validColorSpaces = ['RGB', 'CMYK', 'Gray'];
      if (!validColorSpaces.includes(config.colorSpace)) {
        errors.push(`Invalid color space: ${config.colorSpace}`);
      }
    }

    // Check image quality
    if (config.imageQuality !== undefined) {
      if (config.imageQuality < 1 || config.imageQuality > 100) {
        errors.push('Image quality must be between 1 and 100');
      }
    }

    // Check memory settings
    if (config.memoryInitialPages && config.memoryInitialPages < 16) {
      errors.push('Initial memory pages must be at least 16 (1MB)');
    }

    if (config.memoryMaximumPages && config.memoryMaximumPages < config.memoryInitialPages!) {
      errors.push('Maximum memory pages must be greater than initial pages');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get progress estimation for compression
   */
  static estimateProgressStages(pageCount: number): string[] {
    const stages = ['Initializing Ghostscript'];
    
    if (pageCount > 10) {
      stages.push('Loading PDF structure');
    }
    
    stages.push('Processing pages');
    
    if (pageCount > 5) {
      stages.push('Optimizing images');
    }
    
    stages.push('Generating compressed PDF');
    stages.push('Finalizing output');
    
    return stages;
  }
}