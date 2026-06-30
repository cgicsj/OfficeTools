# IPC Handlers and Preload Bridge

Reference files:

- `apps/desktop/src/shared/constants/channels.ts`
- `apps/desktop/src/shared/types/ipc.ts`
- `apps/desktop/src/main/ipc/index.ts`
- `apps/desktop/src/main/ipc/dialog.handler.ts`
- `apps/desktop/src/main/ipc/path.handler.ts`
- `apps/desktop/src/main/ipc/job.handler.ts`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/renderer/src/vite-env.d.ts`

## Channel Flow

Add IPC work in this order:

1. Add a channel under `IPC_CHANNELS` with the existing `<domain>:<action>` naming style.
2. Add or update the shared return/input types in `src/shared/types`.
3. Register the main handler in `src/main/ipc/<domain>.handler.ts`.
4. Add the handler setup function to `registerIpcHandlers()`.
5. Expose a typed preload method on `officeToolsApi`.
6. Use `window.officeTools` from the renderer.

## Handler Shape

Handlers should be small adapters. They validate raw IPC input, call a service or Electron API, and return `ApiResult<T>`.

Current examples:

- `dialog.handler.ts` wraps `dialog.showOpenDialog`, handles cancellation as a successful empty result, and registers selected files/folders before returning metadata.
- `path.handler.ts` validates `SET_LAST_OUTPUT_DIRECTORY` input with `setLastOutputDirectoryInputSchema.safeParse`.
- `job.handler.ts` delegates cancellation to `cancelActiveJob()`.

## Preload Rules

- Expose only the typed `OfficeToolsApi` object with `contextBridge.exposeInMainWorld('officeTools', officeToolsApi)`.
- Do not expose `ipcRenderer`, arbitrary channel names, Node APIs, or filesystem paths to the renderer.
- Event subscriptions must return an unsubscribe function. `jobs.onJobEvent` is the current pattern.

## Renderer Contract

`apps/desktop/src/renderer/src/vite-env.d.ts` extends `Window` with `officeTools: OfficeToolsApi`. Keep that type in sync with preload.

Renderer code should handle both `success: true` and `success: false` results. Do not assume IPC calls throw for expected business failures.
