# Implementation Plan: VocoType CLI phase 2 speech-to-text

## Phase A: Cross-Layer Foundations

- Read relevant Trellis specs before editing: shared quality/typescript, frontend component/state/IPC rules, backend IPC/service/error-handling rules, and cross-layer thinking guide.
- Refactor navigation state so `语音转文字` is a top-level module and does not misuse Excel `WorkflowTab` semantics.
- Add shared speech types under `apps/desktop/src/shared/types`.
- Add speech IPC channel constants under `apps/desktop/src/shared/constants/channels.ts`.
- Extend `OfficeToolsApi` and `window.officeTools` preload bridge with a speech API group.

## Phase B: Python Helper Prototype

- Add a Python helper/service directory in a packaging-friendly location.
- Implement a JSON protocol for `health` and `transcribe_file` requests.
- Adapt VocoType FunASR ONNX file-transcription logic while excluding microphone capture, hotkeys, keyboard output, Volcengine, and dataset recording.
- Make model and dependency paths configurable for development and future packaged modes.
- Return structured success/error payloads.
- Add a fake helper mode or test double path for queue tests without ASR dependencies.

## Phase C: Main-Process Speech Service

- Add `apps/desktop/src/main/services/speech` with file validation, queue management, helper process lifecycle, and export logic.
- Add speech IPC handlers under `apps/desktop/src/main/ipc` and register them in `registerIpcHandlers`.
- Implement serial queue behavior: queued, processing, completed, failed, retryable.
- Ensure one failed file does not stop the remaining queue.
- Emit typed progress/status events or return final job results in a way the renderer can track per-file state.
- Keep speech cancellation and retry scoped to speech jobs unless a shared job abstraction is intentionally introduced.

## Phase D: Renderer Speech UI

- Add `语音转文字` module to `AppShell` navigation.
- Add the initial `音频转文字` page.
- Add file selection UI for `.wav`, `.mp3`, `.m4a`, `.flac`.
- Show queue order, current status, per-file errors, and final summary.
- Show one result card per audio file.
- Implement copy single transcript and copy all transcripts.
- Implement `.txt` export action through main-process API.
- Keep Excel split/merge UI behavior unchanged.

## Phase E: Packaging Follow-Up Preparation

- Document dev setup for Python/FunASR helper.
- Identify Debian arm64 native dependency requirements for `soundfile`, `librosa`, `funasr_onnx`, ONNX runtime, and model files.
- Ensure helper/model resource paths can be included by Electron Forge maker-deb later.
- Keep runtime checks clear enough for the future single-installer work.

## Phase F: Validation

- Run `pnpm lint`.
- Run `pnpm typecheck`.
- Run `pnpm build`.
- Run or add focused tests for queue behavior with a fake helper if practical.
- Manually validate with a supported audio file when Python/FunASR dependencies are available.

## Risk Areas

- Navigation refactor can accidentally broaden `WorkflowTab`; avoid semantic drift.
- Python helper lifecycle can leak processes; main process must clean up on app quit/job end.
- Large model files and native Python dependencies may not work inside asar; keep resources external/unpacked.
- Debian arm64 ONNX/native dependency support must be verified during packaging stage.
- Multi-format audio decode may depend on packaged native libraries; `.wav` should remain the stability baseline.

## Rollback Points

- After navigation refactor: verify Excel split/merge still render and compile.
- After IPC additions: verify preload typecheck passes.
- After helper integration: allow disabling speech module if helper health check fails.
- Before packaging work: feature should still run in dev with external dependencies.

## Review Gate Before `task.py start`

- Confirm PRD, design, and implementation plan with the user.
- Confirm whether implementation should begin with functional MVP only, leaving Debian arm64 single-installer packaging as the next Trellis task/stage after feature completion.
