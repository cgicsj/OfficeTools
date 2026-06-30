import { app } from 'electron';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

export type TempWorkspace = {
  jobId: string;
  rootPath: string;
};

export const createTempWorkspace = async (jobId: string): Promise<TempWorkspace> => {
  const rootPath = path.join(app.getPath('userData'), 'cache', 'jobs', jobId);
  await mkdir(rootPath, { recursive: true });
  return { jobId, rootPath };
};

export const removeTempWorkspace = async (workspace: TempWorkspace): Promise<void> => {
  await rm(workspace.rootPath, { recursive: true, force: true });
};

