# Fix Excel Parse Errors

## Goal
Fix installed-app Excel parsing failures reported after the app launches successfully.

## User Value
Users can select and parse `.xlsx`, `.xls`, and `.et` files without low-level JavaScript errors or inaccessible-file failures.

## Confirmed Facts
- `.xlsx` parsing currently reports `Cannot read properties of null (reading 'toString')`.
- `.xls` and `.et` parsing currently report `Cannot access file`.
- The app can now launch, so this task is scoped to Excel parsing/runtime file access.
- Excel parsing is owned by main-process services, not renderer code.

## Requirements
- Locate the code path that calls `toString()` on nullable workbook/cell values and make it null-safe.
- Locate why `.xls` / `.et` parsing reports `Cannot access file` in the packaged app path.
- Fix root causes in source code/configuration rather than modifying installed files manually.
- Preserve support for `.xlsx`, `.xls`, and `.et` parse workflows.
- Add or update runnable regression coverage where practical.

## Acceptance Criteria
- `.xlsx` parse code handles blank/null cells without throwing `Cannot read properties of null (reading 'toString')`.
- `.xls` and `.et` parse paths do not fail with `Cannot access file` due to packaged runtime path/dependency setup.
- `pnpm --filter @office-tools/desktop test:functional` passes.
- `pnpm typecheck` passes.
- `pnpm lint` passes.
- Any needed packaging validation command is run if the fix touches packaging/runtime assets.

## Out of Scope
- Redesigning Excel parsing UI.
- Full fidelity support for every legacy workbook feature.
- Manual repair of files under `/usr/lib/office-tools`.

## Resolution Notes
- Root cause for `.xlsx`: metadata/job code read `ExcelJS.Cell.text`; ExcelJS delegates to internal `toString()` methods that can throw when workbook values are malformed or nullable, including formula results represented as `null`.
- Fix: added `src/main/services/excel/cell-text.ts` and routed ExcelJS preview/grouping text reads through `readExcelJsCellText(...)`, which returns `''` for nullish or unrecognized object values.
- Root cause for `.xls` / `.et`: modules using SheetJS `XLSX.readFile(...)` did not inject Node `fs` with `XLSX.set_fs(nodeFs)`, so packaged/runtime reads could fail with `Cannot access file <path>`.
- Fix: initialized SheetJS with `XLSX.set_fs(nodeFs)` in metadata, split job, and merge job modules.
- Regression coverage: functional test now parses generated `.xlsx`, `.xls`, and `.et` files through `parseSplitDocumentMetadata(...)`.

## Validation Completed
- `pnpm --filter @office-tools/desktop test:functional`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm make:deb:arm64`
- Verified generated `.deb` contains `/.vite/build/main.js` and `/.vite/renderer/main_window/index.html` in `app.asar`.
