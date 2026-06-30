# Excel Split

## Goal

Implement the OfficeTools Excel split workflow according to the Phase 1 requirements.

Parent task: `06-28-office-tools-phase1`.

Depends on:

- `06-28-electron-platform`
- `06-28-excel-processing-probe`

## Requirements

- Let users choose 1 to 20 `.xls`, `.xlsx`, or `.et` files.
- Reject or exclude unsupported file types.
- Reject files over 10 MB.
- Require the user to click `解析文档`.
- Before parsing, the sheet, field-name row, and split-column controls stay empty and disabled.
- After parsing, the sheet control lists every workbook sheet, the field-name row control lists rows 1 through 10, and split columns display as `（A）字段名`, `（B）字段名`, and so on.
- Process files one by one with per-file interaction.
- Parse `.xls` through the direct `.xls` library adapter without WPS conversion.
- Parse `.et` through the direct `.et` library adapter without WPS conversion.
- If `.xls` or `.et` direct reading fails, show the manual-conversion dialog, skip the file, and continue.
- Let the user select a sheet per file, defaulting to the first sheet.
- Show selected input files by file name only in the main file list, with the full source path available through hover tooltip.
- Allow users to remove selected input files individually before processing.
- Show the selected output directory inside the split settings panel after the user chooses `保存至`.
- Reject the current file if the selected sheet contains images, charts, legends, or similar embedded visual objects.
- Let the user select the field-name row.
- Treat the field-name row and all previous rows as the title area.
- Build split-column options from the field-name row.
- Show merged-cell field names using the merged value.
- Disambiguate duplicate field names with column letters.
- Display empty field names as `未命名列 (C列)`.
- Log `标题行为第 XXX 行` when the field-name row changes.
- Log `选择按照“XXX”列进行拆分` when the split column changes.
- Split rows by selected-column display value.
- Put empty values into `原文件名_空值.xlsx`.
- Do not generate outputs with title rows only and no data rows.
- Sanitize illegal filename characters to `_`.
- Append suffixes for duplicate sanitized filenames.
- Block processing if a file would produce more than 500 split files.
- Preserve required formatting in split outputs.
- Generate one final zip after all selected files finish.
- Put each input file's outputs in a separate folder inside the zip.
- After split completion, show a completion dialog with `确认` and `打开输出文件夹`, and emit the corresponding log entry.
- When the user clicks cancel during split processing, ask whether to `跳过当前文件` or `取消所有任务`.
- Support canceling the whole batch and cleaning temporary files.

## Acceptance Criteria

- [ ] File selection enforces type, size, and count constraints.
- [ ] Before parsing, sheet, field-name row, and split-column controls are empty and disabled.
- [ ] After parsing, per-file sheet, field-name row, and split-column selection work with the required option labels.
- [ ] Field-name display handles merged, duplicate, and empty names.
- [ ] The file list shows file names, exposes full paths through hover tooltip, and supports individual removal.
- [ ] The chosen output directory is visible in the split settings panel.
- [ ] Required log messages are emitted.
- [ ] Empty split values produce `原文件名_空值.xlsx`.
- [ ] Illegal filename characters and duplicate names are handled.
- [ ] The 500-output limit blocks processing with a dialog.
- [ ] The final zip structure matches the parent PRD.
- [ ] Split outputs preserve title area, merged cells, style, row height, column width, hidden state, number formats, date display, and long-number display to manual acceptance.
- [ ] Split completion shows `确认` and `打开输出文件夹`, and logs completion.
- [ ] Canceling offers `跳过当前文件` and `取消所有任务`; cancel-all stops the batch, cleans temp files, and produces no zip.
