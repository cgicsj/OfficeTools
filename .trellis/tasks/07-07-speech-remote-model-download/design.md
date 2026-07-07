# Design: Remote model download for speech transcription

## Summary

Add a main-process-managed speech model manager. The renderer never downloads files directly and never handles raw model paths. The main process reads default configuration, stores user override preferences, checks local model availability, downloads zip packages, extracts them into userData, emits progress events, and injects model env variables when spawning the Python helper.

## Data Flow

```text
Speech UI start
  -> window.officeTools.speech.ensureModels()
  -> main speech model manager
  -> prompt needed / download progress events
  -> local model directories resolved
  -> startTranscriptionJob
  -> Python helper with model env vars
```

Settings flow:

```text
Speech settings button
  -> getModelSettings()
  -> modal edits modelBaseUrl
  -> setModelSettings()
  -> persisted in userData preferences
```

## Default Configuration

Add a resource file:

```text
apps/desktop/resources/speech-models/config.json
```

Shape:

```json
{
  "modelBaseUrl": "https://2.22.2.2",
  "asrPackageName": "funasr-asr-model.zip",
  "puncPackageName": "funasr-punc-model.zip"
}
```

This resource is included with Electron Forge `extraResource` so a packager can change it before building.

## Local Storage

Use app userData:

```text
<userData>/speech-models/asr/
<userData>/speech-models/punc/
<userData>/speech-models/downloads/
```

Persist model settings in the existing preferences file or a speech-specific JSON file under userData. The implementation should avoid exposing local model paths to the renderer.

## IPC Contracts

Add speech APIs:

- `getModelSettings() -> ApiResult<SpeechModelSettings>`
- `setModelSettings(input) -> ApiResult<SpeechModelSettings>`
- `ensureModels() -> ApiResult<SpeechModelStatus>`
- model download progress events over existing speech event stream or a model-specific speech event variant.

## Download Behavior

- If both ASR and punctuation model directories contain an ONNX model file, return ready immediately.
- If missing, renderer prompts the user before starting download.
- Download packages serially to simplify progress reporting.
- Extract zip packages with `jszip`, already available in dependencies.
- Normalize extracted folder shape by finding the directory containing `model.onnx` or `model_quant.onnx`.
- On download/extract failure, return actionable error and do not start transcription.

## Python Helper Integration

The main process passes env vars when spawning the helper:

- `OFFICE_TOOLS_FUNASR_ASR_MODEL_DIR=<resolved-asr-dir>`
- `OFFICE_TOOLS_FUNASR_PUNC_MODEL_DIR=<resolved-punc-dir>` when punctuation model is available

Fake helper mode should continue to work without requiring models.

## UI

- Add a settings button in the speech toolbar.
- Add a modal to edit model download address.
- Add a model-download confirmation modal when models are missing.
- Show progress via the existing speech logs/summary area.
- Align the save-path display box with toolbar buttons using consistent height and no vertical offset.

## Risks

- Real model packages are large; tests must avoid network and real model downloads.
- Zip extraction may produce different top-level folder names; detect model files rather than hard-coding folder names.
- Default config loading must work in dev and packaged modes.
