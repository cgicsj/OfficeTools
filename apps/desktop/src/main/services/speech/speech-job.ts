import { access, mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  ExportSpeechTranscriptsInput,
  ExportSpeechTranscriptsResult,
  ProbeSpeechDurationsInput,
  ProbeSpeechDurationsResult,
  SpeechEvent,
  SpeechTranscriptionItem,
  SpeechTranscriptionJobResult,
  StartSpeechTranscriptionInput,
} from '../../../shared/types/speech';
import { APP_CONFIG } from '../../../shared/constants/config';
import { getRegisteredFilePath } from '../file-selection/file-registry';
import { setActiveJobAbortController } from '../jobs/job-cancellation';
import { probeAudioDurationSeconds, transcribeAudioFile } from './speech-helper';
import { getSpeechModelEnvironment } from './speech-models';

type EmitSpeechEvent = (event: SpeechEvent) => void;

class SpeechJobCanceledError extends Error {
  constructor() {
    super('用户已取消');
  }
}

const supportedAudioExtensions = new Set<string>(APP_CONFIG.SUPPORTED_AUDIO_EXTENSIONS);

const emitLog = (emit: EmitSpeechEvent, level: SpeechEventLogLevel, message: string): void => {
  emit({
    type: 'log',
    level,
    message,
    timestampMs: Date.now(),
  });
};

type SpeechEventLogLevel = Extract<SpeechEvent, { type: 'log' }>['level'];

const createItem = async (sourceId: string): Promise<SpeechTranscriptionItem> => {
  const filePath = getRegisteredFilePath(sourceId);
  if (!filePath) {
    throw new Error('音频文件引用已失效，请重新选择文件');
  }

  const fileStats = await stat(filePath);
  const extension = path.extname(filePath).replace('.', '').toLowerCase();

  return {
    sourceId,
    name: path.basename(filePath),
    extension,
    sizeBytes: fileStats.size,
    displayPath: filePath,
    status: 'pending',
    transcript: '',
    rawText: '',
  };
};

const markItem = (
  item: SpeechTranscriptionItem,
  status: SpeechTranscriptionItem['status'],
  fields: Partial<SpeechTranscriptionItem> = {},
): SpeechTranscriptionItem => {
  return {
    ...item,
    ...fields,
    status,
  };
};

const summarize = (items: SpeechTranscriptionItem[]): SpeechTranscriptionJobResult['summary'] => {
  return {
    totalFiles: items.length,
    completedFiles: items.filter((item) => item.status === 'completed').length,
    failedFiles: items.filter((item) => item.status === 'failed').length,
    canceledFiles: items.filter((item) => item.status === 'canceled').length,
  };
};

export const isSpeechJobCanceledError = (error: unknown): boolean => {
  return error instanceof SpeechJobCanceledError;
};


export const probeSpeechAudioDurations = async (
  input: ProbeSpeechDurationsInput,
): Promise<ProbeSpeechDurationsResult> => {
  const items: ProbeSpeechDurationsResult['items'] = [];

  for (const sourceId of input.sourceIds) {
    const filePath = getRegisteredFilePath(sourceId);
    if (!filePath) {
      throw new Error('音频文件引用已失效，请重新选择文件');
    }

    const durationSeconds = await probeAudioDurationSeconds(filePath);
    items.push({
      sourceId,
      name: path.basename(filePath),
      durationSeconds,
      isLongDuration: durationSeconds > APP_CONFIG.LIMITS.SPEECH_LONG_AUDIO_THRESHOLD_SECONDS,
    });
  }

  return { items };
};

export const runSpeechTranscriptionJob = async (
  input: StartSpeechTranscriptionInput,
  emit: EmitSpeechEvent,
): Promise<SpeechTranscriptionJobResult> => {
  const abortController = new AbortController();
  setActiveJobAbortController(abortController);

  const items = await Promise.all(input.sourceIds.map((sourceId) => createItem(sourceId)));
  const modelEnvironment = process.env.OFFICE_TOOLS_SPEECH_FAKE === '1' ? {} : await getSpeechModelEnvironment();
  const resultItems: SpeechTranscriptionItem[] = [];

  try {
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (abortController.signal.aborted) {
        const canceledItems = items.slice(index).map((pendingItem) => markItem(pendingItem, 'canceled'));
        canceledItems.forEach((canceledItem) => emit({ type: 'item-status', item: canceledItem }));
        resultItems.push(...canceledItems);
        throw new SpeechJobCanceledError();
      }

      emit({
        type: 'progress',
        progress: {
          currentFileIndex: index + 1,
          totalFiles: items.length,
          currentFileName: item.name,
          message: `正在转写 ${item.name}`,
        },
      });

      if (!supportedAudioExtensions.has(item.extension)) {
        const failedItem = markItem(item, 'failed', {
          error: `${item.extension.toUpperCase()} 类型不支持`,
        });
        resultItems.push(failedItem);
        emit({ type: 'item-status', item: failedItem });
        emitLog(emit, 'warning', `${item.name} 类型不支持，已跳过`);
        continue;
      }

      const processingItem = markItem(item, 'processing');
      emit({ type: 'item-status', item: processingItem });

      try {
        const filePath = getRegisteredFilePath(item.sourceId);
        if (!filePath) {
          throw new Error('音频文件引用已失效，请重新选择文件');
        }

        const helperResult = await transcribeAudioFile(filePath, abortController.signal, modelEnvironment, (message) => {
          emit({
            type: 'progress',
            progress: {
              currentFileIndex: index + 1,
              totalFiles: items.length,
              currentFileName: item.name,
              message: `${item.name}：${message}`,
            },
          });
        });
        const completedItem = markItem(processingItem, 'completed', {
          transcript: helperResult.text,
          rawText: helperResult.rawText,
          durationSeconds: helperResult.durationSeconds,
          inferenceLatencySeconds: helperResult.inferenceLatencySeconds,
          confidence: helperResult.confidence,
        });
        resultItems.push(completedItem);
        emit({ type: 'item-status', item: completedItem });
        emitLog(emit, 'success', `${item.name} 转写完成`);
      } catch (error) {
        if (abortController.signal.aborted) {
          const canceledItem = markItem(processingItem, 'canceled', { error: '用户已取消' });
          resultItems.push(canceledItem);
          emit({ type: 'item-status', item: canceledItem });
          throw new SpeechJobCanceledError();
        }

        const failedItem = markItem(processingItem, 'failed', {
          error: error instanceof Error && error.message ? error.message : '语音转文字失败',
        });
        resultItems.push(failedItem);
        emit({ type: 'item-status', item: failedItem });
        emitLog(emit, 'error', `${item.name} 转写失败：${failedItem.error ?? '未知错误'}`);
      }
    }

    emit({
      type: 'progress',
      progress: {
        currentFileIndex: items.length,
        totalFiles: items.length,
        message: '批量转写完成',
      },
    });

    return {
      items: resultItems,
      summary: summarize(resultItems),
    };
  } finally {
    setActiveJobAbortController(null);
  }
};

const sanitizeBaseName = (name: string): string => {
  const parsed = path.parse(name).name.trim();
  const sanitized = parsed.replace(/[\\/:*?"<>|]/g, '_');
  return sanitized || 'transcript';
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const createUniqueTranscriptPath = async (
  outputDirectory: string,
  baseName: string,
  usedPaths: Set<string>,
): Promise<string> => {
  let suffix = 0;

  while (true) {
    const fileName = suffix === 0 ? `${baseName}.txt` : `${baseName}-${suffix + 1}.txt`;
    const targetPath = path.join(outputDirectory, fileName);

    if (!usedPaths.has(targetPath) && !(await fileExists(targetPath))) {
      usedPaths.add(targetPath);
      return targetPath;
    }

    suffix += 1;
  }
};

export const exportSpeechTranscripts = async (
  input: ExportSpeechTranscriptsInput,
): Promise<ExportSpeechTranscriptsResult> => {
  await mkdir(input.outputDirectory, { recursive: true });
  const files: ExportSpeechTranscriptsResult['files'] = [];
  const usedPaths = new Set<string>();

  for (const item of input.items) {
    const targetPath = await createUniqueTranscriptPath(input.outputDirectory, sanitizeBaseName(item.name), usedPaths);
    await writeFile(targetPath, item.transcript, 'utf8');
    files.push({
      sourceId: item.sourceId,
      path: targetPath,
    });
  }

  return {
    outputDirectory: input.outputDirectory,
    files,
  };
};
