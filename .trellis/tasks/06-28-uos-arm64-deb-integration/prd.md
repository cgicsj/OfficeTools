# UOS ARM64 Deb Packaging And Integration

## Goal

Package and validate the integrated OfficeTools Phase 1 application as a UOS ARM64 `.deb` desktop app.

Parent task: `06-28-office-tools-phase1`.

Depends on:

- `06-28-electron-platform`
- `06-28-excel-processing-probe`
- `06-28-excel-split`
- `06-28-excel-merge`

## Requirements

- Build an ARM64 `.deb` installer for OfficeTools.
- The installed app uses the product name `OfficeTools`.
- The installed app launches from the desktop environment.
- The packaged app can directly parse supported `.xls`, `.xlsx`, and `.et` sample files or show the manual-conversion fallback dialog for reader failures.
- The packaged app can access file/folder dialogs, system Downloads, selected output directories, and app cache/temp directories.
- The packaged app can complete at least one split flow and one merge flow with sample files.
- Temporary files are cleaned after completion, failure, and cancellation.

## Acceptance Criteria

- [ ] A `.deb` artifact is produced for ARM64.
- [ ] The `.deb` installs on the target UOS ARM64 environment.
- [ ] The app launches after installation.
- [ ] The app displays only the two Phase 1 tabs.
- [ ] File, folder, and output directory selection work after packaging.
- [ ] Direct `.xls` / `.et` reader behavior works or degrades to the required manual-conversion dialog.
- [ ] One split sample completes and writes/downloads the expected zip.
- [ ] One merge sample completes and writes `汇总数据.xlsx` or an automatically renamed variant.
- [ ] Cancel behavior works in the packaged app.

## Out Of Scope

- Store publishing.
- Auto-update.
- Code signing beyond what is required for local installation testing.
