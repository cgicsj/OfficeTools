# Unit tests for Excel and speech workflows

## Goal

Add focused automated tests for OfficeTools' Excel processing and speech-to-text modules so core service behavior can be verified without launching the Electron UI or requiring real ASR models.

## Problem Statement

OfficeTools now has two primary functional areas: Excel split/merge workflows and local speech-to-text. The existing functional test covers a broad happy path and some speech behavior, but the project needs clearer module-level coverage for edge cases and recent requirements such as long-audio confirmation support and duplicate TXT export protection.

## Scope

### In Scope

- Add or expand automated tests for Excel service behavior.
- Add or expand automated tests for speech service behavior.
- Keep tests runnable from the existing package test setup.
- Use fake helper mode or test doubles for speech tests so CI does not need FunASR models or native ASR runtime.
- Keep renderer interaction tests out of scope unless they can be added without new framework dependencies.
- Preserve existing production behavior.

### Out of Scope

- Adding Playwright, React Testing Library, Vitest, Jest, or other new test frameworks unless the implementation plan explicitly justifies it.
- Manual UI testing automation.
- Real ASR accuracy tests requiring model downloads.
- Implementing speech segmentation/cropping.
- Changing Excel or speech product behavior beyond testability fixes.

## Requirements

- Excel tests should cover split/merge core service behavior and representative edge cases already supported by the code.
- Speech tests should cover fake-helper transcription queue behavior, failed-item continuation, duplicate TXT export naming, duration probing, and long-audio threshold detection.
- Tests should avoid brittle assertions against generated temporary paths except where path naming is the behavior under test.
- Tests should clean up temporary files/directories after execution.
- Tests should pass with `pnpm --filter @office-tools/desktop test:functional` or an explicitly added package test script.
- Existing validation commands must keep passing: `pnpm typecheck`, `pnpm lint`, and package build if touched code warrants it.

## Acceptance Criteria

- [ ] Excel module has automated coverage for existing split/merge workflows and at least one edge-case path.
- [ ] Speech module has automated coverage for queue continuation after one failed file.
- [ ] Speech module has automated coverage for duplicate TXT export names without overwriting existing files.
- [ ] Speech module has automated coverage for duration probing and identifying files longer than 4 hours.
- [ ] Tests do not require real FunASR model files or cloud credentials.
- [ ] All relevant test, lint, and typecheck commands pass.

## Current Context

- There are uncommitted speech feature refinements in the working tree: long-audio duration preflight, duplicate TXT export protection, save-path CSS alignment, and copy button label update.
- Existing test harness is under `apps/desktop/tests/functional` and builds to `.functional-tests` via Vite, then runs Node's built-in test runner.
- Electron APIs are mocked via `apps/desktop/tests/functional/mocks/electron.ts`.
