# Excel Merge

## Goal

Implement the OfficeTools Excel merge workflow according to the Phase 1 requirements.

Parent task: `06-28-office-tools-phase1`.

Depends on:

- `06-28-electron-platform`
- `06-28-excel-processing-probe`

## Requirements

- Let users select a folder.
- Traverse the selected folder and keep `.xls`, `.xlsx`, and `.et` files.
- Exclude files over 10 MB.
- List eligible files with numeric prefixes.
- Convert `.xls` and `.et` through WPS before parsing.
- If WPS is unavailable or conversion fails, show the manual-conversion dialog, skip the file, and continue.
- Let the user select one sheet for each eligible file.
- Reject a file if its selected sheet contains images, charts, legends, or similar embedded visual objects.
- Support merge mode 1: merge selected sheets into one output sheet.
- Support merge mode 2: merge selected sheets into multiple output sheets in one workbook.
- For one-sheet merge, let the user select the field-name row.
- Treat the field-name row and all previous rows as the title area.
- Treat rows after the field-name row as data rows.
- Preserve empty rows as data.
- Do not add a source-file column.
- Compare field-name row display values to decide whether headers match.
- If headers match, keep the first file's title area and append later data rows only.
- If headers differ, append each file including its title area and show `选择的文件具有标题行内容不一致，已保留标题行追加合并。`.
- For one-sheet merge, use the first valid file's column widths.
- Preserve source data-row style.
- For multi-sheet merge, use source file names as output sheet names.
- Truncate sheet names to Excel's 31-character limit.
- Append suffixes for duplicate sheet names.
- Default output file name is `汇总数据.xlsx`.
- Default output location is system Downloads.
- Provide `保存至` for selecting output location.
- Automatically rename on output filename conflict.
- Support canceling the whole batch and cleaning temporary files.

## Acceptance Criteria

- [ ] Folder scan filters type and size constraints.
- [ ] Each eligible file can have one selected sheet.
- [ ] Selected-sheet unsupported-object rejection works.
- [ ] One-sheet merge handles identical headers by keeping one title area.
- [ ] One-sheet merge handles differing headers by appending title areas and showing the required dialog.
- [ ] Empty rows are preserved in one-sheet merge.
- [ ] Data-row style is preserved to manual acceptance.
- [ ] Multi-sheet merge creates one output sheet per selected source sheet.
- [ ] Sheet names are truncated and de-duplicated correctly.
- [ ] Output path defaults, `保存至`, and automatic rename work.
- [ ] Canceling stops the batch, cleans temp files, and produces no output.
