# Code Quality

OfficeTools uses strict TypeScript plus ESLint as the baseline quality gate.

Reference files:

- `apps/desktop/eslint.config.mjs`
- `apps/desktop/tsconfig.json`
- `package.json`
- `apps/desktop/package.json`

## Required Checks

Run from the repository root:

```bash
pnpm lint
pnpm typecheck
```

The root scripts delegate to the desktop package. The desktop package runs `eslint . --max-warnings 0` and `tsc --noEmit`.

## Type Safety Rules

- Do not use explicit `any`; use a concrete type or `unknown` plus validation.
- Do not use non-null assertions. Narrow with an `if` guard, optional chaining, or a fallback.
- Use `import type` for type-only imports.
- Exported functions should declare return types. Current examples include `createMainWindow(): BrowserWindow`, `registerIpcHandlers(): void`, and `registerSelectedFiles(...): Promise<SelectedFile[]>`.

## Console and Logging

`no-console` is configured as a warning and lint runs with `--max-warnings 0`. Do not add `console.log`, `console.warn`, or `console.error` as application logging. If a future feature needs durable logging, add a main-process logging service and document it before using it broadly.

## File and Naming Conventions

- React component files are PascalCase, for example `components/workflows/SplitWorkflow.tsx`.
- Main-process handler files use `<domain>.handler.ts`, for example `src/main/ipc/path.handler.ts`.
- Main-process services live under a domain directory, for example `src/main/services/preferences/preferences.ts`.
- Shared constants use uppercase object names with `as const`, for example `IPC_CHANNELS` and `APP_CONFIG`.
- Shared object and union types use PascalCase, for example `ApiResult<T>`, `JobEvent`, and `WorkflowTab`.

## Source Boundaries

- Keep Electron and Node APIs in the main process or preload. Renderer code should call `window.officeTools`.
- Keep shared types and serializable constants in `apps/desktop/src/shared`.
- Do not import generated files from `.vite`, `out`, or `dist`.
