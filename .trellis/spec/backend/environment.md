# Environment and Packaging

Reference files:

- `apps/desktop/src/main/env-setup.ts`
- `apps/desktop/src/main/index.ts`
- `apps/desktop/forge.config.ts`
- `apps/desktop/vite.main.config.ts`
- `apps/desktop/vite.preload.config.ts`
- `apps/desktop/vite.renderer.config.ts`
- `.gitignore`
- `apps/desktop/eslint.config.mjs`

## userData Isolation

`src/main/env-setup.ts` appends `-dev` to Electron `userData` when `app.isPackaged` is false. Keep importing `./env-setup` before code that reads or writes app data, preferences, cache, or job files.

`src/main/index.ts` currently imports `./env-setup` before registering IPC handlers and creating the window. Preserve that ordering.

## BrowserWindow Security Baseline

The main window uses:

- `contextIsolation: true`
- `nodeIntegration: false`
- preload script from the Vite build output

Do not weaken these settings to solve renderer access problems. Add a typed preload API instead.

## Vite Build Entries

Electron Forge owns the build entries:

- main: `src/main/index.ts`
- preload: `src/preload/index.ts`
- renderer: `main_window`

Main and preload output names are fixed to `main.js` and `preload.js`, matching `BrowserWindow` startup code.

## Renderer Build Output Contract

### 1. Scope / Trigger

- Trigger this contract when changing `apps/desktop/vite.renderer.config.ts`, `apps/desktop/forge.config.ts`, renderer `root`, or the packaged `loadFile` path in `apps/desktop/src/main/index.ts`.

### 2. Signatures

- Forge renderer target name: `main_window`.
- Packaged main-process load path: `path.join(__dirname, '../renderer/${MAIN_WINDOW_VITE_NAME}/index.html')`.
- Required production output path: `apps/desktop/.vite/renderer/main_window/index.html`.

### 3. Contracts

- `vite.renderer.config.ts` may set `root` to `apps/desktop/src/renderer`, but `build.outDir` must still resolve to `apps/desktop/.vite/renderer/main_window`.
- Do not let the renderer production build emit under `apps/desktop/src/renderer/.vite`; Forge packages from the desktop package root and the main process will not load that nested path.
- Preserve Forge/Vite renderer asset URLs as relative URLs so `index.html` can load bundled `assets/*` from ASAR.

### 4. Validation & Error Matrix

- Missing `apps/desktop/.vite/renderer/main_window/index.html` after `pnpm build` -> packaged app can open a blank window; fix renderer `build.outDir`.
- ASAR missing `.vite/renderer/main_window/index.html` -> Debian/package artifact is invalid for release.
- Runtime log shows `ERR_FILE_NOT_FOUND` for `renderer/main_window/index.html` -> main load path and renderer output path are mismatched.

### 5. Good/Base/Bad Cases

- Good: `pnpm build` creates `.vite/build/main.js`, `.vite/build/preload.js`, and `.vite/renderer/main_window/index.html` under `apps/desktop`.
- Base: development still uses `MAIN_WINDOW_VITE_DEV_SERVER_URL`; packaged builds use the file path above.
- Bad: renderer files exist only under `src/renderer/.vite`, even if the local Vite build itself succeeded.

### 6. Tests Required

- Run `pnpm build` when changing renderer build paths or Forge renderer config.
- Check `rg --files -uu apps/desktop/.vite` for `.vite/renderer/main_window/index.html` and renderer assets.
- When ASAR tooling is available, list `resources/app.asar` and assert `.vite/renderer/main_window/index.html` is present.
- Run `pnpm lint` and `pnpm typecheck`.

### 7. Wrong vs Correct

- Wrong: set only `root: path.resolve(desktopRoot, './src/renderer')` and rely on a relative default `outDir`; Vite can emit under `src/renderer/.vite`.
- Correct: keep the renderer `root`, and set `build.outDir` to `path.resolve(desktopRoot, './.vite/renderer/main_window')`.


## Packaging

Forge config currently enables ASAR packaging, configures the Debian maker, applies Electron fuses, and carries OfficeTools Debian metadata for the `office-tools` package. Use `pnpm make:deb:arm64` to produce the ARM64 Debian artifact under `apps/desktop/out/make/deb/arm64/`. If native modules are added for Excel processing, revisit packaging with a real package/build check and update this spec.

## Generated Files

Do not edit or commit generated `.vite`, `out`, or `dist` output. `.gitignore` and ESLint both exclude these paths.
