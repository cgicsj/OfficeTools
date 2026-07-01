# Excel Processing Capability Probe Implementation Plan

## Checklist

- [x] Add sample workbook location or document where samples must be placed locally.
- [x] Create `.xls` direct library read probe.
- [x] Create `.et` direct library read probe.
- [x] Create malformed `.xls` rejection probe for SheetJS text fallback.
- [x] Create malformed `.et` rejection probe for SheetJS text fallback.
- [x] Create workbook read/write probe for `.xlsx`.
- [x] Create style preservation probe.
- [x] Create merged-cell and hidden-row/column probe.
- [x] Create display-value and formula behavior probe.
- [x] Create embedded-object detection probe.
- [x] Write the probe report.
- [x] Update parent design if findings change assumptions.

## Validation

- Run probes on the development machine.
- Run direct `.xls` library read probes with representative `.xls` samples.
- Run direct `.et` library read probes with representative `.et` samples.
- Confirm malformed `.xls` and `.et` files are rejected before generic text fallback.
- Manually inspect generated files from preservation probes.

## Rollback

If a requirement cannot be supported, stop before implementing split/merge and revise the relevant PRD with the exact limitation.

## Target Validation Pending

The local probe harness is complete and ran successfully on this development machine. Direct `.xls` and `.et` reading remain blocked until representative samples are available. Run:

```bash
pnpm probe:excel
```

Do not treat direct `.xls` or `.et` reading as proven until that sample run is recorded in `report.md`. `.xls` and `.et` must not be converted through WPS.
