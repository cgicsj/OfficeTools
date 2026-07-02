# Fix Deb Renderer White Screen

## Goal
Fix the installed `.deb` app white screen caused by the packaged Electron app failing to load the renderer HTML.

## User Value
Users can install and launch the ARM64 Debian package without seeing a blank window.

## Confirmed Facts
- Installed app fails with `ERR_FILE_NOT_FOUND`.
- Failing URL: `file:///usr/lib/office-tools/resources/app.asar/.vite/renderer/main_window/index.html`.
- The main process expects renderer output at `.vite/renderer/main_window/index.html` inside `app.asar`.
- Previous work already identified this as a packaging/output path contract.

## Requirements
- Identify why `.vite/renderer/main_window/index.html` is missing from packaged `app.asar`.
- Fix the source configuration, not the installed files manually.
- Rebuild/package the desktop app after the fix.
- Verify the generated package contains `.vite/renderer/main_window/index.html` in `app.asar`.
- Preserve development startup behavior.

## Acceptance Criteria
- `pnpm build` succeeds.
- `pnpm make:deb:arm64` succeeds or reaches the Debian packaging step with a generated `.deb`.
- The packaged `app.asar` contains `.vite/renderer/main_window/index.html`.
- The Debian artifact path is reported to the user.
- `pnpm lint` and `pnpm typecheck` pass after code/config changes.

## Out of Scope
- Renderer UI redesign.
- Manual editing under `/usr/lib/office-tools`.
- Fixing unrelated packaging warnings.

## Resolution Notes
- Root cause confirmed: the existing `.deb` payload was stale. Its `app.asar` contained `.vite/build/main.js` and `.vite/build/preload.js`, but did not contain `.vite/renderer/main_window/index.html`.
- The current source Vite output and package directory already contained the renderer HTML.
- Re-running `pnpm make:deb:arm64` regenerated `apps/desktop/out/make/deb/arm64/office-tools_0.1.0_arm64.deb` with a larger, refreshed `app.asar`.
- Verified the regenerated `.deb` payload includes `.vite/renderer/main_window/index.html` inside `/usr/lib/office-tools/resources/app.asar`.

## Validation Completed
- `pnpm make:deb:arm64`
- `dpkg-deb -x apps/desktop/out/make/deb/arm64/office-tools_0.1.0_arm64.deb /tmp/office-tools-deb-check`
- `node node_modules/@electron/asar/bin/asar.js list /tmp/office-tools-deb-check/usr/lib/office-tools/resources/app.asar | rg '^/.vite|renderer|index.html'`
- `pnpm typecheck`
- `pnpm lint`
