/// <reference types="vite/client" />

import type { OfficeToolsApi } from '@shared/types/ipc';

declare global {
  interface Window {
    officeTools: OfficeToolsApi;
  }
}

export {};

