import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { APP_CONFIG } from '../../../shared/constants/config';
import type { MergeFolderScanFailure, ParseMergeFolderResult } from '../../../shared/types/excel';
import { getRegisteredFolderPath, registerSelectedFiles } from '../file-selection/file-registry';
import { parseSplitDocumentMetadata } from './split-metadata';

const supportedExtensions = new Set<string>(APP_CONFIG.SUPPORTED_EXCEL_EXTENSIONS);

const isSupportedExcelPath = (filePath: string): boolean => {
  const extension = path.extname(filePath).replace('.', '').toLowerCase();
  return supportedExtensions.has(extension);
};

const collectExcelFilePaths = async (folderPath: string): Promise<string[]> => {
  const entries = await readdir(folderPath, { withFileTypes: true });
  const sortedEntries = [...entries].sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'));
  const filePaths: string[] = [];

  for (const entry of sortedEntries) {
    const entryPath = path.join(folderPath, entry.name);

    if (entry.isDirectory()) {
      filePaths.push(...await collectExcelFilePaths(entryPath));
      continue;
    }

    if (entry.isFile() && isSupportedExcelPath(entryPath)) {
      filePaths.push(entryPath);
    }
  }

  return filePaths;
};

const createExcludedFailure = (filePath: string, reason: string): MergeFolderScanFailure => {
  return {
    fileName: path.basename(filePath),
    reason,
  };
};

export const parseMergeFolder = async (folderSourceId: string): Promise<ParseMergeFolderResult> => {
  const folderPath = getRegisteredFolderPath(folderSourceId);
  if (!folderPath) {
    throw new Error('找不到已选择文件夹，请重新选择文件夹');
  }

  const excelFilePaths = await collectExcelFilePaths(folderPath);
  const eligibleFilePaths: string[] = [];
  const excludedFiles: MergeFolderScanFailure[] = [];

  for (const filePath of excelFilePaths) {
    const fileStats = await stat(filePath);
    if (fileStats.size > APP_CONFIG.LIMITS.MAX_FILE_SIZE_BYTES) {
      excludedFiles.push(createExcludedFailure(filePath, '超过 10 MB，已排除'));
      continue;
    }

    eligibleFilePaths.push(filePath);
  }

  const selectedFilePaths = eligibleFilePaths.slice(0, APP_CONFIG.LIMITS.MAX_FILES);
  eligibleFilePaths.slice(APP_CONFIG.LIMITS.MAX_FILES).forEach((filePath) => {
    excludedFiles.push(createExcludedFailure(
      filePath,
      `超过最多 ${APP_CONFIG.LIMITS.MAX_FILES} 个文件限制，已排除`,
    ));
  });

  const registeredFiles = await registerSelectedFiles(selectedFilePaths);
  const metadata = registeredFiles.length > 0
    ? await parseSplitDocumentMetadata(registeredFiles.map((file) => file.sourceId))
    : { failures: [], workbooks: [] };
  const parsedSourceIds = new Set(metadata.workbooks.map((workbook) => workbook.sourceId));

  return {
    excludedFiles,
    failures: metadata.failures,
    files: registeredFiles.filter((file) => parsedSourceIds.has(file.sourceId)),
    workbooks: metadata.workbooks,
  };
};
