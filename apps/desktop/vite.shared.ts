import path from 'node:path';

export const desktopRoot = __dirname;

export const sharedAlias: Record<string, string> = {
  '@shared': path.resolve(desktopRoot, './src/shared'),
  '@renderer': path.resolve(desktopRoot, './src/renderer/src'),
};
