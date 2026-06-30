# Electron Main Process Guidelines

This layer covers `apps/desktop/src/main` and `apps/desktop/src/preload`. It is called `backend` in Trellis because it owns privileged work: Electron APIs, Node file-system access, IPC handlers, preferences, and packaging-sensitive behavior.

## Tech Stack

- Electron main process and preload script.
- Electron Forge with Vite builds for main, preload, and renderer.
- Node `fs/promises`, `path`, and `crypto` for local filesystem work.
- Zod for runtime validation at IPC and persisted JSON boundaries.

There is no database, ORM, HTTP server, or logging framework in the current codebase.

## Documentation Files

| File | When to Read |
| --- | --- |
| [directory-structure.md](./directory-structure.md) | Adding main, preload, service, or IPC files |
| [ipc-handlers.md](./ipc-handlers.md) | Adding or changing IPC channels and preload APIs |
| [services.md](./services.md) | File selection, preferences, temp workspace, job services |
| [excel-processing.md](./excel-processing.md) | Excel adapters, WPS conversion gate, object detection |
| [environment.md](./environment.md) | App startup, `userData`, build, package, or generated files |
| [error-handling.md](./error-handling.md) | IPC result shapes and expected failures |
| [type-safety.md](./type-safety.md) | Zod schemas, `ApiResult`, shared constants |
| [quality.md](./quality.md) | Main-process code quality checks |

Always also read `../shared/index.md`.

## Core Rules

| Rule | Reference |
| --- | --- |
| Keep renderer away from Node and Electron APIs | [ipc-handlers.md](./ipc-handlers.md) |
| Add channels in shared constants before handlers/preload/UI | [ipc-handlers.md](./ipc-handlers.md) |
| Validate raw IPC input with Zod `safeParse` | [type-safety.md](./type-safety.md) |
| Return `ApiResult<T>` from invoke handlers | [error-handling.md](./error-handling.md) |
| Keep real filesystem paths in main-process registries | [services.md](./services.md) |
| Import `env-setup` before code that depends on `userData` | [environment.md](./environment.md) |
| Do not introduce persistent storage patterns without a new design | [directory-structure.md](./directory-structure.md) |
| Keep Excel processing behind main-process adapters | [excel-processing.md](./excel-processing.md) |

## Reference Source Files

- `apps/desktop/src/main/index.ts`
- `apps/desktop/src/main/env-setup.ts`
- `apps/desktop/src/main/ipc/index.ts`
- `apps/desktop/src/main/ipc/*.handler.ts`
- `apps/desktop/src/main/services/**`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/shared/constants/channels.ts`
- `apps/desktop/src/shared/types/ipc.ts`
