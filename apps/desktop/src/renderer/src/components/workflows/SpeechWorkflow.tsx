import { ClipboardCopy, Copy, Download, FileAudio2, FolderOpen, Play, RotateCcw, Settings, Square } from 'lucide-react';
import type { SpeechTranscriptionItem, SpeechTranscriptionProgress } from '@shared/types/speech';
import { formatBytes } from '../../lib/format';
import { Button } from '../ui/Button';

type SpeechLogEntry = {
  id: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestampMs: number;
};

type SpeechWorkflowProps = {
  canExport: boolean;
  files: SpeechTranscriptionItem[];
  isBusy: boolean;
  isStarting: boolean;
  logs: SpeechLogEntry[];
  onCancel: () => void;
  onCopyAll: () => void;
  onCopyTranscript: (sourceId: string) => void;
  onExport: () => void;
  onRemoveFile: (sourceId: string) => void;
  onRetryFile: (sourceId: string) => void;
  onOpenSettings: () => void;
  onSelectFiles: () => void;
  onSelectOutputDirectory: () => void;
  onStart: () => void;
  outputDirectory: string;
  progress: SpeechTranscriptionProgress;
};

const statusLabel: Record<SpeechTranscriptionItem['status'], string> = {
  pending: '待转写',
  processing: '转写中',
  completed: '已完成',
  failed: '失败',
  canceled: '已取消',
};

const formatTime = (timestampMs: number): string => {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestampMs);
};

export const SpeechWorkflow = ({
  canExport,
  files,
  isBusy,
  isStarting,
  logs,
  onCancel,
  onCopyAll,
  onCopyTranscript,
  onExport,
  onOpenSettings,
  onRemoveFile,
  onRetryFile,
  onSelectFiles,
  onSelectOutputDirectory,
  onStart,
  outputDirectory,
  progress,
}: SpeechWorkflowProps): JSX.Element => {
  const completedCount = files.filter((file) => file.status === 'completed').length;
  const failedCount = files.filter((file) => file.status === 'failed').length;
  const hasFiles = files.length > 0;
  const isActionLocked = isBusy || isStarting;

  return (
    <section className="speech-workflow" aria-label="音频转文字">
      <section className="workflow-toolbar speech-toolbar" aria-label="音频转文字操作">
        <div className="speech-toolbar__group" aria-label="转写操作">
          <Button
            disabled={isActionLocked}
            icon={<FileAudio2 size={16} aria-hidden="true" />}
            onClick={onSelectFiles}
            variant="primary"
          >
            选择音频
          </Button>
          <Button
            disabled={!hasFiles || isActionLocked}
            icon={<Play size={16} aria-hidden="true" />}
            onClick={onStart}
            variant="primary"
          >
            {isStarting ? '准备中…' : isBusy ? '转写中…' : '开始转写'}
          </Button>
          <Button disabled={!isBusy} icon={<Square size={16} aria-hidden="true" />} onClick={onCancel} variant="danger">
            取消
          </Button>
        </div>
        <div className="speech-toolbar__group" aria-label="结果操作">
          <Button disabled={completedCount === 0} icon={<ClipboardCopy size={16} aria-hidden="true" />} onClick={onCopyAll}>
            复制全部已完成文本
          </Button>
          <Button disabled={!canExport} icon={<Download size={16} aria-hidden="true" />} onClick={onExport}>
            导出 TXT
          </Button>
        </div>
        <div className="speech-toolbar__group speech-toolbar__group--settings" aria-label="设置和输出路径">
          <Button disabled={isActionLocked} icon={<FolderOpen size={16} aria-hidden="true" />} onClick={onSelectOutputDirectory}>
            选择保存路径
          </Button>
          <Button disabled={isActionLocked} icon={<Settings size={16} aria-hidden="true" />} onClick={onOpenSettings}>
            模型设置
          </Button>
          <div className="output-path speech-workflow__output" title={outputDirectory || '未设置保存路径'}>
            保存路径：{outputDirectory || '未设置'}
          </div>
        </div>
      </section>

      <div className="speech-workflow__summary" aria-live="polite">
        {isActionLocked ? (
          <span className="speech-workflow__busy-notice" role="status">
            {isStarting
              ? '正在检查模型和音频时长，请勿重复点击开始按钮。'
              : '正在转写音频，请等待当前任务完成或点击“取消”，不要重复点击开始按钮。'}
          </span>
        ) : null}
        <span>总计 {files.length} 个文件</span>
        <span>已完成 {completedCount} 个</span>
        <span>失败 {failedCount} 个</span>
        <span>{progress.message ?? '等待处理'}</span>
      </div>

      <div className="speech-workflow__grid">
        <section className="workflow-panel" aria-label="音频队列">
          <div className="workflow-panel__header">
            <h2>音频队列</h2>
            <span>
              {progress.totalFiles > 0
                ? `${progress.currentFileIndex}/${progress.totalFiles}`
                : '支持 WAV / MP3 / M4A / FLAC'}
            </span>
          </div>
          {files.length === 0 ? (
            <div className="empty-state">请选择需要转写的音频文件</div>
          ) : (
            <ol className="speech-file-list">
              {files.map((file, index) => (
                <li className={`speech-file-list__item speech-file-list__item--${file.status}`} key={file.sourceId}>
                  <div className="speech-file-list__index">{index + 1}.</div>
                  <div className="speech-file-list__body">
                    <div className="speech-file-list__name" title={file.displayPath}>
                      {file.name}
                    </div>
                    <div className="speech-file-list__meta">
                      <span>{file.extension.toUpperCase()}</span>
                      <span>{formatBytes(file.sizeBytes)}</span>
                      <span>{statusLabel[file.status]}</span>
                    </div>
                    {file.error ? <div className="speech-file-list__error">{file.error}</div> : null}
                  </div>
                  {file.status === 'failed' ? (
                    <button
                      aria-label={`重试 ${file.name}`}
                      className="file-list__remove"
                      disabled={isActionLocked}
                      onClick={() => onRetryFile(file.sourceId)}
                      title="重试"
                      type="button"
                    >
                      <RotateCcw size={15} aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      aria-label={`移除 ${file.name}`}
                      className="file-list__remove"
                      disabled={isActionLocked}
                      onClick={() => onRemoveFile(file.sourceId)}
                      title="移除"
                      type="button"
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="workflow-panel" aria-label="转写结果">
          <div className="workflow-panel__header">
            <h2>转写结果</h2>
            <span>每个音频一个结果卡片</span>
          </div>
          <div className="speech-result-list">
            {files.filter((file) => file.status !== 'pending').length === 0 ? (
              <div className="empty-state">转写完成后会在这里显示文本</div>
            ) : null}
            {files
              .filter((file) => file.status !== 'pending')
              .map((file) => (
                <article className={`speech-result-card speech-result-card--${file.status}`} key={file.sourceId}>
                  <header className="speech-result-card__header">
                    <div>
                      <h3 title={file.name}>{file.name}</h3>
                      <span>{statusLabel[file.status]}</span>
                    </div>
                    {file.status === 'completed' ? (
                      <Button
                        icon={<Copy size={15} aria-hidden="true" />}
                        onClick={() => onCopyTranscript(file.sourceId)}
                      >
                        复制
                      </Button>
                    ) : null}
                  </header>
                  {file.status === 'completed' ? (
                    <p className="speech-result-card__text">{file.transcript || '（空结果）'}</p>
                  ) : (
                    <p className="speech-result-card__error">{file.error ?? statusLabel[file.status]}</p>
                  )}
                </article>
              ))}
          </div>
        </section>
      </div>

      <section className="workflow-log" aria-label="语音转文字日志">
        <div className="workflow-log__header">
          <h2>处理日志</h2>
        </div>
        <div className="workflow-log__body">
          {logs.length === 0 ? (
            <div className="empty-state">暂无日志</div>
          ) : (
            logs.map((log) => (
              <div className={`workflow-log__entry workflow-log__entry--${log.level}`} key={log.id}>
                <time>{formatTime(log.timestampMs)}</time>
                <span>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </section>
  );
};
