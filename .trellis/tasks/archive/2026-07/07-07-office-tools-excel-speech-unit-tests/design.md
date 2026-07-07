# Design: Unit tests for Excel and speech workflows

## Summary

Use the existing Node test runner + Vite functional-test harness to add focused service-level tests for Excel and speech modules. This avoids introducing a new framework and keeps tests close to current service boundaries.

## Test Boundary

The target boundary is service-level behavior:

- Excel: `src/main/services/excel/*` functions and file registry inputs.
- Speech: `src/main/services/speech/*` functions and fake helper mode.

Renderer component testing remains out of scope because the project does not currently include React test tooling.

## Test Harness

Continue using:

- `apps/desktop/tests/functional/vite.config.ts`
- `node:test`
- `node:assert/strict`
- existing Electron mock alias

If the existing single functional test file becomes too broad, split tests into separate files only if the Vite config can support deterministic output and package scripts remain simple.

## Speech Test Strategy

Speech tests should not require real ASR dependencies. Use:

- `OFFICE_TOOLS_SPEECH_FAKE=1` for deterministic transcript output.
- `OFFICE_TOOLS_SPEECH_FAKE_DURATION_SECONDS` to exercise duration threshold behavior.
- Temporary files registered through `registerSelectedFiles`.

Coverage targets:

- Unsupported extension fails while supported files continue.
- Export generates unique TXT names when duplicates or existing files are present.
- Duration probe marks files longer than `APP_CONFIG.LIMITS.SPEECH_LONG_AUDIO_THRESHOLD_SECONDS`.

## Excel Test Strategy

Reuse generated Excel workbooks in temp directories. Coverage targets:

- Split by a selected column and merge generated outputs.
- Metadata parsing for nullable cells and legacy workbook formats.
- Add focused edge cases only where currently stable and non-flaky.

## Compatibility

- Do not require network access.
- Do not require GUI/Electron launch.
- Keep tests independent of host user data by using temp directories and the Electron mock.

## Risks

- Over-broad functional tests can become slow; keep fixtures small.
- Speech helper duration probing shells out to Python even in fake mode; failures should surface clearly.
- Current uncommitted speech changes should be validated together with added tests before commit.
