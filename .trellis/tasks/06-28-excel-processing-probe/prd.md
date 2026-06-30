# Excel Processing Capability Probe

## Goal

Validate the high-risk Excel processing assumptions before implementing split and merge features.

Parent task: `06-28-office-tools-phase1`.

## Requirements

- Verify how OfficeTools can call locally installed WPS on UOS ARM64 for `.xls` conversion.
- Verify `.xls` to `.xlsx` conversion.
- Verify direct `.et` reading through a library that supports WPS `.et` files.
- Verify behavior when WPS is unavailable, `.xls` conversion fails, or direct `.et` reading fails.
- Evaluate Excel library support for:
  - reading sheet names and row counts;
  - reading display values;
  - preserving cell styles;
  - preserving column widths and row heights;
  - preserving merged cells;
  - preserving hidden row/column state;
  - preserving number and date display formats;
  - writing `.xlsx` outputs;
  - detecting images/charts only on the selected sheet when possible.
- Determine how formula display values behave when the workbook has or has not saved calculated values.
- Produce a recommendation for the implementation stack or a narrowed fallback.

## Acceptance Criteria

- [x] A probe report documents WPS command availability and `.xls` conversion behavior.
- [ ] `.xls` conversion has been tested with a sample file.
- [ ] `.et` direct library reading has been tested with a sample file.
- [x] The direct `.et` library choice and validation gaps are documented.
- [x] At least one candidate Excel library has been tested against the preservation requirements.
- [x] The selected-sheet embedded object detection approach is documented.
- [x] Formula display-value limitations are documented.
- [x] The parent design is updated if the probe changes technical assumptions.

## Out Of Scope

- Full production split implementation.
- Full production merge implementation.
- `.deb` packaging.

## Remaining External Validation

The unresolved acceptance items are `.xls` conversion with a real sample on a UOS ARM64 machine with WPS installed and direct `.et` library reading with representative `.et` samples. The local development machine has no WPS command candidates and no local `.xls` / `.et` samples, so `.xls` conversion and `.et` direct-read fidelity must not be treated as proven yet. `.et` must not be routed through WPS conversion.
