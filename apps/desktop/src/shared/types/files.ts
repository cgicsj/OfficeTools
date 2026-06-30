export type FileProcessingStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'skipped'
  | 'failed'
  | 'canceled';

export type SelectedFile = {
  sourceId: string;
  name: string;
  extension: string;
  sizeBytes: number;
  displayPath: string;
};

export type SelectedFolder = {
  sourceId: string;
  name: string;
};

export type FileListItem = SelectedFile & {
  status: FileProcessingStatus;
};

