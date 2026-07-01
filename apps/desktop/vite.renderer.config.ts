import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';
import { desktopRoot, sharedAlias } from './vite.shared';

export default defineConfig({
  root: path.resolve(desktopRoot, './src/renderer'),
  plugins: [react()],
  build: {
    emptyOutDir: true,
    outDir: path.resolve(desktopRoot, './.vite/renderer/main_window'),
  },
  resolve: {
    alias: sharedAlias,
  },
});
