import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ParsedWorkbook } from '@shared/types/excel';
import type { FileListItem, SelectedFile, SelectedFolder } from '@shared/types/files';
import type { JobProgress, LogEntry, WorkflowTab } from '@shared/types/jobs';
import { APP_CONFIG } from '@shared/constants/config';
import { AppShell } from './components/layout/AppShell';
import { ModalDialog } from './components/ui/ModalDialog';
import { MergeWorkflow } from './components/workflows/MergeWorkflow';
import { SplitWorkflow } from './components/workflows/SplitWorkflow';
import { createLogEntry } from './lib/logs';
import {
  createDefaultSplitSettings,
  createSettingsForFieldRow,
  createSettingsForSheet,
  createSplitColumnOptions,
  emptySplitSettings,
  getSheetByName,
  getWorkbookBySourceId,
} from './lib/split-settings';
import type { SplitSettingsState } from './lib/split-settings';

const idleProgress: JobProgress = {
  stage: 'idle',
  currentFileIndex: 0,
  totalFiles: 0,
  message: '等待处理',
};

type CompletionDialogState = {
  outputDirectory: string;
  tab: WorkflowTab;
};

const toFileListItems = (files: SelectedFile[]): FileListItem[] => {
  return files.map((file) => ({
    ...file,
    status: 'pending',
  }));
};

const getUnknownErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return '操作失败';
};

export const App = (): JSX.Element => {
  const [activeTab, setActiveTab] = useState<WorkflowTab>('split');
  const [splitFiles, setSplitFiles] = useState<FileListItem[]>([]);
  const [splitParsedWorkbooks, setSplitParsedWorkbooks] = useState<ParsedWorkbook[]>([]);
  const [activeSplitSourceId, setActiveSplitSourceId] = useState('');
  const [splitSettings, setSplitSettings] = useState<Record<string, SplitSettingsState>>({});
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
  const [completionDialog, setCompletionDialog] = useState<CompletionDialogState | null>(null);
  const [cancelChoiceTab, setCancelChoiceTab] = useState<WorkflowTab | null>(null);
  const splitCompletionTimerRef = useRef<number | null>(null);

  const appendLog = useCallback((tab: WorkflowTab, level: LogEntry['level'], message: string): void => {
    setLogs((currentLogs) => ({
      ...currentLogs,
      [tab]: [...currentLogs[tab], createLogEntry(tab, level, message)],
    }));
  }, []);

  const clearSplitCompletionTimer = useCallback((): void => {
    if (splitCompletionTimerRef.current !== null) {
      window.clearTimeout(splitCompletionTimerRef.current);
      splitCompletionTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearSplitCompletionTimer();
    };
  }, [clearSplitCompletionTimer]);

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
  const activeSplitSettings = useMemo(() => {
    return splitSettings[activeSplitSourceId];
  }, [activeSplitSourceId, splitSettings]);

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
    appendLog(activeTab, 'info', `保存路径已设置为 ${result.data}`);
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

    if (result.data.length === 0) {
      return;
    }

    const nextFiles = toFileListItems(result.data).slice(0, APP_CONFIG.LIMITS.MAX_FILES);
    setSplitFiles(nextFiles);
    setSplitParsedWorkbooks([]);
    setSplitSettings({});
    setActiveSplitSourceId(nextFiles[0]?.sourceId ?? '');
    setSplitProgress({
      ...idleProgress,
      totalFiles: nextFiles.length,
    });
    appendLog('split', 'info', `已选择 ${nextFiles.length} 个文件`);
  }, [appendLog]);

  const removeSplitFile = useCallback(
    (sourceId: string): void => {
      if (busyTab === 'split') {
        return;
      }

      const removedFile = splitFiles.find((file) => file.sourceId === sourceId);
      if (!removedFile) {
        return;
      }

      const nextFiles = splitFiles.filter((file) => file.sourceId !== sourceId);
      const nextParsedWorkbooks = splitParsedWorkbooks.filter((workbook) => {
        return workbook.sourceId !== sourceId;
      });

      setSplitFiles(nextFiles);
      setSplitParsedWorkbooks(nextParsedWorkbooks);
      setSplitSettings((currentSettings) => {
        return Object.fromEntries(
          Object.entries(currentSettings).filter(([currentSourceId]) => currentSourceId !== sourceId),
        );
      });
      setActiveSplitSourceId((currentSourceId) => {
        if (currentSourceId !== sourceId) {
          return currentSourceId;
        }

        return nextParsedWorkbooks[0]?.sourceId ?? nextFiles[0]?.sourceId ?? '';
      });
      setSplitProgress({
        ...idleProgress,
        totalFiles: nextFiles.length,
      });
      appendLog('split', 'info', `已删除文件 ${removedFile.name}`);
    },
    [appendLog, busyTab, splitFiles, splitParsedWorkbooks],
  );

  const parseSplitDocuments = useCallback(async (): Promise<void> => {
    if (splitFiles.length === 0) {
      return;
    }

    setBusyTab('split');
    setSplitProgress({
      stage: 'parsing',
      currentFileIndex: 1,
      totalFiles: splitFiles.length,
      currentFileName: splitFiles[0]?.name,
      message: '解析文档',
    });
    appendLog('split', 'info', '开始解析文档');

    try {
      const result = await window.officeTools.excel.parseSplitDocuments({
        sourceIds: splitFiles.map((file) => file.sourceId),
      });

      if (result.success === false) {
        setSplitProgress({
          ...idleProgress,
          stage: 'failed',
          totalFiles: splitFiles.length,
          message: '解析失败',
        });
        appendLog('split', 'error', result.error);
        return;
      }

      const { failures, workbooks } = result.data;
      const failedSourceIds = new Set(failures.map((failure) => failure.sourceId));
      const nextSettings = Object.fromEntries(
        workbooks.map((workbook) => [workbook.sourceId, createDefaultSplitSettings(workbook)]),
      );

      setSplitParsedWorkbooks(workbooks);
      setSplitSettings(nextSettings);
      setActiveSplitSourceId((currentSourceId) => {
        const hasCurrentWorkbook = workbooks.some((workbook) => workbook.sourceId === currentSourceId);
        return hasCurrentWorkbook ? currentSourceId : workbooks[0]?.sourceId ?? '';
      });
      setSplitFiles((currentFiles) =>
        currentFiles.map((file) => ({
          ...file,
          status: failedSourceIds.has(file.sourceId) ? 'failed' : 'pending',
        })),
      );

      failures.forEach((failure) => {
        appendLog('split', 'warning', `${failure.fileName} 解析失败：${failure.error}`);
      });

      if (workbooks.length === 0) {
        setSplitProgress({
          ...idleProgress,
          stage: 'failed',
          totalFiles: splitFiles.length,
          message: '没有可解析的文档',
        });
        appendLog('split', 'error', '没有可解析的文档');
        return;
      }

      setSplitProgress({
        ...idleProgress,
        stage: 'completed',
        currentFileIndex: workbooks.length,
        totalFiles: splitFiles.length,
        message: '解析完成',
      });
      appendLog('split', 'success', `解析完成：${workbooks.length} 个文件可配置`);
    } catch (error) {
      setSplitProgress({
        ...idleProgress,
        stage: 'failed',
        totalFiles: splitFiles.length,
        message: '解析失败',
      });
      appendLog('split', 'error', getUnknownErrorMessage(error));
    } finally {
      setBusyTab(null);
    }
  }, [appendLog, splitFiles]);

  const changeActiveSplitFile = useCallback(
    (sourceId: string): void => {
      setActiveSplitSourceId(sourceId);

      const workbook = getWorkbookBySourceId(splitParsedWorkbooks, sourceId);
      if (!workbook || splitSettings[sourceId]) {
        return;
      }

      setSplitSettings((currentSettings) => ({
        ...currentSettings,
        [sourceId]: createDefaultSplitSettings(workbook),
      }));
    },
    [splitParsedWorkbooks, splitSettings],
  );

  const changeSplitSheet = useCallback(
    (sheetName: string): void => {
      const workbook = getWorkbookBySourceId(splitParsedWorkbooks, activeSplitSourceId);
      const sheet = workbook?.sheets.find((candidateSheet) => candidateSheet.name === sheetName);
      if (!workbook || !sheet) {
        return;
      }

      setSplitSettings((currentSettings) => ({
        ...currentSettings,
        [workbook.sourceId]: createSettingsForSheet(sheet),
      }));
      appendLog('split', 'info', `选择 sheet：${sheet.name}`);
    },
    [activeSplitSourceId, appendLog, splitParsedWorkbooks],
  );

  const changeSplitFieldRow = useCallback(
    (fieldRow: string): void => {
      const workbook = getWorkbookBySourceId(splitParsedWorkbooks, activeSplitSourceId);
      const currentSettings = splitSettings[activeSplitSourceId] ?? emptySplitSettings;
      const sheet = getSheetByName(workbook, currentSettings.sheetName);
      if (!workbook || !sheet) {
        return;
      }

      setSplitSettings((currentSettingsBySourceId) => ({
        ...currentSettingsBySourceId,
        [workbook.sourceId]: createSettingsForFieldRow(currentSettings, sheet, fieldRow),
      }));
      appendLog('split', 'info', `标题行为第 ${fieldRow} 行`);
    },
    [activeSplitSourceId, appendLog, splitParsedWorkbooks, splitSettings],
  );

  const changeSplitColumn = useCallback(
    (columnNumber: string): void => {
      const workbook = getWorkbookBySourceId(splitParsedWorkbooks, activeSplitSourceId);
      const currentSettings = splitSettings[activeSplitSourceId] ?? emptySplitSettings;
      const sheet = getSheetByName(workbook, currentSettings.sheetName);
      const selectedOption = createSplitColumnOptions(sheet, currentSettings.fieldRow).find((option) => {
        return option.value === columnNumber;
      });

      if (!workbook || !sheet) {
        return;
      }

      setSplitSettings((currentSettingsBySourceId) => ({
        ...currentSettingsBySourceId,
        [workbook.sourceId]: {
          ...currentSettings,
          splitColumn: columnNumber,
        },
      }));

      if (selectedOption) {
        appendLog('split', 'info', `选择按照“${selectedOption.label}”列进行拆分`);
      }
    },
    [activeSplitSourceId, appendLog, splitParsedWorkbooks, splitSettings],
  );

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

  const finishSplitJob = useCallback((): void => {
    clearSplitCompletionTimer();
    setSplitFiles((currentFiles) =>
      currentFiles.map((file) => {
        if (file.status === 'pending' || file.status === 'processing') {
          return {
            ...file,
            status: 'completed',
          };
        }

        return file;
      }),
    );
    setSplitProgress({
      stage: 'completed',
      currentFileIndex: splitFiles.length,
      totalFiles: splitFiles.length,
      message: '拆分完成',
    });
    appendLog('split', 'success', `拆分完成，输出目录：${outputDirectory || '-'}`);
    setBusyTab(null);
    setCompletionDialog({
      outputDirectory,
      tab: 'split',
    });
  }, [appendLog, clearSplitCompletionTimer, outputDirectory, splitFiles.length]);

  const startSplit = useCallback((): void => {
    if (splitFiles.length === 0 || splitParsedWorkbooks.length === 0) {
      return;
    }

    const firstProcessableIndex = splitFiles.findIndex((file) => file.status !== 'failed');
    const currentFile = firstProcessableIndex >= 0 ? splitFiles[firstProcessableIndex] : undefined;
    if (!currentFile) {
      return;
    }

    clearSplitCompletionTimer();
    setBusyTab('split');
    setSplitFiles((currentFiles) =>
      currentFiles.map((file, index) => {
        if (file.status === 'failed') {
          return file;
        }

        return {
          ...file,
          status: index === firstProcessableIndex ? 'processing' : 'pending',
        };
      }),
    );
    setSplitProgress({
      stage: 'processing',
      currentFileIndex: firstProcessableIndex + 1,
      totalFiles: splitFiles.length,
      currentFileName: currentFile.name,
      message: '正在处理',
    });
    appendLog('split', 'info', `正在处理 ${currentFile.name}`);

    splitCompletionTimerRef.current = window.setTimeout(() => {
      finishSplitJob();
    }, 900);
  }, [appendLog, clearSplitCompletionTimer, finishSplitJob, splitFiles, splitParsedWorkbooks.length]);

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

  const cancelAllTasks = useCallback(
    async (targetTab: WorkflowTab | null = null): Promise<void> => {
      const tabToCancel = targetTab ?? cancelChoiceTab ?? busyTab ?? activeTab;
      clearSplitCompletionTimer();
      setCancelChoiceTab(null);

      const result = await window.officeTools.jobs.cancelActiveJob();
      if (result.success === false) {
        appendLog(tabToCancel, 'error', result.error);
        return;
      }

      if (tabToCancel === 'split') {
        setSplitFiles((currentFiles) =>
          currentFiles.map((file) => {
            if (file.status === 'pending' || file.status === 'processing') {
              return {
                ...file,
                status: 'canceled',
              };
            }

            return file;
          }),
        );
        setSplitProgress({
          ...idleProgress,
          stage: 'canceled',
          totalFiles: splitFiles.length,
          message: '用户已取消',
        });
      }

      if (tabToCancel === 'merge') {
        setMergeProgress({
          ...idleProgress,
          stage: 'canceled',
          totalFiles: mergeFiles.length,
          message: '用户已取消',
        });
      }

      appendLog(tabToCancel, 'warning', '用户已取消所有任务');
      setBusyTab(null);
    },
    [
      activeTab,
      appendLog,
      busyTab,
      cancelChoiceTab,
      clearSplitCompletionTimer,
      mergeFiles.length,
      splitFiles.length,
    ],
  );

  const requestCancelJob = useCallback((): void => {
    if (!busyTab) {
      return;
    }

    if (busyTab === 'split') {
      setCancelChoiceTab('split');
      return;
    }

    void cancelAllTasks(busyTab);
  }, [busyTab, cancelAllTasks]);

  const skipCurrentFile = useCallback((): void => {
    if (cancelChoiceTab !== 'split') {
      return;
    }

    const currentFile = splitFiles.find((file) => file.status === 'processing');
    clearSplitCompletionTimer();
    setCancelChoiceTab(null);

    if (currentFile) {
      setSplitFiles((currentFiles) =>
        currentFiles.map((file) => {
          if (file.sourceId === currentFile.sourceId) {
            return {
              ...file,
              status: 'skipped',
            };
          }

          return file;
        }),
      );
      appendLog('split', 'warning', `已跳过当前文件 ${currentFile.name}`);
    }

    finishSplitJob();
  }, [appendLog, cancelChoiceTab, clearSplitCompletionTimer, finishSplitJob, splitFiles]);

  const dismissCompletionDialog = useCallback((): void => {
    setCompletionDialog(null);
  }, []);

  const openCompletionOutputDirectory = useCallback(async (): Promise<void> => {
    if (!completionDialog?.outputDirectory) {
      setCompletionDialog(null);
      return;
    }

    const result = await window.officeTools.paths.openDirectory({
      directory: completionDialog.outputDirectory,
    });

    if (result.success === false) {
      appendLog(completionDialog.tab, 'error', result.error);
      return;
    }

    appendLog(completionDialog.tab, 'info', '已打开输出文件夹');
    setCompletionDialog(null);
  }, [appendLog, completionDialog]);

  return (
    <>
      <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'split' ? (
          <SplitWorkflow
            activeSourceId={activeSplitSourceId}
            files={splitFiles}
            isBusy={busyTab === 'split'}
            logs={selectedLogs}
            onActiveFileChange={changeActiveSplitFile}
            onCancel={requestCancelJob}
            onFieldRowChange={changeSplitFieldRow}
            onParse={parseSplitDocuments}
            onRemoveFile={removeSplitFile}
            onSelectFiles={selectSplitFiles}
            onSelectOutputDirectory={selectOutputDirectory}
            onSheetChange={changeSplitSheet}
            onSplitColumnChange={changeSplitColumn}
            onStart={startSplit}
            outputDirectory={outputDirectory}
            parsedWorkbooks={splitParsedWorkbooks}
            progress={splitProgress}
            settings={activeSplitSettings}
          />
        ) : (
          <MergeWorkflow
            files={mergeFiles}
            folder={mergeFolder}
            isBusy={busyTab === 'merge'}
            logs={selectedLogs}
            onCancel={requestCancelJob}
            onSelectFolder={selectMergeFolder}
            onSelectOutputDirectory={selectOutputDirectory}
            onStart={startMerge}
            outputDirectory={outputDirectory}
            progress={mergeProgress}
          />
        )}
      </AppShell>
      {completionDialog ? (
        <ModalDialog
          actions={[
            { label: '确认', onClick: dismissCompletionDialog },
            {
              label: '打开输出文件夹',
              onClick: () => {
                void openCompletionOutputDirectory();
              },
              variant: 'primary',
            },
          ]}
          description={`任务已完成，输出目录：${completionDialog.outputDirectory || '-'}`}
          title="任务完成"
        />
      ) : null}
      {cancelChoiceTab ? (
        <ModalDialog
          actions={[
            { label: '跳过当前文件', onClick: skipCurrentFile },
            {
              label: '取消所有任务',
              onClick: () => {
                void cancelAllTasks(cancelChoiceTab);
              },
              variant: 'danger',
            },
          ]}
          description="请选择跳过当前正在处理的文件，或取消整个任务。"
          title="取消任务"
        />
      ) : null}
    </>
  );
};
