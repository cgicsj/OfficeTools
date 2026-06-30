# Excel Processing Capability Probe Report

## Summary

- Probe harness: `apps/desktop/scripts/excel-probe.mjs`
- Generated output directory: `.trellis/tasks/06-28-excel-processing-probe/probe-output`
- Sample directory: `.trellis/tasks/06-28-excel-processing-probe/samples`
- Candidate workbook library: `exceljs`
- Candidate xlsx relationship inspector: `yauzl`

## Recommendation

Use `exceljs` as the first Phase 1 `.xlsx` workbook adapter candidate. The synthetic round trip confirms workbook/sheet reading, writing, styles, widths, row heights, merge ranges, hidden rows/columns, number formats, and saved formula results can be preserved with explicit copy logic.

Use a ZIP relationship inspection step for selected-sheet embedded object detection. The synthetic image workbook confirms worksheet-level drawing relationships can be detected without opening the workbook in the renderer. Validate this again with real chart/image/WPS-authored samples before split/merge implementation.

Keep `.xls` and `.et` support gated behind WPS conversion. This development machine did not prove UOS ARM64 WPS conversion unless the WPS conversion section below says `tested`; run the same script on the target machine with `--run-wps-conversion` and sample files before starting split/merge.

## Acceptance Matrix

- [x] Probe report documents WPS command availability and conversion behavior.
- [ ] `.xls` conversion tested with a sample file.
- [ ] `.et` conversion tested with a sample file or documented as blocked by local WPS availability.
- [x] Candidate Excel library tested against preservation requirements.
- [x] Selected-sheet embedded object detection approach documented.
- [x] Formula display-value limitations documented.
- [ ] Parent design updated only if target-machine WPS or real workbook samples change assumptions.

## Samples

No local sample files were found. Put samples in the sample directory and rerun the script.

## WPS Detection

No WPS command candidates were detected on this machine.

## WPS Conversion

- Status: `skipped`
- Reason: Pass --run-wps-conversion on a UOS ARM64 machine with WPS and sample .xls/.et files to attempt conversion.
- Run flag used: `false`

No conversion command was executed in this run.

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

1. Add representative `.xls`, `.et`, styled `.xlsx`, and object-containing `.xlsx` samples under `.trellis/tasks/06-28-excel-processing-probe/samples` on a UOS ARM64 machine.
2. Run `pnpm probe:excel -- --run-wps-conversion` from the repository root.
3. If WPS conversion fails, revise split/merge PRDs to use manual conversion for `.xls` and `.et`.
4. If real embedded object samples are not detected per selected sheet, conservatively block workbooks with any worksheet object relationship and update the parent design.
