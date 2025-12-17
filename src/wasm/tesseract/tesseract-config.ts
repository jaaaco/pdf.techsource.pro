/**
 * Tesseract WASM Configuration
 * Validates: Requirements 6.2
 */

import { WASMModuleConfig } from '@/workers/shared/wasm-loader';

export interface TesseractConfig extends WASMModuleConfig {
  languages: string[];
  ocrEngineMode?: 'LEGACY' | 'NEURAL' | 'BOTH' | 'DEFAULT';
  pageSegMode?: number;
  confidenceThreshold?: number;
  outputFormat?: 'text' | 'hocr' | 'pdf' | 'searchable-pdf';
  preprocessing?: {
    deskew?: boolean;
    denoise?: boolean;
    enhance?: boolean;
  };
}

export class TesseractWASM {
  /**
   * Available language codes and names
   */
  static readonly SUPPORTED_LANGUAGES = {
    'eng': 'English',
    'spa': 'Spanish',
    'fra': 'French',
    'deu': 'German',
    'ita': 'Italian',
    'por': 'Portuguese',
    'rus': 'Russian',
    'chi_sim': 'Chinese (Simplified)',
    'chi_tra': 'Chinese (Traditional)',
    'jpn': 'Japanese',
    'kor': 'Korean',
    'ara': 'Arabic',
    'hin': 'Hindi'
  };

  /**
   * Get default Tesseract WASM configuration
   */
  static getDefaultConfig(): TesseractConfig {
    return {
      wasmPath: '/wasm-files/tesseract.js',
      dataPath: '/tesseract-data',
      memoryInitialPages: 1024, // 64MB initial
      memoryMaximumPages: 8192, // 512MB maximum
      allowMemoryGrowth: true,
      languages: ['eng'],
      ocrEngineMode: 'DEFAULT',
      pageSegMode: 3, // Fully automatic page segmentation
      confidenceThreshold: 60,
      outputFormat: 'searchable-pdf',
      preprocessing: {
        deskew: true,
        denoise: false,
        enhance: true
      },
      
      locateFile: (path: string, prefix: string) => {
        if (path.endsWith('.wasm')) {
          return '/wasm-files/tesseract.wasm';
        }
        if (path.endsWith('.traineddata')) {
          return `/tesseract-data/${path}`;
        }
        return prefix + path;
      }
    };
  }

  /**
   * Get OCR parameters for Tesseract
   */
  static getOCRParameters(config: TesseractConfig): Record<string, string> {
    const params: Record<string, string> = {};

    // Engine mode
    if (config.ocrEngineMode) {
      const engineModes = {
        'LEGACY': '0',
        'NEURAL': '1', 
        'BOTH': '2',
        'DEFAULT': '3'
      };
      params['tessedit_ocr_engine_mode'] = engineModes[config.ocrEngineMode];
    }

    // Page segmentation mode
    if (config.pageSegMode !== undefined) {
      params['tessedit_pageseg_mode'] = config.pageSegMode.toString();
    }

    // Confidence threshold
    if (config.confidenceThreshold !== undefined) {
      params['tessedit_reject_mode'] = '0';
      params['tessedit_reject_bad_qual_wds'] = 'true';
    }

    // Preprocessing options
    if (config.preprocessing?.deskew) {
      params['textord_heavy_nr'] = 'true';
    }

    if (config.preprocessing?.enhance) {
      params['textord_noise_rejwords'] = 'true';
      params['textord_noise_rejrows'] = 'true';
    }

    return params;
  }

  /**
   * Estimate memory requirements for OCR
   */
  static estimateMemoryRequirement(
    imageWidth: number, 
    imageHeight: number, 
    config: TesseractConfig
  ): number {
    // Base memory requirement
    let memoryMB = 128; // 128MB base for Tesseract

    // Add memory based on image size
    const pixelCount = imageWidth * imageHeight;
    const imageSizeMB = (pixelCount * 3) / (1024 * 1024); // RGB bytes to MB
    
    // OCR requires multiple passes and intermediate data
    memoryMB += imageSizeMB * 4; // 4x image size for processing

    // Language models require additional memory
    memoryMB += config.languages.length * 20; // ~20MB per language

    // Neural engine uses more memory
    if (config.ocrEngineMode === 'NEURAL' || config.ocrEngineMode === 'BOTH') {
      memoryMB *= 1.5;
    }

    return Math.ceil(memoryMB) * 1024 * 1024; // Convert to bytes
  }

  /**
   * Validate Tesseract configuration
   */
  static validateConfig(config: TesseractConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check languages
    if (!config.languages || config.languages.length === 0) {
      errors.push('At least one language must be specified');
    } else {
      const supportedLangs = Object.keys(this.SUPPORTED_LANGUAGES);
      const invalidLangs = config.languages.filter(lang => !supportedLangs.includes(lang));
      if (invalidLangs.length > 0) {
        errors.push(`Unsupported languages: ${invalidLangs.join(', ')}`);
      }
    }

    // Check engine mode
    if (config.ocrEngineMode) {
      const validModes = ['LEGACY', 'NEURAL', 'BOTH', 'DEFAULT'];
      if (!validModes.includes(config.ocrEngineMode)) {
        errors.push(`Invalid OCR engine mode: ${config.ocrEngineMode}`);
      }
    }

    // Check page segmentation mode
    if (config.pageSegMode !== undefined) {
      if (config.pageSegMode < 0 || config.pageSegMode > 13) {
        errors.push('Page segmentation mode must be between 0 and 13');
      }
    }

    // Check confidence threshold
    if (config.confidenceThreshold !== undefined) {
      if (config.confidenceThreshold < 0 || config.confidenceThreshold > 100) {
        errors.push('Confidence threshold must be between 0 and 100');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}