import { FolderOpen, Play, Save, Square } from 'lucide-react';
import type { FileListItem, SelectedFolder } from '@shared/types/files';
import type { JobProgress, LogEntry } from '@shared/types/jobs';
import { Button } from '../ui/Button';
import { FileList } from './FileList';
import { ProgressPanel } from './ProgressPanel';
import { WorkflowLog } from './WorkflowLog';

type MergeWorkflowProps = {
  folder: SelectedFolder | null;
  files: FileListItem[];
  logs: LogEntry[];
  outputDirectory: string;
  progress: JobProgress;
  isBusy: boolean;
  onSelectFolder: () => void;
  onSelectOutputDirectory: () => void;
  onStart: () => void;
  onCancel: () => void;
};

export const MergeWorkflow = ({
  folder,
  files,
  logs,
  outputDirectory,
  progress,
  isBusy,
  onSelectFolder,
  onSelectOutputDirectory,
  onStart,
  onCancel,
}: MergeWorkflowProps): JSX.Element => {
  return (
    <div className="workflow">
      <section className="workflow-toolbar" aria-label="表格合并操作">
        <Button
          icon={<FolderOpen size={17} aria-hidden="true" />}
          onClick={onSelectFolder}
          title="选择文件夹"
        >
          选择文件夹
        </Button>
        <Button
          icon={<Save size={17} aria-hidden="true" />}
          onClick={onSelectOutputDirectory}
          title="保存至"
        >
          保存至
        </Button>
        <Button
          disabled={!folder || isBusy}
          icon={<Play size={17} aria-hidden="true" />}
          onClick={onStart}
          title="开始汇总并下载"
          variant="primary"
        >
          开始汇总并下载
        </Button>
        <Button
          disabled={!isBusy}
          icon={<Square size={17} aria-hidden="true" />}
          onClick={onCancel}
          title="取消"
          variant="danger"
        >
          取消
        </Button>
      </section>
      <section className="workflow-grid">
        <div className="workflow-panel">
          <div className="workflow-panel__header">
            <h2>文件夹</h2>
            <span>{folder?.name ?? '-'}</span>
          </div>
          <div className="output-path" title={outputDirectory}>
            {outputDirectory || '-'}
          </div>
          <FileList files={files} />
        </div>
        <div className="workflow-panel">
          <div className="workflow-panel__header">
            <h2>合并设置</h2>
            <span>待配置</span>
          </div>
          <div className="settings-grid">
            <label>
              <span>合并方式</span>
              <select defaultValue="single-sheet">
                <option value="single-sheet">合并到一个 sheet</option>
                <option value="multi-sheet">合并到多个 sheet</option>
              </select>
            </label>
            <label>
              <span>字段名所在行</span>
              <select defaultValue="1">
                <option value="1">第 1 行</option>
                <option value="2">第 2 行</option>
                <option value="3">第 3 行</option>
              </select>
            </label>
          </div>
          <ProgressPanel progress={progress} />
        </div>
      </section>
      <WorkflowLog logs={logs} />
    </div>
  );
};

