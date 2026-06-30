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

## Packaging

Forge config currently enables ASAR packaging, configures the Debian maker, and applies Electron fuses. If native modules are added for Excel processing, revisit packaging with a real package/build check and update this spec.

## Generated Files

Do not edit or commit generated `.vite`, `out`, or `dist` output. `.gitignore` and ESLint both exclude these paths.
