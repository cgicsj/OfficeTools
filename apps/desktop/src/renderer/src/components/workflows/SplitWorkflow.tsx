import { FileSpreadsheet, Play, Save, Search, Square } from 'lucide-react';
import type { ParsedWorkbook } from '@shared/types/excel';
import type { FileListItem } from '@shared/types/files';
import type { JobProgress, LogEntry } from '@shared/types/jobs';
import {
  createSplitColumnOptions,
  emptySplitSettings,
  FIELD_ROW_OPTIONS,
  getSheetByName,
  getWorkbookBySourceId,
} from '../../lib/split-settings';
import type { SplitSettingsState } from '../../lib/split-settings';
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
  parsedWorkbooks: ParsedWorkbook[];
  activeSourceId: string;
  settings: SplitSettingsState | undefined;
  onActiveFileChange: (sourceId: string) => void;
  onFieldRowChange: (fieldRow: string) => void;
  onRemoveFile: (sourceId: string) => void;
  onSelectFiles: () => void;
  onSelectOutputDirectory: () => void;
  onSheetChange: (sheetName: string) => void;
  onSplitColumnChange: (columnNumber: string) => void;
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
  parsedWorkbooks,
  activeSourceId,
  settings,
  onActiveFileChange,
  onFieldRowChange,
  onRemoveFile,
  onSelectFiles,
  onSelectOutputDirectory,
  onSheetChange,
  onSplitColumnChange,
  onParse,
  onStart,
  onCancel,
}: SplitWorkflowProps): JSX.Element => {
  const activeSettings = settings ?? emptySplitSettings;
  const activeWorkbook = getWorkbookBySourceId(parsedWorkbooks, activeSourceId);
  const activeSheet = getSheetByName(activeWorkbook, activeSettings.sheetName);
  const splitColumnOptions = createSplitColumnOptions(activeSheet, activeSettings.fieldRow);
  const hasParsedWorkbook = Boolean(activeWorkbook);
  const canStart =
    files.length > 0 &&
    hasParsedWorkbook &&
    activeSettings.sheetName !== '' &&
    activeSettings.fieldRow !== '' &&
    activeSettings.splitColumn !== '';

  return (
    <div className="workflow">
      <section className="workflow-toolbar" aria-label="表格拆分操作">
        <Button
          disabled={isBusy}
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
          disabled={isBusy}
          icon={<Save size={17} aria-hidden="true" />}
          onClick={onSelectOutputDirectory}
          title="保存至"
        >
          保存至
        </Button>
        <Button
          disabled={!canStart || isBusy}
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
          <FileList canRemove={!isBusy} files={files} onRemoveFile={onRemoveFile} />
        </div>
        <div className="workflow-panel">
          <div className="workflow-panel__header">
            <h2>拆分设置</h2>
            <span>{activeWorkbook?.fileName ?? '待解析'}</span>
          </div>
          <div className="output-path" title={outputDirectory}>
            保存路径：{outputDirectory || '-'}
          </div>
          <div className="settings-grid">
            <label>
              <span>当前文件</span>
              <select
                disabled={!hasParsedWorkbook || isBusy}
                onChange={(event) => onActiveFileChange(event.currentTarget.value)}
                value={activeWorkbook?.sourceId ?? ''}
              >
                <option value="">请先解析文档</option>
                {parsedWorkbooks.map((workbook) => (
                  <option key={workbook.sourceId} value={workbook.sourceId}>
                    {workbook.fileName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Sheet</span>
              <select
                disabled={!hasParsedWorkbook || isBusy}
                onChange={(event) => onSheetChange(event.currentTarget.value)}
                value={activeSettings.sheetName}
              >
                <option value="">请先解析文档</option>
                {activeWorkbook?.sheets.map((sheet) => (
                  <option key={sheet.name} value={sheet.name}>
                    {sheet.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>字段名所在行</span>
              <select
                disabled={!hasParsedWorkbook || isBusy}
                onChange={(event) => onFieldRowChange(event.currentTarget.value)}
                value={activeSettings.fieldRow}
              >
                <option value="">请先解析文档</option>
                {FIELD_ROW_OPTIONS.map((rowNumber) => (
                  <option key={rowNumber} value={rowNumber}>
                    第 {rowNumber} 行
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>选择按哪一列拆分</span>
              <select
                disabled={!hasParsedWorkbook || isBusy || splitColumnOptions.length === 0}
                onChange={(event) => onSplitColumnChange(event.currentTarget.value)}
                value={activeSettings.splitColumn}
              >
                <option value="">请先解析文档</option>
                {splitColumnOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
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
