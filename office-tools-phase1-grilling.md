# OfficeTools Phase 1 Grilling Conclusion

## 1. Product Scope

Application name: OfficeTools

Target platform: UOS ARM64

Application type: Electron desktop application

Deployment format: `.deb` installer

Phase 1 scope:

- Build the desktop application shell.
- Provide only two visible tabs:
  - Excel Split
  - Excel Merge
- Do not show future modules before they are implemented.

Future modules include text layout, OCR, speech-to-text, PPT generation, and other office utilities. OCR may use large-model based services in later phases, but Phase 1 Excel processing must run offline.

## 2. General Excel Rules

Supported input formats:

- `.xls`
- `.xlsx`
- `.et`

Internal processing format:

- Convert `.xls` and `.et` to `.xlsx` through locally installed WPS.
- Process `.xlsx` directly.
- Output files are always `.xlsx`.

If WPS is unavailable or conversion fails:

- Show a dialog asking the user to manually convert the file to `.xlsx`.
- In batch processing, skip the current file and continue with later files.

Unsupported files:

- Encrypted Excel files.
- Macro-enabled files, such as `.xlsm`.
- Files whose currently selected sheet contains images, charts, legends, or similar embedded visual objects.

If another sheet in the same workbook contains images or charts but the selected sheet does not, processing is allowed.

Formula handling:

- Output calculated display values, not formulas.

Preservation requirements:

- Cell style.
- Column width.
- Row height.
- Merged cells.
- Number format.
- Date display.
- Long number string display.
- Hidden row and hidden column state.

Not guaranteed in Phase 1:

- Filters.
- Freeze panes.
- Print settings.
- Conditional formatting.
- Data validation.
- Comments.

## 3. Excel Split

Users can select one or more files.

Limits:

- Each file must be no larger than 10 MB.
- At most 20 files can be selected.
- Only `.xls`, `.xlsx`, and `.et` are allowed.

Flow:

1. User selects files.
2. User clicks `解析文档`.
3. Application processes files one by one.
4. For each file, user selects the sheet. The first sheet is selected by default.
5. User selects the field-name row.
6. The field-name row and all rows before it are treated as the title area.
7. Split-column options are read from the selected field-name row.
8. User clicks `开始拆分并下载`.
9. After all files are processed, the application generates one combined zip file.

Field-name rules:

- If the field-name cell is part of a merged range, display the merged range value.
- Duplicate field names are displayed with column letters, for example `金额 (A列)` and `金额 (D列)`.
- Empty field names are displayed as `未命名列 (C列)` and remain selectable.

Split rules:

- Split by the display value of the selected column.
- Rows with the same selected-column value go into the same output file.
- Empty selected-column values go into `原文件名_空值.xlsx`.
- Do not generate output files that contain only the title area and no data rows.
- Replace illegal filename characters with `_`.
- If sanitized filenames conflict, append a sequence number automatically.
- A single source Excel file can generate at most 500 split files. If this limit is exceeded, block processing and show a dialog.

Zip structure:

```text
总拆分结果.zip
  原文件名/
    原文件名_列值.xlsx
    原文件名_空值.xlsx
  原文件名_2/
    原文件名_列值.xlsx
```

Split output must preserve:

- The title area.
- Merged cells in the title area.
- Cell styles.
- Column widths.
- Row heights.
- Hidden row and column state.
- Number formats.
- Date display.
- Long number display.

## 4. Excel Merge

Users select a folder.

Folder scan rules:

- Traverse files in the selected folder.
- Keep only `.xls`, `.xlsx`, and `.et`.
- Exclude files larger than 10 MB.
- List eligible files with numeric prefixes.

For each eligible file:

- User selects the sheet to merge.
- Only the selected sheet participates in merge processing.

Merge modes:

1. Merge all selected sheets into one output sheet.
2. Merge selected sheets into multiple output sheets in one workbook.

### 4.1 Merge Into One Sheet

User selects the field-name row.

The field-name row and all rows before it are treated as the title area.

The data area starts from the row after the field-name row.

Rules:

- Preserve empty rows as data.
- Do not add a source-file column.
- Compare field-name row display values to determine whether headers match.
- If field names are identical, keep only the first file's title area and append later files' data rows.
- If field names differ, append each file including its title area and show this dialog:
  - `选择的文件具有标题行内容不一致，已保留标题行追加合并。`
- Output column widths use the first valid file.
- Data rows preserve their original source-file row styles.

### 4.2 Merge Into Multiple Sheets

Rules:

- Each selected source sheet becomes one sheet in the output workbook.
- Output sheet name uses the source file name.
- Sheet names longer than Excel's 31-character limit are truncated.
- Duplicate sheet names receive automatic sequence suffixes.

Output file:

- Default name: `汇总数据.xlsx`.
- Default location: system Downloads directory.
- Provide a `保存至` button to choose the output directory.
- If a same-name file already exists, automatically rename the output file.
- After merge completes, save/download the generated file.

## 5. UI And Interaction

Phase 1 shows only two tabs:

- `Excel 拆分`
- `Excel 合并`

Each tab has its own independent log area. Switching tabs switches the displayed logs.

Use desktop wording:

- `选择文件`
- `选择文件夹`

Do not use web-style wording such as `上传`.

Batch file list:

- Prefix files with `1.`, `2.`, `3.`, etc.
- Show different states for pending, processing, completed, skipped, and failed files.
- While processing a file, show `正在处理 XXXX`.

Long-running processing:

- Show a loading animation.
- Show current file index, total file count, and current stage.
- Provide a `取消` button.

Cancel behavior:

- Cancel the entire batch process.
- Clean temporary files.
- Do not generate a download result.
- Log `用户已取消`.

Logs:

- Logs are kept only for the current UI session.
- Logs are lost after the application closes.
- No log export is required in Phase 1.

Example log messages:

- `读取文档成功，共 XXX 行数据`
- `标题行为第 XXX 行`
- `选择按照“XXX”列进行拆分`
- `已拆分完成`
- `读取文件成功，共 XX 个文件`
- `已汇总完成`
- `用户已取消`

## 6. Temporary Files

Temporary files may be written to the application cache directory.

Temporary file types:

- WPS-converted `.xlsx` files.
- Intermediate split files.
- Intermediate merge files.
- Temporary zip files.

Temporary files must be cleaned after completion, failure, or cancellation.

## 7. User Preferences

No complex configuration persistence is required in Phase 1.

The application may remember the last selected output directory.

## 8. Acceptance Samples

Phase 1 acceptance should include at least these sample files:

- Normal `.xlsx`.
- `.xlsx` with merged title rows.
- `.xlsx` with styles, dates, and long number strings.
- `.xls`.
- `.et`.

Acceptance standard:

- Manual inspection is acceptable.
- Output files should be visually and functionally close to the source files.
- Merged title cells, fonts, borders, background colors, date display, column widths, and row heights should be basically consistent with the source.
- Pixel-perfect equality is not required.

## 9. Main Risks For Trellis Planning

1. Whether WPS on UOS ARM64 can reliably convert `.xls` and `.et` to `.xlsx`.
2. Whether a packaged Electron `.deb` app can reliably locate and call system WPS.
3. Excel library selection for style, merge-cell, column-width, row-height, hidden-state, and number-format preservation.
4. Format loss after `.xls` or `.et` conversion.
5. Whether images and charts can be detected only for the selected sheet.
6. Whether calculated formula display values are available when the source file has not been recalculated and saved.
7. Memory usage and UI responsiveness when processing up to 20 files of 10 MB each.

## 10. Grilling Conclusion

The requirement is ready to enter Trellis planning.

Do not start implementation directly.

Recommended next steps:

1. Create a Trellis task.
2. Write the PRD based on this document.
3. Create a technical design focused on WPS conversion, Excel style preservation, and Electron process boundaries.
4. Create an implementation plan with validation samples and risk probes before full feature development.
