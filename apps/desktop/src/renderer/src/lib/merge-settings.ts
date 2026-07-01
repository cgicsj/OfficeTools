import type { ParsedWorkbook } from '@shared/types/excel';

export type MergeSheetSelections = Record<string, string>;

export const createDefaultMergeSheetSelections = (workbooks: ParsedWorkbook[]): MergeSheetSelections => {
  return Object.fromEntries(
    workbooks.map((workbook) => [workbook.sourceId, workbook.sheets[0]?.name ?? '']),
  );
};

export const hasCompleteMergeSheetSelections = (
  workbooks: ParsedWorkbook[],
  sheetSelections: MergeSheetSelections,
): boolean => {
  return workbooks.length > 0 && workbooks.every((workbook) => {
    return workbook.sheets.some((sheet) => sheet.name === sheetSelections[workbook.sourceId]);
  });
};
