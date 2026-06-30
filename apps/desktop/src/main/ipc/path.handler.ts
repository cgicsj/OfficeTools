import { app, ipcMain, shell } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/channels';
import { openDirectoryInputSchema } from '../../shared/types/paths';
import { setLastOutputDirectoryInputSchema } from '../../shared/types/preferences';
import { getLastOutputDirectory, setLastOutputDirectory } from '../services/preferences/preferences';

export const setupPathHandlers = (): void => {
  ipcMain.handle(IPC_CHANNELS.PATHS.GET_DEFAULT_OUTPUT_DIRECTORY, () => {
    return { success: true, data: app.getPath('downloads') };
  });

  ipcMain.handle(IPC_CHANNELS.PATHS.GET_LAST_OUTPUT_DIRECTORY, async () => {
    const directory = await getLastOutputDirectory();
    return { success: true, data: directory };
  });

  ipcMain.handle(IPC_CHANNELS.PATHS.OPEN_DIRECTORY, async (_event, input: unknown) => {
    const parsedInput = openDirectoryInputSchema.safeParse(input);
    if (parsedInput.success === false) {
      return {
        success: false,
        error: 'Invalid directory input',
        code: 'INVALID_DIRECTORY_INPUT',
      };
    }

    const openError = await shell.openPath(parsedInput.data.directory);
    if (openError) {
      return {
        success: false,
        error: openError,
        code: 'OPEN_DIRECTORY_FAILED',
      };
    }

    return { success: true, data: undefined };
  });

  ipcMain.handle(IPC_CHANNELS.PATHS.SET_LAST_OUTPUT_DIRECTORY, async (_event, input: unknown) => {
    const parsedInput = setLastOutputDirectoryInputSchema.safeParse(input);
    if (parsedInput.success === false) {
      return {
        success: false,
        error: 'Invalid output directory input',
        code: 'INVALID_OUTPUT_DIRECTORY_INPUT',
      };
    }

    await setLastOutputDirectory(parsedInput.data.directory);
    return { success: true, data: undefined };
  });
};

