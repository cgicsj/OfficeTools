import type ExcelJS from 'exceljs';

type ExcelJsTextLikeValue = {
  text: string;
};

type ExcelJsRichTextValue = {
  richText: unknown[];
};

type ExcelJsErrorValue = {
  error: string;
};

type ExcelJsFormulaResultValue = {
  result: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const hasText = (value: Record<string, unknown>): value is ExcelJsTextLikeValue => {
  return typeof value.text === 'string';
};

const hasRichText = (value: Record<string, unknown>): value is ExcelJsRichTextValue => {
  return Array.isArray(value.richText);
};

const hasError = (value: Record<string, unknown>): value is ExcelJsErrorValue => {
  return typeof value.error === 'string';
};

const hasFormulaResult = (value: Record<string, unknown>): value is ExcelJsFormulaResultValue => {
  return Object.prototype.hasOwnProperty.call(value, 'result');
};

const stringifyExcelJsValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (!isRecord(value)) {
    return String(value);
  }

  if (hasText(value)) {
    return value.text;
  }

  if (hasRichText(value)) {
    return value.richText
      .map((entry) => isRecord(entry) && typeof entry.text === 'string' ? entry.text : '')
      .join('');
  }

  if (hasFormulaResult(value)) {
    return stringifyExcelJsValue(value.result);
  }

  if (hasError(value)) {
    return value.error;
  }

  return '';
};

export const readExcelJsCellText = (cell: ExcelJS.Cell): string => {
  return stringifyExcelJsValue(cell.value);
};
