# Implementation Plan: Unit tests for Excel and speech workflows

## Phase A: Baseline Review

- Confirm current uncommitted speech changes and test harness state.
- Read applicable Trellis specs for backend services, shared TypeScript, and quality.
- Run or inspect existing functional tests to avoid duplicate coverage.

## Phase B: Speech Service Tests

- Ensure fake helper mode covers deterministic transcription.
- Add or refine tests for queue continuation after unsupported/failed items.
- Add or refine tests for duplicate TXT export names, including existing output files.
- Add or refine tests for duration probing and 4-hour threshold detection.

## Phase C: Excel Service Tests

- Preserve existing split/merge functional coverage.
- Add a focused edge-case test only if it is stable and directly tied to existing service behavior.
- Avoid changing Excel production logic unless a test exposes a real bug.

## Phase D: Validation

- Run `pnpm typecheck`.
- Run `pnpm lint`.
- Run `pnpm --filter @office-tools/desktop test:functional`.
- Run `pnpm build` if cross-layer production code remains modified.
- Run `git diff --check`.

## Phase E: Finish

- Update specs only if a new reusable testing convention is learned.
- Commit the feature fixes and test coverage together or split commits if the diff naturally separates.
- Push to GitHub if requested after commit.
