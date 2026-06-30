# Excel Merge Implementation Plan

## Checklist

- [ ] Implement folder selection and scanning.
- [ ] Implement type/size filtering and numbered file list.
- [ ] Implement per-file sheet selection.
- [ ] Implement selected-sheet unsupported-object rejection.
- [ ] Implement merge mode selection.
- [ ] Implement field-name row selection for one-sheet mode.
- [ ] Implement header display-value comparison.
- [ ] Implement one-sheet writer for matching headers.
- [ ] Implement one-sheet writer for differing headers and warning dialog.
- [ ] Implement multi-sheet writer.
- [ ] Implement sheet-name truncation and duplicate resolution.
- [ ] Implement output directory/default Downloads handling.
- [ ] Implement output conflict automatic rename.
- [ ] Implement cancellation cleanup.
- [ ] Add focused tests for header comparison, sheet-name policy, and output filename policy.
- [ ] Run sample workbook manual acceptance.

## Validation

- Type-check, lint, and tests.
- Merge normal `.xlsx` files into one sheet.
- Merge differing-header `.xlsx` files into one sheet.
- Merge selected sheets into multiple sheets.
- Merge `.xls` and `.et` through WPS conversion.
- Verify selected-sheet object rejection.
- Verify automatic output rename.
- Verify cancel cleanup.

## Rollback

If one-sheet merge and multi-sheet merge compete for adapter behavior, split writer code paths behind separate service functions before continuing feature work.
