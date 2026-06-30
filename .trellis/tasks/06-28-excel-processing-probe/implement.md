# Excel Processing Capability Probe Implementation Plan

## Checklist

- [ ] Add sample workbook location or document where samples must be placed locally.
- [ ] Create a WPS detection probe.
- [ ] Create `.xls` conversion probe.
- [ ] Create `.et` conversion probe.
- [ ] Create workbook read/write probe for `.xlsx`.
- [ ] Create style preservation probe.
- [ ] Create merged-cell and hidden-row/column probe.
- [ ] Create display-value and formula behavior probe.
- [ ] Create embedded-object detection probe.
- [ ] Write the probe report.
- [ ] Update parent design if findings change assumptions.

## Validation

- Run probes on the development machine.
- Run WPS-specific probes on UOS ARM64 when available.
- Manually inspect generated files from preservation probes.

## Rollback

If a requirement cannot be supported, stop before implementing split/merge and revise the relevant PRD with the exact limitation.
