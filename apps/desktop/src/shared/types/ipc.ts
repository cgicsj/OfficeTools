import type { ApiResult } from './api';
import type {
  MergeJobResult,
  ParseMergeFolderInput,
  ParseMergeFolderResult,
  ParseSplitDocumentsInput,
  ParseSplitDocumentsResult,
  SplitJobResult,
  StartMergeJobInput,
  StartSplitJobInput,
} from './excel';
import type { SelectedFile, SelectedFolder } from './files';
import type { JobEvent } from './jobs';
import type { OpenDirectoryInput } from './paths';
import type { SetLastOutputDirectoryInput } from './preferences';
import type {
  ExportSpeechTranscriptsInput,
  ExportSpeechTranscriptsResult,
  SpeechEvent,
  SpeechTranscriptionJobResult,
  StartSpeechTranscriptionInput,
} from './speech';

export type OfficeToolsApi = {
  dialog: {
    selectExcelFiles: () => Promise<ApiResult<SelectedFile[]>>;
    selectAudioFiles: () => Promise<ApiResult<SelectedFile[]>>;
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
    parseMergeFolder: (input: ParseMergeFolderInput) => Promise<ApiResult<ParseMergeFolderResult>>;
    startMergeJob: (input: StartMergeJobInput) => Promise<ApiResult<MergeJobResult>>;
  };
  jobs: {
    cancelActiveJob: () => Promise<ApiResult<void>>;
    skipCurrentFile: () => Promise<ApiResult<void>>;
    onJobEvent: (listener: (event: JobEvent) => void) => () => void;
  };
  speech: {
    startTranscriptionJob: (
      input: StartSpeechTranscriptionInput,
    ) => Promise<ApiResult<SpeechTranscriptionJobResult>>;
    exportTranscripts: (
      input: ExportSpeechTranscriptsInput,
    ) => Promise<ApiResult<ExportSpeechTranscriptsResult>>;
    onSpeechEvent: (listener: (event: SpeechEvent) => void) => () => void;
  };
};

