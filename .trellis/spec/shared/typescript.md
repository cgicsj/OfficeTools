# TypeScript

OfficeTools is a strict TypeScript project. Favor explicit contracts at runtime boundaries and keep shared types serializable.

Reference files:

- `apps/desktop/tsconfig.json`
- `apps/desktop/src/shared/types/api.ts`
- `apps/desktop/src/shared/types/ipc.ts`
- `apps/desktop/src/shared/types/jobs.ts`
- `apps/desktop/src/shared/types/preferences.ts`
- `apps/desktop/src/shared/constants/channels.ts`
- `apps/desktop/src/shared/constants/config.ts`

## Shared Contracts

Shared contracts live under `apps/desktop/src/shared`. They are used by main, preload, and renderer code, so keep them free of Electron, React, and Node-only runtime imports.

Use discriminated unions for cross-layer results and events:

- `ApiResult<T>` uses `success: true` with `data` and `success: false` with `error` plus optional `code`.
- `JobEvent` uses a `type` discriminator for `log`, `progress`, and `file-status` payloads.

When reading an `ApiResult`, compare with `result.success === true` or `result.success === false` so TypeScript narrows correctly.

## Runtime Validation

Use Zod for data that crosses a trust boundary or is read from disk. Current examples:

- `setLastOutputDirectoryInputSchema` validates raw IPC input in `src/main/ipc/path.handler.ts`.
- `preferencesFileSchema` validates `preferences.json` in `src/main/services/preferences/preferences.ts`.

Take raw IPC payloads as `unknown`, validate with `safeParse`, and only pass `parsed.data` into services.

## Constants

Use `as const` for nested constants that define stable runtime values:

- `IPC_CHANNELS` in `src/shared/constants/channels.ts`
- `APP_CONFIG` in `src/shared/constants/config.ts`

Add new channels or app limits in these shared constants before wiring the main/preload/renderer layers.

## Imports

- Renderer code uses the `@shared/*` alias for shared contracts.
- Main and preload currently use relative imports to `src/shared`. Keep that style consistent unless the whole layer is intentionally migrated.
- Use `import type` for type-only imports.

## Avoid

- Non-serializable values in shared types.
- `Date` objects crossing IPC; use numbers such as `timestampMs`.
- `any`, non-null assertions, and `@ts-ignore`.
- Type definitions duplicated separately in main, preload, and renderer.
