import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/channels';
import { parseSplitDocumentsInputSchema } from '../../shared/types/excel';
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
};
