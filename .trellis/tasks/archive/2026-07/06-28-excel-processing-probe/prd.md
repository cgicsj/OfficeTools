# Excel Processing Capability Probe

## Goal

Validate the high-risk Excel processing assumptions before implementing split and merge features.

Parent task: `06-28-office-tools-phase1`.

## Requirements

- Verify direct `.xls` reading through a library that supports legacy Excel `.xls` files.
- Verify direct `.et` reading through a library that supports WPS `.et` files.
- Verify behavior when direct `.xls` or `.et` reading fails.
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

- [ ] `.xls` direct library reading has been tested with a sample file.
- [ ] `.et` direct library reading has been tested with a sample file.
- [x] Malformed `.xls` input is rejected before SheetJS text fallback can treat it as a valid sheet.
- [x] Malformed `.et` input is rejected before SheetJS text fallback can treat it as a valid sheet.
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

The unresolved acceptance items are direct `.xls` and `.et` library reading with representative samples. The local development machine has no local `.xls` / `.et` samples, so direct-read fidelity for those formats must not be treated as proven yet. `.xls` and `.et` must not be routed through WPS conversion. The local malformed-file probe proves that text-like `.xls` and `.et` impostors are rejected before SheetJS can parse them as generic text sheets.
