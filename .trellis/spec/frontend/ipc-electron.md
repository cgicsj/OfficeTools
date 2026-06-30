# Renderer IPC Usage

Reference files:

- `apps/desktop/src/shared/types/ipc.ts`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/renderer/src/vite-env.d.ts`
- `apps/desktop/src/renderer/src/App.tsx`

## Renderer Boundary

Renderer code calls `window.officeTools`. It must not import from `electron`, use `ipcRenderer`, access Node `fs`, or depend on absolute local file paths.

`vite-env.d.ts` declares the global `Window.officeTools` type from `OfficeToolsApi`. Keep this as the renderer's source of truth.

## Result Handling

Every invoke method returns `ApiResult<T>`. Current `App.tsx` handlers use this pattern:

- If `result.success === false`, append an error or warning log and stop.
- If `result.success === true`, update UI state from `result.data`.
- Treat `undefined` data from canceled folder/directory dialogs as a no-op.

Do not assume user cancellation is an error.

## Event Subscriptions

`window.officeTools.jobs.onJobEvent(listener)` returns a cleanup function. Any renderer effect that subscribes to events must return that cleanup function from `useEffect`.

## File Paths

The renderer receives `SelectedFile` and `SelectedFolder` metadata with `sourceId`. It should display `name`, `extension`, and `sizeBytes`; main-process services resolve `sourceId` to real paths.

Avoid showing or storing absolute source paths in renderer state unless a product requirement explicitly asks for it.
