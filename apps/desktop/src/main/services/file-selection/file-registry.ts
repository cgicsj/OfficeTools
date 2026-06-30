import crypto from 'node:crypto';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import type { SelectedFile, SelectedFolder } from '../../../shared/types/files';

const fileRegistry = new Map<string, string>();
const folderRegistry = new Map<string, string>();

const getExtension = (filePath: string): string => {
  return path.extname(filePath).replace('.', '').toLowerCase();
};

export const registerSelectedFiles = async (filePaths: string[]): Promise<SelectedFile[]> => {
  const files: SelectedFile[] = [];

  for (const filePath of filePaths) {
    const fileStats = await stat(filePath);
    const sourceId = crypto.randomUUID();
    fileRegistry.set(sourceId, filePath);
    files.push({
      sourceId,
      name: path.basename(filePath),
      extension: getExtension(filePath),
      sizeBytes: fileStats.size,
      displayPath: filePath,
    });
  }

  return files;
};

export const registerFolder = async (folderPath: string): Promise<SelectedFolder> => {
  const sourceId = crypto.randomUUID();
  folderRegistry.set(sourceId, folderPath);

  return {
    sourceId,
    name: path.basename(folderPath),
  };
};

export const getRegisteredFilePath = (sourceId: string): string | undefined => {
  return fileRegistry.get(sourceId);
};

export const getRegisteredFolderPath = (sourceId: string): string | undefined => {
  return folderRegistry.get(sourceId);
};

