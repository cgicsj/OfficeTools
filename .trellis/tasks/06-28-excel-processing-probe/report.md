# Excel Processing Capability Probe Report

## Summary

- Probe harness: `apps/desktop/scripts/excel-probe.mjs`
- Generated output directory: `.trellis/tasks/06-28-excel-processing-probe/probe-output`
- Sample directory: `.trellis/tasks/06-28-excel-processing-probe/samples`
- Candidate workbook library: `exceljs`
- Candidate direct .xls/.et reader: `xlsx` / SheetJS CE
- Candidate xlsx relationship inspector: `yauzl`

## Recommendation

Use `exceljs` as the first Phase 1 `.xlsx` workbook adapter candidate. The synthetic round trip confirms workbook/sheet reading, writing, styles, widths, row heights, merge ranges, hidden rows/columns, number formats, and saved formula results can be preserved with explicit copy logic.

Use SheetJS CE `xlsx` as the direct-read adapter candidate for legacy `.xls` and WPS `.et` files. Do not route `.xls` or `.et` through WPS conversion. Real `.xls` and `.et` samples must still validate sheet names, display values, merge metadata, format metadata, hidden row/column metadata, and any required style preservation limits before split/merge implementation treats those formats as fully supported.

Use a ZIP relationship inspection step for selected-sheet embedded object detection. The synthetic image workbook confirms worksheet-level drawing relationships can be detected without opening the workbook in the renderer. Validate this again with real chart/image/WPS-authored samples before split/merge implementation.

## Acceptance Matrix

- [ ] `.xls` direct library read tested with a sample file.
- [ ] `.et` direct library read tested with a sample file.
- [x] Malformed `.xls` input is rejected before SheetJS text fallback can treat it as a sheet.
- [x] Malformed `.et` input is rejected before SheetJS text fallback can treat it as a sheet.
- [x] Candidate Excel library tested against preservation requirements.
- [x] Selected-sheet embedded object detection approach documented.
- [x] Formula display-value limitations documented.
- [x] Parent design updated with local probe findings and direct `.xls` / `.et` reader plan.

## Samples

No local sample files were found. Put samples in the sample directory and rerun the script.

## SheetJS XLS Direct-Read Probe

- Status: `skipped`
- Reason: No .xls sample files were found. Add representative .xls samples and rerun the probe.

No .xls direct-read attempt was executed in this run.

### Malformed XLS Rejection

- Artifact: `.trellis/tasks/06-28-excel-processing-probe/probe-output/malformed-direct-read.xls`
- Result: `pass`
- Detail: Unsupported .xls container signature; expected a CFB or ZIP workbook container.

## SheetJS ET Direct-Read Probe

- Status: `skipped`
- Reason: No .et sample files were found. Add representative .et samples and rerun the probe.

No .et direct-read attempt was executed in this run.

### Malformed ET Rejection

- Artifact: `.trellis/tasks/06-28-excel-processing-probe/probe-output/malformed-direct-read.et`
- Result: `pass`
- Detail: Unsupported .et container signature; expected a CFB or ZIP workbook container.

## ExcelJS Workbook Probe

Artifacts:

- Source workbook: `.trellis/tasks/06-28-excel-processing-probe/probe-output/exceljs-source.xlsx`
- Copied workbook: `.trellis/tasks/06-28-excel-processing-probe/probe-output/exceljs-copied.xlsx`

| Capability | Result | Detail |
| --- | --- | --- |
| sheet names and row count | pass | sheets=源数据, rows=4 |
| cell styles | pass | A1 bold=true, fill=pattern |
| column widths | pass | A width=18 |
| row heights | pass | row1 height=26 |
| merged cells | pass | merges=A1:F1 |
| hidden row and column state | pass | row4 hidden=true, colF hidden=true |
| number and date formats | pass | B3=#,##0.00, C3=yyyy-mm-dd, D3=@ |
| saved formula display value | pass | value={"formula":"B3*2","result":2469.12}, text=2469.12 |
| unsaved formula limitation observed | pass | value={"formula":"B3*3"}, text=(empty cached result) |

### Formula Display Values

`exceljs` can expose saved formula results when the source workbook contains cached calculation results. Formulas without saved results do not give OfficeTools a trustworthy calculated display value; production code should use the saved result when present and treat missing cached results as a limitation that may require user recalculation/resave in WPS.

## Embedded Object Detection Probe

Artifact:

- Object workbook: `.trellis/tasks/06-28-excel-processing-probe/probe-output/object-detection.xlsx`

Overall result: `pass`

| Sheet | Worksheet relationship file | Has object relationship | Relationship excerpt |
| --- | --- | --- | --- |
| 无对象 | xl/worksheets/_rels/sheet1.xml.rels | no | No worksheet relationship file. |
| 含图片 | xl/worksheets/_rels/sheet2.xml.rels | yes | <?xml version="1.0" encoding="UTF-8" standalone="yes"?> <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships> |

Detection approach: inspect `xl/worksheets/_rels/sheetN.xml.rels` for relationship types containing drawing, vmlDrawing, oleObject, or ctrlProp. A selected sheet with these relationships should be blocked; non-selected sheets may continue if their own relationship file is clean.

## Next Steps Before Split/Merge

1. Add representative `.xls`, `.et`, styled `.xlsx`, and object-containing `.xlsx` samples under `.trellis/tasks/06-28-excel-processing-probe/samples`.
2. Run `pnpm probe:excel` from the repository root to validate SheetJS direct `.xls` and `.et` reading in the same report.
3. If SheetJS direct reading fails or cannot preserve required metadata from real samples, narrow that file format support contract before split/merge implementation proceeds.
4. If real embedded object samples are not detected per selected sheet, conservatively block workbooks with any worksheet object relationship and update the parent design.
