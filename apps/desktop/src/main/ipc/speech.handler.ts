import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/channels';
import {
  exportSpeechTranscriptsInputSchema,
  startSpeechTranscriptionInputSchema,
} from '../../shared/types/speech';
import {
  exportSpeechTranscripts,
  isSpeechJobCanceledError,
  runSpeechTranscriptionJob,
} from '../services/speech/speech-job';

export const setupSpeechHandlers = (): void => {
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
