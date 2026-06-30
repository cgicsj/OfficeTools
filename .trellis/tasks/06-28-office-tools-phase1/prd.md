# OfficeTools Phase 1

## Goal

Build the first local-only UOS ARM64 desktop release of OfficeTools as an Electron application focused on Excel split and Excel merge workflows.

Source requirement document: `office-tools-phase1-grilling.md`.

## User Value

Office users can process common Excel split and merge tasks on a local UOS ARM64 machine without uploading documents to a remote service, while preserving basic workbook formatting well enough for manual office use.

## Confirmed Facts

- The repository currently has Trellis/agent configuration and the grilling conclusion document, but no application scaffold or `package.json`.
- Phase 1 must create the Electron desktop platform and implement Excel split and merge.
- The app name is `OfficeTools`.
- Target platform is UOS ARM64.
- Delivery format is a `.deb` installer.
- Phase 1 is local single-machine software with no login, licensing, cloud sync, or auto-update.
- The Phase 1 shell uses a left module area that shows only `表格处理`; future modules such as `文档排版`, `图片转文字`, and `语音转文字` are hidden until implemented.
- Inside `表格处理`, only two tabs are visible in Phase 1: `表格拆分` and `表格合并`.
- Future modules are hidden until implemented.

## Task Map

- `06-28-electron-platform`: create the Electron desktop app shell, renderer UI, IPC boundaries, dialogs, job/log state, cancellation plumbing, and persistence for last output directory.
- `06-28-excel-processing-probe`: validate WPS `.xls` conversion, direct `.et` library reading, and Excel library behavior before feature implementation.
- `06-28-excel-split`: implement the Excel split workflow.
- `06-28-excel-merge`: implement the Excel merge workflow.
- `06-28-uos-arm64-deb-integration`: package, install, and validate the integrated UOS ARM64 `.deb` release.

The parent task owns cross-child requirements and final integration acceptance. Child tasks own implementation deliverables.

## Cross-Cutting Requirements

- Supported input formats are `.xls`, `.xlsx`, and `.et`.
- `.xls` is converted to `.xlsx` through locally installed WPS before processing.
- `.et` is read directly through a library that supports WPS `.et` files; do not convert `.et` through WPS.
- If WPS is unavailable for `.xls`, `.xls` conversion fails, or the `.et` direct reader fails, show a dialog telling the user to manually convert the file to `.xlsx`; in a batch, skip the current file and continue.
- Output files are always `.xlsx`.
- Excel processing must be offline.
- Encrypted files are unsupported.
- Macro-enabled files such as `.xlsm` are unsupported.
- If the selected sheet contains images, charts, legends, or similar embedded visual objects, block processing for that file.
- If non-selected sheets contain embedded visual objects, processing may continue.
- Formula cells output calculated display values, not formulas.
- Preserve cell style, column width, row height, merged cells, number format, date display, long-number display, and hidden row/column state.
- Phase 1 does not guarantee filters, freeze panes, print settings, conditional formatting, data validation, or comments.
- Use desktop wording such as `选择文件` and `选择文件夹`, not `上传`.
- Tab logs are independent and switch with the active tab.
- Long-running jobs show loading state, current file index, total file count, current stage, and a cancel button.
- Canceling a job cancels the whole batch, cleans temporary files, produces no output, and logs `用户已取消`.
- Temporary files may be written to the application cache directory and must be cleaned after completion, failure, or cancellation.
- The app may remember the last selected output directory.

## Excel Split Requirements

- Users can select 1 to 20 files.
- Each file must be at most 10 MB.
- The user clicks `解析文档` before per-file setup.
- Files are handled one by one.
- For each file, the user selects a sheet; the first sheet is selected by default.
- The user selects the field-name row.
- The field-name row and all earlier rows are the title area.
- Split-column options are read from the field-name row.
- Merged field-name cells display the merged value.
- Duplicate field names include column letters, for example `金额 (A列)`.
- Empty field names display as `未命名列 (C列)` and are selectable.
- When the split column changes, log `选择按照“XXX”列进行拆分`.
- When the field-name row changes, log `标题行为第 XXX 行`.
- Split rows by selected-column display value.
- Empty split values produce `原文件名_空值.xlsx`.
- Do not produce files with only title rows and no data rows.
- Replace illegal filename characters with `_`.
- If sanitized names conflict, append a sequence suffix.
- A single source workbook can produce at most 500 split files; exceeding the limit blocks processing with a dialog.
- All input files in one split batch produce one final zip.
- Each input file gets its own folder inside the zip.

## Excel Merge Requirements

- Users select a folder.
- The app traverses the selected folder and keeps only `.xls`, `.xlsx`, and `.et`.
- Files over 10 MB are excluded.
- Eligible files are listed with numeric prefixes.
- The user selects the sheet to merge for each eligible file.
- Merge mode options are:
  - merge all selected sheets into one output sheet;
  - merge selected sheets into multiple output sheets in one workbook.
- For one-sheet merge, the user selects the field-name row.
- The field-name row and all earlier rows are the title area.
- Data begins on the row after the field-name row.
- Empty rows are preserved as data.
- Do not add a source-file column.
- Compare field-name row display values to decide whether headers match.
- If field names are identical, keep the first file's title area and append later data rows only.
- If field names differ, append each file including its title area and show `选择的文件具有标题行内容不一致，已保留标题行追加合并。`.
- For one-sheet merge, output column widths come from the first valid file.
- Data rows preserve their source-file data-row style.
- For multi-sheet merge, each selected source sheet becomes one output sheet.
- Multi-sheet output sheet names use source file names, are truncated to Excel's 31-character limit, and receive suffixes on conflict.
- Output default file name is `汇总数据.xlsx`.
- Output default location is the system Downloads directory.
- Provide a `保存至` button.
- If an output file name already exists, automatically rename the output.

## Acceptance Criteria

- [ ] The task tree exists and each child has requirements tied to this parent PRD.
- [ ] The final Phase 1 app shows the left `表格处理` module and only the `表格拆分` / `表格合并` tabs inside it.
- [ ] The final app runs as a local UOS ARM64 Electron desktop app.
- [ ] The final `.deb` can be installed and launched on the target platform.
- [ ] Split and merge workflows enforce the file type, size, count, unsupported-object, encrypted-file, and macro-file rules.
- [ ] `.xls` conversion through WPS is attempted before processing; unavailable or failed conversion produces the specified dialog and skip behavior.
- [ ] `.et` files use the direct `.et` library path instead of WPS conversion; reader failures produce the specified dialog and skip behavior.
- [ ] Output files use `.xlsx`.
- [ ] Split output zip structure matches the grilling conclusion.
- [ ] Merge output defaults to `汇总数据.xlsx` and supports selected output directory.
- [ ] Long-running operations show loading/progress state and support canceling the batch.
- [ ] Temporary files are cleaned after completion, failure, and cancellation.
- [ ] Manual sample acceptance passes for normal `.xlsx`, merged-title `.xlsx`, styled/date/long-number `.xlsx`, `.xls`, and `.et` samples.

## Out Of Scope

- OCR, speech-to-text, PPT generation, text layout, or other future modules.
- Login, authorization, licensing, cloud processing, cloud sync, or auto-update.
- Log export.
- `.xlsm` support.
- Pixel-perfect workbook visual equality.

## Open Questions

No product-scope questions are currently blocking planning. Technical risks are assigned to `06-28-excel-processing-probe`.
