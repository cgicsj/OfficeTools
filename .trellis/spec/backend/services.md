# Main Process Services

Services own privileged or stateful behavior behind IPC handlers.

Reference files:

- `apps/desktop/src/main/services/file-selection/file-registry.ts`
- `apps/desktop/src/main/services/preferences/preferences.ts`
- `apps/desktop/src/main/services/jobs/job-cancellation.ts`
- `apps/desktop/src/main/services/workspace/temp-workspace.ts`
- `apps/desktop/src/shared/types/files.ts`
- `apps/desktop/src/shared/types/preferences.ts`

## File Selection Registry

`file-registry.ts` stores real selected paths in main-process `Map` objects and returns safe metadata to the renderer:

- `sourceId`
- `name`
- `extension`
- `sizeBytes` for files

Use this pattern for future Excel processing. Renderer state should keep `sourceId` and display metadata; main-process services resolve `sourceId` back to a real path when doing filesystem work.

Avoid returning absolute source paths to renderer components or logs unless a task explicitly requires exposing them.

## Preferences

`preferences.ts` stores lightweight settings in `app.getPath('userData')/preferences.json`.

Rules:

- Validate loaded JSON with `preferencesFileSchema`.
- Return `{}` when the file does not exist.
- Return `{}` when the JSON shape is invalid.
- Re-throw unexpected read/write errors.
- Create the parent directory before writing.

Add new preferences to `preferencesFileSchema` first, then update typed service functions and IPC handlers.

## Temporary Workspace

`temp-workspace.ts` creates per-job folders under `app.getPath('userData')/cache/jobs/<jobId>`. Use `removeTempWorkspace` with `recursive: true` and `force: true` for cleanup.

Future file-processing jobs should keep temporary intermediates in this workspace, not next to source files or inside renderer-accessible paths.

## Cancellation

`job-cancellation.ts` stores one active `AbortController` and one skip-current-file flag at module scope. New long-running jobs should:

- Create an `AbortController` when work starts.
- Call `setActiveJobAbortController(controller)`.
- Pass `controller.signal` through processing functions.
- Clear the active controller when the job ends.
- Check `signal.aborted` at expensive or repeated steps.
- Use `requestSkipCurrentFile()` only for workflows that can continue after the current file.
- Call `consumeSkipCurrentFileRequest()` at file boundaries or row/group loops so skip-current does not leak into the next file.

Cancel-all aborts the whole job and should clean the temp workspace without producing final output. Skip-current is best-effort while file I/O is in progress; the service must check the flag before repeated expensive work and before starting later output groups.
