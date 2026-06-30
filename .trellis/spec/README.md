# OfficeTools Trellis Specs

These specs describe the current OfficeTools repository. They are not a generic Electron template.

## Current Architecture

- Workspace: one pnpm workspace package, `@office-tools/desktop`.
- Runtime: Electron main process, preload bridge, React renderer, and shared TypeScript contracts under `apps/desktop/src/shared`.
- Build: Electron Forge 7 with the Vite plugin, Electron 33, Vite 6, React 18, TypeScript strict mode, Zod, and lucide-react.
- Styling: plain global CSS split into token, base, layout, and component files.
- Persistence: lightweight JSON preferences under Electron `userData`.
- Not present today: persistent database layer, data-fetching framework, utility CSS framework, a test runner, and a separate shared package.

## Spec Layers

### [Shared](./shared/index.md)

Read these for every code change:

- [Code Quality](./shared/code-quality.md)
- [TypeScript](./shared/typescript.md)
- [Git Conventions](./shared/git-conventions.md)
- [Timestamp Handling](./shared/timestamp.md)
- [pnpm + Electron Setup](./shared/pnpm-electron-setup.md)

### [Backend / Main Process](./backend/index.md)

Read these when changing `apps/desktop/src/main`, `apps/desktop/src/preload`, IPC channels, file-system access, preferences, or packaging behavior.

### [Frontend / Renderer](./frontend/index.md)

Read these when changing `apps/desktop/src/renderer`, UI state, CSS, or renderer-to-main IPC calls.

### [Thinking Guides](./guides/index.md)

Use these checklists before cross-layer work, repeated patterns, or non-trivial debugging. Database-specific guides only apply if a database layer is later introduced.

### [Big Questions](./big-question/index.md)

Project-specific pitfalls captured after debugging live here. Keep this layer small and source-backed.

## Verification Commands

Run from the repository root:

```bash
pnpm lint
pnpm typecheck
```

These delegate to `@office-tools/desktop`.
