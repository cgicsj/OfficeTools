import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/channels';
import { cancelActiveJob, requestSkipCurrentFile } from '../services/jobs/job-cancellation';

export const setupJobHandlers = (): void => {
  ipcMain.handle(IPC_CHANNELS.JOB.CANCEL_ACTIVE, () => {
    cancelActiveJob();
    return { success: true, data: undefined };
  });

  ipcMain.handle(IPC_CHANNELS.JOB.SKIP_CURRENT_FILE, () => {
    const accepted = requestSkipCurrentFile();
    if (!accepted) {
      return {
        success: false,
        error: '当前没有正在处理的文件',
        code: 'NO_ACTIVE_JOB',
      };
    }

    return { success: true, data: undefined };
  });
};
