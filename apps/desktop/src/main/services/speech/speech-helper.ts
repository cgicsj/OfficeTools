import { app } from 'electron';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

type HelperSuccess = {
  success: true;
  text: string;
  raw_text?: string;
  duration?: number;
  inference_latency?: number;
  confidence?: number;
};

type HelperFailure = {
  success: false;
  error: string;
  code?: string;
};

type HelperResult = HelperSuccess | HelperFailure;

export type SpeechHelperResult = {
  text: string;
  rawText: string;
  durationSeconds: number;
  inferenceLatencySeconds: number;
  confidence: number;
};

const helperRelativePath = path.join('resources', 'speech-helper', 'transcribe_file.py');

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const resolveHelperPath = async (): Promise<string> => {
  const candidates = [
    path.join(process.cwd(), helperRelativePath),
    path.join(process.cwd(), 'apps', 'desktop', helperRelativePath),
    path.join(app.getAppPath(), helperRelativePath),
  ];

  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'speech-helper', 'transcribe_file.py'));
  }

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  throw new Error('未找到语音转文字 Python helper，请检查应用资源是否完整');
};

const parseHelperResult = (stdout: string): HelperResult => {
  const lines = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const lastLine = lines.at(-1);
  if (!lastLine) {
    return { success: false, error: 'Python helper 未返回结果' };
  }

  const parsed: unknown = JSON.parse(lastLine);
  if (typeof parsed !== 'object' || parsed === null || !('success' in parsed)) {
    return { success: false, error: 'Python helper 返回格式无效' };
  }

  return parsed as HelperResult;
};

export const transcribeAudioFile = async (audioPath: string, signal: AbortSignal): Promise<SpeechHelperResult> => {
  const helperPath = await resolveHelperPath();
  const pythonExecutable = process.env.OFFICE_TOOLS_PYTHON ?? 'python3';

  return await new Promise<SpeechHelperResult>((resolve, reject) => {
    const child = spawn(pythonExecutable, [helperPath, audioPath], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = (callback: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      signal.removeEventListener('abort', abortChild);
      callback();
    };

    const abortChild = (): void => {
      child.kill('SIGTERM');
      finish(() => {
        reject(new Error('用户已取消'));
      });
    };

    if (signal.aborted) {
      abortChild();
      return;
    }

    signal.addEventListener('abort', abortChild);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      finish(() => {
        reject(new Error(`无法启动 Python helper: ${error.message}`));
      });
    });
    child.on('close', () => {
      finish(() => {
        try {
          const result = parseHelperResult(stdout);
          if (result.success === false) {
            reject(new Error(result.error || stderr || '语音转文字失败'));
            return;
          }

          resolve({
            text: result.text,
            rawText: result.raw_text ?? result.text,
            durationSeconds: result.duration ?? 0,
            inferenceLatencySeconds: result.inference_latency ?? 0,
            confidence: result.confidence ?? 0,
          });
        } catch (error) {
          if (error instanceof Error) {
            reject(new Error(stderr ? `${error.message}: ${stderr}` : error.message));
            return;
          }

          reject(new Error('Python helper 返回解析失败'));
        }
      });
    });
  });
};
