# Main Process Quality

Reference files:

- `apps/desktop/eslint.config.mjs`
- `apps/desktop/src/main/index.ts`
- `apps/desktop/src/main/ipc/index.ts`
- `apps/desktop/src/main/services/**`
- `apps/desktop/src/preload/index.ts`

## Before Editing

Search for the existing domain first:

```bash
rg "IPC_CHANNELS" apps/desktop/src
rg "officeTools" apps/desktop/src
rg "sourceId" apps/desktop/src
```

Prefer extending an existing domain handler/service over adding a parallel structure.

## Quality Gate

Run from the repository root:

```bash
pnpm lint
pnpm typecheck
```

## Review Checklist

- IPC channels are declared in `src/shared/constants/channels.ts`.
- Preload exposes only typed methods, not raw Electron APIs.
- Handlers return `ApiResult<T>` for invoke calls.
- Raw input is typed `unknown` and validated with Zod.
- Main-process services, not renderer code, touch filesystem paths.
- `env-setup` ordering remains intact.
- No `any`, non-null assertions, or console calls were added.
