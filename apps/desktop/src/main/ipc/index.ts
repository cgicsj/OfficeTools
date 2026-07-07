import { setupDialogHandlers } from './dialog.handler';
import { setupExcelHandlers } from './excel.handler';
import { setupJobHandlers } from './job.handler';
import { setupPathHandlers } from './path.handler';
import { setupSpeechHandlers } from './speech.handler';

export const registerIpcHandlers = (): void => {
  setupDialogHandlers();
  setupPathHandlers();
  setupExcelHandlers();
  setupJobHandlers();
  setupSpeechHandlers();
};

