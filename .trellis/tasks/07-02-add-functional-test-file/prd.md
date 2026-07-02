# Add Functional Test File

## Goal
Add a functional test file that can be run locally to verify the desktop Excel workflow behavior without requiring Electron UI automation.

## User Value
Developers can quickly validate the core OfficeTools Excel processing path after changes, reducing regressions in split/merge workflows.

## Confirmed Facts
- The repository has no existing test framework or test script.
- The desktop package already has `typecheck`, `lint`, `build`, and `probe:excel` scripts.
- Core user-facing functionality centers on Excel split and merge workflows.
- Excel workflow logic depends on existing local dependencies (`exceljs`, `xlsx`, `jszip`) and file registry source IDs.
- This is a lightweight task; PRD-only planning is sufficient.

## Requirements
- Add a runnable functional test file under the desktop package.
- Use only existing dependencies and Node built-in testing/assertion APIs.
- Generate temporary Excel fixtures during the test instead of relying on checked-in binary fixtures.
- Exercise source-code services where practical, not just standalone duplicate logic.
- Verify meaningful workflow outcomes: generated split artifact, expected grouped rows, merge output, and completed job events.
- Add a package script so the test is discoverable and repeatable.

## Acceptance Criteria
- `pnpm --filter @office-tools/desktop test:functional` runs the functional test.
- The test creates its own temporary workbook and output directories.
- The test validates split output contains department-specific workbooks with expected row data.
- The test validates merge output exists and contains expected source rows.
- The test leaves no persistent fixture/output files in the repository.
- Existing `typecheck` remains passing.

## Out of Scope
- Electron UI automation.
- Adding a third-party test framework.
- Broad unit test coverage for all helpers.
- Network dependency installation.

## Open Questions
None blocking. Recommended implementation: compile a small test-only TypeScript entry with `tsc`, then run it with Node's built-in test runner.
