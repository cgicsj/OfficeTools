import { FileSpreadsheet, Play, Save, Search, Square } from 'lucide-react';
import type { FileListItem } from '@shared/types/files';
import type { JobProgress, LogEntry } from '@shared/types/jobs';
import { Button } from '../ui/Button';
import { FileList } from './FileList';
import { ProgressPanel } from './ProgressPanel';
import { WorkflowLog } from './WorkflowLog';

type SplitWorkflowProps = {
  files: FileListItem[];
  logs: LogEntry[];
  outputDirectory: string;
  progress: JobProgress;
  isBusy: boolean;
  onSelectFiles: () => void;
  onSelectOutputDirectory: () => void;
  onParse: () => void;
  onStart: () => void;
  onCancel: () => void;
};

export const SplitWorkflow = ({
  files,
  logs,
  outputDirectory,
  progress,
  isBusy,
  onSelectFiles,
  onSelectOutputDirectory,
  onParse,
  onStart,
  onCancel,
}: SplitWorkflowProps): JSX.Element => {
  return (
    <div className="workflow">
      <section className="workflow-toolbar" aria-label="表格拆分操作">
        <Button
          icon={<FileSpreadsheet size={17} aria-hidden="true" />}
          onClick={onSelectFiles}
          title="选择文件"
        >
          选择文件
        </Button>
        <Button
          disabled={files.length === 0 || isBusy}
          icon={<Search size={17} aria-hidden="true" />}
          onClick={onParse}
          title="解析文档"
        >
          解析文档
        </Button>
        <Button
          icon={<Save size={17} aria-hidden="true" />}
          onClick={onSelectOutputDirectory}
          title="保存至"
        >
          保存至
        </Button>
        <Button
          disabled={files.length === 0 || isBusy}
          icon={<Play size={17} aria-hidden="true" />}
          onClick={onStart}
          title="开始拆分并下载"
          variant="primary"
        >
          开始拆分并下载
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
            <h2>文件清单</h2>
            <span>{files.length} 个文件</span>
          </div>
          <div className="output-path" title={outputDirectory}>
            {outputDirectory || '-'}
          </div>
          <FileList files={files} />
        </div>
        <div className="workflow-panel">
          <div className="workflow-panel__header">
            <h2>拆分设置</h2>
            <span>逐个文件</span>
          </div>
          <div className="settings-grid">
            <label>
              <span>Sheet</span>
              <select defaultValue="first">
                <option value="first">第一个 sheet</option>
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
            <label>
              <span>选择按哪一列拆分</span>
              <select defaultValue="">
                <option value="">待解析</option>
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

