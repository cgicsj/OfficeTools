export const IPC_CHANNELS = {
  DIALOG: {
    SELECT_EXCEL_FILES: 'dialog:select-excel-files',
    SELECT_FOLDER: 'dialog:select-folder',
    SELECT_OUTPUT_DIRECTORY: 'dialog:select-output-directory',
  },
  PATHS: {
    GET_DEFAULT_OUTPUT_DIRECTORY: 'paths:get-default-output-directory',
    GET_LAST_OUTPUT_DIRECTORY: 'paths:get-last-output-directory',
    OPEN_DIRECTORY: 'paths:open-directory',
    SET_LAST_OUTPUT_DIRECTORY: 'paths:set-last-output-directory',
  },
  EXCEL: {
    PARSE_SPLIT_DOCUMENTS: 'excel:parse-split-documents',
    START_SPLIT_JOB: 'excel:start-split-job',
    PARSE_MERGE_FOLDER: 'excel:parse-merge-folder',
    START_MERGE_JOB: 'excel:start-merge-job',
  },
  JOB: {
    CANCEL_ACTIVE: 'job:cancel-active',
    SKIP_CURRENT_FILE: 'job:skip-current-file',
    EVENT: 'job:event',
  },
} as const;

