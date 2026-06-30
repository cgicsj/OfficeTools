# UOS ARM64 Deb Packaging And Integration Implementation Plan

## Checklist

- [ ] Add package metadata for OfficeTools.
- [ ] Configure ARM64 `.deb` build.
- [ ] Build the packaged artifact.
- [ ] Install on UOS ARM64 target environment.
- [ ] Launch installed app.
- [ ] Run file/folder/output dialog smoke tests.
- [ ] Run direct `.xls` / `.et` reader smoke test or verify fallback dialog.
- [ ] Run one split sample.
- [ ] Run one merge sample.
- [ ] Run cancel cleanup smoke test.
- [ ] Document package path and validation results.

## Validation

- Build command succeeds.
- `.deb` installs and launches on target UOS ARM64.
- Split and merge samples pass manual acceptance.

## Rollback

If packaging fails because the scaffold or build tool does not support ARM64 `.deb` reliably, return to the platform child and replace or reconfigure the packaging stack before changing feature code.
