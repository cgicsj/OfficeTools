import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC_CHANNELS } from '../shared/constants/channels';
import type { JobEvent } from '../shared/types/jobs';
import type { OfficeToolsApi } from '../shared/types/ipc';
import type { SetLastOutputDirectoryInput } from '../shared/types/preferences';

const officeToolsApi: OfficeToolsApi = {
  dialog: {
    selectExcelFiles: () => ipcRenderer.invoke(IPC_CHANNELS.DIALOG.SELECT_EXCEL_FILES),
    selectFolder: () => ipcRenderer.invoke(IPC_CHANNELS.DIALOG.SELECT_FOLDER),
    selectOutputDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.DIALOG.SELECT_OUTPUT_DIRECTORY),
  },
  paths: {
    getDefaultOutputDirectory: () =>
      ipcRenderer.invoke(IPC_CHANNELS.PATHS.GET_DEFAULT_OUTPUT_DIRECTORY),
    getLastOutputDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.PATHS.GET_LAST_OUTPUT_DIRECTORY),
    openDirectory: (input) => ipcRenderer.invoke(IPC_CHANNELS.PATHS.OPEN_DIRECTORY, input),
    setLastOutputDirectory: (input: SetLastOutputDirectoryInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.PATHS.SET_LAST_OUTPUT_DIRECTORY, input),
  },
  excel: {
    parseSplitDocuments: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.EXCEL.PARSE_SPLIT_DOCUMENTS, input),
    startSplitJob: (input) => ipcRenderer.invoke(IPC_CHANNELS.EXCEL.START_SPLIT_JOB, input),
    parseMergeFolder: (input) => ipcRenderer.invoke(IPC_CHANNELS.EXCEL.PARSE_MERGE_FOLDER, input),
    startMergeJob: (input) => ipcRenderer.invoke(IPC_CHANNELS.EXCEL.START_MERGE_JOB, input),
  },
  jobs: {
    cancelActiveJob: () => ipcRenderer.invoke(IPC_CHANNELS.JOB.CANCEL_ACTIVE),
    skipCurrentFile: () => ipcRenderer.invoke(IPC_CHANNELS.JOB.SKIP_CURRENT_FILE),
    onJobEvent: (listener: (event: JobEvent) => void) => {
      const handler = (_event: IpcRendererEvent, payload: JobEvent): void => {
        listener(payload);
      };

      ipcRenderer.on(IPC_CHANNELS.JOB.EVENT, handler);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.JOB.EVENT, handler);
      };
    },
  },
};

contextBridge.exposeInMainWorld('officeTools', officeToolsApi);

