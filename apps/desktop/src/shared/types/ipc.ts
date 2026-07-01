import type { ApiResult } from './api';
import type {
  ParseSplitDocumentsInput,
  ParseSplitDocumentsResult,
  SplitJobResult,
  StartSplitJobInput,
} from './excel';
import type { SelectedFile, SelectedFolder } from './files';
import type { JobEvent } from './jobs';
import type { OpenDirectoryInput } from './paths';
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
    openDirectory: (input: OpenDirectoryInput) => Promise<ApiResult<void>>;
    setLastOutputDirectory: (input: SetLastOutputDirectoryInput) => Promise<ApiResult<void>>;
  };
  excel: {
    parseSplitDocuments: (
      input: ParseSplitDocumentsInput,
    ) => Promise<ApiResult<ParseSplitDocumentsResult>>;
    startSplitJob: (input: StartSplitJobInput) => Promise<ApiResult<SplitJobResult>>;
  };
  jobs: {
    cancelActiveJob: () => Promise<ApiResult<void>>;
    skipCurrentFile: () => Promise<ApiResult<void>>;
    onJobEvent: (listener: (event: JobEvent) => void) => () => void;
  };
};

