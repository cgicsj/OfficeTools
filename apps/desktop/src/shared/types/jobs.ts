import type { FileProcessingStatus } from './files';

export type WorkflowTab = 'split' | 'merge';

export type LogLevel = 'info' | 'success' | 'warning' | 'error';

export type LogEntry = {
  id: string;
  tab: WorkflowTab;
  level: LogLevel;
  message: string;
  timestampMs: number;
};

export type JobStage =
  | 'idle'
  | 'selecting'
  | 'parsing'
  | 'processing'
  | 'saving'
  | 'completed'
  | 'canceled'
  | 'failed';

export type JobProgress = {
  stage: JobStage;
  currentFileIndex: number;
  totalFiles: number;
  currentFileName?: string;
  message?: string;
};

export type JobEvent =
  | {
      type: 'log';
      entry: LogEntry;
    }
  | {
      type: 'progress';
      tab: WorkflowTab;
      progress: JobProgress;
    }
  | {
      type: 'file-status';
      tab: WorkflowTab;
      sourceId: string;
      status: FileProcessingStatus;
    };

