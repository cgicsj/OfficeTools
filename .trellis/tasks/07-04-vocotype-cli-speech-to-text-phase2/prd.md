# VocoType CLI phase 2 speech-to-text planning

## Goal

Plan the second-phase speech-to-text feature for OfficeTools using `233stone/vocotype-cli` as the primary technical reference, then hand the resulting requirements and implementation plan to Trellis development.

## Problem Statement

OfficeTools currently focuses on local Excel split/merge workflows. Phase 2 should add a speech-to-text capability that turns user-selected audio files into editable text while preserving the project's local-first desktop tooling direction. Live microphone recording and real-time dictation are intentionally out of scope for the MVP.

## User Value

- Users can convert existing meeting, interview, note, or voice-memo audio files into text.
- Users can keep speech processing local by default when privacy matters.
- The implementation can reuse the file-based ASR parts of VocoType CLI rather than inventing an ASR pipeline from scratch.

## Confirmed Facts

### VocoType CLI reference project

- Repository inspected from `https://github.com/233stone/vocotype-cli.git` on July 4, 2026.
- The CLI is a Python application with `main.py` as the command entry and `app/` modules for capture, transcription, output, hotkeys, and ASR backends.
- `app/config.py` defines defaults for hotkey toggle, audio capture, ASR options, output injection, logging, and backend selection.
- `app/audio_capture.py` captures mono `int16` microphone frames via `sounddevice.RawInputStream` into a bounded queue.
- `app/transcribe.py` owns the recording session lifecycle, buffers audio, writes temporary WAV files, dispatches async transcription work, and reports a `TranscriptionResult`.
- VocoType supports a local `funasr` backend and a cloud `volcengine` backend; local `funasr` is the privacy-preserving default.
- The local backend uses FunASR ONNX models, optional VAD, optional punctuation restoration, model caching, and periodic memory cleanup.
- The CLI has global hotkey start/stop behavior and text output injection through keyboard/clipboard/Unicode strategies.
- Dataset recording exists as a plugin that can persist audio and transcript pairs for debugging or model/data work.

### OfficeTools host project

- OfficeTools is an Electron + React + TypeScript desktop app under `apps/desktop`.
- The current UI has a sidebar module for table processing and two workflow tabs: split and merge.
- Shared workflow state is typed through `WorkflowTab`, `JobStage`, `JobEvent`, and `ApiResult` under `apps/desktop/src/shared/types`.
- Renderer-to-main calls go through `window.officeTools`, the preload bridge, `IPC_CHANNELS`, and main-process IPC handlers.
- Existing services live under `apps/desktop/src/main/services`; cross-layer features must update shared types, IPC constants, preload, main handlers, and renderer UI together.
- Validation commands available from the workspace root include `pnpm lint`, `pnpm typecheck`, and `pnpm build`.

## Requirements

- Add a new speech-to-text capability as a first-class OfficeTools feature, not as an Excel sub-feature.
- Add a new top-level sidebar module named `语音转文字` with an initial `音频转文字` page.
- MVP input is audio-file transcription only; no live recording, hotkey dictation, or real-time microphone capture.
- MVP supports selecting multiple audio files and transcribes them through a single serial queue.
- A single-file failure does not stop the batch; the failed file is marked failed with an actionable error and the queue continues.
- Failed files remain visible and can be retried individually.
- MVP supported input formats are `.wav`, `.mp3`, `.m4a`, and `.flac`; 16 kHz mono WAV is the primary stability path.
- Keep the MVP local-first and privacy-preserving; MVP uses a local Python helper/service based on VocoType's FunASR ONNX file-transcription path.
- The final product target is a single OfficeTools installer that bundles all required ASR runtime dependencies and models.
- The single-installer packaging target prioritizes Debian arm64 first.
- Delivery order: first complete the Phase 2 speech-to-text feature loop, then complete Debian arm64 single-installer packaging as the follow-up delivery stage.
- Provide a clear UI for selecting multiple audio files, viewing per-file and overall transcription progress, and reviewing recognized text in one result card per audio file.
- MVP output supports copying one transcript, copying all transcripts, and exporting plain `.txt` transcript files.
- Preserve existing Excel split/merge workflows without regressions.
- Use typed IPC contracts for all renderer-main communication.
- Keep heavy ASR/runtime dependencies isolated from the renderer and from existing Excel services by running ASR through a main-process-managed external Python helper/service.
- Surface actionable setup/runtime errors, including missing ASR runtime, missing model files, unsupported file extensions, decode failures, and transcription failures.
- Make the implementation testable without requiring real microphone input or large model downloads in normal lint/typecheck paths.

## Non-Goals

- Do not implement live microphone recording or real-time streaming transcription in the MVP.
- Do not implement a full VocoType-style system-wide input method in the MVP.
- Do not require cloud ASR credentials for the default flow.
- Do not port FunASR inference directly into the Electron renderer or TypeScript main process in the MVP.
- Do not block Excel processing on ASR model installation or initialization.
- Do not make architecture choices that prevent single-installer bundling of Python, native dependencies, and ASR models after the functional loop is complete.
- Do not persist user audio by default.
- Do not provide `.srt`, `.json`, timeline subtitle export, word timestamps, speaker diarization, or speaker labels in the MVP.
- Do not promise support for audio formats outside `.wav`, `.mp3`, `.m4a`, and `.flac` in the MVP.

## Acceptance Criteria

- [ ] Planning artifacts include `prd.md`, `design.md`, and `implement.md` before Trellis development starts.
- [x] The planned MVP identifies the exact input mode: audio-file transcription only.
- [x] The planned MVP supports multiple audio files processed serially through a queue.
- [x] The planned batch failure strategy marks one file failed, continues the queue, shows a final summary, and supports retrying failed items.
- [x] The planned MVP supports `.wav`, `.mp3`, `.m4a`, and `.flac`, with 16 kHz mono WAV as the primary stability path.
- [x] The planned MVP uses a main-process-managed external Python helper/service for local FunASR ONNX file transcription.
- [x] The planned result UX uses one card per audio file with copy single, copy all, and plain `.txt` export actions.
- [x] The planned UX adds a top-level `语音转文字` sidebar module with an initial `音频转文字` page.
- [ ] The implementation plan lists affected shared types, IPC channels, preload API, main services, renderer components, packaging considerations, and validation commands.
- [ ] The plan includes a rollback strategy that can remove or disable speech-to-text without affecting Excel workflows.
- [ ] The plan separates functional delivery from follow-up single-installer packaging while keeping packaging constraints visible during implementation.

## Open Product Decisions

- Navigation chosen: top-level `语音转文字` module, not a table-processing tab.

- MVP input mode chosen: audio-file transcription only.
- Batch behavior chosen: multiple selected audio files, processed serially in queue order.
- Failure behavior chosen: one file failure does not stop the batch; failed items keep error details and can be retried.
- Input formats chosen: `.wav`, `.mp3`, `.m4a`, `.flac`; 16 kHz mono WAV is the primary stability path.
- Output chosen: one result card per audio file, copy single, copy all, and plain `.txt` export.
- ASR integration chosen: main-process-managed external Python helper/service using VocoType's local FunASR ONNX file transcription path.
- Final packaging goal: after Phase 2 feature development is complete, bundle all required Python/runtime/model dependencies into one Debian arm64 installer first.
- Packaging evidence: OfficeTools already has `make:deb:arm64` in `apps/desktop/package.json`, using Electron Forge `maker-deb`.
