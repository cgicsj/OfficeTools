import { setupDialogHandlers } from './dialog.handler';
import { setupJobHandlers } from './job.handler';
import { setupPathHandlers } from './path.handler';

export const registerIpcHandlers = (): void => {
  setupDialogHandlers();
  setupPathHandlers();
  setupJobHandlers();
};

