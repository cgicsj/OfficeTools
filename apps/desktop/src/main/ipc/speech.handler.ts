import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/channels';
import {
  exportSpeechTranscriptsInputSchema,
  probeSpeechDurationsInputSchema,
  setSpeechModelSettingsInputSchema,
  startSpeechTranscriptionInputSchema,
} from '../../shared/types/speech';
import {
  exportSpeechTranscripts,
  probeSpeechAudioDurations,
  isSpeechJobCanceledError,
  runSpeechTranscriptionJob,
} from '../services/speech/speech-job';
import {
  ensureSpeechModels,
  getSpeechModelSettings,
  getSpeechModelStatus,
  updateSpeechModelSettings,
} from '../services/speech/speech-models';

export const setupSpeechHandlers = (): void => {

  ipcMain.handle(IPC_CHANNELS.SPEECH.GET_MODEL_SETTINGS, async () => {
    try {
      return { success: true, data: await getSpeechModelSettings() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error && error.message ? error.message : '读取模型设置失败',
        code: 'SPEECH_MODEL_SETTINGS_FAILED',
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SPEECH.SET_MODEL_SETTINGS, async (_event, input: unknown) => {
    const parsedInput = setSpeechModelSettingsInputSchema.safeParse(input);
    if (parsedInput.success === false) {
      return {
        success: false,
        error: 'Invalid speech model settings input',
        code: 'INVALID_SPEECH_MODEL_SETTINGS_INPUT',
      };
    }

    try {
      return { success: true, data: await updateSpeechModelSettings(parsedInput.data.modelBaseUrl) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error && error.message ? error.message : '保存模型设置失败',
        code: 'SPEECH_MODEL_SETTINGS_FAILED',
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SPEECH.GET_MODEL_STATUS, async () => {
    try {
      return { success: true, data: await getSpeechModelStatus() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error && error.message ? error.message : '读取模型状态失败',
        code: 'SPEECH_MODEL_STATUS_FAILED',
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SPEECH.ENSURE_MODELS, async (event) => {
    try {
      const result = await ensureSpeechModels((progress) => {
        event.sender.send(IPC_CHANNELS.SPEECH.EVENT, {
          type: 'model-download-progress',
          progress,
        });
      });
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error && error.message ? error.message : '下载语音模型失败',
        code: 'SPEECH_MODEL_DOWNLOAD_FAILED',
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SPEECH.PROBE_DURATIONS, async (_event, input: unknown) => {
    const parsedInput = probeSpeechDurationsInputSchema.safeParse(input);
    if (parsedInput.success === false) {
      return {
        success: false,
        error: 'Invalid speech duration probe input',
        code: 'INVALID_SPEECH_DURATION_PROBE_INPUT',
      };
    }

    try {
      const result = await probeSpeechAudioDurations(parsedInput.data);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof Error && error.message) {
        return {
          success: false,
          error: error.message,
          code: 'SPEECH_DURATION_PROBE_FAILED',
        };
      }

      return {
        success: false,
        error: '读取音频时长失败',
        code: 'SPEECH_DURATION_PROBE_FAILED',
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SPEECH.START_TRANSCRIPTION_JOB, async (event, input: unknown) => {
    const parsedInput = startSpeechTranscriptionInputSchema.safeParse(input);
    if (parsedInput.success === false) {
      return {
        success: false,
        error: 'Invalid speech transcription input',
        code: 'INVALID_SPEECH_TRANSCRIPTION_INPUT',
      };
    }

    try {
      const result = await runSpeechTranscriptionJob(parsedInput.data, (speechEvent) => {
        event.sender.send(IPC_CHANNELS.SPEECH.EVENT, speechEvent);
      });
      return { success: true, data: result };
    } catch (error) {
      if (isSpeechJobCanceledError(error)) {
        return {
          success: false,
          error: '用户已取消',
          code: 'JOB_CANCELED',
        };
      }

      if (error instanceof Error && error.message) {
        return {
          success: false,
          error: error.message,
          code: 'SPEECH_TRANSCRIPTION_FAILED',
        };
      }

      return {
        success: false,
        error: '语音转文字任务失败',
        code: 'SPEECH_TRANSCRIPTION_FAILED',
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SPEECH.EXPORT_TRANSCRIPTS, async (_event, input: unknown) => {
    const parsedInput = exportSpeechTranscriptsInputSchema.safeParse(input);
    if (parsedInput.success === false) {
      return {
        success: false,
        error: 'Invalid speech transcript export input',
        code: 'INVALID_SPEECH_EXPORT_INPUT',
      };
    }

    try {
      const result = await exportSpeechTranscripts(parsedInput.data);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof Error && error.message) {
        return {
          success: false,
          error: error.message,
          code: 'SPEECH_EXPORT_FAILED',
        };
      }

      return {
        success: false,
        error: '导出转写文本失败',
        code: 'SPEECH_EXPORT_FAILED',
      };
    }
  });
};
