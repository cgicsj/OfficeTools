# Main Process Services

Services own privileged or stateful behavior behind IPC handlers.

Reference files:

- `apps/desktop/src/main/services/file-selection/file-registry.ts`
- `apps/desktop/src/main/services/preferences/preferences.ts`
- `apps/desktop/src/main/services/jobs/job-cancellation.ts`
- `apps/desktop/src/main/services/workspace/temp-workspace.ts`
- `apps/desktop/src/shared/types/files.ts`
- `apps/desktop/src/shared/types/preferences.ts`

## File Selection Registry

`file-registry.ts` stores real selected paths in main-process `Map` objects and returns safe metadata to the renderer:

- `sourceId`
- `name`
- `extension`
- `sizeBytes` for files

Use this pattern for future Excel processing. Renderer state should keep `sourceId` and display metadata; main-process services resolve `sourceId` back to a real path when doing filesystem work.

Avoid returning absolute source paths to renderer components or logs unless a task explicitly requires exposing them.

## Preferences

`preferences.ts` stores lightweight settings in `app.getPath('userData')/preferences.json`.

Rules:

- Validate loaded JSON with `preferencesFileSchema`.
- Return `{}` when the file does not exist.
- Return `{}` when the JSON shape is invalid.
- Re-throw unexpected read/write errors.
- Create the parent directory before writing.

Add new preferences to `preferencesFileSchema` first, then update typed service functions and IPC handlers.

## Temporary Workspace

`temp-workspace.ts` creates per-job folders under `app.getPath('userData')/cache/jobs/<jobId>`. Use `removeTempWorkspace` with `recursive: true` and `force: true` for cleanup.

Future file-processing jobs should keep temporary intermediates in this workspace, not next to source files or inside renderer-accessible paths.

## Cancellation

`job-cancellation.ts` stores one active `AbortController` and one skip-current-file flag at module scope. New long-running jobs should:

- Create an `AbortController` when work starts.
- Call `setActiveJobAbortController(controller)`.
- Pass `controller.signal` through processing functions.
- Clear the active controller when the job ends.
- Check `signal.aborted` at expensive or repeated steps.
- Use `requestSkipCurrentFile()` only for workflows that can continue after the current file.
- Call `consumeSkipCurrentFileRequest()` at file boundaries or row/group loops so skip-current does not leak into the next file.

Cancel-all aborts the whole job and should clean the temp workspace without producing final output. Skip-current is best-effort while file I/O is in progress; the service must check the flag before repeated expensive work and before starting later output groups.

## Scenario: Main-Managed External Helpers

### 1. Scope / Trigger

Use this pattern when a feature needs a privileged or heavyweight runtime outside Electron, such as Python ASR inference, native tools, or model-backed processing. The main process owns helper discovery, process lifecycle, cancellation, and error normalization; the renderer only sees typed IPC results/events.

### 2. Signatures

- Preload/API shape: `window.officeTools.<domain>.<action>(input) -> Promise<ApiResult<Result>>`.
- Event shape: `window.officeTools.<domain>.on<Event>(listener) -> unsubscribe` when long-running progress is needed.
- Main service helper boundary: `run<Domain>Job(input, emitEvent) -> Promise<JobResult>`.
- Process helper boundary: invoke a stable script/binary path with serializable arguments and parse a single structured JSON result.

### 3. Contracts

- Request fields crossing IPC must live under `apps/desktop/src/shared/types` and include Zod schemas.
- Renderer sends stable metadata IDs such as `sourceId`; main services resolve real filesystem paths through registries.
- Helper result JSON must include a success discriminator: `{ "success": true, ... }` or `{ "success": false, "error": string, "code"?: string }`.
- Runtime env keys must be explicit and documented near the helper service. For speech helpers, examples include `OFFICE_TOOLS_PYTHON`, `OFFICE_TOOLS_SPEECH_FAKE`, `OFFICE_TOOLS_SPEECH_FAKE_DURATION_SECONDS`, and model directory variables.
- Packaged helper files must be included as Electron resources, not assumed to be importable from renderer code.
- Helper path resolution should check dev workspace paths, `app.getAppPath()`, and `process.resourcesPath`; guard `process.resourcesPath` because Node-based tests may run outside packaged Electron.

### 4. Validation & Error Matrix

- Invalid IPC payload -> `ApiResult` failure with stable `INVALID_*` code.
- Missing registry path -> user-facing failure asking the user to reselect files.
- Missing helper resource -> user-facing setup failure; do not crash the renderer.
- Helper spawn failure -> user-facing setup failure naming the missing runtime.
- Helper JSON parse failure -> user-facing runtime failure; include stderr only when it helps diagnosis.
- Per-item helper failure in a batch -> mark that item failed and continue unless the job was canceled.
- Abort signal -> terminate helper process, mark active/pending work canceled, and clear the active job controller.

### 5. Good/Base/Bad Cases

- Good: A batch job validates input, resolves paths in main, runs one helper item at a time, emits per-item status, continues after item failures, and returns a summary.
- Base: A single helper failure becomes a failed item with an actionable message while later items still run.
- Bad: The renderer spawns Python, imports Node/Electron APIs, receives raw absolute paths unnecessarily, or treats one bad file as a full batch crash.

### 6. Tests Required

- Typecheck verifies shared contracts, preload API, and renderer call sites.
- Lint verifies no unsafe `any`, non-null assertions, or debug logging were added.
- Use a fake helper mode or test double for queue tests so CI does not require large models or native runtimes.
- Packaging-sensitive helpers require a build/package check that confirms helper resources are present under the packaged app resources.
- Existing workflows must keep their tests passing after navigation or shared IPC changes.

### 7. Wrong vs Correct

#### Wrong

```typescript
// Renderer-owned privileged work; do not do this.
window.electron.spawn('python3', ['helper.py', filePath]);
```

#### Correct

```typescript
// Renderer calls a typed bridge; main owns helper lifecycle and paths.
const result = await window.officeTools.speech.startTranscriptionJob({ sourceIds });
```

External helper integrations should preserve the existing OfficeTools flow: UI -> preload API -> IPC handler -> main service -> helper/process -> typed result/event -> UI.

## Scenario: Speech Model Downloads

### 1. Scope / Trigger

Use this pattern when speech ASR models are too large for the installer and must be downloaded on first use while keeping inference local.

### 2. Signatures

- Default config resource: `resources/speech-models/config.json`.
- Config shape: `{ "modelBaseUrl": string, "asrPackageName": string, "puncPackageName": string }`.
- Main APIs: `getSpeechModelSettings()`, `updateSpeechModelSettings(modelBaseUrl)`, `getSpeechModelStatus()`, `ensureSpeechModels(emitProgress)`.
- Preload APIs: `window.officeTools.speech.getModelSettings()`, `setModelSettings(input)`, `getModelStatus()`, and `ensureModels()`.

### 3. Contracts

- The renderer only receives model settings, readiness, and progress; it must not receive local model filesystem paths.
- Model packages are downloaded and extracted by the main process into `app.getPath('userData')/speech-models`.
- Package URLs are resolved as `<modelBaseUrl>/<packageName>`.
- A package is valid when its root or single nested model directory contains `model.onnx` or `model_quant.onnx`.
- The Python helper receives model paths through `OFFICE_TOOLS_FUNASR_ASR_MODEL_DIR` and `OFFICE_TOOLS_FUNASR_PUNC_MODEL_DIR`.

### 4. Validation & Error Matrix

- Invalid model settings input -> `ApiResult` failure with `INVALID_SPEECH_MODEL_SETTINGS_INPUT`.
- Missing model packages or non-200 HTTP response -> user-facing model download failure; do not start transcription.
- Zip path traversal -> reject extraction with a user-facing failure.
- Missing ONNX model after extraction -> reject package and keep transcription blocked.
- Existing local models -> skip download and start transcription normally.

### 5. Good/Base/Bad Cases

- Good: First speech conversion detects missing models, asks the user, shows progress, extracts models under userData, then continues local transcription.
- Base: User updates the model base URL from the speech settings modal and the value persists across sessions.
- Bad: Renderer downloads model files, hard-codes local model paths, or uploads user audio to a remote ASR service without an explicit cloud-mode design.

### 6. Tests Required

- Functional tests should use tiny local zip fixtures and `file://` model base URLs so CI does not require network or real model files.
- Existing fake speech helper tests must keep working without downloaded models.
- Build/package checks must include the default config resource through Electron Forge `extraResource`.

### 7. Wrong vs Correct

#### Wrong

```typescript
// Renderer-owned download and local path exposure; do not do this.
await fetch(modelUrl).then((response) => response.blob());
window.officeTools.speech.startTranscriptionJob({ modelPath: '/home/user/model' });
```

#### Correct

```typescript
// Renderer asks main to ensure models; main owns paths and helper environment.
const status = await window.officeTools.speech.ensureModels();
```
