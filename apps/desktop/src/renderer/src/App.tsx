import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MergeMode, ParsedWorkbook, StartMergeJobInput, StartSplitJobInput } from '@shared/types/excel';
import type { FileListItem, SelectedFile, SelectedFolder } from '@shared/types/files';
import type { JobProgress, LogEntry, WorkflowTab } from '@shared/types/jobs';
import type { SpeechDurationProbeItem, SpeechEvent, SpeechModelSettings, SpeechTranscriptionItem, SpeechTranscriptionProgress } from '@shared/types/speech';
import { APP_CONFIG } from '@shared/constants/config';
import { AppShell } from './components/layout/AppShell';
import type { AppModule } from './components/layout/AppShell';
import { ModalDialog } from './components/ui/ModalDialog';
import { MergeWorkflow } from './components/workflows/MergeWorkflow';
import { SplitWorkflow } from './components/workflows/SplitWorkflow';
import { SpeechWorkflow } from './components/workflows/SpeechWorkflow';
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

const idleSpeechProgress: SpeechTranscriptionProgress = {
  currentFileIndex: 0,
  totalFiles: 0,
  message: '等待处理',
};

type CompletionDialogState = {
  outputDirectory: string;
  tab: WorkflowTab | 'speech';
  warning?: string;
};

type LongSpeechConfirmationState = {
  sourceIds: string[];
  longFiles: SpeechDurationProbeItem[];
};

type ModelDownloadConfirmationState = {
  sourceIds: string[];
};

type SpeechLogEntry = {
  id: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestampMs: number;
};

const toFileListItems = (files: SelectedFile[]): FileListItem[] => {
  return files.map((file) => ({
    ...file,
    status: 'pending',
  }));
};

const supportedExcelExtensions = new Set<string>(APP_CONFIG.SUPPORTED_EXCEL_EXTENSIONS);
const supportedAudioExtensions = new Set<string>(APP_CONFIG.SUPPORTED_AUDIO_EXTENSIONS);

const isSupportedExcelFile = (file: SelectedFile): boolean => {
  return supportedExcelExtensions.has(file.extension.toLowerCase());
};

const isWithinFileSizeLimit = (file: SelectedFile): boolean => {
  return file.sizeBytes <= APP_CONFIG.LIMITS.MAX_FILE_SIZE_BYTES;
};

const isSupportedAudioFile = (file: SelectedFile): boolean => {
  return supportedAudioExtensions.has(file.extension.toLowerCase());
};

const toSpeechItems = (files: SelectedFile[]): SpeechTranscriptionItem[] => {
  return files.map((file) => ({
    ...file,
    rawText: '',
    status: 'pending',
    transcript: '',
  }));
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

const formatDurationText = (durationSeconds: number): string => {
  const totalMinutes = Math.max(0, Math.round(durationSeconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours} 小时 ${minutes} 分钟`;
  }

  if (hours > 0) {
    return `${hours} 小时`;
  }

  return `${minutes} 分钟`;
};

export const App = (): JSX.Element => {
  const [activeModule, setActiveModule] = useState<AppModule>('tables');
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
  const [speechFiles, setSpeechFiles] = useState<SpeechTranscriptionItem[]>([]);
  const [speechProgress, setSpeechProgress] = useState<SpeechTranscriptionProgress>(idleSpeechProgress);
  const [speechLogs, setSpeechLogs] = useState<SpeechLogEntry[]>([]);
  const [isSpeechBusy, setIsSpeechBusy] = useState(false);
  const [isSpeechStarting, setIsSpeechStarting] = useState(false);
  const [speechElapsedSeconds, setSpeechElapsedSeconds] = useState(0);
  const speechStartTimeRef = useRef<number | null>(null);
  const speechRequestLockRef = useRef(false);
  const speechRunLockRef = useRef(false);
  const [longSpeechConfirmation, setLongSpeechConfirmation] = useState<LongSpeechConfirmationState | null>(null);
  const [modelDownloadConfirmation, setModelDownloadConfirmation] = useState<ModelDownloadConfirmationState | null>(null);
  const [speechModelSettings, setSpeechModelSettings] = useState<SpeechModelSettings | null>(null);
  const [speechModelBaseUrlDraft, setSpeechModelBaseUrlDraft] = useState('');

  const appendLog = useCallback((tab: WorkflowTab, level: LogEntry['level'], message: string): void => {
    setLogs((currentLogs) => ({
      ...currentLogs,
      [tab]: [...currentLogs[tab], createLogEntry(tab, level, message)],
    }));
  }, []);

  const appendSpeechLog = useCallback((level: SpeechLogEntry['level'], message: string): void => {
    setSpeechLogs((currentLogs) => [
      ...currentLogs,
      {
        id: crypto.randomUUID(),
        level,
        message,
        timestampMs: Date.now(),
      },
    ]);
  }, []);

  useEffect(() => {
    if (!isSpeechBusy && !isSpeechStarting) {
      speechStartTimeRef.current = null;
      setSpeechElapsedSeconds(0);
      return undefined;
    }

    if (speechStartTimeRef.current === null) {
      speechStartTimeRef.current = Date.now();
      setSpeechElapsedSeconds(0);
    }

    const intervalId = window.setInterval(() => {
      if (speechStartTimeRef.current !== null) {
        setSpeechElapsedSeconds(Math.floor((Date.now() - speechStartTimeRef.current) / 1000));
      }
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isSpeechBusy, isSpeechStarting]);


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

  useEffect(() => {
    return window.officeTools.speech.onSpeechEvent((event: SpeechEvent) => {
      if (event.type === 'progress') {
        setSpeechProgress(event.progress);
        return;
      }

      if (event.type === 'log') {
        setSpeechLogs((currentLogs) => [
          ...currentLogs,
          {
            id: crypto.randomUUID(),
            level: event.level,
            message: event.message,
            timestampMs: event.timestampMs,
          },
        ]);
        return;
      }

      if (event.type === 'model-download-progress') {
        const percentText = event.progress.percent === undefined ? '' : ` ${event.progress.percent}%`;
        const phaseText = event.progress.phase === 'downloading'
          ? '正在下载'
          : event.progress.phase === 'extracting'
            ? '正在解压'
            : '下载完成';
        setSpeechProgress({
          currentFileIndex: 0,
          message: `${phaseText} ${event.progress.packageName}${percentText}`,
          totalFiles: 0,
        });
        return;
      }

      setSpeechFiles((currentFiles) =>
        currentFiles.map((file) => {
          if (file.sourceId !== event.item.sourceId) {
            return file;
          }

          return event.item;
        }),
      );
    });
  }, []);

  const selectedLogs = useMemo(() => logs[activeTab], [activeTab, logs]);
  const canExportSpeech = useMemo(() => {
    return speechFiles.some((file) => file.status === 'completed' && file.transcript.trim().length > 0) && outputDirectory.length > 0;
  }, [outputDirectory, speechFiles]);
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

  const removeMergeFile = useCallback(
    (sourceId: string): void => {
      if (busyTab === 'merge') {
        return;
      }

      const fileToRemove = mergeFiles.find((file) => file.sourceId === sourceId);
      setMergeFiles((currentFiles) => currentFiles.filter((file) => file.sourceId !== sourceId));
      setMergeParsedWorkbooks((currentWorkbooks) => currentWorkbooks.filter((workbook) => workbook.sourceId !== sourceId));
      setMergeSheetSelections((currentSelections) => {
        const nextSelections = { ...currentSelections };
        delete nextSelections[sourceId];
        return nextSelections;
      });
      setMergeProgress((currentProgress) => ({
        ...currentProgress,
        currentFileIndex: Math.max(0, Math.min(currentProgress.currentFileIndex, Math.max(mergeFiles.length - 1, 0))),
        message: mergeFiles.length <= 1 ? '暂无可合并文件' : '已移除文件',
        stage: mergeFiles.length <= 1 ? 'idle' : currentProgress.stage,
        totalFiles: Math.max(mergeFiles.length - 1, 0),
      }));

      if (fileToRemove) {
        appendLog('merge', 'warning', `已移除 ${fileToRemove.name}`);
      }
    },
    [appendLog, busyTab, mergeFiles],
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

  const changeModule = useCallback((module: AppModule): void => {
    setActiveModule(module);
  }, []);

  const selectSpeechFiles = useCallback(async (): Promise<void> => {
    const result = await window.officeTools.dialog.selectAudioFiles();
    if (result.success === false) {
      appendSpeechLog('error', result.error);
      return;
    }

    if (result.data.length === 0) {
      return;
    }

    const unsupportedFiles = result.data.filter((file) => !isSupportedAudioFile(file));
    const validFiles = result.data.filter((file) => isSupportedAudioFile(file));
    unsupportedFiles.forEach((file) => {
      appendSpeechLog('warning', `${file.name} 类型不支持，已排除`);
    });

    if (validFiles.length === 0) {
      appendSpeechLog('error', '没有符合条件的音频文件');
      return;
    }

    const nextFiles = toSpeechItems(validFiles.slice(0, APP_CONFIG.LIMITS.MAX_FILES));
    if (validFiles.length > APP_CONFIG.LIMITS.MAX_FILES) {
      appendSpeechLog('warning', `最多支持 ${APP_CONFIG.LIMITS.MAX_FILES} 个文件，已保留前 ${APP_CONFIG.LIMITS.MAX_FILES} 个`);
    }

    setSpeechFiles(nextFiles);
    setSpeechProgress({
      ...idleSpeechProgress,
      totalFiles: nextFiles.length,
    });
    appendSpeechLog('info', `已选择 ${nextFiles.length} 个音频文件`);
  }, [appendSpeechLog]);

  const removeSpeechFile = useCallback((sourceId: string): void => {
    setSpeechFiles((currentFiles) => currentFiles.filter((file) => file.sourceId !== sourceId));
  }, []);

  const runSpeechFiles = useCallback(
    async (sourceIds: string[]): Promise<void> => {
      if (sourceIds.length === 0) {
        appendSpeechLog('warning', '请先选择需要转写的音频文件');
        return;
      }

      if (speechRunLockRef.current) {
        appendSpeechLog('warning', '正在转写，请勿重复点击开始按钮');
        return;
      }

      speechRunLockRef.current = true;
      setIsSpeechBusy(true);
      setSpeechFiles((currentFiles) =>
        currentFiles.map((file) =>
          sourceIds.includes(file.sourceId)
            ? {
                ...file,
                error: undefined,
                rawText: '',
                status: 'pending',
                transcript: '',
              }
            : file,
        ),
      );
      setSpeechProgress({
        currentFileIndex: 0,
        message: '准备转写',
        totalFiles: sourceIds.length,
      });

      try {
        const result = await window.officeTools.speech.startTranscriptionJob({ sourceIds });
        if (result.success === false) {
          if (result.code !== 'JOB_CANCELED') {
            appendSpeechLog('error', result.error);
          }
          return;
        }

        setSpeechFiles((currentFiles) =>
          currentFiles.map((file) => result.data.items.find((item) => item.sourceId === file.sourceId) ?? file),
        );
        appendSpeechLog(
          result.data.summary.failedFiles > 0 ? 'warning' : 'success',
          `转写完成：成功 ${result.data.summary.completedFiles} 个，失败 ${result.data.summary.failedFiles} 个`,
        );
      } catch (error) {
        appendSpeechLog('error', getUnknownErrorMessage(error));
      } finally {
        speechRunLockRef.current = false;
        setIsSpeechBusy(false);
      }
    },
    [appendSpeechLog],
  );

  const requestSpeechTranscription = useCallback(
    async (sourceIds: string[]): Promise<void> => {
      if (sourceIds.length === 0) {
        appendSpeechLog('warning', '请先选择需要转写的音频文件');
        return;
      }

      if (speechRequestLockRef.current || speechRunLockRef.current) {
        appendSpeechLog('warning', '正在准备或转写，请勿重复点击开始按钮');
        return;
      }

      speechRequestLockRef.current = true;
      setIsSpeechStarting(true);
      setSpeechProgress({
        currentFileIndex: 0,
        message: '正在检查模型和音频时长',
        totalFiles: sourceIds.length,
      });

      try {
        const modelStatus = await window.officeTools.speech.getModelStatus();
        if (modelStatus.success === false) {
          appendSpeechLog('error', modelStatus.error);
          return;
        }

        if (!modelStatus.data.ready) {
          setModelDownloadConfirmation({ sourceIds });
          return;
        }

        const result = await window.officeTools.speech.probeDurations({ sourceIds });
        if (result.success === false) {
          appendSpeechLog('error', result.error);
          return;
        }

        const longFiles = result.data.items.filter((item) => item.isLongDuration);
        if (longFiles.length > 0) {
          setLongSpeechConfirmation({ longFiles, sourceIds });
          return;
        }

        speechRequestLockRef.current = false;
        setIsSpeechStarting(false);
        await runSpeechFiles(sourceIds);
      } finally {
        speechRequestLockRef.current = false;
        setIsSpeechStarting(false);
      }
    },
    [appendSpeechLog, runSpeechFiles],
  );

  const startSpeechTranscription = useCallback(async (): Promise<void> => {
    await requestSpeechTranscription(speechFiles.map((file) => file.sourceId));
  }, [requestSpeechTranscription, speechFiles]);

  const retrySpeechFile = useCallback(
    (sourceId: string): void => {
      void requestSpeechTranscription([sourceId]);
    },
    [requestSpeechTranscription],
  );

  const continueLongSpeechTranscription = useCallback((): void => {
    const confirmation = longSpeechConfirmation;
    if (!confirmation) {
      return;
    }

    setLongSpeechConfirmation(null);
    appendSpeechLog('warning', '用户确认继续转写超长音频，处理时间可能较长');
    void runSpeechFiles(confirmation.sourceIds);
  }, [appendSpeechLog, longSpeechConfirmation, runSpeechFiles]);

  const cancelLongSpeechTranscription = useCallback((): void => {
    setLongSpeechConfirmation(null);
    appendSpeechLog('warning', '已取消超长音频转写');
  }, [appendSpeechLog]);

  const continueModelDownload = useCallback(async (): Promise<void> => {
    const confirmation = modelDownloadConfirmation;
    if (!confirmation) {
      return;
    }

    setModelDownloadConfirmation(null);
    setIsSpeechBusy(true);
    appendSpeechLog('info', '开始下载语音模型，下载完成后将继续转写');

    try {
      const result = await window.officeTools.speech.ensureModels();
      if (result.success === false) {
        appendSpeechLog('error', result.error);
        return;
      }

      appendSpeechLog('success', '语音模型下载完成');
      await requestSpeechTranscription(confirmation.sourceIds);
    } finally {
      setIsSpeechBusy(false);
    }
  }, [appendSpeechLog, modelDownloadConfirmation, requestSpeechTranscription]);

  const cancelModelDownload = useCallback((): void => {
    setModelDownloadConfirmation(null);
    appendSpeechLog('warning', '已取消语音模型下载和本次转写');
  }, [appendSpeechLog]);

  const openSpeechModelSettings = useCallback(async (): Promise<void> => {
    const result = await window.officeTools.speech.getModelSettings();
    if (result.success === false) {
      appendSpeechLog('error', result.error);
      return;
    }

    setSpeechModelSettings(result.data);
    setSpeechModelBaseUrlDraft(result.data.modelBaseUrl);
  }, [appendSpeechLog]);

  const closeSpeechModelSettings = useCallback((): void => {
    setSpeechModelSettings(null);
    setSpeechModelBaseUrlDraft('');
  }, []);

  const saveSpeechModelSettings = useCallback(async (): Promise<void> => {
    const result = await window.officeTools.speech.setModelSettings({
      modelBaseUrl: speechModelBaseUrlDraft.trim(),
    });
    if (result.success === false) {
      appendSpeechLog('error', result.error);
      return;
    }

    setSpeechModelSettings(null);
    setSpeechModelBaseUrlDraft('');
    appendSpeechLog('success', '模型下载地址已保存');
  }, [appendSpeechLog, speechModelBaseUrlDraft]);

  const cancelSpeechTranscription = useCallback(async (): Promise<void> => {
    const result = await window.officeTools.jobs.cancelActiveJob();
    if (result.success === false) {
      appendSpeechLog('error', result.error);
      return;
    }

    setSpeechFiles((currentFiles) =>
      currentFiles.map((file) => {
        if (file.status === 'pending' || file.status === 'processing') {
          return {
            ...file,
            error: '用户已取消',
            status: 'canceled',
          };
        }

        return file;
      }),
    );
    setSpeechProgress({
      ...idleSpeechProgress,
      totalFiles: 0,
      message: '用户已取消',
    });
    setIsSpeechBusy(false);
    appendSpeechLog('warning', '用户已取消语音转文字任务');
  }, [appendSpeechLog]);

  const copySpeechTranscript = useCallback(
    async (sourceId: string): Promise<void> => {
      const item = speechFiles.find((file) => file.sourceId === sourceId);
      if (!item) {
        appendSpeechLog('error', '转写结果不存在');
        return;
      }

      await navigator.clipboard.writeText(item.transcript);
      appendSpeechLog('success', `已复制 ${item.name} 的转写文本`);
    },
    [appendSpeechLog, speechFiles],
  );

  const copyAllSpeechTranscripts = useCallback(async (): Promise<void> => {
    const textToCopy = speechFiles
      .filter((file) => file.status === 'completed')
      .map((file) => `# ${file.name}\n${file.transcript}`)
      .join('\n\n');

    if (!textToCopy) {
      appendSpeechLog('warning', '没有可复制的转写结果');
      return;
    }

    await navigator.clipboard.writeText(textToCopy);
    appendSpeechLog('success', '已复制全部转写文本');
  }, [appendSpeechLog, speechFiles]);

  const exportSpeechTranscripts = useCallback(async (): Promise<void> => {
    const completedItems = speechFiles.filter((file) => file.status === 'completed' && file.transcript.trim().length > 0);
    if (completedItems.length === 0) {
      appendSpeechLog('warning', '没有可导出的转写结果');
      return;
    }

    if (!outputDirectory) {
      appendSpeechLog('warning', '请先选择保存路径');
      return;
    }

    const result = await window.officeTools.speech.exportTranscripts({
      outputDirectory,
      items: completedItems.map((item) => ({
        name: item.name,
        sourceId: item.sourceId,
        transcript: item.transcript,
      })),
    });

    if (result.success === false) {
      appendSpeechLog('error', result.error);
      return;
    }

    setCompletionDialog({
      outputDirectory: result.data.outputDirectory,
      tab: 'speech',
      warning: `已导出 ${result.data.files.length} 个 TXT 文件。`,
    });
    appendSpeechLog('success', `已导出 ${result.data.files.length} 个 TXT 文件`);
  }, [appendSpeechLog, outputDirectory, speechFiles]);

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
      if (completionDialog.tab === 'speech') {
        appendSpeechLog('error', result.error);
      } else {
        appendLog(completionDialog.tab, 'error', result.error);
      }
      return;
    }

    if (completionDialog.tab === 'speech') {
      appendSpeechLog('info', '已打开输出文件夹');
    } else {
      appendLog(completionDialog.tab, 'info', '已打开输出文件夹');
    }
    setCompletionDialog(null);
  }, [appendLog, appendSpeechLog, completionDialog]);

  return (
    <>
      <AppShell activeModule={activeModule} activeTab={activeTab} onModuleChange={changeModule} onTabChange={setActiveTab}>
        {activeModule === 'speech' ? (
          <SpeechWorkflow
            canExport={canExportSpeech}
            files={speechFiles}
            elapsedSeconds={speechElapsedSeconds}
            isBusy={isSpeechBusy}
            isStarting={isSpeechStarting}
            logs={speechLogs}
            onCancel={cancelSpeechTranscription}
            onCopyAll={() => {
              void copyAllSpeechTranscripts();
            }}
            onCopyTranscript={(sourceId) => {
              void copySpeechTranscript(sourceId);
            }}
            onExport={() => {
              void exportSpeechTranscripts();
            }}
            onOpenSettings={() => {
              void openSpeechModelSettings();
            }}
            onRemoveFile={removeSpeechFile}
            onRetryFile={retrySpeechFile}
            onSelectFiles={selectSpeechFiles}
            onSelectOutputDirectory={selectOutputDirectory}
            onStart={() => {
              void startSpeechTranscription();
            }}
            outputDirectory={outputDirectory}
            progress={speechProgress}
          />
        ) : activeTab === 'split' ? (
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
            onRemoveFile={removeMergeFile}
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
      {speechModelSettings ? (
        <ModalDialog
          actions={[
            { label: '取消', onClick: closeSpeechModelSettings },
            { label: '保存', onClick: () => { void saveSpeechModelSettings(); }, variant: 'primary' },
          ]}
          description="配置模型下载地址。"
          title="语音模型设置"
        >
          <label className="modal-field">
            <span>模型下载地址</span>
            <input
              className="modal-field__input"
              onChange={(event) => setSpeechModelBaseUrlDraft(event.target.value)}
              placeholder="https://2.22.2.2"
              type="url"
              value={speechModelBaseUrlDraft}
            />
          </label>
        </ModalDialog>
      ) : null}
      {modelDownloadConfirmation ? (
        <ModalDialog
          actions={[
            { label: '取消转换', onClick: cancelModelDownload },
            { label: '下载并继续', onClick: () => { void continueModelDownload(); }, variant: 'primary' },
          ]}
          description="首次使用语音转文字需要下载本地 ASR 模型。模型下载完成后将缓存在本机，后续可离线转写。"
          title="需要下载语音模型"
        />
      ) : null}
      {longSpeechConfirmation ? (
        <ModalDialog
          actions={[
            { label: '不转换', onClick: cancelLongSpeechTranscription },
            {
              label: '继续转换',
              onClick: continueLongSpeechTranscription,
              variant: 'primary',
            },
          ]}
          description={`以下音频超过 4 小时，转换时间可能比较长：${longSpeechConfirmation.longFiles
            .map((file) => `${file.name}（${formatDurationText(file.durationSeconds)}）`)
            .join('、')}。是否继续转换？`}
          title="音频时长较长"
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
