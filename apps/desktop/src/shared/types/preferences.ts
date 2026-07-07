import { z } from 'zod';

export const preferencesFileSchema = z.object({
  lastOutputDirectory: z.string().min(1).optional(),
  speechModelBaseUrl: z.string().min(1).optional(),
});

export const setLastOutputDirectoryInputSchema = z.object({
  directory: z.string().min(1),
});

export type PreferencesFile = z.infer<typeof preferencesFileSchema>;
export type SetLastOutputDirectoryInput = z.infer<typeof setLastOutputDirectoryInputSchema>;

