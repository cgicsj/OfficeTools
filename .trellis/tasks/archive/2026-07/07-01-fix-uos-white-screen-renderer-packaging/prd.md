# Fix UOS white screen renderer packaging

## Goal

Fix the packaged desktop app opening to a blank white window on UOS after installation by ensuring the renderer bundle is emitted to the location loaded by the Electron main process and included in the Debian package ASAR.

## Requirements

- Preserve the existing Electron Forge/Vite runtime contract: the packaged main process loads `.vite/renderer/main_window/index.html` relative to `.vite/build/main.js`.
- Ensure the renderer production build output is created under the desktop package root at `.vite/renderer/main_window`, not under `src/renderer/.vite`.
- Do not weaken BrowserWindow security settings or change renderer IPC boundaries.
- Keep generated `.vite` and `out` artifacts ignored and uncommitted.

## Acceptance Criteria

- [x] A fresh ARM64 package build includes `.vite/renderer/main_window/index.html` and its renderer assets in `resources/app.asar`.
- [x] The packaged main process load path still resolves to the renderer file included in ASAR.
- [x] `pnpm lint` passes.
- [x] `pnpm typecheck` passes.

## Notes

- Initial self-check found that `app.asar` only contained `.vite/build/main.js`, `.vite/build/preload.js`, and `package.json`, while the renderer was emitted to `apps/desktop/src/renderer/.vite/renderer/main_window`.
