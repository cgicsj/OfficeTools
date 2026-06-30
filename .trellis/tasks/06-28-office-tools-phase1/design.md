# OfficeTools Phase 1 Design

## Overview

Phase 1 should be built as an Electron desktop app with a typed renderer/main boundary and a worker-style processing layer for Excel jobs. The repository currently has no app scaffold, so the first child task creates the project structure.

## Proposed Architecture

- Renderer: React + TypeScript UI for tabs, file lists, forms, logs, progress, dialogs, and cancellation.
- Preload: typed context bridge exposing a narrow OfficeTools API.
- Main process: native file/folder dialogs, output path handling, Downloads directory resolution, cache directory management, WPS `.xls` invocation, direct `.et` reader orchestration, and job orchestration.
- Worker/process layer: CPU and file-heavy Excel conversion/split/merge work so the UI does not freeze.
- Shared types: request/response contracts, job status, file state, workbook metadata, and log event types.

## Process Boundaries

The renderer never reads arbitrary local files directly. It requests file/folder selection through IPC, receives sanitized metadata, and starts jobs through typed job requests.

The main process owns:

- local path access;
- WPS detection and `.xls` conversion calls;
- direct `.et` library read calls;
- temp directory lifecycle;
- output file collision handling;
- cancellation tokens;
- sending progress/log events back to the renderer.

Excel processing code should avoid UI dependencies so it can be tested with sample workbooks and reused by split and merge workflows.

## Excel Processing Design

Excel processing should be implemented behind an adapter boundary:

- `WorkbookAdapter`: open `.xlsx` workbooks, inspect workbook/sheet metadata, read display values, copy style-sensitive ranges, and write output `.xlsx`.
- `WpsConverter`: detect usable WPS command support and convert `.xls` to temporary `.xlsx`.
- `EtWorkbookReader`: open WPS `.et` files directly through the selected library without WPS conversion and expose the workbook metadata needed by split/merge.
- `UnsupportedObjectDetector`: determine whether the selected sheet contains images, charts, legends, or similar objects.
- `FilenamePolicy`: sanitize illegal path characters, enforce length limits, and resolve duplicate names.
- `TempWorkspace`: create and clean per-job cache directories.

The initial probe result selects `exceljs` as the first `.xlsx` workbook adapter candidate, SheetJS CE `xlsx` as the direct `.et` reader candidate, and `yauzl` relationship inspection for selected-sheet embedded-object detection. Feature implementation may build behind these adapter boundaries, but automatic `.xls` conversion remains gated by a UOS ARM64 WPS run with representative samples and `.et` direct reading remains gated by representative `.et` samples. Formula output should use cached calculated results; files without saved formula results need an explicit warning/skip path.

## Probe Findings

Local probe findings recorded in `06-28-excel-processing-probe/report.md`:

- Use `exceljs` for Phase 1 `.xlsx` read/write adapter work.
- Use SheetJS CE `xlsx` as the direct `.et` reader candidate; do not convert `.et` through WPS.
- Use `yauzl` to inspect worksheet relationship files for selected-sheet embedded object detection.
- Preserve formulas as display values only when cached formula results are present.
- Keep WPS `.xls` conversion behind a target-machine validation gate; the current development environment did not have WPS installed.

## UI State Design

Each tab owns independent state:

- selected files/folder;
- parsed file metadata;
- current per-file configuration;
- logs;
- progress;
- cancellation state;
- output directory.

The shared app shell only owns the active tab and common layout.

File states should include pending, processing, completed, skipped, failed, and canceled. Logs should be structured events rendered as text, not ad hoc string state spread across components.

## Data Flow

Split:

1. Renderer asks main process to select files.
2. Main process filters obvious type/size constraints and returns metadata.
3. Renderer starts parse.
4. Main process converts `.xls` where needed, opens `.et` through the direct reader where needed, opens workbook metadata, and reports sheets/row counts/field-name candidates.
5. Renderer collects sheet, field-name row, and split-column selection for each file.
6. Main process runs split jobs in sequence, writes temporary `.xlsx` outputs, creates one zip, moves it to the chosen output location, and reports completion.

Merge:

1. Renderer asks main process to select a folder.
2. Main process scans eligible files and returns metadata.
3. Renderer collects sheet selections, merge mode, field-name row for one-sheet merge, and output directory.
4. Main process converts `.xls` where needed, opens `.et` through the direct reader where needed, validates selected sheets, merges outputs, resolves filename conflicts, writes `汇总数据.xlsx` or a renamed variant, and reports completion.

## Compatibility Notes

- UOS ARM64 and WPS command behavior for `.xls` are high-risk and must be tested on target hardware.
- Electron packaging must not bundle or assume WPS; it should locate and invoke the system installation only for `.xls` conversion.
- The app should degrade clearly when WPS is unavailable for `.xls`.
- `.xls` fidelity depends on WPS conversion. `.et` fidelity depends on the direct reader's metadata support and must be validated with real `.et` samples.

## Rollback Shape

Each child task should leave the app in a coherent state:

- Platform scaffold can run without Excel features.
- Probe can fail without shipping split/merge implementation.
- Split and merge can be developed independently after the shared adapter is validated.
- Packaging can be deferred without changing feature logic.

## Key Trade-Offs

- WPS `.xls` conversion plus direct `.et` reading reduces `.et` dependence on installed WPS, but it creates a separate `.et` metadata fidelity gate.
- Display-value formula output gives deterministic files but may depend on source workbooks having saved calculated values.
- Manual visual acceptance is pragmatic for office formatting but cannot prove pixel-perfect fidelity.
