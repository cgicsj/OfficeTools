import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import * as cpexcel from 'xlsx/dist/cpexcel.full.mjs';
import type {
  ParsedWorkbook,
  ParsedWorkbookSheet,
  ParseSplitDocumentsResult,
} from '../../../shared/types/excel';
import { getRegisteredFilePath } from '../file-selection/file-registry';

XLSX.set_cptable(cpexcel);

const PREVIEW_ROW_COUNT = 10;
const ZIP_SIGNATURE = '504b';
const CFB_SIGNATURE = 'd0cf11e0a1b11ae1';

const createEmptyPreviewRows = (): string[][] => {
  return Array.from({ length: PREVIEW_ROW_COUNT }, () => []);
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return '文档解析失败';
};

const hasWorkbookContainerSignature = async (filePath: string): Promise<boolean> => {
  const handle = await readFile(filePath);
  const signature = handle.subarray(0, 8).toString('hex').toLowerCase();
  return signature.startsWith(ZIP_SIGNATURE) || signature === CFB_SIGNATURE;
};

const readCellText = (cell: ExcelJS.Cell): string => {
  const text = cell.text;
  if (text) {
    return text;
  }

  const value = cell.value;
  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
};

const readExcelJsSheet = (worksheet: ExcelJS.Worksheet): ParsedWorkbookSheet => {
  const columnCount = worksheet.columnCount;
  const previewRows = Array.from({ length: PREVIEW_ROW_COUNT }, (_row, rowIndex) => {
    const row = worksheet.getRow(rowIndex + 1);
    return Array.from({ length: columnCount }, (_column, columnIndex) => {
      return readCellText(row.getCell(columnIndex + 1));
    });
  });

  return {
    name: worksheet.name,
    rowCount: worksheet.rowCount,
    columnCount,
    previewRows,
  };
};

const parseXlsxWorkbook = async (sourceId: string, filePath: string): Promise<ParsedWorkbook> => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  return {
    sourceId,
    fileName: path.basename(filePath),
    sheets: workbook.worksheets.map((worksheet) => readExcelJsSheet(worksheet)),
  };
};

const readSheetJsCellDisplayText = (cell: XLSX.CellObject | undefined): string => {
  if (!cell) {
    return '';
  }

  if (typeof cell.w === 'string') {
    return cell.w;
  }

  if (cell.v === null || cell.v === undefined) {
    return '';
  }

  return String(cell.v);
};

const findMergedMasterCell = (
  worksheet: XLSX.WorkSheet,
  rowIndex: number,
  columnIndex: number,
): XLSX.CellObject | undefined => {
  const mergeRanges = worksheet['!merges'];
  if (!mergeRanges) {
    return undefined;
  }

  const mergeRange = mergeRanges.find((candidateRange) => {
    return rowIndex >= candidateRange.s.r &&
      rowIndex <= candidateRange.e.r &&
      columnIndex >= candidateRange.s.c &&
      columnIndex <= candidateRange.e.c;
  });

  if (!mergeRange) {
    return undefined;
  }

  const masterAddress = XLSX.utils.encode_cell({ r: mergeRange.s.r, c: mergeRange.s.c });
  return worksheet[masterAddress] as XLSX.CellObject | undefined;
};

const readSheetJsCellText = (worksheet: XLSX.WorkSheet, rowIndex: number, columnIndex: number): string => {
  const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
  const cell = worksheet[address] as XLSX.CellObject | undefined;
  const directText = readSheetJsCellDisplayText(cell);
  if (directText !== '') {
    return directText;
  }

  return readSheetJsCellDisplayText(findMergedMasterCell(worksheet, rowIndex, columnIndex));
};

const readSheetJsSheet = (sheetName: string, worksheet: XLSX.WorkSheet): ParsedWorkbookSheet => {
  const reference = worksheet['!ref'];
  if (!reference) {
    return {
      name: sheetName,
      rowCount: 0,
      columnCount: 0,
      previewRows: createEmptyPreviewRows(),
    };
  }

  const range = XLSX.utils.decode_range(reference);
  const rowCount = range.e.r + 1;
  const columnCount = range.e.c + 1;
  const previewRows = Array.from({ length: PREVIEW_ROW_COUNT }, (_row, rowIndex) => {
    return Array.from({ length: columnCount }, (_column, columnIndex) => {
      return readSheetJsCellText(worksheet, rowIndex, columnIndex);
    });
  });

  return {
    name: sheetName,
    rowCount,
    columnCount,
    previewRows,
  };
};

const parseSheetJsWorkbook = async (
  sourceId: string,
  filePath: string,
  formatLabel: string,
): Promise<ParsedWorkbook> => {
  const hasValidSignature = await hasWorkbookContainerSignature(filePath);
  if (!hasValidSignature) {
    throw new Error(`${formatLabel} 文件格式无效，请另存为 .xlsx 后重试`);
  }

  const workbook = XLSX.readFile(filePath, {
    cellDates: false,
    cellNF: true,
    cellStyles: true,
    cellText: true,
  });

  return {
    sourceId,
    fileName: path.basename(filePath),
    sheets: workbook.SheetNames.map((sheetName) => {
      return readSheetJsSheet(sheetName, workbook.Sheets[sheetName]);
    }),
  };
};

const parseWorkbook = async (sourceId: string, filePath: string): Promise<ParsedWorkbook> => {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === '.xlsx') {
    return parseXlsxWorkbook(sourceId, filePath);
  }

  if (extension === '.xls') {
    return parseSheetJsWorkbook(sourceId, filePath, 'XLS');
  }

  if (extension === '.et') {
    return parseSheetJsWorkbook(sourceId, filePath, 'ET');
  }

  throw new Error('不支持的文件格式');
};

export const parseSplitDocumentMetadata = async (
  sourceIds: string[],
): Promise<ParseSplitDocumentsResult> => {
  const result: ParseSplitDocumentsResult = {
    workbooks: [],
    failures: [],
  };

  for (const sourceId of sourceIds) {
    const filePath = getRegisteredFilePath(sourceId);
    if (!filePath) {
      result.failures.push({
        sourceId,
        fileName: sourceId,
        error: '找不到已选择文件，请重新选择文件',
      });
      continue;
    }

    try {
      const workbook = await parseWorkbook(sourceId, filePath);
      result.workbooks.push(workbook);
    } catch (error) {
      result.failures.push({
        sourceId,
        fileName: path.basename(filePath),
        error: getErrorMessage(error),
      });
    }
  }

  return result;
};
