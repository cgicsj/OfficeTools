# Renderer State Management

Reference files:

- `apps/desktop/src/renderer/src/App.tsx`
- `apps/desktop/src/shared/types/jobs.ts`
- `apps/desktop/src/shared/types/files.ts`
- `apps/desktop/src/renderer/src/lib/logs.ts`

## Current Pattern

`App.tsx` is the state owner. It tracks:

- active workflow tab
- split and merge file lists
- selected merge folder
- logs keyed by `WorkflowTab`
- output directory
- split and merge progress
- current busy tab

Workflow components are controlled views. They do not call IPC directly and do not own cross-workflow state.

## Logs

Use `createLogEntry(tab, level, message)` so logs have stable IDs, `WorkflowTab`, `LogLevel`, message, and `timestampMs`.

Store logs as `Record<WorkflowTab, LogEntry[]>`, matching the current `App.tsx` pattern.

## Progress

Use the shared `JobProgress` shape. Stages are defined in `src/shared/types/jobs.ts` and rendered by `ProgressPanel`.

For new long-running work, keep progress updates serializable and tab-scoped so they can also travel over `JobEvent`.

## Derived State and Callbacks

- Use `useMemo` for derived values that are passed into children, such as `selectedLogs`.
- Use `useCallback` for event handlers passed into workflow components.
- Keep dependency arrays complete; the ESLint React Hooks plugin warns on missing dependencies.

## When to Extract a Hook

There are no custom hooks today. Extract one only when a workflow's state/effects become reusable or make `App.tsx` hard to reason about. If a hook calls IPC, keep the same `ApiResult` handling and cleanup rules documented in `ipc-electron.md`.
