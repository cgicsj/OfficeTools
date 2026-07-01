# Excel Split Implementation Plan

## Checklist

- [x] Implement split file selection validation.
- [x] Implement split parse action.
- [x] Implement per-file sheet metadata loading.
- [x] Implement selected-sheet unsupported-object rejection.
- [x] Implement field-name row selection and column-option extraction.
- [x] Implement merged, duplicate, and empty field-name display rules.
- [x] Implement required log events.
- [x] Implement split grouping and 500-output validation.
- [x] Implement filename sanitization and duplicate resolution.
- [x] Implement output workbook writer.
- [x] Implement final zip writer.
- [x] Implement cancellation cleanup.
- [ ] Add focused tests for filename policy, field-name option generation, and grouping rules.
- [ ] Run sample workbook manual acceptance.

## Validation

- Type-check, lint, and tests.
- Split normal `.xlsx`.
- Split merged-title `.xlsx`.
- Split styled/date/long-number `.xlsx`.
- Split `.xls` through the direct `.xls` library adapter.
- Split `.et` through the direct `.et` library adapter.
- Verify selected-sheet object rejection.
- Verify cancel cleanup.

## Rollback

If output style preservation regresses, isolate the writer change and fall back to the last passing adapter behavior before continuing UI work.


## Implementation Notes

- Real split jobs now run in the main process through typed IPC instead of the previous renderer-side completion simulation.
- `.xlsx` files split through `exceljs`; `.xls` and `.et` files split directly through SheetJS CE without WPS conversion.
- The final output is `总拆分结果.zip` in the selected output directory, with one folder per input file and duplicate names suffixed.
- Selected-sheet embedded object rejection is implemented for `.xlsx` relationship files and direct `.xls` / `.et` files. ZIP-like `.et` files use worksheet relationship inspection; CFB/BIFF files scan the selected sheet substream for object/drawing records and fail closed when object ownership cannot be confirmed. Representative `.xls` / `.et` samples are still required to validate direct-reader fidelity.

## Validation Run

- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm probe:excel`

Representative `.xls` / `.et` sample acceptance is still pending because no local samples are available.
