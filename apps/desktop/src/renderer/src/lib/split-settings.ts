import type { ParsedWorkbook, ParsedWorkbookSheet } from '@shared/types/excel';

export type SplitSettingsState = {
  sheetName: string;
  fieldRow: string;
  splitColumn: string;
};

export type SplitColumnOption = {
  value: string;
  label: string;
};

export const FIELD_ROW_OPTIONS = Array.from({ length: 10 }, (_item, index) => index + 1);

export const emptySplitSettings: SplitSettingsState = {
  sheetName: '',
  fieldRow: '',
  splitColumn: '',
};

export const getColumnLetter = (columnNumber: number): string => {
  let currentNumber = columnNumber;
  let columnLetter = '';

  while (currentNumber > 0) {
    const remainder = (currentNumber - 1) % 26;
    columnLetter = String.fromCharCode(65 + remainder) + columnLetter;
    currentNumber = Math.floor((currentNumber - 1) / 26);
  }

  return columnLetter || 'A';
};

export const getWorkbookBySourceId = (
  workbooks: ParsedWorkbook[],
  sourceId: string,
): ParsedWorkbook | undefined => {
  return workbooks.find((workbook) => workbook.sourceId === sourceId);
};

export const getSheetByName = (
  workbook: ParsedWorkbook | undefined,
  sheetName: string,
): ParsedWorkbookSheet | undefined => {
  if (!workbook) {
    return undefined;
  }

  return workbook.sheets.find((sheet) => sheet.name === sheetName) ?? workbook.sheets[0];
};

export const createSplitColumnOptions = (
  sheet: ParsedWorkbookSheet | undefined,
  fieldRow: string,
): SplitColumnOption[] => {
  if (!sheet || fieldRow === '') {
    return [];
  }

  const rowNumber = Number(fieldRow);
  if (!Number.isInteger(rowNumber) || rowNumber < 1) {
    return [];
  }

  const rowValues = sheet.previewRows[rowNumber - 1] ?? [];
  const columnCount = Math.max(sheet.columnCount, rowValues.length);
  const normalizedFieldCounts = new Map<string, number>();

  rowValues.forEach((fieldValue) => {
    const normalizedFieldName = fieldValue.trim();
    if (normalizedFieldName === '') {
      return;
    }

    normalizedFieldCounts.set(
      normalizedFieldName,
      (normalizedFieldCounts.get(normalizedFieldName) ?? 0) + 1,
    );
  });

  return Array.from({ length: columnCount }, (_column, index) => {
    const columnNumber = index + 1;
    const columnLetter = getColumnLetter(columnNumber);
    const fieldName = rowValues[index]?.trim() ?? '';
    const isDuplicate = fieldName !== '' && (normalizedFieldCounts.get(fieldName) ?? 0) > 1;
    const displayFieldName = fieldName === ''
      ? `未命名列 (${columnLetter}列)`
      : isDuplicate
        ? `${fieldName} (${columnLetter}列)`
        : fieldName;

    return {
      value: String(columnNumber),
      label: `（${columnLetter}）${displayFieldName}`,
    };
  });
};

export const createDefaultSplitSettings = (workbook: ParsedWorkbook): SplitSettingsState => {
  const firstSheet = workbook.sheets[0];
  if (!firstSheet) {
    return emptySplitSettings;
  }

  const fieldRow = '1';
  const firstColumn = createSplitColumnOptions(firstSheet, fieldRow)[0];

  return {
    sheetName: firstSheet.name,
    fieldRow,
    splitColumn: firstColumn?.value ?? '',
  };
};

export const createSettingsForSheet = (sheet: ParsedWorkbookSheet): SplitSettingsState => {
  const fieldRow = '1';
  const firstColumn = createSplitColumnOptions(sheet, fieldRow)[0];

  return {
    sheetName: sheet.name,
    fieldRow,
    splitColumn: firstColumn?.value ?? '',
  };
};

export const createSettingsForFieldRow = (
  currentSettings: SplitSettingsState,
  sheet: ParsedWorkbookSheet | undefined,
  fieldRow: string,
): SplitSettingsState => {
  const firstColumn = createSplitColumnOptions(sheet, fieldRow)[0];

  return {
    ...currentSettings,
    fieldRow,
    splitColumn: firstColumn?.value ?? '',
  };
};
