import { defineConfig } from 'vite';
import { sharedAlias } from './vite.shared';

export default defineConfig({
  resolve: {
    alias: sharedAlias,
  },
  build: {
    target: 'node20',
    rollupOptions: {
      output: {
        entryFileNames: 'preload.js',
      },
    },
  },
});
