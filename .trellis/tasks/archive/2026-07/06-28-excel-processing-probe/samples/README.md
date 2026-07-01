# Excel Probe Samples

Place local validation samples in this directory before running the target-machine probe.

Recommended files:

- normal `.xlsx`
- `.xlsx` with merged title rows
- `.xlsx` with styles, dates, and long number strings
- `.xlsx` with embedded objects on the selected sheet
- `.xlsx` with embedded objects only on a non-selected sheet
- `.xls`
- `.et`

Run from the repository root:

```bash
pnpm probe:excel
```

SheetJS `.xls` and `.et` direct-read validation runs whenever representative samples are present. Generated probe workbooks are written to `../probe-output/`, which is ignored.
