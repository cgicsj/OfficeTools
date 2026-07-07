# Design: VocoType CLI phase 2 speech-to-text

## Summary

Add a new OfficeTools top-level `语音转文字` module with an initial `音频转文字` page. The MVP accepts selected audio files, processes them through a serial queue, and returns editable transcripts. ASR runs outside the renderer and TypeScript main process through a main-process-managed Python helper/service based on VocoType CLI's local FunASR ONNX file-transcription path.

## Accuracy-First Engine Decision

The default speech engine remains the local FunASR ONNX Python helper because the product priority is best Chinese transcription quality. Node.js-only ASR remains a future optional engine for reducing Python runtime dependencies, but it should not replace FunASR until it proves equal or better on representative Chinese meeting/interview audio.

## Product Scope

### In Scope

- Top-level sidebar module: `语音转文字`.
- Initial page: `音频转文字`.
- Batch audio-file selection.
- Supported input extensions: `.wav`, `.mp3`, `.m4a`, `.flac`.
- Serial queue processing with per-file status.
- Per-file result cards with transcript text.
- Copy single transcript, copy all transcripts, and export plain `.txt` transcripts.
- Per-file retry after failure.
- Local FunASR ONNX transcription via Python helper/service.
- Debian arm64 packaging constraints kept visible during implementation.

### Out of Scope

- Live microphone recording.
- Real-time streaming transcription.
- Global hotkey dictation or system-wide text injection.
- Cloud ASR in the MVP.
- `.srt`, `.json`, timeline subtitles, word timestamps, speaker labels, or diarization.
- Automatic training dataset capture.

## Existing Architecture Fit

OfficeTools uses a cross-layer Electron pattern:

1. Renderer components call `window.officeTools`.
2. `apps/desktop/src/preload/index.ts` exposes a typed bridge.
3. `apps/desktop/src/shared/constants/channels.ts` defines IPC channels.
4. Main-process IPC handlers call services under `apps/desktop/src/main/services`.
5. Shared request/result/event types live under `apps/desktop/src/shared/types`.

Speech-to-text should follow this same pattern rather than bypassing preload or letting the renderer access Node/Python directly.

## Proposed Module Model

### Navigation

The current `WorkflowTab` type only models table workflows (`split | merge`). Speech-to-text should not be squeezed into that semantic type. Introduce or refactor navigation types so the shell can represent:

- Top-level module: table processing.
- Table sub-tabs: split, merge.
- Top-level module: speech-to-text.
- Speech sub-page: audio transcription.

Implementation may use a dedicated `AppModule` plus module-specific tab types, or a route-like view state. Avoid extending `WorkflowTab` with unrelated speech values if it causes semantic drift in job/log types.

### Renderer UI

Create a speech workflow component that supports:

- Select audio files.
- Display selected queue in order.
- Start transcription.
- Show current queue progress and per-file status.
- Show transcript result card per file.
- Show failure card with error and retry action.
- Copy single transcript.
- Copy all successful transcripts.
- Export `.txt` transcript output.

### Main Services

Add a speech service area under `apps/desktop/src/main/services/speech`:

- Validates selected file paths and extensions.
- Builds a serial transcription queue.
- Starts/stops or reuses a Python helper/service.
- Sends one file at a time to the helper.
- Emits typed progress/status events.
- Writes `.txt` exports when requested.
- Keeps ASR model/runtime initialization isolated from Excel services.

### IPC/API

Add a speech API group to `OfficeToolsApi`, for example:

- `selectAudioFiles()` or reuse a generic dialog handler with audio filters.
- `startTranscriptionJob(input)`.
- `retryTranscription(input)`.
- `exportTranscripts(input)`.
- Optional speech event stream if job events remain generic.

Prefer typed `ApiResult<T>` responses and typed progress events. If reusing `JobEvent`, update `WorkflowTab`/job semantics carefully; otherwise introduce speech-specific events to avoid corrupting Excel job contracts.

## Python Helper Boundary

### Recommended Shape

Use a long-lived Python helper/service managed by Electron main process:

- Main process spawns Python with a known helper script path.
- Communication uses newline-delimited JSON over stdin/stdout, or a local process protocol with equivalent structured messages.
- Main sends `transcribe_file` requests containing an absolute file path and options.
- Helper returns success/error JSON with transcript, raw text, duration, inference latency, confidence/model metadata when available.
- Helper keeps FunASR models warm between files when possible.

### Why This Boundary

- VocoType's ASR stack is already Python-oriented.
- FunASR ONNX/model loading is heavy and should not live in the renderer.
- A long-lived helper avoids reloading models for every file.
- JSON protocol keeps TypeScript/Python coupling explicit and testable.
- The same helper boundary can later be packaged into Debian arm64 resources.

### VocoType Code to Reuse Conceptually

- `app/funasr_server.py`: local ONNX ASR, optional VAD, punctuation, model cache, cleanup.
- `app/funasr_config.py`: model names and revision.
- `app/download_models.py`: model cache/download mechanics, if compatible with packaging goals.
- `app/transcribe.py`: result shape and file transcription dispatch ideas; omit microphone capture/session buffering.

Do not carry over VocoType microphone capture, global hotkey, keyboard injection, or dataset recorder into the MVP.

## Data Contracts

Suggested shared types:

- `SpeechAudioFile`: id, path, name, extension, sizeBytes.
- `SpeechTranscriptionStatus`: `queued | processing | completed | failed | canceled`.
- `SpeechTranscriptionItem`: file metadata, status, transcript, rawText, error, duration, inferenceLatency.
- `StartSpeechTranscriptionInput`: files or file paths in queue order, options.
- `SpeechTranscriptionJobResult`: job id, items, summary.
- `SpeechJobEvent`: per-file status/progress/log events.
- `ExportSpeechTranscriptsInput`: selected item ids or transcripts, output directory or file path, export mode.

## Error Handling

Errors must be user-actionable:

- Unsupported extension.
- File missing or unreadable.
- Decode failure.
- Python executable/helper unavailable.
- Missing Python dependency.
- Missing model files.
- ASR initialization failure.
- ASR transcription failure.
- Export path/write failure.

A single item failure must not stop the queue. The queue continues, and the failed item remains retryable with the original error.

## Packaging Design Notes

The final packaging target is one Debian arm64 installer after the functional loop is complete. Current project evidence:

- `apps/desktop/package.json` has `make:deb:arm64`.
- `apps/desktop/forge.config.ts` uses Electron Forge `maker-deb`.

Design constraints for implementation:

- Keep helper scripts under a stable resource directory that can be included in packaged builds.
- Keep model path resolution configurable for dev and packaged modes.
- Avoid assuming internet access at runtime for packaged production mode.
- Ensure any native Python dependencies are validated on Debian arm64 before final packaging.
- Avoid placing large mutable model files inside Electron asar if they need filesystem access; use unpacked resources or app data as appropriate.

## Rollback Strategy

- Speech module should be removable by deleting its navigation entry and API group.
- Excel `split`/`merge` contracts must remain untouched except for navigation shell refactoring.
- If Python helper integration is unstable, keep UI hidden or disabled behind an availability check without impacting Excel workflows.
- Avoid global singleton state shared with Excel job cancellation unless intentionally generalized.

## Validation Strategy

Functional implementation should support validation without real ASR models by using a fake helper in tests or development mode. Required final checks before implementation completion:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- Targeted functional/service tests if added for speech queue behavior
- Manual test with at least one `.wav` file on the target environment when ASR dependencies are available
