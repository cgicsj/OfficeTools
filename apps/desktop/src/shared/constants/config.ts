export const APP_CONFIG = {
  PRODUCT_NAME: 'OfficeTools',
  WINDOW: {
    DEFAULT_WIDTH: 1180,
    DEFAULT_HEIGHT: 760,
    MIN_WIDTH: 980,
    MIN_HEIGHT: 640,
  },
  LIMITS: {
    MAX_FILES: 20,
    MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
    MAX_SPLIT_OUTPUT_FILES: 500,
  },
  SUPPORTED_EXCEL_EXTENSIONS: ['xls', 'xlsx', 'et'],
  SUPPORTED_AUDIO_EXTENSIONS: ['wav', 'mp3', 'm4a', 'flac'],
} as const;

