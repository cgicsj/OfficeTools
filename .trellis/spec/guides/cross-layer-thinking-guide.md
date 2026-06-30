# Cross-Layer Thinking Guide

Use this for OfficeTools features that span renderer UI, shared contracts, preload, IPC handlers, main-process services, and local filesystem state.

## When to Use

Use this guide when a feature touches at least three of these layers:

- React components
- Renderer state or helpers
- Shared types/constants
- Preload bridge
- IPC handlers
- Main-process services
- Local filesystem, preferences, or temp workspaces
- Packaging behavior

Excel split/merge work normally qualifies.

## 1. Identify the Layers

Write down the exact files or directories likely to change. Example for a new job event:

- `src/shared/types/jobs.ts`
- `src/shared/constants/channels.ts`
- `src/preload/index.ts`
- `src/main/ipc/job.handler.ts`
- `src/main/services/jobs/...`
- `src/renderer/src/App.tsx`
- `src/renderer/src/components/workflows/...`

## 2. Define Data Flow

Current OfficeTools flow:

```text
User action
  -> React handler in App.tsx
  -> window.officeTools method
  -> preload ipcRenderer.invoke/on wrapper
  -> ipcMain handler
  -> main-process service
  -> ApiResult or JobEvent
  -> renderer state update
  -> UI render
```

For file processing, renderer state should carry `sourceId` metadata while main services resolve real paths.

## 3. Check Boundary Formats

At each boundary, answer:

- What is the TypeScript type?
- Is runtime validation needed?
- Is the value serializable across IPC?
- Does a timestamp use milliseconds and a `Ms` suffix?
- Does an error use `ApiResult` or a `JobEvent` log/progress update?

## 4. Plan Expected Failure States

Handle expected cases explicitly:

- User cancels file/folder/output selection.
- No files are selected.
- Output directory is missing or invalid.
- Source ID no longer resolves to a path.
- Processing is canceled through `AbortController`.
- Temporary workspace cleanup runs after success, failure, or cancellation.

Do not turn normal cancellation into an error.

## 5. Event and Cleanup Rules

For event-driven work:

- Define the event in `JobEvent` first.
- Send only serializable payloads.
- Subscribe in renderer with `window.officeTools.jobs.onJobEvent`.
- Return unsubscribe cleanup from `useEffect`.
- Keep events tab-scoped with `WorkflowTab` when they update workflow state.

## 6. Verification

Minimum checks:

```bash
pnpm lint
pnpm typecheck
```

Add focused verification for the touched behavior, such as running the Electron app, selecting files, canceling a job, or packaging with `pnpm make` when packaging-sensitive code changes.
