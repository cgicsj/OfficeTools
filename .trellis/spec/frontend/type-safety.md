# Renderer Type Safety

Reference files:

- `apps/desktop/src/renderer/src/vite-env.d.ts`
- `apps/desktop/src/renderer/src/App.tsx`
- `apps/desktop/src/shared/types/files.ts`
- `apps/desktop/src/shared/types/jobs.ts`
- `apps/desktop/src/shared/types/ipc.ts`

## Shared Imports

Renderer code imports shared contracts with `@shared/*`, for example:

- `@shared/types/files`
- `@shared/types/jobs`
- `@shared/constants/config`

Keep renderer-only helpers under `src/renderer/src/lib` and do not move them into shared unless main/preload also need them.

## Window API

`vite-env.d.ts` declares `Window.officeTools` as `OfficeToolsApi`. When preload changes, update the shared type first and let TypeScript find renderer call sites.

## State Types

Use explicit state types for nullable or union-heavy state:

- `useState<WorkflowTab>('split')`
- `useState<SelectedFolder | null>(null)`
- `useState<Record<WorkflowTab, LogEntry[]>>({...})`
- `useState<WorkflowTab | null>(null)`

Do not let empty arrays infer `never[]`; provide the state type when needed.

## Result Narrowing

Use strict comparisons on `ApiResult`:

```typescript
if (result.success === false) {
  appendLog('split', 'error', result.error);
  return;
}
```

This keeps access to `data` and `error` type-safe.
