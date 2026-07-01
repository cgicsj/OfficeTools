# Excel Merge Implementation Plan

## Checklist

- [x] Implement folder selection and scanning.
- [x] Implement type/size filtering and numbered file list.
- [x] Implement per-file sheet selection.
- [x] Implement selected-sheet unsupported-object rejection.
- [x] Implement merge mode selection.
- [x] Implement field-name row selection for one-sheet mode.
- [x] Implement header display-value comparison.
- [x] Implement one-sheet writer for matching headers.
- [x] Implement one-sheet writer for differing headers and warning dialog.
- [x] Implement multi-sheet writer.
- [x] Implement sheet-name truncation and duplicate resolution.
- [x] Implement output directory/default Downloads handling.
- [x] Implement output conflict automatic rename.
- [x] Implement cancellation cleanup.
- [ ] Add focused tests for header comparison, sheet-name policy, and output filename policy. (Skipped this pass per user instruction.)
- [ ] Run sample workbook manual acceptance. (Skipped this pass per user instruction.)

## Validation

- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm build`
- [x] `pnpm probe:excel`
- [ ] Focused tests and sample workbook manual acceptance were deferred per user instruction.

## Functional Validation Targets

- Type-check, lint, and tests.
- Merge normal `.xlsx` files into one sheet.
- Merge differing-header `.xlsx` files into one sheet.
- Merge selected sheets into multiple sheets.
- Merge `.xls` through the direct `.xls` library adapter.
- Merge `.et` through the direct `.et` library adapter.
- Verify selected-sheet object rejection.
- Verify automatic output rename.
- Verify cancel cleanup.

## Rollback

If one-sheet merge and multi-sheet merge compete for adapter behavior, split writer code paths behind separate service functions before continuing feature work.
