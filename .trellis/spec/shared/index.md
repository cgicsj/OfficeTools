# Shared Development Guidelines

These rules apply across Electron main, preload, renderer, and shared code.

## Documentation Files

| File | When to Read |
| --- | --- |
| [code-quality.md](./code-quality.md) | Always, before editing source |
| [typescript.md](./typescript.md) | Type definitions, IPC contracts, Zod schemas |
| [timestamp.md](./timestamp.md) | Logs, job progress, dates, durations |
| [pnpm-electron-setup.md](./pnpm-electron-setup.md) | Dependency, build, package, or workspace changes |
| [git-conventions.md](./git-conventions.md) | Before committing |

## Current Project Facts

- Root scripts in `package.json` delegate to `@office-tools/desktop` with `pnpm --filter @office-tools/desktop ...`.
- `apps/desktop/eslint.config.mjs` enforces no explicit `any`, no non-null assertions, type-only imports, React Hooks rules, and `no-console` warnings.
- `apps/desktop/tsconfig.json` uses `strict: true`, `moduleResolution: "Bundler"`, and path aliases for `@shared/*` and `@renderer/*`.
- Shared runtime contracts live in `apps/desktop/src/shared`, not in a separate workspace package.

## Mandatory Checks

Run these from the repository root before reporting a code change complete:

```bash
pnpm lint
pnpm typecheck
```

Generated folders (`node_modules`, `.vite`, `out`, `dist`, `coverage`) are not source and should stay out of reviews and specs.
