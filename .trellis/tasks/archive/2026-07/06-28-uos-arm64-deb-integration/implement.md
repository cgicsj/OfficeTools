# UOS ARM64 Deb Packaging And Integration Implementation Plan

## Checklist

- [x] Add package metadata for OfficeTools.
- [x] Configure ARM64 `.deb` build.
- [x] Build the packaged artifact.
- [ ] Install on UOS ARM64 target environment. (Skipped this pass per user instruction.)
- [ ] Launch installed app. (Skipped this pass per user instruction.)
- [ ] Run file/folder/output dialog smoke tests. (Skipped this pass per user instruction.)
- [ ] Run direct `.xls` / `.et` reader smoke test or verify fallback dialog. (Skipped this pass per user instruction.)
- [ ] Run one split sample. (Skipped this pass per user instruction.)
- [ ] Run one merge sample. (Skipped this pass per user instruction.)
- [ ] Run cancel cleanup smoke test. (Skipped this pass per user instruction.)
- [x] Document package path and validation results.

## Validation

- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm make:deb:arm64`
- [x] Generated artifact: `apps/desktop/out/make/deb/arm64/office-tools_0.1.0_arm64.deb`
- [x] `dpkg-deb --info` reports `Package: office-tools` and `Architecture: arm64`.
- [ ] UOS ARM64 install/launch and smoke tests were deferred per user instruction.

## Original Validation Targets

- Build command succeeds.
- `.deb` installs and launches on target UOS ARM64.
- Split and merge samples pass manual acceptance.

## Rollback

If packaging fails because the scaffold or build tool does not support ARM64 `.deb` reliably, return to the platform child and replace or reconfigure the packaging stack before changing feature code.
