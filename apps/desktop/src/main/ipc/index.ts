import { setupDialogHandlers } from './dialog.handler';
import { setupExcelHandlers } from './excel.handler';
import { setupJobHandlers } from './job.handler';
import { setupPathHandlers } from './path.handler';

export const registerIpcHandlers = (): void => {
  setupDialogHandlers();
  setupPathHandlers();
  setupExcelHandlers();
  setupJobHandlers();
};

