import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FileListItem, SelectedFile, SelectedFolder } from '@shared/types/files';
import type { JobProgress, LogEntry, WorkflowTab } from '@shared/types/jobs';
import { APP_CONFIG } from '@shared/constants/config';
import { AppShell } from './components/layout/AppShell';
import { MergeWorkflow } from './components/workflows/MergeWorkflow';
import { SplitWorkflow } from './components/workflows/SplitWorkflow';
import { createLogEntry } from './lib/logs';

const idleProgress: JobProgress = {
  stage: 'idle',
  currentFileIndex: 0,
  totalFiles: 0,
  message: '等待处理',
};

const toFileListItems = (files: SelectedFile[]): FileListItem[] => {
  return files.map((file) => ({
    ...file,
    status: 'pending',
  }));
};

export const App = (): JSX.Element => {
  const [activeTab, setActiveTab] = useState<WorkflowTab>('split');
  const [splitFiles, setSplitFiles] = useState<FileListItem[]>([]);
  const [mergeFiles, setMergeFiles] = useState<FileListItem[]>([]);
  const [mergeFolder, setMergeFolder] = useState<SelectedFolder | null>(null);
  const [logs, setLogs] = useState<Record<WorkflowTab, LogEntry[]>>({
    split: [],
    merge: [],
  });
  const [outputDirectory, setOutputDirectory] = useState('');
  const [splitProgress, setSplitProgress] = useState<JobProgress>(idleProgress);
  const [mergeProgress, setMergeProgress] = useState<JobProgress>(idleProgress);
  const [busyTab, setBusyTab] = useState<WorkflowTab | null>(null);

  const appendLog = useCallback((tab: WorkflowTab, level: LogEntry['level'], message: string): void => {
    setLogs((currentLogs) => ({
      ...currentLogs,
      [tab]: [...currentLogs[tab], createLogEntry(tab, level, message)],
    }));
  }, []);

  useEffect(() => {
    const loadOutputDirectory = async (): Promise<void> => {
      const lastResult = await window.officeTools.paths.getLastOutputDirectory();
      if (lastResult.success === true && lastResult.data) {
        setOutputDirectory(lastResult.data);
        return;
      }

      const defaultResult = await window.officeTools.paths.getDefaultOutputDirectory();
      if (defaultResult.success === true) {
        setOutputDirectory(defaultResult.data);
      }
    };

    void loadOutputDirectory();
  }, []);

  const selectedLogs = useMemo(() => logs[activeTab], [activeTab, logs]);

  const selectOutputDirectory = useCallback(async (): Promise<void> => {
    const result = await window.officeTools.dialog.selectOutputDirectory();
    if (result.success === false) {
      appendLog(activeTab, 'error', result.error);
      return;
    }

    if (!result.data) {
      return;
    }

    setOutputDirectory(result.data);
    const saveResult = await window.officeTools.paths.setLastOutputDirectory({ directory: result.data });
    if (saveResult.success === false) {
      appendLog(activeTab, 'warning', saveResult.error);
    }
  }, [activeTab, appendLog]);

  const selectSplitFiles = useCallback(async (): Promise<void> => {
    const result = await window.officeTools.dialog.selectExcelFiles();
    if (result.success === false) {
      appendLog('split', 'error', result.error);
      return;
    }

    const nextFiles = toFileListItems(result.data).slice(0, APP_CONFIG.LIMITS.MAX_FILES);
    setSplitFiles(nextFiles);
    setSplitProgress({
      ...idleProgress,
      totalFiles: nextFiles.length,
    });
    appendLog('split', 'info', `已选择 ${nextFiles.length} 个文件`);
  }, [appendLog]);

  const selectMergeFolder = useCallback(async (): Promise<void> => {
    const result = await window.officeTools.dialog.selectFolder();
    if (result.success === false) {
      appendLog('merge', 'error', result.error);
      return;
    }

    setMergeFolder(result.data ?? null);
    setMergeFiles([]);
    setMergeProgress(idleProgress);
    if (result.data) {
      appendLog('merge', 'info', `已选择文件夹 ${result.data.name}`);
    }
  }, [appendLog]);

  const parseSplitDocuments = useCallback((): void => {
    setSplitProgress({
      stage: 'parsing',
      currentFileIndex: splitFiles.length > 0 ? 1 : 0,
      totalFiles: splitFiles.length,
      currentFileName: splitFiles[0]?.name,
      message: '解析文档',
    });
    appendLog('split', 'info', '解析文档');
  }, [appendLog, splitFiles]);

  const startSplit = useCallback((): void => {
    if (splitFiles.length === 0) {
      return;
    }

    setBusyTab('split');
    setSplitFiles((currentFiles) =>
      currentFiles.map((file, index) => ({
        ...file,
        status: index === 0 ? 'processing' : 'pending',
      })),
    );
    setSplitProgress({
      stage: 'processing',
      currentFileIndex: 1,
      totalFiles: splitFiles.length,
      currentFileName: splitFiles[0]?.name,
      message: '正在处理',
    });
    appendLog('split', 'info', `正在处理 ${splitFiles[0]?.name ?? ''}`);
  }, [appendLog, splitFiles]);

  const startMerge = useCallback((): void => {
    if (!mergeFolder) {
      return;
    }

    setBusyTab('merge');
    setMergeProgress({
      stage: 'processing',
      currentFileIndex: 0,
      totalFiles: mergeFiles.length,
      currentFileName: mergeFolder.name,
      message: '正在汇总',
    });
    appendLog('merge', 'info', `正在处理 ${mergeFolder.name}`);
  }, [appendLog, mergeFiles.length, mergeFolder]);

  const cancelJob = useCallback(async (): Promise<void> => {
    const result = await window.officeTools.jobs.cancelActiveJob();
    if (result.success === false) {
      appendLog(activeTab, 'error', result.error);
      return;
    }

    if (busyTab === 'split') {
      setSplitFiles((currentFiles) =>
        currentFiles.map((file) => ({
          ...file,
          status: file.status === 'processing' ? 'canceled' : file.status,
        })),
      );
      setSplitProgress({
        ...idleProgress,
        stage: 'canceled',
        totalFiles: splitFiles.length,
        message: '用户已取消',
      });
    }

    if (busyTab === 'merge') {
      setMergeProgress({
        ...idleProgress,
        stage: 'canceled',
        totalFiles: mergeFiles.length,
        message: '用户已取消',
      });
    }

    appendLog(busyTab ?? activeTab, 'warning', '用户已取消');
    setBusyTab(null);
  }, [activeTab, appendLog, busyTab, mergeFiles.length, splitFiles.length]);

  return (
    <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'split' ? (
        <SplitWorkflow
          files={splitFiles}
          isBusy={busyTab === 'split'}
          logs={selectedLogs}
          onCancel={cancelJob}
          onParse={parseSplitDocuments}
          onSelectFiles={selectSplitFiles}
          onSelectOutputDirectory={selectOutputDirectory}
          onStart={startSplit}
          outputDirectory={outputDirectory}
          progress={splitProgress}
        />
      ) : (
        <MergeWorkflow
          files={mergeFiles}
          folder={mergeFolder}
          isBusy={busyTab === 'merge'}
          logs={selectedLogs}
          onCancel={cancelJob}
          onSelectFolder={selectMergeFolder}
          onSelectOutputDirectory={selectOutputDirectory}
          onStart={startMerge}
          outputDirectory={outputDirectory}
          progress={mergeProgress}
        />
      )}
    </AppShell>
  );
};

