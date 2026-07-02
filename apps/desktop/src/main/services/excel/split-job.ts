import * as nodeFs from 'node:fs';
import crypto from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import * as cpexcel from 'xlsx/dist/cpexcel.full.mjs';
import { APP_CONFIG } from '../../../shared/constants/config';
import type {
  SplitJobFileResult,
  SplitJobResult,
  StartSplitJobFileInput,
  StartSplitJobInput,
} from '../../../shared/types/excel';
import type { JobEvent, JobProgress, LogEntry, WorkflowTab } from '../../../shared/types/jobs';
import { readExcelJsCellText } from './cell-text';
import { assertNoUnsupportedObjectsInDirectWorkbook } from './legacy-object-detector';
import { getRegisteredFilePath } from '../file-selection/file-registry';
import {
  consumeSkipCurrentFileRequest,
  isSkipCurrentFileRequested,
  setActiveJobAbortController,
} from '../jobs/job-cancellation';
import { createTempWorkspace, removeTempWorkspace } from '../workspace/temp-workspace';

XLSX.set_fs(nodeFs);
XLSX.set_cptable(cpexcel);

const SPLIT_TAB: WorkflowTab = 'split';
const ZIP_SIGNATURE = '504b';
const CFB_SIGNATURE = 'd0cf11e0a1b11ae1';
const OUTPUT_ZIP_NAME = '总拆分结果.zip';
const EMPTY_SPLIT_VALUE_LABEL = '空值';
const OBJECT_RELATIONSHIP_MARKERS = ['drawing', 'vmlDrawing', 'oleObject', 'ctrlProp'];
const XLSX_MAX_SHEET_NAME_LENGTH = 31;
const ILLEGAL_FILE_NAME_CHARS = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*']);

type EmitJobEvent = (event: JobEvent) => void;

type SplitJobContext = {
  abortSignal: AbortSignal;
  emit: EmitJobEvent;
  workspaceRoot: string;
};

type SplitOutputFile = {
  fileName: string;
  filePath: string;
  folderName: string;
};

type ProcessedFile = {
  result: SplitJobFileResult;
  outputFiles: SplitOutputFile[];
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

class SplitJobCanceledError extends Error {
  constructor() {
    super('用户已取消');
    this.name = 'SplitJobCanceledError';
  }
}

class SplitFileSkippedError extends Error {
  constructor() {
    super('用户已跳过当前文件');
    this.name = 'SplitFileSkippedError';
  }
}

const createLogEntry = (level: LogEntry['level'], message: string): LogEntry => {
  return {
    id: crypto.randomUUID(),
    level,
    message,
    tab: SPLIT_TAB,
    timestampMs: Date.now(),
  };
};

const emitLog = (emit: EmitJobEvent, level: LogEntry['level'], message: string): void => {
  emit({ type: 'log', entry: createLogEntry(level, message) });
};

const emitProgress = (emit: EmitJobEvent, progress: JobProgress): void => {
  emit({ type: 'progress', tab: SPLIT_TAB, progress });
};

const emitFileStatus = (
  emit: EmitJobEvent,
  sourceId: string,
  status: SplitJobFileResult['status'] | 'processing',
): void => {
  emit({ type: 'file-status', tab: SPLIT_TAB, sourceId, status });
};

const throwIfCanceled = (abortSignal: AbortSignal): void => {
  if (abortSignal.aborted) {
    throw new SplitJobCanceledError();
  }
};

const throwIfInterrupted = (context: SplitJobContext): void => {
  throwIfCanceled(context.abortSignal);
  if (consumeSkipCurrentFileRequest()) {
    throw new SplitFileSkippedError();
  }
};

const getUnknownErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return '拆分失败';
};

const getBaseName = (filePath: string): string => {
  const extension = path.extname(filePath);
  return path.basename(filePath, extension);
};

const sanitizeFileNamePart = (value: string, fallback: string): string => {
  const sanitized = Array.from(value)
    .map((character) => {
      return character.charCodeAt(0) < 32 || ILLEGAL_FILE_NAME_CHARS.has(character) ? '_' : character;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');

  return sanitized || fallback;
};


const createUniqueName = (desiredName: string, usedNames: Set<string>, extension = ''): string => {
  let index = 1;
  let candidate = `${desiredName}${extension}`;

  while (usedNames.has(candidate.toLowerCase())) {
    index += 1;
    candidate = `${desiredName}_${index}${extension}`;
  }

  usedNames.add(candidate.toLowerCase());
  return candidate;
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

const hasWorkbookContainerSignature = async (filePath: string): Promise<boolean> => {
  const handle = await readFile(filePath);
  const signature = handle.subarray(0, 8).toString('hex').toLowerCase();
  return signature.startsWith(ZIP_SIGNATURE) || signature === CFB_SIGNATURE;
};

const readCellText = readExcelJsCellText;

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

const getWorksheetMerges = (worksheet: ExcelJS.Worksheet): string[] => {
  const model = (worksheet as ExcelJsWorksheetWithModel).model;
  return Array.isArray(model.merges) ? model.merges : [];
};

const isRangeInsideTitleArea = (rangeAddress: string, fieldRow: number): boolean => {
  const range = XLSX.utils.decode_range(rangeAddress);
  return range.s.r < fieldRow && range.e.r < fieldRow;
};

const copyExcelJsColumns = (
  sourceWorksheet: ExcelJS.Worksheet,
  targetWorksheet: ExcelJS.Worksheet,
  columnCount: number,
): void => {
  for (let columnNumber = 1; columnNumber <= columnCount; columnNumber += 1) {
    const sourceColumn = sourceWorksheet.getColumn(columnNumber);
    const targetColumn = targetWorksheet.getColumn(columnNumber);
    targetColumn.width = sourceColumn.width;
    targetColumn.hidden = sourceColumn.hidden;
    targetColumn.outlineLevel = sourceColumn.outlineLevel;
    targetColumn.style = { ...sourceColumn.style };
  }
};

const copyExcelJsRow = (
  sourceWorksheet: ExcelJS.Worksheet,
  targetWorksheet: ExcelJS.Worksheet,
  sourceRowNumber: number,
  targetRowNumber: number,
  columnCount: number,
): void => {
  const sourceRow = sourceWorksheet.getRow(sourceRowNumber);
  const targetRow = targetWorksheet.getRow(targetRowNumber);
  targetRow.height = sourceRow.height;
  targetRow.hidden = sourceRow.hidden;
  targetRow.outlineLevel = sourceRow.outlineLevel;
  for (let columnNumber = 1; columnNumber <= columnCount; columnNumber += 1) {
    const sourceCell = sourceRow.getCell(columnNumber);
    const targetCell = targetRow.getCell(columnNumber);
    targetCell.value = getExcelJsOutputCellValue(sourceCell);
    targetCell.style = { ...sourceCell.style };
    targetCell.numFmt = sourceCell.numFmt;
    targetCell.alignment = sourceCell.alignment;
    targetCell.border = sourceCell.border;
    targetCell.fill = sourceCell.fill;
    targetCell.font = sourceCell.font;
    targetCell.protection = sourceCell.protection;
  }

  targetRow.commit();
};

const createSafeSheetName = (sheetName: string): string => {
  return sanitizeFileNamePart(sheetName.replace(/[\\/*?:[\]]/g, '_'), 'Sheet1').slice(
    0,
    XLSX_MAX_SHEET_NAME_LENGTH,
  );
};

const isExcelJsRowEmpty = (
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  columnCount: number,
): boolean => {
  const row = worksheet.getRow(rowNumber);
  for (let columnNumber = 1; columnNumber <= columnCount; columnNumber += 1) {
    if (readCellText(row.getCell(columnNumber)).trim() !== '') {
      return false;
    }
  }

  return true;
};

const createOutputFileName = (
  sourceBaseName: string,
  splitValue: string,
  usedNames: Set<string>,
): string => {
  const valuePart = splitValue === '' ? EMPTY_SPLIT_VALUE_LABEL : splitValue;
  const safeValue = sanitizeFileNamePart(valuePart, EMPTY_SPLIT_VALUE_LABEL);
  const safeBaseName = sanitizeFileNamePart(sourceBaseName, '源文件');
  return createUniqueName(`${safeBaseName}_${safeValue}`, usedNames, '.xlsx');
};

const ensureGroupLimit = (groupCount: number): void => {
  if (groupCount > APP_CONFIG.LIMITS.MAX_SPLIT_OUTPUT_FILES) {
    throw new Error(`拆分结果超过 ${APP_CONFIG.LIMITS.MAX_SPLIT_OUTPUT_FILES} 个文件，请缩小拆分范围`);
  }
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

const writeExcelJsGroupWorkbook = async (
  sourceWorksheet: ExcelJS.Worksheet,
  input: StartSplitJobFileInput,
  rowNumbers: number[],
  outputPath: string,
): Promise<void> => {
  const outputWorkbook = new ExcelJS.Workbook();
  const outputWorksheet = outputWorkbook.addWorksheet(createSafeSheetName(sourceWorksheet.name));
  const columnCount = Math.max(sourceWorksheet.columnCount, 1);

  copyExcelJsColumns(sourceWorksheet, outputWorksheet, columnCount);

  for (let sourceRowNumber = 1; sourceRowNumber <= input.fieldRow; sourceRowNumber += 1) {
    copyExcelJsRow(sourceWorksheet, outputWorksheet, sourceRowNumber, sourceRowNumber, columnCount);
  }

  rowNumbers.forEach((sourceRowNumber, index) => {
    copyExcelJsRow(sourceWorksheet, outputWorksheet, sourceRowNumber, input.fieldRow + index + 1, columnCount);
  });

  getWorksheetMerges(sourceWorksheet).forEach((mergeAddress) => {
    if (isRangeInsideTitleArea(mergeAddress, input.fieldRow)) {
      outputWorksheet.mergeCells(mergeAddress);
    }
  });

  await outputWorkbook.xlsx.writeFile(outputPath);
};

const processXlsxFile = async (
  sourcePath: string,
  input: StartSplitJobFileInput,
  context: SplitJobContext,
): Promise<SplitOutputFile[]> => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(sourcePath);
  throwIfInterrupted(context);

  const worksheet = workbook.worksheets.find((candidate) => candidate.name === input.sheetName);
  if (!worksheet) {
    throw new Error(`找不到 sheet：${input.sheetName}`);
  }

  const sheetIndex = workbook.worksheets.findIndex((candidate) => candidate.name === worksheet.name);
  const hasObjects = await detectSelectedSheetObjects(sourcePath, sheetIndex);
  if (hasObjects) {
    throw new Error('所选 sheet 含有图片、图表或其他嵌入对象，暂不支持拆分');
  }

  const columnCount = Math.max(worksheet.columnCount, input.splitColumn);
  const groups = new Map<string, number[]>();

  for (let rowNumber = input.fieldRow + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    throwIfInterrupted(context);
    if (isExcelJsRowEmpty(worksheet, rowNumber, columnCount)) {
      continue;
    }

    const splitText = readCellText(worksheet.getRow(rowNumber).getCell(input.splitColumn)).trim();
    const rowNumbers = groups.get(splitText) ?? [];
    rowNumbers.push(rowNumber);
    groups.set(splitText, rowNumbers);
    ensureGroupLimit(groups.size);
  }

  if (groups.size === 0) {
    return [];
  }

  const sourceBaseName = getBaseName(sourcePath);
  const outputFolderName = sanitizeFileNamePart(sourceBaseName, '源文件');
  const outputFolderPath = path.join(context.workspaceRoot, input.sourceId);
  await mkdir(outputFolderPath, { recursive: true });

  const outputFiles: SplitOutputFile[] = [];
  const usedFileNames = new Set<string>();
  for (const [splitValue, rowNumbers] of groups) {
    throwIfInterrupted(context);
    const fileName = createOutputFileName(sourceBaseName, splitValue, usedFileNames);
    const filePath = path.join(outputFolderPath, fileName);
    await writeExcelJsGroupWorkbook(worksheet, input, rowNumbers, filePath);
    outputFiles.push({ fileName, filePath, folderName: outputFolderName });
  }

  return outputFiles;
};

const readSheetJsCellText = (worksheet: XLSX.WorkSheet, rowIndex: number, columnIndex: number): string => {
  const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
  const cell = worksheet[address] as XLSX.CellObject | undefined;
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

const isSheetJsRowEmpty = (worksheet: XLSX.WorkSheet, rowIndex: number, columnCount: number): boolean => {
  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    if (readSheetJsCellText(worksheet, rowIndex, columnIndex).trim() !== '') {
      return false;
    }
  }

  return true;
};

const copySheetJsCell = (cell: XLSX.CellObject): XLSX.CellObject => {
  const copiedCell: SheetJsFormulaCell = { ...cell };
  if (copiedCell.f && copiedCell.v === undefined) {
    throw new Error('公式缺少已保存的计算结果，请在 WPS 中重新计算并保存后重试');
  }

  delete copiedCell.f;
  delete copiedCell.F;
  return copiedCell;
};

const copySheetJsRows = (
  sourceWorksheet: XLSX.WorkSheet,
  targetWorksheet: XLSX.WorkSheet,
  rowMappings: Array<{ sourceRowIndex: number; targetRowIndex: number }>,
  columnCount: number,
): void => {
  rowMappings.forEach(({ sourceRowIndex, targetRowIndex }) => {
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const sourceAddress = XLSX.utils.encode_cell({ r: sourceRowIndex, c: columnIndex });
      const sourceCell = sourceWorksheet[sourceAddress] as XLSX.CellObject | undefined;
      if (!sourceCell) {
        continue;
      }

      const targetAddress = XLSX.utils.encode_cell({ r: targetRowIndex, c: columnIndex });
      targetWorksheet[targetAddress] = copySheetJsCell(sourceCell);
    }
  });
};

const copySheetJsRowMetadata = (
  sourceWorksheet: XLSX.WorkSheet,
  targetWorksheet: XLSX.WorkSheet,
  rowMappings: Array<{ sourceRowIndex: number; targetRowIndex: number }>,
): void => {
  const sourceRows = sourceWorksheet['!rows'];
  if (!sourceRows) {
    return;
  }

  const targetRows: XLSX.RowInfo[] = [];
  rowMappings.forEach(({ sourceRowIndex, targetRowIndex }) => {
    const sourceRow = sourceRows[sourceRowIndex];
    if (sourceRow) {
      targetRows[targetRowIndex] = { ...sourceRow };
    }
  });
  targetWorksheet['!rows'] = targetRows;
};

const copySheetJsColumnMetadata = (
  sourceWorksheet: XLSX.WorkSheet,
  targetWorksheet: XLSX.WorkSheet,
  columnCount: number,
): void => {
  const sourceColumns = sourceWorksheet['!cols'];
  if (!sourceColumns) {
    return;
  }

  targetWorksheet['!cols'] = sourceColumns.slice(0, columnCount).map((column) => {
    return column ? { ...column } : column;
  });
};

const copySheetJsTitleMerges = (
  sourceWorksheet: XLSX.WorkSheet,
  targetWorksheet: XLSX.WorkSheet,
  fieldRow: number,
): void => {
  const sourceMerges = sourceWorksheet['!merges'];
  if (!sourceMerges) {
    return;
  }

  targetWorksheet['!merges'] = sourceMerges
    .filter((mergeRange) => mergeRange.s.r < fieldRow && mergeRange.e.r < fieldRow)
    .map((mergeRange) => ({
      e: { ...mergeRange.e },
      s: { ...mergeRange.s },
    }));
};

const writeSheetJsGroupWorkbook = (
  sourceWorksheet: XLSX.WorkSheet,
  sheetName: string,
  input: StartSplitJobFileInput,
  rowIndexes: number[],
  columnCount: number,
  outputPath: string,
): void => {
  const targetWorksheet: XLSX.WorkSheet = {};
  const rowMappings: Array<{ sourceRowIndex: number; targetRowIndex: number }> = [];

  for (let sourceRowIndex = 0; sourceRowIndex < input.fieldRow; sourceRowIndex += 1) {
    rowMappings.push({ sourceRowIndex, targetRowIndex: sourceRowIndex });
  }

  rowIndexes.forEach((sourceRowIndex, index) => {
    rowMappings.push({ sourceRowIndex, targetRowIndex: input.fieldRow + index });
  });

  copySheetJsRows(sourceWorksheet, targetWorksheet, rowMappings, columnCount);
  copySheetJsRowMetadata(sourceWorksheet, targetWorksheet, rowMappings);
  copySheetJsColumnMetadata(sourceWorksheet, targetWorksheet, columnCount);
  copySheetJsTitleMerges(sourceWorksheet, targetWorksheet, input.fieldRow);

  const rowCount = input.fieldRow + rowIndexes.length;
  targetWorksheet['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(rowCount - 1, 0), c: Math.max(columnCount - 1, 0) },
  });

  const targetWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(targetWorkbook, targetWorksheet, createSafeSheetName(sheetName));
  XLSX.writeFile(targetWorkbook, outputPath, { bookType: 'xlsx', cellStyles: true });
};

const processSheetJsFile = async (
  sourcePath: string,
  input: StartSplitJobFileInput,
  context: SplitJobContext,
  formatLabel: string,
): Promise<SplitOutputFile[]> => {
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
  throwIfInterrupted(context);

  const worksheet = workbook.Sheets[input.sheetName];
  if (!worksheet) {
    throw new Error(`找不到 sheet：${input.sheetName}`);
  }

  await assertNoUnsupportedObjectsInDirectWorkbook(sourcePath, input.sheetName, workbook.SheetNames);
  throwIfInterrupted(context);

  const reference = worksheet['!ref'];
  if (!reference) {
    return [];
  }

  const range = XLSX.utils.decode_range(reference);
  const columnCount = Math.max(range.e.c + 1, input.splitColumn);
  const groups = new Map<string, number[]>();

  for (let rowIndex = input.fieldRow; rowIndex <= range.e.r; rowIndex += 1) {
    throwIfInterrupted(context);
    if (isSheetJsRowEmpty(worksheet, rowIndex, columnCount)) {
      continue;
    }

    const splitText = readSheetJsCellText(worksheet, rowIndex, input.splitColumn - 1).trim();
    const rowIndexes = groups.get(splitText) ?? [];
    rowIndexes.push(rowIndex);
    groups.set(splitText, rowIndexes);
    ensureGroupLimit(groups.size);
  }

  if (groups.size === 0) {
    return [];
  }

  const sourceBaseName = getBaseName(sourcePath);
  const outputFolderName = sanitizeFileNamePart(sourceBaseName, '源文件');
  const outputFolderPath = path.join(context.workspaceRoot, input.sourceId);
  await mkdir(outputFolderPath, { recursive: true });

  const outputFiles: SplitOutputFile[] = [];
  const usedFileNames = new Set<string>();
  for (const [splitValue, rowIndexes] of groups) {
    throwIfInterrupted(context);
    const fileName = createOutputFileName(sourceBaseName, splitValue, usedFileNames);
    const filePath = path.join(outputFolderPath, fileName);
    writeSheetJsGroupWorkbook(worksheet, input.sheetName, input, rowIndexes, columnCount, filePath);
    outputFiles.push({ fileName, filePath, folderName: outputFolderName });
  }

  return outputFiles;
};

const processSingleFile = async (
  input: StartSplitJobFileInput,
  context: SplitJobContext,
): Promise<ProcessedFile> => {
  const sourcePath = getRegisteredFilePath(input.sourceId);
  if (!sourcePath) {
    throw new Error('找不到已选择文件，请重新选择文件');
  }

  const extension = path.extname(sourcePath).toLowerCase();
  let outputFiles: SplitOutputFile[];
  if (extension === '.xlsx') {
    outputFiles = await processXlsxFile(sourcePath, input, context);
  } else if (extension === '.xls') {
    outputFiles = await processSheetJsFile(sourcePath, input, context, 'XLS');
  } else if (extension === '.et') {
    outputFiles = await processSheetJsFile(sourcePath, input, context, 'ET');
  } else {
    throw new Error('不支持的文件格式');
  }

  const fileName = path.basename(sourcePath);
  if (outputFiles.length === 0) {
    return {
      outputFiles,
      result: {
        fileName,
        outputCount: 0,
        sourceId: input.sourceId,
        status: 'skipped',
        error: '没有可拆分的数据行',
      },
    };
  }

  return {
    outputFiles,
    result: {
      fileName,
      outputCount: outputFiles.length,
      sourceId: input.sourceId,
      status: 'completed',
    },
  };
};

const createResultZip = async (
  outputDirectory: string,
  outputFiles: SplitOutputFile[],
): Promise<string> => {
  await mkdir(outputDirectory, { recursive: true });
  const outputPath = await resolveUniqueOutputPath(outputDirectory, OUTPUT_ZIP_NAME);
  const zip = new JSZip();
  const usedFolderNames = new Set<string>();
  const folderNameMap = new Map<string, string>();

  for (const outputFile of outputFiles) {
    const folderKey = path.dirname(outputFile.filePath);
    const mappedFolderName = folderNameMap.get(folderKey);
    const folderName = mappedFolderName ?? createUniqueName(outputFile.folderName, usedFolderNames);
    folderNameMap.set(folderKey, folderName);
    const fileBuffer = await readFile(outputFile.filePath);
    zip.file(`${folderName}/${outputFile.fileName}`, fileBuffer);
  }

  const zipBuffer = await zip.generateAsync({ compression: 'DEFLATE', type: 'nodebuffer' });
  await writeFile(outputPath, zipBuffer);
  return outputPath;
};

export const isSplitJobCanceledError = (error: unknown): boolean => {
  return error instanceof SplitJobCanceledError;
};

export const runSplitJob = async (
  input: StartSplitJobInput,
  emit: EmitJobEvent,
): Promise<SplitJobResult> => {
  const abortController = new AbortController();
  const jobId = crypto.randomUUID();
  const workspace = await createTempWorkspace(jobId);
  const context: SplitJobContext = {
    abortSignal: abortController.signal,
    emit,
    workspaceRoot: workspace.rootPath,
  };
  const fileResults: SplitJobFileResult[] = [];
  const allOutputFiles: SplitOutputFile[] = [];

  setActiveJobAbortController(abortController);
  emitProgress(emit, {
    currentFileIndex: 0,
    message: '准备拆分',
    stage: 'processing',
    totalFiles: input.files.length,
  });

  try {
    for (const [fileIndex, fileInput] of input.files.entries()) {
      throwIfCanceled(abortController.signal);
      consumeSkipCurrentFileRequest();

      const sourcePath = getRegisteredFilePath(fileInput.sourceId);
      const fileName = sourcePath ? path.basename(sourcePath) : fileInput.sourceId;
      emitFileStatus(emit, fileInput.sourceId, 'processing');
      emitProgress(emit, {
        currentFileIndex: fileIndex + 1,
        currentFileName: fileName,
        message: '正在拆分',
        stage: 'processing',
        totalFiles: input.files.length,
      });
      emitLog(emit, 'info', `正在拆分 ${fileName}`);

      try {
        const processedFile = await processSingleFile(fileInput, context);
        fileResults.push(processedFile.result);
        allOutputFiles.push(...processedFile.outputFiles);

        if (processedFile.result.status === 'completed') {
          emitFileStatus(emit, fileInput.sourceId, 'completed');
          emitLog(emit, 'success', `${fileName} 已生成 ${processedFile.result.outputCount} 个拆分文件`);
        } else {
          emitFileStatus(emit, fileInput.sourceId, 'skipped');
          emitLog(emit, 'warning', `${fileName} 已跳过：${processedFile.result.error ?? '没有可拆分的数据行'}`);
        }
      } catch (error) {
        if (error instanceof SplitFileSkippedError || isSkipCurrentFileRequested()) {
          consumeSkipCurrentFileRequest();
          fileResults.push({
            error: '用户已跳过当前文件',
            fileName,
            outputCount: 0,
            sourceId: fileInput.sourceId,
            status: 'skipped',
          });
          emitFileStatus(emit, fileInput.sourceId, 'skipped');
          emitLog(emit, 'warning', `已跳过当前文件 ${fileName}`);
          continue;
        }

        if (error instanceof SplitJobCanceledError) {
          throw error;
        }

        const errorMessage = getUnknownErrorMessage(error);
        fileResults.push({
          error: errorMessage,
          fileName,
          outputCount: 0,
          sourceId: fileInput.sourceId,
          status: 'failed',
        });
        emitFileStatus(emit, fileInput.sourceId, 'failed');
        emitLog(emit, 'error', `${fileName} 拆分失败：${errorMessage}`);
      }
    }

    if (allOutputFiles.length === 0) {
      throw new Error('没有生成任何拆分结果');
    }

    throwIfCanceled(abortController.signal);
    emitProgress(emit, {
      currentFileIndex: input.files.length,
      message: '正在生成压缩包',
      stage: 'saving',
      totalFiles: input.files.length,
    });
    const outputPath = await createResultZip(input.outputDirectory, allOutputFiles);
    emitLog(emit, 'success', `拆分完成，输出文件：${outputPath}`);
    emitProgress(emit, {
      currentFileIndex: input.files.length,
      message: '拆分完成',
      stage: 'completed',
      totalFiles: input.files.length,
    });

    return {
      files: fileResults,
      outputDirectory: input.outputDirectory,
      outputPath,
    };
  } catch (error) {
    if (error instanceof SplitJobCanceledError) {
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
