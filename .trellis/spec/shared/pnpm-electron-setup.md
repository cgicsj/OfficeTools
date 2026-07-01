# pnpm and Electron Setup

OfficeTools is a pnpm workspace with one application package today.

Reference files:

- `package.json`
- `pnpm-workspace.yaml`
- `.npmrc`
- `.gitignore`
- `apps/desktop/package.json`
- `apps/desktop/forge.config.ts`
- `apps/desktop/vite.shared.ts`
- `apps/desktop/vite.main.config.ts`
- `apps/desktop/vite.preload.config.ts`
- `apps/desktop/vite.renderer.config.ts`

## Workspace

The root `package.json` is private and delegates scripts to `@office-tools/desktop`:

```bash
pnpm dev
pnpm build
pnpm make
pnpm make:deb:arm64
pnpm lint
pnpm typecheck
```

`pnpm-workspace.yaml` includes `apps/*` and excludes generated `dist` and `out` folders.

## pnpm Node Modules

`.npmrc` intentionally uses:

- `node-linker=hoisted`
- `shamefully-hoist=true`
- `strict-peer-dependencies=false`
- `prefer-offline=true`

Keep these settings unless Electron packaging is revalidated without them. They reduce symlink-related packaging and native dependency problems.

## Electron Forge and Vite

`apps/desktop/forge.config.ts` uses Electron Forge with:

- `@electron-forge/plugin-vite`
- `@electron-forge/maker-deb`
- `@electron-forge/plugin-fuses`
- `packagerConfig.asar: true`
- executable name `office-tools`

Use `pnpm make:deb:arm64` for the UOS ARM64 Debian package path. It delegates to `electron-forge make --platform linux --arch arm64 --targets @electron-forge/maker-deb` and writes ignored artifacts under `apps/desktop/out/make/deb/arm64/`.

The Vite plugin has separate entries for:

- main: `src/main/index.ts` with `vite.main.config.ts`
- preload: `src/preload/index.ts` with `vite.preload.config.ts`
- renderer: `main_window` with `vite.renderer.config.ts`

`vite.shared.ts` defines `@shared` and `@renderer` aliases for all Vite builds.

## Generated Files

Do not edit or review generated output in:

- `node_modules/`
- `.vite/`
- `out/`
- `dist/`
- `coverage/`

These are ignored by `.gitignore`, and ESLint also ignores build output.
