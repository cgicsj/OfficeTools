# Excel Processing Capability Probe Implementation Plan

## Checklist

- [x] Add sample workbook location or document where samples must be placed locally.
- [x] Create a WPS detection probe.
- [x] Create `.xls` conversion probe.
- [x] Create `.et` conversion probe.
- [x] Create workbook read/write probe for `.xlsx`.
- [x] Create style preservation probe.
- [x] Create merged-cell and hidden-row/column probe.
- [x] Create display-value and formula behavior probe.
- [x] Create embedded-object detection probe.
- [x] Write the probe report.
- [x] Update parent design if findings change assumptions.

## Validation

- Run probes on the development machine.
- Run WPS-specific probes on UOS ARM64 when available.
- Manually inspect generated files from preservation probes.

## Rollback

If a requirement cannot be supported, stop before implementing split/merge and revise the relevant PRD with the exact limitation.

## Target Validation Pending

The local probe harness is complete and ran successfully on this development machine. Full WPS conversion validation remains blocked until a UOS ARM64 machine with WPS and representative `.xls` / `.et` samples is available. Run:

```bash
pnpm probe:excel -- --run-wps-conversion
```

Do not treat automatic `.xls` / `.et` conversion as proven until that target-machine run is recorded in `report.md`.
