# Excel Processing Capability Probe Design

## Probe Strategy

This child should create small scripts or test harnesses inside the app repository after scaffolding exists. The goal is evidence, not user-facing polish.

## Areas To Validate

### WPS Conversion

Validate:

- how to locate WPS on UOS ARM64;
- whether WPS can run `.xls` conversion without blocking the app UI;
- conversion command arguments for `.xls`;
- output path handling;
- failure detection.

If WPS cannot provide stable command-line conversion, Phase 1 must rely on the manual-conversion fallback for `.xls`. `.et` is no longer a WPS conversion input.

### ET Direct Reader

Validate:

- whether the selected library can open representative WPS `.et` files directly;
- sheet name, row count, display-value, merge, format, hidden row/column, and style metadata availability;
- failure detection when an `.et` file cannot be parsed;
- file container preflight so text-like `.et` impostors are not accepted through SheetJS generic text fallback;
- the fallback message that tells the user to manually convert the file to `.xlsx`.

If direct `.et` reading cannot meet the required split/merge metadata needs, narrow the `.et` support contract before implementation starts instead of adding WPS conversion back.

### Workbook Read/Write

Validate library behavior for copying rows/ranges into new workbooks while preserving:

- style;
- merge ranges;
- row height;
- column width;
- hidden state;
- number/date formats;
- long-number display;
- calculated display values.

### Object Detection

Validate whether embedded objects can be detected per selected sheet. If not, document whether the implementation must conservatively reject the entire workbook.

## Probe Output

Write a short report in the task directory summarizing:

- commands tested;
- sample files used;
- library behavior;
- gaps;
- chosen implementation path;
- changes needed in parent/child PRDs.

## Local Probe Findings

The probe harness uses `exceljs` for `.xlsx` workbook read/write checks, SheetJS CE `xlsx` for direct `.et` read checks, and `yauzl` for read-only inspection of worksheet relationship files inside `.xlsx` archives.

Local findings from the development machine:

- `exceljs` can read workbook/sheet names and preserve styles, column widths, row heights, merged cells, hidden row/column state, number/date formats, long-number text formatting, and saved formula results when explicit copy logic is used.
- SheetJS CE `xlsx` is the selected direct `.et` reader candidate, but no local `.et` sample was available, so real `.et` fidelity is still a sample-validation gate.
- SheetJS can parse text-like `.et` impostors as generic text sheets, so the probe now preflights `.et` files for CFB or ZIP workbook container signatures before accepting a read result.
- Formulas without cached results do not expose a trustworthy calculated display value; production behavior should use saved results and warn or skip when no cached result is available.
- Embedded-object detection can be implemented by checking `xl/worksheets/_rels/sheetN.xml.rels` for drawing, vmlDrawing, oleObject, or ctrlProp relationship types. Synthetic image detection worked per worksheet.
- No WPS command was detected on the development machine, so `.xls` conversion remains a UOS ARM64 target validation gate.
