# Excel Processing Capability Probe

## Goal

Validate the high-risk Excel processing assumptions before implementing split and merge features.

Parent task: `06-28-office-tools-phase1`.

## Requirements

- Verify how OfficeTools can call locally installed WPS on UOS ARM64.
- Verify `.xls` to `.xlsx` conversion.
- Verify `.et` to `.xlsx` conversion.
- Verify behavior when WPS is unavailable or conversion fails.
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

- [ ] A probe report documents WPS command availability and conversion behavior.
- [ ] `.xls` conversion has been tested with a sample file.
- [ ] `.et` conversion has been tested with a sample file or documented as blocked by local WPS availability.
- [ ] At least one candidate Excel library has been tested against the preservation requirements.
- [ ] The selected-sheet embedded object detection approach is documented.
- [ ] Formula display-value limitations are documented.
- [ ] The parent design is updated if the probe changes technical assumptions.

## Out Of Scope

- Full production split implementation.
- Full production merge implementation.
- `.deb` packaging.
