# Code Reuse Thinking Guide

Use this to avoid duplicating OfficeTools patterns.

## Search Before Adding

Before creating a helper or abstraction, search for the concept:

```bash
rg "formatBytes|formatTime|createLogEntry" apps/desktop/src
rg "registerSelectedFiles|sourceId|getRegistered" apps/desktop/src
rg "safeParse|ApiResult|success: false" apps/desktop/src
```

If an existing helper is close, extend it or rename it with the broader concept rather than adding a sibling that does the same work.

## Existing Reuse Points

| Need | Current Location |
| --- | --- |
| Cross-layer result shape | `src/shared/types/api.ts` |
| IPC channel names | `src/shared/constants/channels.ts` |
| App limits and supported extensions | `src/shared/constants/config.ts` |
| File/folder source ID registry | `src/main/services/file-selection/file-registry.ts` |
| Preferences JSON access | `src/main/services/preferences/preferences.ts` |
| Job cancellation state | `src/main/services/jobs/job-cancellation.ts` |
| Temp job workspace | `src/main/services/workspace/temp-workspace.ts` |
| Log entry creation | `src/renderer/src/lib/logs.ts` |
| Byte/time formatting | `src/renderer/src/lib/format.ts` |
| Button UI primitive | `src/renderer/src/components/ui/Button.tsx` |

## Extraction Rules

- Shared contracts go under `src/shared/types` or `src/shared/constants`.
- Main-only filesystem or Electron helpers go under `src/main/services/<domain>`.
- Renderer-only pure helpers go under `src/renderer/src/lib`.
- Reusable visual primitives go under `src/renderer/src/components/ui`.
- Workflow-specific views stay under `src/renderer/src/components/workflows`.

Do not put Node/Electron imports in `src/shared` or renderer helpers.

## Duplication Threshold

| Similar Uses | Action |
| --- | --- |
| 1 | Keep local if the name is clear |
| 2 | Consider whether the pattern is likely to grow |
| 3+ | Extract or extend a shared helper |

When you intentionally keep two similar implementations separate, document why in code or task notes.

## Common Anti-Patterns

- Creating a new IPC response shape instead of using `ApiResult<T>`.
- Adding raw string channel names outside `IPC_CHANNELS`.
- Reimplementing file size or timestamp formatting inside components.
- Returning real file paths to renderer instead of using `sourceId`.
- Adding a one-off button class instead of using `Button` variants.
- Copying workflow state logic without checking whether it belongs in a shared hook.

## After Refactoring

Search for old patterns after introducing shared code:

```bash
rg "oldFunctionName|oldClassName|oldChannel" apps/desktop/src
pnpm lint
pnpm typecheck
```
