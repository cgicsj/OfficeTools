import { z } from 'zod';

export const openDirectoryInputSchema = z.object({
  directory: z.string().min(1),
});

export type OpenDirectoryInput = z.infer<typeof openDirectoryInputSchema>;
