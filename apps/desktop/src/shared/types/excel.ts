import { z } from 'zod';

export const parseSplitDocumentsInputSchema = z.object({
  sourceIds: z.array(z.string().min(1)).min(1),
});

export type ParseSplitDocumentsInput = z.infer<typeof parseSplitDocumentsInputSchema>;

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
