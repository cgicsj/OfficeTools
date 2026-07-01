import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MergeMode, ParsedWorkbook, StartMergeJobInput, StartSplitJobInput } from '@shared/types/excel';
import type { FileListItem, SelectedFile, SelectedFolder } from '@shared/types/files';
import type { JobProgress, LogEntry, WorkflowTab } from '@shared/types/jobs';
import { APP_CONFIG } from '@shared/constants/config';
import { AppShell } from './components/layout/AppShell';
import { ModalDialog } from './components/ui/ModalDialog';
import { MergeWorkflow } from './components/workflows/MergeWorkflow';
import { SplitWorkflow } from './components/workflows/SplitWorkflow';
import { createLogEntry } from './lib/logs';
import { createDefaultMergeSheetSelections, hasCompleteMergeSheetSelections } from './lib/merge-settings';
import type { MergeSheetSelections } from './lib/merge-settings';
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
  warning?: string;
};

const toFileListItems = (files: SelectedFile[]): FileListItem[] => {
  return files.map((file) => ({
    ...file,
    status: 'pending',
  }));
};

const supportedExcelExtensions = new Set<string>(APP_CONFIG.SUPPORTED_EXCEL_EXTENSIONS);

const isSupportedExcelFile = (file: SelectedFile): boolean => {
  return supportedExcelExtensions.has(file.extension.toLowerCase());
};

const isWithinFileSizeLimit = (file: SelectedFile): boolean => {
  return file.sizeBytes <= APP_CONFIG.LIMITS.MAX_FILE_SIZE_BYTES;
};

const isMergeMode = (value: string): value is MergeMode => {
  return value === 'single-sheet' || value === 'multi-sheet';
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
  const [mergeParsedWorkbooks, setMergeParsedWorkbooks] = useState<ParsedWorkbook[]>([]);
  const [mergeMode, setMergeMode] = useState<MergeMode>('single-sheet');
  const [mergeFieldRow, setMergeFieldRow] = useState('1');
  const [mergeSheetSelections, setMergeSheetSelections] = useState<MergeSheetSelections>({});
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


  useEffect(() => {
    return window.officeTools.jobs.onJobEvent((event) => {
      if (event.type === 'log') {
        setLogs((currentLogs) => ({
          ...currentLogs,
          [event.entry.tab]: [...currentLogs[event.entry.tab], event.entry],
        }));
        return;
      }

      if (event.type === 'progress') {
        if (event.tab === 'split') {
          setSplitProgress(event.progress);
          return;
        }

        setMergeProgress(event.progress);
        return;
      }

      if (event.tab === 'split') {
        setSplitFiles((currentFiles) =>
          currentFiles.map((file) => {
            if (file.sourceId !== event.sourceId) {
              return file;
            }

            return {
              ...file,
              status: event.status,
            };
          }),
        );
        return;
      }

      setMergeFiles((currentFiles) =>
        currentFiles.map((file) => {
          if (file.sourceId !== event.sourceId) {
            return file;
          }

          return {
            ...file,
            status: event.status,
          };
        }),
      );
    });
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

    const unsupportedFiles = result.data.filter((file) => !isSupportedExcelFile(file));
    const oversizedFiles = result.data.filter((file) => isSupportedExcelFile(file) && !isWithinFileSizeLimit(file));
    const validFiles = result.data.filter((file) => isSupportedExcelFile(file) && isWithinFileSizeLimit(file));
    const nextFiles = toFileListItems(validFiles.slice(0, APP_CONFIG.LIMITS.MAX_FILES));

    unsupportedFiles.forEach((file) => {
      appendLog('split', 'warning', `${file.name} 类型不支持，已排除`);
    });
    oversizedFiles.forEach((file) => {
      appendLog('split', 'warning', `${file.name} 超过 10 MB，已排除`);
    });
    if (validFiles.length > APP_CONFIG.LIMITS.MAX_FILES) {
      appendLog('split', 'warning', `最多支持 ${APP_CONFIG.LIMITS.MAX_FILES} 个文件，已保留前 ${APP_CONFIG.LIMITS.MAX_FILES} 个`);
    }

    if (nextFiles.length === 0) {
      appendLog('split', 'error', '没有符合条件的 Excel 文件');
      return;
    }

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

    if (!result.data) {
      return;
    }

    setMergeFolder(result.data);
    setMergeFiles([]);
    setMergeParsedWorkbooks([]);
    setMergeSheetSelections({});
    setBusyTab('merge');
    setMergeProgress({
      stage: 'parsing',
      currentFileIndex: 0,
      totalFiles: 0,
      currentFileName: result.data.name,
      message: '扫描文件夹',
    });
    appendLog('merge', 'info', `已选择文件夹 ${result.data.name}`);

    try {
      const parseResult = await window.officeTools.excel.parseMergeFolder({
        folderSourceId: result.data.sourceId,
      });

      if (parseResult.success === false) {
        setMergeProgress({
          ...idleProgress,
          stage: 'failed',
          message: '扫描失败',
        });
        appendLog('merge', 'error', parseResult.error);
        return;
      }

      parseResult.data.excludedFiles.forEach((file) => {
        appendLog('merge', 'warning', `${file.fileName} ${file.reason}`);
      });
      parseResult.data.failures.forEach((failure) => {
        appendLog('merge', 'warning', `${failure.fileName} 解析失败：${failure.error}`);
      });

      const nextFiles = toFileListItems(parseResult.data.files);
      setMergeFiles(nextFiles);
      setMergeParsedWorkbooks(parseResult.data.workbooks);
      setMergeSheetSelections(createDefaultMergeSheetSelections(parseResult.data.workbooks));

      if (parseResult.data.workbooks.length === 0) {
        setMergeProgress({
          ...idleProgress,
          stage: 'failed',
          totalFiles: nextFiles.length,
          message: '没有可合并的文档',
        });
        appendLog('merge', 'error', '没有符合条件且可解析的 Excel 文件');
        return;
      }

      setMergeProgress({
        ...idleProgress,
        stage: 'completed',
        currentFileIndex: parseResult.data.workbooks.length,
        totalFiles: nextFiles.length,
        message: '扫描完成',
      });
      appendLog('merge', 'success', `扫描完成：${parseResult.data.workbooks.length} 个文件可合并`);
    } catch (error) {
      setMergeProgress({
        ...idleProgress,
        stage: 'failed',
        message: '扫描失败',
      });
      appendLog('merge', 'error', getUnknownErrorMessage(error));
    } finally {
      setBusyTab(null);
    }
  }, [appendLog]);

  const changeMergeMode = useCallback(
    (mode: string): void => {
      if (!isMergeMode(mode)) {
        return;
      }

      setMergeMode(mode);
      appendLog('merge', 'info', mode === 'single-sheet' ? '合并方式：合并到一个 sheet' : '合并方式：合并到多个 sheet');
    },
    [appendLog],
  );

  const changeMergeFieldRow = useCallback(
    (fieldRow: string): void => {
      setMergeFieldRow(fieldRow);
      appendLog('merge', 'info', `字段名所在行为第 ${fieldRow} 行`);
    },
    [appendLog],
  );

  const changeMergeSheet = useCallback(
    (sourceId: string, sheetName: string): void => {
      const workbook = mergeParsedWorkbooks.find((candidate) => candidate.sourceId === sourceId);
      const sheet = workbook?.sheets.find((candidateSheet) => candidateSheet.name === sheetName);
      if (!workbook || !sheet) {
        return;
      }

      setMergeSheetSelections((currentSelections) => ({
        ...currentSelections,
        [sourceId]: sheet.name,
      }));
      appendLog('merge', 'info', `${workbook.fileName} 选择 sheet：${sheet.name}`);
    },
    [appendLog, mergeParsedWorkbooks],
  );

  const startSplit = useCallback(async (): Promise<void> => {
    if (splitFiles.length === 0 || splitParsedWorkbooks.length === 0) {
      return;
    }

    if (outputDirectory === '') {
      appendLog('split', 'error', '请先选择保存路径');
      return;
    }

    const jobFiles: StartSplitJobInput['files'] = splitParsedWorkbooks.flatMap((workbook) => {
      const currentSettings = splitSettings[workbook.sourceId];
      if (!currentSettings) {
        return [];
      }

      const fieldRow = Number(currentSettings.fieldRow);
      const splitColumn = Number(currentSettings.splitColumn);
      if (!Number.isInteger(fieldRow) || !Number.isInteger(splitColumn)) {
        return [];
      }

      return [{
        fieldRow,
        sheetName: currentSettings.sheetName,
        sourceId: workbook.sourceId,
        splitColumn,
      }];
    });

    if (jobFiles.length === 0) {
      appendLog('split', 'error', '没有可拆分的文件配置');
      return;
    }

    setCancelChoiceTab(null);
    setBusyTab('split');
    setSplitFiles((currentFiles) =>
      currentFiles.map((file) => ({
        ...file,
        status: jobFiles.some((jobFile) => jobFile.sourceId === file.sourceId) ? 'pending' : file.status,
      })),
    );
    setSplitProgress({
      currentFileIndex: 0,
      message: '准备拆分',
      stage: 'processing',
      totalFiles: jobFiles.length,
    });

    try {
      const result = await window.officeTools.excel.startSplitJob({
        files: jobFiles,
        outputDirectory,
      });

      if (result.success === false) {
        if (result.code !== 'JOB_CANCELED') {
          setSplitProgress({
            ...idleProgress,
            stage: 'failed',
            totalFiles: jobFiles.length,
            message: '拆分失败',
          });
          appendLog('split', 'error', result.error);
        }
        return;
      }

      setCompletionDialog({
        outputDirectory: result.data.outputDirectory,
        tab: 'split',
      });
    } catch (error) {
      setSplitProgress({
        ...idleProgress,
        stage: 'failed',
        totalFiles: jobFiles.length,
        message: '拆分失败',
      });
      appendLog('split', 'error', getUnknownErrorMessage(error));
    } finally {
      setBusyTab(null);
      setCancelChoiceTab(null);
    }
  }, [appendLog, outputDirectory, splitFiles.length, splitParsedWorkbooks, splitSettings]);

  const startMerge = useCallback(async (): Promise<void> => {
    if (!mergeFolder || mergeParsedWorkbooks.length === 0) {
      return;
    }

    if (outputDirectory === '') {
      appendLog('merge', 'error', '请先选择保存路径');
      return;
    }

    if (!hasCompleteMergeSheetSelections(mergeParsedWorkbooks, mergeSheetSelections)) {
      appendLog('merge', 'error', '请为每个文件选择一个 sheet');
      return;
    }

    const fieldRow = Number(mergeFieldRow);
    if (!Number.isInteger(fieldRow)) {
      appendLog('merge', 'error', '字段名所在行无效');
      return;
    }

    const jobFiles: StartMergeJobInput['files'] = mergeParsedWorkbooks.map((workbook) => ({
      sheetName: mergeSheetSelections[workbook.sourceId] ?? '',
      sourceId: workbook.sourceId,
    }));

    setCancelChoiceTab(null);
    setBusyTab('merge');
    setMergeFiles((currentFiles) =>
      currentFiles.map((file) => ({
        ...file,
        status: jobFiles.some((jobFile) => jobFile.sourceId === file.sourceId) ? 'pending' : file.status,
      })),
    );
    setMergeProgress({
      currentFileIndex: 0,
      message: '准备合并',
      stage: 'processing',
      totalFiles: jobFiles.length,
    });

    try {
      const result = await window.officeTools.excel.startMergeJob({
        fieldRow,
        files: jobFiles,
        mode: mergeMode,
        outputDirectory,
      });

      if (result.success === false) {
        if (result.code !== 'JOB_CANCELED') {
          setMergeProgress({
            ...idleProgress,
            stage: 'failed',
            totalFiles: jobFiles.length,
            message: '合并失败',
          });
          appendLog('merge', 'error', result.error);
        }
        return;
      }

      setCompletionDialog({
        outputDirectory: result.data.outputDirectory,
        tab: 'merge',
        warning: result.data.warning,
      });
    } catch (error) {
      setMergeProgress({
        ...idleProgress,
        stage: 'failed',
        totalFiles: jobFiles.length,
        message: '合并失败',
      });
      appendLog('merge', 'error', getUnknownErrorMessage(error));
    } finally {
      setBusyTab(null);
      setCancelChoiceTab(null);
    }
  }, [
    appendLog,
    mergeFieldRow,
    mergeFolder,
    mergeMode,
    mergeParsedWorkbooks,
    mergeSheetSelections,
    outputDirectory,
  ]);

  const cancelAllTasks = useCallback(
    async (targetTab: WorkflowTab | null = null): Promise<void> => {
      const tabToCancel = targetTab ?? cancelChoiceTab ?? busyTab ?? activeTab;
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
        setMergeFiles((currentFiles) =>
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
        setMergeProgress({
          ...idleProgress,
          stage: 'canceled',
          totalFiles: mergeFiles.length,
          message: '用户已取消',
        });
        appendLog(tabToCancel, 'warning', '用户已取消所有任务');
      }

      setBusyTab(null);
    },
    [activeTab, appendLog, busyTab, cancelChoiceTab, mergeFiles.length, splitFiles.length],
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

  const skipCurrentFile = useCallback(async (): Promise<void> => {
    if (cancelChoiceTab !== 'split') {
      return;
    }

    const currentFile = splitFiles.find((file) => file.status === 'processing');
    setCancelChoiceTab(null);

    if (!currentFile) {
      appendLog('split', 'warning', '当前没有正在处理的文件');
      return;
    }

    const result = await window.officeTools.jobs.skipCurrentFile();
    if (result.success === false) {
      appendLog('split', 'error', result.error);
      return;
    }

    appendLog('split', 'warning', `正在跳过当前文件 ${currentFile.name}`);
  }, [appendLog, cancelChoiceTab, splitFiles]);

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
            fieldRow={mergeFieldRow}
            files={mergeFiles}
            folder={mergeFolder}
            isBusy={busyTab === 'merge'}
            logs={selectedLogs}
            mode={mergeMode}
            onCancel={requestCancelJob}
            onFieldRowChange={changeMergeFieldRow}
            onModeChange={changeMergeMode}
            onSelectFolder={selectMergeFolder}
            onSelectOutputDirectory={selectOutputDirectory}
            onSheetChange={changeMergeSheet}
            onStart={startMerge}
            outputDirectory={outputDirectory}
            parsedWorkbooks={mergeParsedWorkbooks}
            progress={mergeProgress}
            sheetSelections={mergeSheetSelections}
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
          description={completionDialog.warning
            ? `${completionDialog.warning} 任务已完成，输出目录：${completionDialog.outputDirectory || '-'}`
            : `任务已完成，输出目录：${completionDialog.outputDirectory || '-'}`}
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
