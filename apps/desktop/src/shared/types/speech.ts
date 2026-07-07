import { z } from 'zod';
import type { SelectedFile } from './files';

export type SpeechTranscriptionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'canceled';

export type SpeechAudioFile = SelectedFile;

export type SpeechTranscriptionItem = SpeechAudioFile & {
  status: SpeechTranscriptionStatus;
  transcript: string;
  rawText: string;
  error?: string;
  durationSeconds?: number;
  inferenceLatencySeconds?: number;
  confidence?: number;
};

export type StartSpeechTranscriptionInput = {
  sourceIds: string[];
};

export type SpeechTranscriptionSummary = {
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  canceledFiles: number;
};

export type SpeechTranscriptionJobResult = {
  items: SpeechTranscriptionItem[];
  summary: SpeechTranscriptionSummary;
};

export type SpeechTranscriptionProgress = {
  currentFileIndex: number;
  totalFiles: number;
  currentFileName?: string;
  message?: string;
};

export type SpeechEvent =
  | {
      type: 'item-status';
      item: SpeechTranscriptionItem;
    }
  | {
      type: 'progress';
      progress: SpeechTranscriptionProgress;
    }
  | {
      type: 'log';
      level: 'info' | 'success' | 'warning' | 'error';
      message: string;
      timestampMs: number;
    };

export type ExportSpeechTranscriptItem = {
  sourceId: string;
  name: string;
  transcript: string;
};

export type ExportSpeechTranscriptsInput = {
  outputDirectory: string;
  items: ExportSpeechTranscriptItem[];
};

export type ExportSpeechTranscriptsResult = {
  outputDirectory: string;
  files: Array<{
    sourceId: string;
    path: string;
  }>;
};

export const startSpeechTranscriptionInputSchema = z.object({
  sourceIds: z.array(z.string().min(1)).min(1),
});

export const exportSpeechTranscriptsInputSchema = z.object({
  outputDirectory: z.string().min(1),
  items: z
    .array(
      z.object({
        sourceId: z.string().min(1),
        name: z.string().min(1),
        transcript: z.string(),
      }),
    )
    .min(1),
});
