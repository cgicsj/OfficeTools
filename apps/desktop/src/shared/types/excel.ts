import { z } from 'zod';
import type { SelectedFile } from './files';

export const parseSplitDocumentsInputSchema = z.object({
  sourceIds: z.array(z.string().min(1)).min(1),
});

export const mergeModeSchema = z.enum(['single-sheet', 'multi-sheet']);

export const startSplitJobInputSchema = z.object({
  outputDirectory: z.string().min(1),
  files: z.array(
    z.object({
      sourceId: z.string().min(1),
      sheetName: z.string().min(1),
      fieldRow: z.number().int().min(1).max(10),
      splitColumn: z.number().int().min(1),
    }),
  ).min(1),
});

export const parseMergeFolderInputSchema = z.object({
  folderSourceId: z.string().min(1),
});

export const startMergeJobInputSchema = z.object({
  outputDirectory: z.string().min(1),
  mode: mergeModeSchema,
  fieldRow: z.number().int().min(1).max(10),
  files: z.array(
    z.object({
      sourceId: z.string().min(1),
      sheetName: z.string().min(1),
    }),
  ).min(1),
});

export type MergeMode = z.infer<typeof mergeModeSchema>;
export type ParseSplitDocumentsInput = z.infer<typeof parseSplitDocumentsInputSchema>;
export type StartSplitJobInput = z.infer<typeof startSplitJobInputSchema>;
export type ParseMergeFolderInput = z.infer<typeof parseMergeFolderInputSchema>;
export type StartMergeJobInput = z.infer<typeof startMergeJobInputSchema>;
export type StartSplitJobFileInput = StartSplitJobInput['files'][number];
export type StartMergeJobFileInput = StartMergeJobInput['files'][number];

export type ParsedWorkbookSheet = {
  name: string;
  rowCount: number;
  columnCount: number;
  previewRows: string[][];
};

export type ParsedWorkbook = {
  sourceId: string;
  fileName: string;
  sheets: ParsedWorkbookSheet[];
};

export type ParseWorkbookFailure = {
  sourceId: string;
  fileName: string;
  error: string;
};

export type ParseSplitDocumentsResult = {
  workbooks: ParsedWorkbook[];
  failures: ParseWorkbookFailure[];
};

export type SplitJobFileResult = {
  sourceId: string;
  fileName: string;
  outputCount: number;
  status: 'completed' | 'skipped' | 'failed';
  error?: string;
};

export type SplitJobResult = {
  outputDirectory: string;
  outputPath: string;
  files: SplitJobFileResult[];
};

export type MergeFolderScanFailure = {
  fileName: string;
  reason: string;
};

export type ParseMergeFolderResult = {
  files: SelectedFile[];
  workbooks: ParsedWorkbook[];
  failures: ParseWorkbookFailure[];
  excludedFiles: MergeFolderScanFailure[];
};

export type MergeJobFileResult = {
  sourceId: string;
  fileName: string;
  status: 'completed' | 'skipped' | 'failed';
  error?: string;
};

export type MergeJobResult = {
  outputDirectory: string;
  outputPath: string;
  files: MergeJobFileResult[];
  warning?: string;
};
