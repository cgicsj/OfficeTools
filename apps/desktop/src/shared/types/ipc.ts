import type { ApiResult } from './api';
import type { SelectedFile, SelectedFolder } from './files';
import type { JobEvent } from './jobs';
import type { SetLastOutputDirectoryInput } from './preferences';

export type OfficeToolsApi = {
  dialog: {
    selectExcelFiles: () => Promise<ApiResult<SelectedFile[]>>;
    selectFolder: () => Promise<ApiResult<SelectedFolder | undefined>>;
    selectOutputDirectory: () => Promise<ApiResult<string | undefined>>;
  };
  paths: {
    getDefaultOutputDirectory: () => Promise<ApiResult<string>>;
    getLastOutputDirectory: () => Promise<ApiResult<string | undefined>>;
    setLastOutputDirectory: (input: SetLastOutputDirectoryInput) => Promise<ApiResult<void>>;
  };
  jobs: {
    cancelActiveJob: () => Promise<ApiResult<void>>;
    onJobEvent: (listener: (event: JobEvent) => void) => () => void;
  };
};

