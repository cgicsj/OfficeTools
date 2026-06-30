import { app } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { preferencesFileSchema, type PreferencesFile } from '../../../shared/types/preferences';

const getPreferencesPath = (): string => {
  return path.join(app.getPath('userData'), 'preferences.json');
};

const readPreferences = async (): Promise<PreferencesFile> => {
  try {
    const raw = await readFile(getPreferencesPath(), 'utf8');
    const parsedJson: unknown = JSON.parse(raw);
    const parsedPreferences = preferencesFileSchema.safeParse(parsedJson);
    if (parsedPreferences.success === true) {
      return parsedPreferences.data;
    }
    return {};
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? error.code : undefined;
    if (code === 'ENOENT') {
      return {};
    }
    throw error;
  }
};

const writePreferences = async (preferences: PreferencesFile): Promise<void> => {
  await mkdir(path.dirname(getPreferencesPath()), { recursive: true });
  await writeFile(getPreferencesPath(), JSON.stringify(preferences, null, 2), 'utf8');
};

export const getLastOutputDirectory = async (): Promise<string | undefined> => {
  const preferences = await readPreferences();
  return preferences.lastOutputDirectory;
};

export const setLastOutputDirectory = async (directory: string): Promise<void> => {
  const preferences = await readPreferences();
  await writePreferences({
    ...preferences,
    lastOutputDirectory: directory,
  });
};

