import * as nodeFs from 'node:fs';
import crypto from 'node:crypto';
import { access, copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import * as cpexcel from 'xlsx/dist/cpexcel.full.mjs';
import type {
  MergeJobFileResult,
  MergeJobResult,
  StartMergeJobFileInput,
  StartMergeJobInput,
} from '../../../shared/types/excel';
import type { JobEvent, JobProgress, LogEntry, WorkflowTab } from '../../../shared/types/jobs';
import { getRegisteredFilePath } from '../file-selection/file-registry';
import { setActiveJobAbortController } from '../jobs/job-cancellation';
import { createTempWorkspace, removeTempWorkspace } from '../workspace/temp-workspace';
import { readExcelJsCellText } from './cell-text';
import { assertNoUnsupportedObjectsInDirectWorkbook } from './legacy-object-detector';

XLSX.set_fs(nodeFs);
XLSX.set_cptable(cpexcel);

const MERGE_TAB: WorkflowTab = 'merge';
const ZIP_SIGNATURE = '504b';
const CFB_SIGNATURE = 'd0cf11e0a1b11ae1';
const OUTPUT_FILE_NAME = '汇总数据.xlsx';
const SINGLE_SHEET_NAME = '汇总数据';
const HEADER_MISMATCH_WARNING = '选择的文件具有标题行内容不一致，已保留标题行追加合并。';
const OBJECT_RELATIONSHIP_MARKERS = ['drawing', 'vmlDrawing', 'oleObject', 'ctrlProp'];
const XLSX_MAX_SHEET_NAME_LENGTH = 31;
const ILLEGAL_SHEET_NAME_PATTERN = /[\\/*?:[\]]/g;

type EmitJobEvent = (event: JobEvent) => void;

type MergeJobContext = {
  abortSignal: AbortSignal;
  fieldRow: number;
  workspaceRoot: string;
};

type ExcelJsFormulaValue = ExcelJS.CellFormulaValue | ExcelJS.CellSharedFormulaValue;

type ExcelJsWorksheetWithModel = ExcelJS.Worksheet & {
  model: {
    merges?: string[];
  };
};

type SheetJsFormulaCell = XLSX.CellObject & {
  F?: string;
  f?: string;
};

type CellSnapshot = {
  numFmt?: string;
  style?: Partial<ExcelJS.Style>;
  text: string;
  value: ExcelJS.CellValue;
};

type RowSnapshot = {
  cells: Array<CellSnapshot | undefined>;
  height?: number;
  hidden?: boolean;
  outlineLevel?: number;
};

type ColumnSnapshot = {
  hidden?: boolean;
  outlineLevel?: number;
  style?: Partial<ExcelJS.Style>;
  width?: number;
};

type MergeRangeSnapshot = {
  endColumn: number;
  endRow: number;
  startColumn: number;
  startRow: number;
};

type MergeSheetData = {
  columnCount: number;
  columns: ColumnSnapshot[];
  fileName: string;
  headerValues: string[];
  merges: MergeRangeSnapshot[];
  rowCount: number;
  rows: RowSnapshot[];
  sheetName: string;
  sourceId: string;
};

class MergeJobCanceledError extends Error {
  constructor() {
    super('用户已取消');
    this.name = 'MergeJobCanceledError';
  }
}

const createLogEntry = (level: LogEntry['level'], message: string): LogEntry => {
  return {
    id: crypto.randomUUID(),
    level,
    message,
    tab: MERGE_TAB,
    timestampMs: Date.now(),
  };
};

const emitLog = (emit: EmitJobEvent, level: LogEntry['level'], message: string): void => {
  emit({ type: 'log', entry: createLogEntry(level, message) });
};

const emitProgress = (emit: EmitJobEvent, progress: JobProgress): void => {
  emit({ type: 'progress', tab: MERGE_TAB, progress });
};

const emitFileStatus = (
  emit: EmitJobEvent,
  sourceId: string,
  status: MergeJobFileResult['status'] | 'processing',
): void => {
  emit({ type: 'file-status', tab: MERGE_TAB, sourceId, status });
};

const throwIfCanceled = (abortSignal: AbortSignal): void => {
  if (abortSignal.aborted) {
    throw new MergeJobCanceledError();
  }
};

const getUnknownErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return '合并失败';
};

const hasWorkbookContainerSignature = async (filePath: string): Promise<boolean> => {
  const handle = await readFile(filePath);
  const signature = handle.subarray(0, 8).toString('hex').toLowerCase();
  return signature.startsWith(ZIP_SIGNATURE) || signature === CFB_SIGNATURE;
};

const resolveUniqueOutputPath = async (directory: string, fileName: string): Promise<string> => {
  const extension = path.extname(fileName);
  const baseName = path.basename(fileName, extension);
  let index = 1;
  let candidate = path.join(directory, fileName);

  while (true) {
    try {
      await access(candidate);
    } catch {
      return candidate;
    }

    index += 1;
    candidate = path.join(directory, `${baseName}_${index}${extension}`);
  }
};

const isExcelJsFormulaValue = (value: ExcelJS.CellValue): value is ExcelJsFormulaValue => {
  return typeof value === 'object' && value !== null && ('formula' in value || 'sharedFormula' in value);
};

const getExcelJsOutputCellValue = (cell: ExcelJS.Cell): ExcelJS.CellValue => {
  const value = cell.value;
  if (!isExcelJsFormulaValue(value)) {
    return value;
  }

  if (!Object.prototype.hasOwnProperty.call(value, 'result')) {
    throw new Error('公式缺少已保存的计算结果，请在 WPS 中重新计算并保存后重试');
  }

  return value.result ?? null;
};

const cloneStyle = (style: Partial<ExcelJS.Style>): Partial<ExcelJS.Style> | undefined => {
  return Object.keys(style).length > 0 ? { ...style } : undefined;
};

const readExcelJsCellSnapshot = (cell: ExcelJS.Cell): CellSnapshot | undefined => {
  const text = readExcelJsCellText(cell);
  const value = getExcelJsOutputCellValue(cell);
  const style = cloneStyle(cell.style);
  const numFmt = cell.numFmt;

  if (value === null && text === '' && !style && !numFmt) {
    return undefined;
  }

  return {
    numFmt,
    style,
    text,
    value,
  };
};

const getWorksheetMerges = (worksheet: ExcelJS.Worksheet): string[] => {
  const model = (worksheet as ExcelJsWorksheetWithModel).model;
  return Array.isArray(model.merges) ? model.merges : [];
};

const toMergeRangeSnapshot = (rangeAddress: string): MergeRangeSnapshot => {
  const range = XLSX.utils.decode_range(rangeAddress);
  return {
    endColumn: range.e.c + 1,
    endRow: range.e.r + 1,
    startColumn: range.s.c + 1,
    startRow: range.s.r + 1,
  };
};

const detectSelectedSheetObjects = async (xlsxPath: string, sheetIndex: number): Promise<boolean> => {
  const workbookBuffer = await readFile(xlsxPath);
  const zip = await JSZip.loadAsync(workbookBuffer);
  const relationshipFile = zip.file(`xl/worksheets/_rels/sheet${sheetIndex + 1}.xml.rels`);
  if (!relationshipFile) {
    return false;
  }

  const relationshipText = await relationshipFile.async('string');
  return OBJECT_RELATIONSHIP_MARKERS.some((marker) => relationshipText.includes(marker));
};

const readExcelJsSheetData = async (
  sourcePath: string,
  input: StartMergeJobFileInput,
  context: MergeJobContext,
): Promise<MergeSheetData> => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(sourcePath);
  throwIfCanceled(context.abortSignal);

  const worksheet = workbook.worksheets.find((candidate) => candidate.name === input.sheetName);
  if (!worksheet) {
    throw new Error(`找不到 sheet：${input.sheetName}`);
  }

  const sheetIndex = workbook.worksheets.findIndex((candidate) => candidate.name === worksheet.name);
  const hasObjects = await detectSelectedSheetObjects(sourcePath, sheetIndex);
  if (hasObjects) {
    throw new Error('所选 sheet 含有图片、图表或其他嵌入对象，暂不支持合并');
  }
  throwIfCanceled(context.abortSignal);

  const columnCount = Math.max(worksheet.columnCount, 1);
  const rows: RowSnapshot[] = [];

  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    throwIfCanceled(context.abortSignal);
    const sourceRow = worksheet.getRow(rowNumber);
    rows.push({
      cells: Array.from({ length: columnCount }, (_item, columnIndex) => {
        return readExcelJsCellSnapshot(sourceRow.getCell(columnIndex + 1));
      }),
      height: sourceRow.height,
      hidden: sourceRow.hidden,
      outlineLevel: sourceRow.outlineLevel,
    });
  }

  const columns: ColumnSnapshot[] = Array.from({ length: columnCount }, (_item, columnIndex) => {
    const sourceColumn = worksheet.getColumn(columnIndex + 1);
    return {
      hidden: sourceColumn.hidden,
      outlineLevel: sourceColumn.outlineLevel,
      style: cloneStyle(sourceColumn.style),
      width: sourceColumn.width,
    };
  });

  const fieldRow = worksheet.getRow(context.fieldRow);
  const headerValues = Array.from({ length: columnCount }, (_item, columnIndex) => {
    return readExcelJsCellText(fieldRow.getCell(columnIndex + 1));
  });

  return {
    columnCount,
    columns,
    fileName: path.basename(sourcePath),
    headerValues,
    merges: getWorksheetMerges(worksheet).map(toMergeRangeSnapshot),
    rowCount: worksheet.rowCount,
    rows,
    sheetName: worksheet.name,
    sourceId: input.sourceId,
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

const getSheetJsOutputCellValue = (cell: XLSX.CellObject): ExcelJS.CellValue => {
  const formulaCell = cell as SheetJsFormulaCell;
  if (formulaCell.f && cell.v === undefined) {
    throw new Error('公式缺少已保存的计算结果，请在 WPS 中重新计算并保存后重试');
  }

  const value = cell.v;
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value instanceof Date) {
    return value;
  }

  return String(value);
};

const readSheetJsCellSnapshot = (
  worksheet: XLSX.WorkSheet,
  rowIndex: number,
  columnIndex: number,
): CellSnapshot | undefined => {
  const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
  const cell = worksheet[address] as XLSX.CellObject | undefined;
  if (!cell) {
    return undefined;
  }

  return {
    numFmt: typeof cell.z === 'string' ? cell.z : undefined,
    text: readSheetJsCellText(worksheet, rowIndex, columnIndex),
    value: getSheetJsOutputCellValue(cell),
  };
};

const readSheetJsSheetData = async (
  sourcePath: string,
  input: StartMergeJobFileInput,
  context: MergeJobContext,
  formatLabel: string,
): Promise<MergeSheetData> => {
  const hasValidSignature = await hasWorkbookContainerSignature(sourcePath);
  if (!hasValidSignature) {
    throw new Error(`${formatLabel} 文件格式无效，请另存为 .xlsx 后重试`);
  }

  const workbook = XLSX.readFile(sourcePath, {
    cellDates: false,
    cellNF: true,
    cellStyles: true,
    cellText: true,
  });
  throwIfCanceled(context.abortSignal);

  const worksheet = workbook.Sheets[input.sheetName];
  if (!worksheet) {
    throw new Error(`找不到 sheet：${input.sheetName}`);
  }

  await assertNoUnsupportedObjectsInDirectWorkbook(sourcePath, input.sheetName, workbook.SheetNames, '合并');
  throwIfCanceled(context.abortSignal);

  const reference = worksheet['!ref'];
  const range = reference ? XLSX.utils.decode_range(reference) : undefined;
  const rowCount = range ? range.e.r + 1 : 0;
  const columnCount = range ? Math.max(range.e.c + 1, 1) : 1;
  const rows: RowSnapshot[] = [];
  const sourceRows = worksheet['!rows'];

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    throwIfCanceled(context.abortSignal);
    const sourceRow = sourceRows?.[rowIndex];
    rows.push({
      cells: Array.from({ length: columnCount }, (_item, columnIndex) => {
        return readSheetJsCellSnapshot(worksheet, rowIndex, columnIndex);
      }),
      hidden: sourceRow?.hidden,
      outlineLevel: sourceRow?.level,
      height: sourceRow?.hpt,
    });
  }

  const sourceColumns = worksheet['!cols'];
  const columns: ColumnSnapshot[] = Array.from({ length: columnCount }, (_item, columnIndex) => {
    const sourceColumn = sourceColumns?.[columnIndex];
    return {
      hidden: sourceColumn?.hidden,
      width: sourceColumn?.wch,
    };
  });

  const fieldRowIndex = context.fieldRow - 1;
  const headerValues = Array.from({ length: columnCount }, (_item, columnIndex) => {
    return fieldRowIndex >= 0 && fieldRowIndex < rowCount
      ? readSheetJsCellText(worksheet, fieldRowIndex, columnIndex)
      : '';
  });

  const merges = (worksheet['!merges'] ?? []).map((mergeRange) => ({
    endColumn: mergeRange.e.c + 1,
    endRow: mergeRange.e.r + 1,
    startColumn: mergeRange.s.c + 1,
    startRow: mergeRange.s.r + 1,
  }));

  return {
    columnCount,
    columns,
    fileName: path.basename(sourcePath),
    headerValues,
    merges,
    rowCount,
    rows,
    sheetName: input.sheetName,
    sourceId: input.sourceId,
  };
};


const processMergeFile = async (
  input: StartMergeJobFileInput,
  context: MergeJobContext,
): Promise<MergeSheetData> => {
  const sourcePath = getRegisteredFilePath(input.sourceId);
  if (!sourcePath) {
    throw new Error('找不到已选择文件，请重新选择文件');
  }

  const extension = path.extname(sourcePath).toLowerCase();
  if (extension === '.xlsx') {
    return readExcelJsSheetData(sourcePath, input, context);
  }

  if (extension === '.xls') {
    return readSheetJsSheetData(sourcePath, input, context, 'XLS');
  }

  if (extension === '.et') {
    return readSheetJsSheetData(sourcePath, input, context, 'ET');
  }

  throw new Error('不支持的文件格式');
};

const normalizeHeaderValues = (values: string[]): string[] => {
  const normalizedValues = values.map((value) => value.trim());
  while (normalizedValues.length > 0 && normalizedValues[normalizedValues.length - 1] === '') {
    normalizedValues.pop();
  }

  return normalizedValues;
};

const areHeadersEqual = (left: string[], right: string[]): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
};

const hasHeaderMismatch = (sheetData: MergeSheetData[]): boolean => {
  const firstSheet = sheetData[0];
  if (!firstSheet) {
    return false;
  }

  const firstHeader = normalizeHeaderValues(firstSheet.headerValues);
  return sheetData.some((candidate) => {
    return !areHeadersEqual(firstHeader, normalizeHeaderValues(candidate.headerValues));
  });
};

const copyColumnMetadata = (sourceData: MergeSheetData, targetWorksheet: ExcelJS.Worksheet): void => {
  sourceData.columns.forEach((sourceColumn, columnIndex) => {
    const targetColumn = targetWorksheet.getColumn(columnIndex + 1);
    if (sourceColumn.width !== undefined) {
      targetColumn.width = sourceColumn.width;
    }
    if (sourceColumn.hidden !== undefined) {
      targetColumn.hidden = sourceColumn.hidden;
    }
    if (sourceColumn.outlineLevel !== undefined) {
      targetColumn.outlineLevel = sourceColumn.outlineLevel;
    }
    if (sourceColumn.style) {
      targetColumn.style = { ...sourceColumn.style };
    }
  });
};

const copyCellSnapshot = (cell: CellSnapshot | undefined, targetCell: ExcelJS.Cell): void => {
  if (!cell) {
    return;
  }

  targetCell.value = cell.value;
  if (cell.style) {
    targetCell.style = { ...cell.style };
  }
  if (cell.numFmt) {
    targetCell.numFmt = cell.numFmt;
  }
};

const copyMergeRanges = (
  sourceData: MergeSheetData,
  targetWorksheet: ExcelJS.Worksheet,
  sourceStartRow: number,
  sourceEndRow: number,
  targetStartRow: number,
): void => {
  const rowOffset = targetStartRow - sourceStartRow;

  sourceData.merges.forEach((mergeRange) => {
    if (mergeRange.startRow < sourceStartRow || mergeRange.endRow > sourceEndRow) {
      return;
    }

    const targetStart = mergeRange.startRow + rowOffset;
    const targetEnd = mergeRange.endRow + rowOffset;
    if (targetStart === targetEnd && mergeRange.startColumn === mergeRange.endColumn) {
      return;
    }

    targetWorksheet.mergeCells(targetStart, mergeRange.startColumn, targetEnd, mergeRange.endColumn);
  });
};

const copyRowRange = (
  sourceData: MergeSheetData,
  targetWorksheet: ExcelJS.Worksheet,
  sourceStartRow: number,
  sourceEndRow: number,
  targetStartRow: number,
): number => {
  if (sourceStartRow > sourceEndRow || sourceStartRow < 1) {
    return targetStartRow;
  }

  for (let sourceRowNumber = sourceStartRow; sourceRowNumber <= sourceEndRow; sourceRowNumber += 1) {
    const sourceRow = sourceData.rows[sourceRowNumber - 1];
    const targetRowNumber = targetStartRow + sourceRowNumber - sourceStartRow;
    const targetRow = targetWorksheet.getRow(targetRowNumber);

    if (sourceRow) {
      if (sourceRow.height !== undefined) {
        targetRow.height = sourceRow.height;
      }
      if (sourceRow.hidden !== undefined) {
        targetRow.hidden = sourceRow.hidden;
      }
      if (sourceRow.outlineLevel !== undefined) {
        targetRow.outlineLevel = sourceRow.outlineLevel;
      }

      for (let columnNumber = 1; columnNumber <= sourceData.columnCount; columnNumber += 1) {
        copyCellSnapshot(sourceRow.cells[columnNumber - 1], targetRow.getCell(columnNumber));
      }
    }
  }

  copyMergeRanges(sourceData, targetWorksheet, sourceStartRow, sourceEndRow, targetStartRow);
  return targetStartRow + sourceEndRow - sourceStartRow + 1;
};

const createSingleSheetWorkbook = (
  sheetData: MergeSheetData[],
  fieldRow: number,
): { workbook: ExcelJS.Workbook; warning?: string } => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(SINGLE_SHEET_NAME);
  const firstSheet = sheetData[0];
  if (!firstSheet) {
    return { workbook };
  }

  copyColumnMetadata(firstSheet, worksheet);
  const shouldAppendAllTitles = hasHeaderMismatch(sheetData);
  let nextTargetRow = 1;

  sheetData.forEach((sourceData, index) => {
    const titleEndRow = Math.min(fieldRow, sourceData.rowCount);
    const shouldCopyTitle = shouldAppendAllTitles || index === 0;
    if (shouldCopyTitle && titleEndRow >= 1) {
      nextTargetRow = copyRowRange(sourceData, worksheet, 1, titleEndRow, nextTargetRow);
    }

    const dataStartRow = fieldRow + 1;
    if (sourceData.rowCount >= dataStartRow) {
      nextTargetRow = copyRowRange(sourceData, worksheet, dataStartRow, sourceData.rowCount, nextTargetRow);
    }
  });

  return shouldAppendAllTitles
    ? { workbook, warning: HEADER_MISMATCH_WARNING }
    : { workbook };
};

const replaceControlCharacters = (value: string): string => {
  return Array.from(value)
    .map((character) => character.charCodeAt(0) < 32 ? '_' : character)
    .join('');
};

const sanitizeSheetName = (value: string, fallback: string): string => {
  const sanitized = replaceControlCharacters(value.replace(ILLEGAL_SHEET_NAME_PATTERN, '_'))
    .trim()
    .replace(/^'+|'+$/g, '');

  return sanitized || fallback;
};

const createUniqueSheetName = (desiredName: string, usedNames: Set<string>): string => {
  const baseName = sanitizeSheetName(desiredName, 'Sheet');
  let index = 1;

  while (true) {
    const suffix = index === 1 ? '' : `_${index}`;
    const maxBaseLength = Math.max(XLSX_MAX_SHEET_NAME_LENGTH - suffix.length, 1);
    const candidate = `${baseName.slice(0, maxBaseLength)}${suffix}`;
    const normalizedCandidate = candidate.toLowerCase();
    if (!usedNames.has(normalizedCandidate)) {
      usedNames.add(normalizedCandidate);
      return candidate;
    }

    index += 1;
  }
};

const getSourceBaseName = (fileName: string): string => {
  return path.basename(fileName, path.extname(fileName));
};

const createMultiSheetWorkbook = (sheetData: MergeSheetData[]): ExcelJS.Workbook => {
  const workbook = new ExcelJS.Workbook();
  const usedSheetNames = new Set<string>();

  sheetData.forEach((sourceData) => {
    const sheetName = createUniqueSheetName(getSourceBaseName(sourceData.fileName), usedSheetNames);
    const worksheet = workbook.addWorksheet(sheetName);
    copyColumnMetadata(sourceData, worksheet);
    copyRowRange(sourceData, worksheet, 1, sourceData.rowCount, 1);
  });

  return workbook;
};

const writeWorkbookToOutput = async (
  workbook: ExcelJS.Workbook,
  input: StartMergeJobInput,
  context: MergeJobContext,
): Promise<string> => {
  const tempOutputPath = path.join(context.workspaceRoot, OUTPUT_FILE_NAME);
  await workbook.xlsx.writeFile(tempOutputPath);
  throwIfCanceled(context.abortSignal);

  await mkdir(input.outputDirectory, { recursive: true });
  const outputPath = await resolveUniqueOutputPath(input.outputDirectory, OUTPUT_FILE_NAME);
  throwIfCanceled(context.abortSignal);
  await copyFile(tempOutputPath, outputPath);
  return outputPath;
};

export const isMergeJobCanceledError = (error: unknown): boolean => {
  return error instanceof MergeJobCanceledError;
};

export const runMergeJob = async (
  input: StartMergeJobInput,
  emit: EmitJobEvent,
): Promise<MergeJobResult> => {
  const abortController = new AbortController();
  const jobId = crypto.randomUUID();
  const workspace = await createTempWorkspace(jobId);
  const context: MergeJobContext = {
    abortSignal: abortController.signal,
    fieldRow: input.fieldRow,
    workspaceRoot: workspace.rootPath,
  };
  const fileResults: MergeJobFileResult[] = [];
  const mergedSheetData: MergeSheetData[] = [];

  setActiveJobAbortController(abortController);
  emitProgress(emit, {
    currentFileIndex: 0,
    message: '准备合并',
    stage: 'processing',
    totalFiles: input.files.length,
  });

  try {
    for (const [fileIndex, fileInput] of input.files.entries()) {
      throwIfCanceled(abortController.signal);
      const sourcePath = getRegisteredFilePath(fileInput.sourceId);
      const fileName = sourcePath ? path.basename(sourcePath) : fileInput.sourceId;
      emitFileStatus(emit, fileInput.sourceId, 'processing');
      emitProgress(emit, {
        currentFileIndex: fileIndex + 1,
        currentFileName: fileName,
        message: '正在合并',
        stage: 'processing',
        totalFiles: input.files.length,
      });
      emitLog(emit, 'info', `正在合并 ${fileName}`);

      try {
        const sheetData = await processMergeFile(fileInput, context);
        mergedSheetData.push(sheetData);
        fileResults.push({
          fileName,
          sourceId: fileInput.sourceId,
          status: 'completed',
        });
        emitFileStatus(emit, fileInput.sourceId, 'completed');
        emitLog(emit, 'success', `${fileName} 已加入合并`);
      } catch (error) {
        if (error instanceof MergeJobCanceledError) {
          throw error;
        }

        const errorMessage = getUnknownErrorMessage(error);
        fileResults.push({
          error: errorMessage,
          fileName,
          sourceId: fileInput.sourceId,
          status: 'failed',
        });
        emitFileStatus(emit, fileInput.sourceId, 'failed');
        emitLog(emit, 'error', `${fileName} 合并失败：${errorMessage}`);
      }
    }

    if (mergedSheetData.length === 0) {
      throw new Error('没有可合并的文件');
    }

    const workbookResult = input.mode === 'single-sheet'
      ? createSingleSheetWorkbook(mergedSheetData, input.fieldRow)
      : { workbook: createMultiSheetWorkbook(mergedSheetData) };

    if (workbookResult.warning) {
      emitLog(emit, 'warning', workbookResult.warning);
    }

    throwIfCanceled(abortController.signal);
    emitProgress(emit, {
      currentFileIndex: input.files.length,
      message: '正在生成汇总文件',
      stage: 'saving',
      totalFiles: input.files.length,
    });
    const outputPath = await writeWorkbookToOutput(workbookResult.workbook, input, context);
    emitLog(emit, 'success', `合并完成，输出文件：${outputPath}`);
    emitProgress(emit, {
      currentFileIndex: input.files.length,
      message: '合并完成',
      stage: 'completed',
      totalFiles: input.files.length,
    });

    return {
      files: fileResults,
      outputDirectory: input.outputDirectory,
      outputPath,
      warning: workbookResult.warning,
    };
  } catch (error) {
    if (error instanceof MergeJobCanceledError) {
      emitProgress(emit, {
        currentFileIndex: 0,
        message: '用户已取消',
        stage: 'canceled',
        totalFiles: input.files.length,
      });
      emitLog(emit, 'warning', '用户已取消所有任务');
    }

    throw error;
  } finally {
    setActiveJobAbortController(null);
    await removeTempWorkspace(workspace);
  }
};
