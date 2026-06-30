# Main Process Directory Structure

Reference directories:

- `apps/desktop/src/main`
- `apps/desktop/src/preload`
- `apps/desktop/src/shared`

## Current Layout

```text
apps/desktop/src/
  main/
    env-setup.ts
    index.ts
    ipc/
      index.ts
      dialog.handler.ts
      job.handler.ts
      path.handler.ts
    services/
      file-selection/file-registry.ts
      jobs/job-cancellation.ts
      preferences/preferences.ts
      workspace/temp-workspace.ts
  preload/
    index.ts
  shared/
    constants/
      channels.ts
      config.ts
    types/
      api.ts
      files.ts
      ipc.ts
      jobs.ts
      preferences.ts
```

## Where New Code Goes

- App lifecycle and BrowserWindow setup belong in `src/main/index.ts` unless the file becomes large enough to extract a focused helper.
- IPC registration belongs in `src/main/ipc/index.ts`; each handler group lives in `src/main/ipc/<domain>.handler.ts`.
- Privileged side effects belong in `src/main/services/<domain>/`.
- Preload bridge code belongs in `src/preload/index.ts` until it is large enough to split by exposed namespace.
- Cross-layer channels, result types, DTOs, and Zod schemas belong in `src/shared`.

## Source Boundaries

Main process code may use Electron and Node APIs. Renderer code should not.

The existing pattern is:

1. `src/shared/constants/channels.ts` defines a stable channel string.
2. `src/main/ipc/<domain>.handler.ts` registers an `ipcMain.handle` callback.
3. `src/preload/index.ts` exposes a typed method on `window.officeTools`.
4. Renderer code calls `window.officeTools.<namespace>.<method>()`.

## Generated Output

Do not use `.vite`, `out`, or `dist` as source. They are build artifacts and are ignored by lint/git.

## Current Non-Goals

Do not add a persistent storage layer, list-query abstractions, HTTP routes, or server-style controllers unless a task explicitly introduces those layers and updates these specs.
