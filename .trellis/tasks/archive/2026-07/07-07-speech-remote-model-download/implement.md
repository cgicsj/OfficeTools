# Implementation Plan: Remote model download for speech transcription

## Phase A: Specs and Existing Patterns

- Read Trellis backend/frontend/shared specs.
- Inspect preferences, IPC, preload, speech helper, speech job, and tests.
- Confirm `jszip` is available in desktop dependencies.

## Phase B: Shared Contracts and Config

- Add resource config JSON with default `https://2.22.2.2`.
- Add shared speech model settings/status/progress types and Zod schemas.
- Add IPC channels and preload API methods.

## Phase C: Main Model Manager

- Implement default config loading for dev and packaged paths.
- Implement persisted model settings.
- Implement local model directory detection.
- Implement serial zip download + extraction + progress callback.
- Inject resolved model env vars into Python helper spawn.

## Phase D: Renderer UX

- Add speech settings button and modal.
- Add missing-model confirmation before transcription.
- Display download progress in logs/summary.
- Fix save-path top-border alignment.

## Phase E: Tests

- Add functional/service tests for default config/settings if practical.
- Add tests for model-ready detection and zip extraction using local tiny fixtures.
- Preserve fake helper behavior without real ASR models.

## Phase F: Validation and Finish

- Run `pnpm typecheck`.
- Run `pnpm lint`.
- Run `pnpm --filter @office-tools/desktop test:functional`.
- Run `pnpm build`.
- Run `git diff --check`.
- Update spec if a reusable model-download contract is established.
- Commit, archive task, record session, and push if requested.
