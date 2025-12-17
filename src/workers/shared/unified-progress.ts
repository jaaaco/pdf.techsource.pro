/**
 * Unified Progress Reporting System
 * Ensures consistent progress reporting across all tools
 * Validates: Requirements 2.1, 2.2
 */

import { MessageFactory } from './progress-protocol';

export interface ProgressStage {
  name: string;
  weight: number; // Relative weight of this stage (0-1)
  message?: string;
}

export interface UnifiedProgressConfig {
  taskId: string;
  stages: ProgressStage[];
  totalItems?: number; // Total files, pages, etc.
}

export class UnifiedProgressReporter {
  private config: UnifiedProgressConfig;
  private currentStageIndex: number = 0;
  private currentStageProgress: number = 0;
  private startTime: number;
  private lastReportTime: number = 0;
  private readonly MIN_REPORT_INTERVAL = 100; // Minimum ms between reports

  constructor(config: UnifiedProgressConfig) {
    this.config = config;
    this.startTime = Date.now();
    
    // Validate stages
    this.validateStages();
  }

  /**
   * Validate that stages are properly configured
   */
  private validateStages(): void {
    if (this.config.stages.length === 0) {
      throw new Error('At least one progress stage must be defined');
    }

    const totalWeight = this.config.stages.reduce((sum, stage) => sum + stage.weight, 0);
    if (Math.abs(totalWeight - 1.0) > 0.001) {
      throw new Error(`Stage weights must sum to 1.0, got ${totalWeight}`);
    }

    // Ensure all stages have valid names
    for (const stage of this.config.stages) {
      if (!stage.name || stage.name.trim().length === 0) {
        throw new Error('All stages must have non-empty names');
      }
      if (stage.weight <= 0 || stage.weight > 1) {
        throw new Error(`Stage weight must be between 0 and 1, got ${stage.weight} for stage "${stage.name}"`);
      }
    }
  }

  /**
   * Report progress for the current stage
   */
  reportStageProgress(
    stageProgress: number, 
    message?: string,
    forceReport: boolean = false
  ): void {
    // Throttle progress reports to avoid overwhelming the UI
    const now = Date.now();
    if (!forceReport && (now - this.lastReportTime) < this.MIN_REPORT_INTERVAL) {
      return;
    }
    this.lastReportTime = now;

    // Validate stage progress
    if (stageProgress < 0 || stageProgress > 100) {
      console.warn(`Invalid stage progress: ${stageProgress}. Must be between 0 and 100.`);
      stageProgress = Math.max(0, Math.min(100, stageProgress));
    }

    this.currentStageProgress = stageProgress;
    
    const currentStage = this.config.stages[this.currentStageIndex];
    const overallProgress = this.calculateOverallProgress();
    
    const progressMessage = message || currentStage.message || `${currentStage.name}...`;
    
    // Send progress message
    const progressMsg = MessageFactory.createProgressMessage(
      this.config.taskId,
      overallProgress,
      100,
      currentStage.name,
      progressMessage
    );

    self.postMessage(progressMsg);
  }

  /**
   * Move to the next stage
   */
  nextStage(message?: string): void {
    if (this.currentStageIndex < this.config.stages.length - 1) {
      this.currentStageIndex++;
      this.currentStageProgress = 0;
      
      const currentStage = this.config.stages[this.currentStageIndex];
      const progressMessage = message || currentStage.message || `Starting ${currentStage.name}...`;
      
      this.reportStageProgress(0, progressMessage, true);
    }
  }

  /**
   * Set progress for a specific stage by name
   */
  setStage(stageName: string, progress: number = 0, message?: string): void {
    const stageIndex = this.config.stages.findIndex(stage => stage.name === stageName);
    if (stageIndex === -1) {
      throw new Error(`Stage "${stageName}" not found`);
    }

    this.currentStageIndex = stageIndex;
    this.reportStageProgress(progress, message, true);
  }

  /**
   * Report progress for file-based operations
   */
  reportFileProgress(
    currentFile: number,
    totalFiles: number,
    fileProgress: number = 100,
    fileName?: string
  ): void {
    if (totalFiles === 0) return;

    const overallFileProgress = ((currentFile - 1) / totalFiles) * 100 + (fileProgress / totalFiles);
    const message = fileName ? `Processing ${fileName}...` : `Processing file ${currentFile} of ${totalFiles}...`;
    
    this.reportStageProgress(overallFileProgress, message);
  }

  /**
   * Report progress for page-based operations
   */
  reportPageProgress(
    currentPage: number,
    totalPages: number,
    pageName?: string
  ): void {
    if (totalPages === 0) return;

    const pageProgress = (currentPage / totalPages) * 100;
    const message = pageName ? 
      `Processing ${pageName}...` : 
      `Processing page ${currentPage} of ${totalPages}...`;
    
    this.reportStageProgress(pageProgress, message);
  }

  /**
   * Calculate overall progress across all stages
   */
  private calculateOverallProgress(): number {
    let totalProgress = 0;

    // Add completed stages
    for (let i = 0; i < this.currentStageIndex; i++) {
      totalProgress += this.config.stages[i].weight * 100;
    }

    // Add current stage progress
    if (this.currentStageIndex < this.config.stages.length) {
      const currentStage = this.config.stages[this.currentStageIndex];
      totalProgress += (currentStage.weight * this.currentStageProgress);
    }

    return Math.round(Math.max(0, Math.min(100, totalProgress)));
  }

  /**
   * Complete the current stage and move to next
   */
  completeStage(message?: string): void {
    this.reportStageProgress(100, message, true);
    this.nextStage();
  }

  /**
   * Complete all remaining stages (for early completion)
   */
  complete(message?: string): void {
    this.currentStageIndex = this.config.stages.length - 1;
    this.reportStageProgress(100, message || 'Completed', true);
  }

  /**
   * Get processing statistics
   */
  getStats(): {
    elapsedTime: number;
    currentStage: string;
    overallProgress: number;
    estimatedTimeRemaining?: number;
  } {
    const elapsedTime = Date.now() - this.startTime;
    const overallProgress = this.calculateOverallProgress();
    const currentStage = this.config.stages[this.currentStageIndex]?.name || 'Unknown';
    
    let estimatedTimeRemaining: number | undefined;
    if (overallProgress > 5) { // Only estimate after some progress
      const progressRate = overallProgress / elapsedTime; // progress per ms
      const remainingProgress = 100 - overallProgress;
      estimatedTimeRemaining = Math.round(remainingProgress / progressRate);
    }

    return {
      elapsedTime,
      currentStage,
      overallProgress,
      estimatedTimeRemaining
    };
  }
}

/**
 * Predefined stage configurations for common operations
 */
export class StandardProgressStages {
  static readonly COMPRESSION = [
    { name: 'Initializing', weight: 0.05, message: 'Loading compression engine...' },
    { name: 'Processing', weight: 0.85, message: 'Compressing PDF...' },
    { name: 'Finalizing', weight: 0.10, message: 'Generating output...' }
  ];

  static readonly MERGE = [
    { name: 'Analyzing', weight: 0.15, message: 'Analyzing input files...' },
    { name: 'Merging', weight: 0.75, message: 'Combining PDFs...' },
    { name: 'Finalizing', weight: 0.10, message: 'Generating merged PDF...' }
  ];

  static readonly SPLIT = [
    { name: 'Loading', weight: 0.10, message: 'Loading PDF document...' },
    { name: 'Analyzing', weight: 0.10, message: 'Analyzing page structure...' },
    { name: 'Splitting', weight: 0.70, message: 'Creating split documents...' },
    { name: 'Finalizing', weight: 0.10, message: 'Completing split operation...' }
  ];

  static readonly OCR = [
    { name: 'Initializing', weight: 0.10, message: 'Loading OCR engine...' },
    { name: 'Extracting', weight: 0.20, message: 'Extracting page images...' },
    { name: 'Processing', weight: 0.60, message: 'Performing text recognition...' },
    { name: 'Generating', weight: 0.10, message: 'Creating searchable PDF...' }
  ];
}