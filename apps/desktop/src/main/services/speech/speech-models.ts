import { app } from 'electron';
import { createWriteStream } from 'node:fs';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import type {
  SpeechModelDownloadProgress,
  SpeechModelSettings,
  SpeechModelStatus,
} from '../../../shared/types/speech';
import { getSpeechModelBaseUrl, setSpeechModelBaseUrl } from '../preferences/preferences';

type SpeechModelDefaultConfig = {
  modelBaseUrl: string;
  asrPackageName: string;
  puncPackageName: string;
};

type ModelKind = 'asr' | 'punc';

type EmitModelProgress = (progress: SpeechModelDownloadProgress) => void;

type DownloadProgress = {
  downloadedBytes: number;
  totalBytes?: number;
};

const defaultConfigRelativePath = path.join('resources', 'speech-models', 'config.json');
const fallbackDefaultConfig: SpeechModelDefaultConfig = {
  modelBaseUrl: 'https://2.22.2.2',
  asrPackageName: 'funasr-asr-model.zip',
  puncPackageName: 'funasr-punc-model.zip',
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const readDefaultConfig = async (): Promise<SpeechModelDefaultConfig> => {
  const candidates = [
    path.join(process.cwd(), defaultConfigRelativePath),
    path.join(process.cwd(), 'apps', 'desktop', defaultConfigRelativePath),
    path.join(app.getAppPath(), defaultConfigRelativePath),
  ];

  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'speech-models', 'config.json'));
  }

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      const rawConfig = await readFile(candidate, 'utf8');
      const parsedConfig = JSON.parse(rawConfig) as Partial<SpeechModelDefaultConfig>;
      return {
        asrPackageName: parsedConfig.asrPackageName || fallbackDefaultConfig.asrPackageName,
        modelBaseUrl: parsedConfig.modelBaseUrl || fallbackDefaultConfig.modelBaseUrl,
        puncPackageName: parsedConfig.puncPackageName || fallbackDefaultConfig.puncPackageName,
      };
    }
  }

  return fallbackDefaultConfig;
};

const getModelsRoot = (): string => {
  return path.join(app.getPath('userData'), 'speech-models');
};

const getModelDirectory = (kind: ModelKind): string => {
  return path.join(getModelsRoot(), kind);
};

const hasOnnxModel = async (directory: string): Promise<boolean> => {
  return (await fileExists(path.join(directory, 'model.onnx'))) ||
    (await fileExists(path.join(directory, 'model_quant.onnx')));
};

const joinUrl = (baseUrl: string, fileName: string): string => {
  return `${baseUrl.replace(/\/+$/, '')}/${encodeURIComponent(fileName)}`;
};

const resolvePackageUrl = (settings: SpeechModelSettings, kind: ModelKind): string => {
  const packageName = kind === 'asr' ? settings.asrPackageName : settings.puncPackageName;
  return joinUrl(settings.modelBaseUrl, packageName);
};

const getPackageName = (settings: SpeechModelSettings, kind: ModelKind): string => {
  return kind === 'asr' ? settings.asrPackageName : settings.puncPackageName;
};

export const getSpeechModelSettings = async (): Promise<SpeechModelSettings> => {
  const defaultConfig = await readDefaultConfig();
  const configuredBaseUrl = await getSpeechModelBaseUrl();

  return {
    asrPackageName: defaultConfig.asrPackageName,
    defaultModelBaseUrl: defaultConfig.modelBaseUrl,
    modelBaseUrl: configuredBaseUrl ?? defaultConfig.modelBaseUrl,
    puncPackageName: defaultConfig.puncPackageName,
  };
};

export const updateSpeechModelSettings = async (modelBaseUrl: string): Promise<SpeechModelSettings> => {
  await setSpeechModelBaseUrl(modelBaseUrl);
  return getSpeechModelSettings();
};

export const getSpeechModelStatus = async (): Promise<SpeechModelStatus> => {
  const settings = await getSpeechModelSettings();
  const asrReady = await hasOnnxModel(getModelDirectory('asr'));
  const puncReady = await hasOnnxModel(getModelDirectory('punc'));

  return {
    asrReady,
    modelBaseUrl: settings.modelBaseUrl,
    puncReady,
    ready: asrReady && puncReady,
  };
};

const downloadFileUrl = async (url: string, targetPath: string, onProgress: (progress: DownloadProgress) => void): Promise<void> => {
  const sourcePath = fileURLToPath(url);
  const sourceBuffer = await readFile(sourcePath);
  onProgress({ downloadedBytes: sourceBuffer.byteLength, totalBytes: sourceBuffer.byteLength });
  await writeFile(targetPath, sourceBuffer);
};

const downloadHttpUrl = async (url: string, targetPath: string, onProgress: (progress: DownloadProgress) => void): Promise<void> => {
  const client = url.startsWith('https:') ? https : http;

  await new Promise<void>((resolve, reject) => {
    const request = client.get(url, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        void downloadHttpUrl(new URL(response.headers.location, url).toString(), targetPath, onProgress)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`模型下载失败：HTTP ${response.statusCode ?? '未知状态'}`));
        return;
      }

      const totalHeader = response.headers['content-length'];
      const totalBytes = typeof totalHeader === 'string' ? Number(totalHeader) : undefined;
      let downloadedBytes = 0;
      const output = createWriteStream(targetPath);

      response.on('data', (chunk: Buffer) => {
        downloadedBytes += chunk.byteLength;
        onProgress({ downloadedBytes, totalBytes });
      });
      response.pipe(output);
      output.on('finish', () => {
        output.close(() => resolve());
      });
      output.on('error', reject);
    });

    request.on('error', reject);
  });
};

const downloadPackage = async (
  url: string,
  targetPath: string,
  onProgress: (progress: DownloadProgress) => void,
): Promise<void> => {
  if (url.startsWith('file:')) {
    await downloadFileUrl(url, targetPath, onProgress);
    return;
  }

  if (!url.startsWith('http:') && !url.startsWith('https:')) {
    throw new Error('模型下载地址必须以 http://、https:// 或 file:// 开头');
  }

  await downloadHttpUrl(url, targetPath, onProgress);
};

const ensureSafeExtractPath = (rootDirectory: string, relativePath: string): string => {
  const targetPath = path.resolve(rootDirectory, relativePath);
  const rootPath = path.resolve(rootDirectory);
  if (!targetPath.startsWith(rootPath + path.sep) && targetPath !== rootPath) {
    throw new Error('模型压缩包包含非法路径');
  }

  return targetPath;
};

const findModelDirectory = async (rootDirectory: string): Promise<string | undefined> => {
  if (await hasOnnxModel(rootDirectory)) {
    return rootDirectory;
  }

  const zipRoot = await import('node:fs/promises');
  const entries = await zipRoot.readdir(rootDirectory, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const candidate = path.join(rootDirectory, entry.name);
    if (await hasOnnxModel(candidate)) {
      return candidate;
    }
  }

  return undefined;
};

const extractPackage = async (zipPath: string, targetDirectory: string): Promise<string> => {
  const buffer = await readFile(zipPath);
  const zip = await JSZip.loadAsync(buffer);
  const extractionRoot = `${targetDirectory}-extracting`;
  await rm(extractionRoot, { force: true, recursive: true });
  await mkdir(extractionRoot, { recursive: true });

  for (const entry of Object.values(zip.files)) {
    const targetPath = ensureSafeExtractPath(extractionRoot, entry.name);
    if (entry.dir) {
      await mkdir(targetPath, { recursive: true });
      continue;
    }

    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, await entry.async('nodebuffer'));
  }

  const modelDirectory = await findModelDirectory(extractionRoot);
  if (!modelDirectory) {
    throw new Error('模型压缩包中未找到 model.onnx 或 model_quant.onnx');
  }

  await rm(targetDirectory, { force: true, recursive: true });
  await mkdir(path.dirname(targetDirectory), { recursive: true });
  await import('node:fs/promises').then((fs) => fs.rename(modelDirectory, targetDirectory));
  await rm(extractionRoot, { force: true, recursive: true });
  return targetDirectory;
};

const emitProgress = (
  emit: EmitModelProgress,
  packageName: string,
  phase: SpeechModelDownloadProgress['phase'],
  progress: DownloadProgress,
): void => {
  const percent = progress.totalBytes && progress.totalBytes > 0
    ? Math.min(100, Math.round((progress.downloadedBytes / progress.totalBytes) * 100))
    : undefined;

  emit({
    downloadedBytes: progress.downloadedBytes,
    packageName,
    percent,
    phase,
    totalBytes: progress.totalBytes,
  });
};

const ensureOneModel = async (
  kind: ModelKind,
  settings: SpeechModelSettings,
  emit: EmitModelProgress,
): Promise<void> => {
  const targetDirectory = getModelDirectory(kind);
  if (await hasOnnxModel(targetDirectory)) {
    return;
  }

  const packageName = getPackageName(settings, kind);
  const packageUrl = resolvePackageUrl(settings, kind);
  const downloadDirectory = path.join(getModelsRoot(), 'downloads');
  const packagePath = path.join(downloadDirectory, packageName);
  await mkdir(downloadDirectory, { recursive: true });
  await downloadPackage(packageUrl, packagePath, (progress) => emitProgress(emit, packageName, 'downloading', progress));
  emitProgress(emit, packageName, 'extracting', { downloadedBytes: 0 });
  await extractPackage(packagePath, targetDirectory);
  emitProgress(emit, packageName, 'completed', { downloadedBytes: 1, totalBytes: 1 });
};

export const ensureSpeechModels = async (emit: EmitModelProgress): Promise<SpeechModelStatus> => {
  const settings = await getSpeechModelSettings();
  await ensureOneModel('asr', settings, emit);
  await ensureOneModel('punc', settings, emit);
  return getSpeechModelStatus();
};

export const getSpeechModelEnvironment = async (): Promise<NodeJS.ProcessEnv> => {
  const status = await getSpeechModelStatus();
  if (!status.ready) {
    throw new Error('语音模型尚未下载，请先下载模型后再转写');
  }

  return {
    OFFICE_TOOLS_FUNASR_ASR_MODEL_DIR: getModelDirectory('asr'),
    OFFICE_TOOLS_FUNASR_PUNC_MODEL_DIR: getModelDirectory('punc'),
  };
};
