# Excel Split Implementation Plan

## Checklist

- [ ] Implement split file selection validation.
- [ ] Implement split parse action.
- [ ] Implement per-file sheet metadata loading.
- [ ] Implement selected-sheet unsupported-object rejection.
- [ ] Implement field-name row selection and column-option extraction.
- [ ] Implement merged, duplicate, and empty field-name display rules.
- [ ] Implement required log events.
- [ ] Implement split grouping and 500-output validation.
- [ ] Implement filename sanitization and duplicate resolution.
- [ ] Implement output workbook writer.
- [ ] Implement final zip writer.
- [ ] Implement cancellation cleanup.
- [ ] Add focused tests for filename policy, field-name option generation, and grouping rules.
- [ ] Run sample workbook manual acceptance.

## Validation

- Type-check, lint, and tests.
- Split normal `.xlsx`.
- Split merged-title `.xlsx`.
- Split styled/date/long-number `.xlsx`.
- Split `.xls` through WPS conversion.
- Split `.et` through the direct `.et` library adapter.
- Verify selected-sheet object rejection.
- Verify cancel cleanup.

## Rollback

If output style preservation regresses, isolate the writer change and fall back to the last passing adapter behavior before continuing UI work.
