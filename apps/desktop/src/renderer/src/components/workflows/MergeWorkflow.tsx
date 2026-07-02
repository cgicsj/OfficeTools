import { FolderOpen, Play, Save, Square } from 'lucide-react';
import type { MergeMode, ParsedWorkbook } from '@shared/types/excel';
import type { FileListItem, SelectedFolder } from '@shared/types/files';
import type { JobProgress, LogEntry } from '@shared/types/jobs';
import { hasCompleteMergeSheetSelections } from '../../lib/merge-settings';
import type { MergeSheetSelections } from '../../lib/merge-settings';
import { FIELD_ROW_OPTIONS } from '../../lib/split-settings';
import { Button } from '../ui/Button';
import { FileList } from './FileList';
import { ProgressPanel } from './ProgressPanel';
import { WorkflowLog } from './WorkflowLog';

type MergeWorkflowProps = {
  fieldRow: string;
  folder: SelectedFolder | null;
  files: FileListItem[];
  logs: LogEntry[];
  mode: MergeMode;
  outputDirectory: string;
  parsedWorkbooks: ParsedWorkbook[];
  progress: JobProgress;
  sheetSelections: MergeSheetSelections;
  isBusy: boolean;
  onFieldRowChange: (fieldRow: string) => void;
  onModeChange: (mode: string) => void;
  onSelectFolder: () => void;
  onSelectOutputDirectory: () => void;
  onRemoveFile: (sourceId: string) => void;
  onSheetChange: (sourceId: string, sheetName: string) => void;
  onStart: () => void;
  onCancel: () => void;
};

export const MergeWorkflow = ({
  fieldRow,
  folder,
  files,
  logs,
  mode,
  outputDirectory,
  parsedWorkbooks,
  progress,
  sheetSelections,
  isBusy,
  onFieldRowChange,
  onModeChange,
  onSelectFolder,
  onSelectOutputDirectory,
  onRemoveFile,
  onSheetChange,
  onStart,
  onCancel,
}: MergeWorkflowProps): JSX.Element => {
  const hasParsedWorkbook = parsedWorkbooks.length > 0;
  const canStart = Boolean(folder) && hasCompleteMergeSheetSelections(parsedWorkbooks, sheetSelections);

  return (
    <div className="workflow">
      <section className="workflow-toolbar" aria-label="表格合并操作">
        <Button
          disabled={isBusy}
          icon={<FolderOpen size={17} aria-hidden="true" />}
          onClick={onSelectFolder}
          title="选择文件夹"
        >
          选择文件夹
        </Button>
        <Button
          disabled={!canStart || isBusy}
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
            <h2>文件</h2>
            <span>{files.length > 0 ? `${files.length} 个文件` : '待选择'}</span>
          </div>
          <FileList canRemove={!isBusy} files={files} onRemoveFile={onRemoveFile} />
        </div>
        <div className="workflow-panel">
          <div className="workflow-panel__header">
            <h2>合并设置</h2>
            <span>{hasParsedWorkbook ? `${parsedWorkbooks.length} 个文件` : '待扫描'}</span>
          </div>
          <div className="merge-output-setting">
            <div className="merge-output-setting__body">
              <span className="merge-output-setting__label">保存位置</span>
              <div className="output-path merge-output-setting__path" title={outputDirectory}>
                {outputDirectory || '未选择保存位置'}
              </div>
            </div>
            <Button
              disabled={isBusy}
              icon={<Save size={17} aria-hidden="true" />}
              onClick={onSelectOutputDirectory}
              title="选择保存位置"
            >
              保存至
            </Button>
          </div>
          <div className="settings-grid">
            <label>
              <span>合并方式</span>
              <select
                disabled={!hasParsedWorkbook || isBusy}
                onChange={(event) => onModeChange(event.currentTarget.value)}
                value={mode}
              >
                <option value="single-sheet">合并到一个 sheet</option>
                <option value="multi-sheet">合并到多个 sheet</option>
              </select>
            </label>
            <label>
              <span>字段名所在行</span>
              <select
                disabled={!hasParsedWorkbook || isBusy || mode !== 'single-sheet'}
                onChange={(event) => onFieldRowChange(event.currentTarget.value)}
                value={fieldRow}
              >
                {FIELD_ROW_OPTIONS.map((rowNumber) => (
                  <option key={rowNumber} value={rowNumber}>
                    第 {rowNumber} 行
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="merge-sheet-list" aria-label="每个文件的 sheet 选择">
            {parsedWorkbooks.length === 0 ? (
              <div className="empty-state">请选择文件夹</div>
            ) : parsedWorkbooks.map((workbook) => (
              <label className="merge-sheet-list__item" key={workbook.sourceId}>
                <span className="merge-sheet-list__name" title={workbook.fileName}>
                  {workbook.fileName}
                </span>
                <select
                  disabled={isBusy}
                  onChange={(event) => onSheetChange(workbook.sourceId, event.currentTarget.value)}
                  value={sheetSelections[workbook.sourceId] ?? ''}
                >
                  {workbook.sheets.map((sheet) => (
                    <option key={sheet.name} value={sheet.name}>
                      {sheet.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <ProgressPanel progress={progress} />
        </div>
      </section>
      <WorkflowLog logs={logs} />
    </div>
  );
};
