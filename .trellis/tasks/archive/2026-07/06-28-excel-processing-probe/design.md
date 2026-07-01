# Excel Processing Capability Probe Design

## Probe Strategy

This child should create small scripts or test harnesses inside the app repository after scaffolding exists. The goal is evidence, not user-facing polish.

## Areas To Validate

### XLS Direct Reader

Validate:

- whether the selected library can open representative legacy `.xls` files directly;
- sheet name, row count, display-value, merge, format, hidden row/column, and style metadata availability;
- failure detection when an `.xls` file cannot be parsed;
- file container preflight so text-like `.xls` impostors are not accepted through SheetJS generic text fallback;
- the fallback message that tells the user to manually convert the file to `.xlsx`.

If direct `.xls` reading cannot meet the required split/merge metadata needs, narrow the `.xls` support contract before implementation starts instead of adding WPS conversion back.

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

The probe harness uses `exceljs` for `.xlsx` workbook read/write checks, SheetJS CE `xlsx` for direct `.xls` / `.et` read checks, and `yauzl` for read-only inspection of worksheet relationship files inside `.xlsx` archives.

Local findings from the development machine:

- `exceljs` can read workbook/sheet names and preserve styles, column widths, row heights, merged cells, hidden row/column state, number/date formats, long-number text formatting, and saved formula results when explicit copy logic is used.
- SheetJS CE `xlsx` is the selected direct `.xls` / `.et` reader candidate, but no local `.xls` or `.et` sample was available, so real fidelity is still a sample-validation gate.
- SheetJS can parse text-like workbook impostors as generic text sheets, so the probe now preflights `.xls` and `.et` files for CFB or ZIP workbook container signatures before accepting a read result.
- Formulas without cached results do not expose a trustworthy calculated display value; production behavior should use saved results and warn or skip when no cached result is available.
- Embedded-object detection can be implemented by checking `xl/worksheets/_rels/sheetN.xml.rels` for drawing, vmlDrawing, oleObject, or ctrlProp relationship types. Synthetic image detection worked per worksheet.
- `.xls` direct parsing must load SheetJS codepage tables so non-ASCII legacy workbooks decode correctly.
