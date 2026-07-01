import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/channels';
import { parseSplitDocumentsInputSchema, startSplitJobInputSchema } from '../../shared/types/excel';
import { runSplitJob, isSplitJobCanceledError } from '../services/excel/split-job';
import { parseSplitDocumentMetadata } from '../services/excel/split-metadata';

export const setupExcelHandlers = (): void => {
  ipcMain.handle(IPC_CHANNELS.EXCEL.PARSE_SPLIT_DOCUMENTS, async (_event, input: unknown) => {
    const parsedInput = parseSplitDocumentsInputSchema.safeParse(input);
    if (parsedInput.success === false) {
      return {
        success: false,
        error: 'Invalid split document parse input',
        code: 'INVALID_SPLIT_PARSE_INPUT',
      };
    }

    const result = await parseSplitDocumentMetadata(parsedInput.data.sourceIds);
    return { success: true, data: result };
  });

  ipcMain.handle(IPC_CHANNELS.EXCEL.START_SPLIT_JOB, async (event, input: unknown) => {
    const parsedInput = startSplitJobInputSchema.safeParse(input);
    if (parsedInput.success === false) {
      return {
        success: false,
        error: 'Invalid split job input',
        code: 'INVALID_SPLIT_JOB_INPUT',
      };
    }

    try {
      const result = await runSplitJob(parsedInput.data, (jobEvent) => {
        event.sender.send(IPC_CHANNELS.JOB.EVENT, jobEvent);
      });
      return { success: true, data: result };
    } catch (error) {
      if (isSplitJobCanceledError(error)) {
        return {
          success: false,
          error: '用户已取消',
          code: 'JOB_CANCELED',
        };
      }

      if (error instanceof Error && error.message) {
        return {
          success: false,
          error: error.message,
          code: 'SPLIT_JOB_FAILED',
        };
      }

      return {
        success: false,
        error: '拆分任务失败',
        code: 'SPLIT_JOB_FAILED',
      };
    }
  });
};
