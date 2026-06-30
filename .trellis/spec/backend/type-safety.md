# Main Process Type Safety

Reference files:

- `apps/desktop/src/shared/types/api.ts`
- `apps/desktop/src/shared/types/ipc.ts`
- `apps/desktop/src/shared/types/preferences.ts`
- `apps/desktop/src/shared/types/jobs.ts`
- `apps/desktop/src/main/ipc/path.handler.ts`
- `apps/desktop/src/preload/index.ts`

## Validate Boundaries

IPC arguments arrive as untrusted data. Type handler arguments as `unknown`, validate with a shared Zod schema, then pass typed data to services.

Current pattern:

- `setLastOutputDirectoryInputSchema` is defined in shared code.
- `path.handler.ts` calls `safeParse(input)`.
- Only `parsedInput.data.directory` reaches `setLastOutputDirectory`.

## Keep Contracts Shared

`OfficeToolsApi` is the single contract for preload and renderer. When changing it, update:

- `src/shared/types/ipc.ts`
- `src/preload/index.ts`
- renderer call sites
- `src/renderer/src/vite-env.d.ts` only if the global shape changes

## Use Serializable DTOs

IPC payloads should be serializable plain data. Use strings, numbers, booleans, arrays, and objects. Avoid `Date`, `Map`, `Set`, `Error`, functions, DOM objects, and Electron objects.

The file registry pattern is the preferred way to represent local files across IPC: renderer receives metadata plus `sourceId`; main process keeps actual paths.

## Imports

Use `import type` for type-only imports. Keep shared types free of Node/Electron imports so they can compile in renderer code.
