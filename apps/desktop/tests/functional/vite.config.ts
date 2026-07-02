import path from 'node:path';
import { defineConfig } from 'vite';
import { sharedAlias } from '../../vite.shared';

export default defineConfig({
  resolve: {
    alias: {
      ...sharedAlias,
      electron: path.resolve(__dirname, './mocks/electron.ts'),
    },
  },
  build: {
    emptyOutDir: true,
    outDir: path.resolve(__dirname, '../../.functional-tests'),
    ssr: path.resolve(__dirname, './excel-workflows.test.ts'),
    target: 'node20',
    rollupOptions: {
      output: {
        entryFileNames: 'excel-workflows.test.mjs',
      },
    },
  },
});
