import { z } from 'zod';

export const parseSplitDocumentsInputSchema = z.object({
  sourceIds: z.array(z.string().min(1)).min(1),
});

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

export type ParseSplitDocumentsInput = z.infer<typeof parseSplitDocumentsInputSchema>;
export type StartSplitJobInput = z.infer<typeof startSplitJobInputSchema>;
export type StartSplitJobFileInput = StartSplitJobInput['files'][number];

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
