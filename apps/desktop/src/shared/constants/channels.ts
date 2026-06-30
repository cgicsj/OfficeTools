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
  },
  JOB: {
    CANCEL_ACTIVE: 'job:cancel-active',
    EVENT: 'job:event',
  },
} as const;

