import { AlertCircle, CheckCircle2, Circle, Clock, Loader2, SkipForward, XCircle } from 'lucide-react';
import type { FileListItem, FileProcessingStatus } from '@shared/types/files';
import { formatBytes } from '../../lib/format';

type FileListProps = {
  files: FileListItem[];
};

const statusConfig: Record<FileProcessingStatus, { label: string; icon: JSX.Element }> = {
  pending: { label: '待处理', icon: <Circle size={16} aria-hidden="true" /> },
  processing: { label: '处理中', icon: <Loader2 className="spin" size={16} aria-hidden="true" /> },
  completed: { label: '已完成', icon: <CheckCircle2 size={16} aria-hidden="true" /> },
  skipped: { label: '已跳过', icon: <SkipForward size={16} aria-hidden="true" /> },
  failed: { label: '失败', icon: <AlertCircle size={16} aria-hidden="true" /> },
  canceled: { label: '已取消', icon: <XCircle size={16} aria-hidden="true" /> },
};

export const FileList = ({ files }: FileListProps): JSX.Element => {
  if (files.length === 0) {
    return <div className="empty-state">暂无文件</div>;
  }

  return (
    <ol className="file-list">
      {files.map((file, index) => {
        const status = statusConfig[file.status];
        return (
          <li className={`file-list__item file-list__item--${file.status}`} key={file.sourceId}>
            <div className="file-list__index">{index + 1}.</div>
            <div className="file-list__body">
              <div className="file-list__name" title={file.name}>
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

