# Excel Processing Capability Probe Implementation Plan

## Checklist

- [x] Add sample workbook location or document where samples must be placed locally.
- [x] Create a WPS detection probe.
- [x] Create `.xls` conversion probe.
- [x] Create `.et` direct library read probe.
- [x] Create workbook read/write probe for `.xlsx`.
- [x] Create style preservation probe.
- [x] Create merged-cell and hidden-row/column probe.
- [x] Create display-value and formula behavior probe.
- [x] Create embedded-object detection probe.
- [x] Write the probe report.
- [x] Update parent design if findings change assumptions.

## Validation

- Run probes on the development machine.
- Run WPS-specific `.xls` probes on UOS ARM64 when available.
- Run direct `.et` library read probes with representative `.et` samples.
- Manually inspect generated files from preservation probes.

## Rollback

If a requirement cannot be supported, stop before implementing split/merge and revise the relevant PRD with the exact limitation.

## Target Validation Pending

The local probe harness is complete and ran successfully on this development machine. Full `.xls` WPS conversion validation remains blocked until a UOS ARM64 machine with WPS and representative `.xls` samples is available. Direct `.et` reading also remains blocked until representative `.et` samples are available. Run:

```bash
pnpm probe:excel -- --run-wps-conversion
```

Do not treat automatic `.xls` conversion or direct `.et` reading as proven until that target-machine/sample run is recorded in `report.md`. `.et` must not be converted through WPS.
