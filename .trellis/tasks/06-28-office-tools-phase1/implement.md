# OfficeTools Phase 1 Implementation Plan

## Child Order

1. `06-28-electron-platform`
2. `06-28-excel-processing-probe`
3. `06-28-excel-split`
4. `06-28-excel-merge`
5. `06-28-uos-arm64-deb-integration`

Do not start the parent task for implementation unless parent-only integration work is discovered. Start the child that owns the next independently verifiable deliverable.

## Planning Gates

- Each child must have `prd.md`.
- Complex children must have `design.md` and `implement.md` before `task.py start`.
- `excel-split` and `excel-merge` must not start until the probe has selected the Excel processing approach or explicitly documents a narrowed fallback.

## Implementation Checklist

- [ ] Scaffold the Electron + React + TypeScript application.
- [ ] Define IPC contracts and shared job/log types.
- [ ] Implement app shell, two tabs, independent logs, file list states, progress, and cancellation plumbing.
- [ ] Validate WPS conversion on UOS ARM64 for `.xls` and `.et`.
- [ ] Validate Excel adapter capabilities for style, merged cells, hidden rows/columns, number formats, display values, and object detection.
- [ ] Implement split parsing and per-file configuration flow.
- [ ] Implement split output generation and final zip structure.
- [ ] Implement merge folder scan and per-file sheet selection flow.
- [ ] Implement one-sheet and multi-sheet merge modes.
- [ ] Implement output directory handling, Downloads default, and automatic rename on conflict.
- [ ] Package as `.deb` for ARM64 and run target installation validation.

## Validation Commands

Exact commands will be defined after the scaffold exists. Expected command categories:

- dependency installation;
- type check;
- lint;
- unit tests for shared utilities and Excel policies;
- integration tests or scripts for sample workbook processing;
- Electron build;
- `.deb` package build.

## Sample Validation Set

Maintain sample files for:

- normal `.xlsx`;
- `.xlsx` with merged title rows;
- `.xlsx` with styles, dates, and long number strings;
- `.xls`;
- `.et`;
- selected-sheet embedded object rejection;
- workbook with embedded object only on non-selected sheet.

## Review Gates

- After platform scaffold: confirm app opens, tabs render, and IPC is typed.
- After processing probe: confirm whether the full Excel requirements are feasible with the chosen stack.
- After split: run split samples and manually inspect output formatting.
- After merge: run merge samples and manually inspect output formatting.
- After packaging: install the `.deb` on UOS ARM64 and run at least one split and one merge flow.

## Rollback Points

- If WPS conversion is unreliable, narrow `.xls` and `.et` to manual-conversion-only before implementing feature UI around automatic conversion.
- If selected-sheet object detection is not reliable, block workbooks with any embedded workbook objects and revise the PRD before implementation.
- If style preservation cannot meet manual acceptance, document the exact unsupported style subset and get product approval before continuing.
