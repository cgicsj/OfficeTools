import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/channels';
import { cancelActiveJob } from '../services/jobs/job-cancellation';

export const setupJobHandlers = (): void => {
  ipcMain.handle(IPC_CHANNELS.JOB.CANCEL_ACTIVE, () => {
    cancelActiveJob();
    return { success: true, data: undefined };
  });
};

