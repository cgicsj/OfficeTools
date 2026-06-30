# Electron Renderer Restrictions

Reference files:

- `apps/desktop/src/main/index.ts`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/renderer/src/App.tsx`
- `apps/desktop/src/main/ipc/dialog.handler.ts`

## Security Baseline

The BrowserWindow uses `contextIsolation: true` and `nodeIntegration: false`. Renderer code runs like browser code plus the typed `window.officeTools` bridge.

Do not weaken BrowserWindow security settings to access a native capability.

## Native Dialogs

Use `window.officeTools.dialog.*` for file, folder, and output directory selection. The main process owns `dialog.showOpenDialog` and returns safe metadata or selected output directory data.

Do not use browser `prompt`, `alert`, or `confirm`. They do not match the desktop workflow UI and are forbidden by renderer quality rules.

## Filesystem Access

Renderer code should not use Node `fs`, file paths from `<input type="file">`, or browser storage as a substitute for main-process services.

Use `sourceId` metadata returned by the main process and call typed IPC APIs for privileged work.

## Long-Running Work

Renderer components may show progress, logs, and cancellation state, but CPU-heavy or filesystem-heavy Excel processing belongs in main-process services so it can use real paths, temporary workspaces, and cancellation signals.
