import { AlertCircle, CheckCircle2, Circle, Clock, Loader2, SkipForward, Trash2, XCircle } from 'lucide-react';
import type { FileListItem, FileProcessingStatus } from '@shared/types/files';
import { formatBytes } from '../../lib/format';

type FileListProps = {
  files: FileListItem[];
  canRemove?: boolean;
  onRemoveFile?: (sourceId: string) => void;
};

const statusConfig: Record<FileProcessingStatus, { label: string; icon: JSX.Element }> = {
  pending: { label: '待处理', icon: <Circle size={16} aria-hidden="true" /> },
  processing: { label: '处理中', icon: <Loader2 className="spin" size={16} aria-hidden="true" /> },
  completed: { label: '已完成', icon: <CheckCircle2 size={16} aria-hidden="true" /> },
  skipped: { label: '已跳过', icon: <SkipForward size={16} aria-hidden="true" /> },
  failed: { label: '失败', icon: <AlertCircle size={16} aria-hidden="true" /> },
  canceled: { label: '已取消', icon: <XCircle size={16} aria-hidden="true" /> },
};

export const FileList = ({ files, canRemove = false, onRemoveFile }: FileListProps): JSX.Element => {
  if (files.length === 0) {
    return <div className="empty-state">暂无文件</div>;
  }

  return (
    <ol className="file-list">
      {files.map((file, index) => {
        const status = statusConfig[file.status];
        const itemClassName = [
          'file-list__item',
          `file-list__item--${file.status}`,
          onRemoveFile ? 'file-list__item--removable' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <li className={itemClassName} key={file.sourceId}>
            <div className="file-list__index">{index + 1}.</div>
            <div className="file-list__body">
              <div className="file-list__name" title={file.displayPath}>
                {file.name}
              </div>
              <div className="file-list__meta">
                <span>{file.extension.toUpperCase()}</span>
                <span>{formatBytes(file.sizeBytes)}</span>
              </div>
            </div>
            <div className="file-list__status" title={status.label}>
              {status.icon}
              <span>{status.label}</span>
            </div>
            {onRemoveFile ? (
              <button
                aria-label={`删除 ${file.name}`}
                className="file-list__remove"
                disabled={!canRemove}
                onClick={() => onRemoveFile(file.sourceId)}
                title="删除文件"
                type="button"
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            ) : null}
            {file.status === 'processing' ? (
              <div className="file-list__processing">
                <Clock size={14} aria-hidden="true" />
                <span>正在处理 {file.name}</span>
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
};

