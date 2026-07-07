import { dialog, ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/channels';
import { registerFolder, registerSelectedFiles } from '../services/file-selection/file-registry';

export const setupDialogHandlers = (): void => {
  ipcMain.handle(IPC_CHANNELS.DIALOG.SELECT_EXCEL_FILES, async () => {
    const result = await dialog.showOpenDialog({
      title: '选择文件',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Excel 文件',
          extensions: ['xls', 'xlsx', 'et'],
        },
      ],
    });

    if (result.canceled) {
      return { success: true, data: [] };
    }

    const files = await registerSelectedFiles(result.filePaths);
    return { success: true, data: files };
  });

  ipcMain.handle(IPC_CHANNELS.DIALOG.SELECT_AUDIO_FILES, async () => {
    const result = await dialog.showOpenDialog({
      title: '选择音频文件',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: '音频文件',
          extensions: ['wav', 'mp3', 'm4a', 'flac'],
        },
      ],
    });

    if (result.canceled) {
      return { success: true, data: [] };
    }

    const files = await registerSelectedFiles(result.filePaths);
    return { success: true, data: files };
  });

  ipcMain.handle(IPC_CHANNELS.DIALOG.SELECT_FOLDER, async () => {
    const result = await dialog.showOpenDialog({
      title: '选择文件夹',
      properties: ['openDirectory'],
    });

    if (result.canceled) {
      return { success: true, data: undefined };
    }

    const selectedPath = result.filePaths[0];
    if (!selectedPath) {
      return { success: true, data: undefined };
    }

    const folder = await registerFolder(selectedPath);
    return { success: true, data: folder };
  });

  ipcMain.handle(IPC_CHANNELS.DIALOG.SELECT_OUTPUT_DIRECTORY, async () => {
    const result = await dialog.showOpenDialog({
      title: '保存至',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled) {
      return { success: true, data: undefined };
    }

    const selectedPath = result.filePaths[0];
    return { success: true, data: selectedPath };
  });
};

