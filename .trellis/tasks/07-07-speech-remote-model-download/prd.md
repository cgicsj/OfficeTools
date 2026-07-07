# Remote model download for speech transcription

## Goal

Make speech-to-text usable without bundling large ASR model files in the installer by downloading required FunASR model packages on first speech conversion, while giving users clear prompts, progress, and a configurable model download address.

## Problem Statement

Bundling ASR and punctuation models can increase the installer from roughly 77 MB to hundreds of MB or more. OfficeTools should keep the installer smaller while preserving local inference privacy: download models from a configured remote address, cache them locally, and run transcription locally afterward.

## User Requirements

- On first speech conversion, if required local model files are missing, prompt the user that models must be downloaded.
- Show model download progress in the speech UI.
- After download completes, continue with speech conversion using local models.
- Add a settings button on the speech-to-text main screen.
- Settings allow users to view/edit the model download address.
- The default model download address is `https://2.22.2.2`.
- The default address must live in a configuration file so it can be changed before packaging an installer.
- Fix the save-path display box so its top border aligns with the adjacent button top edge.

## Functional Scope

### In Scope

- Config resource with default speech model download address.
- Main-process model configuration service that reads packaged defaults and persisted user override.
- IPC/preload contracts for reading/updating speech model settings.
- Main-process download service with progress events.
- Speech UI settings button and settings modal.
- Automatic first-use model check/download before transcription.
- Inject downloaded model directories into the Python helper environment.
- Tests using local fake/model-package fixtures or mocked HTTP where practical.

### Out of Scope

- Cloud ASR transcription.
- Real production model hosting setup.
- Checksums/signature enforcement unless lightweight enough for this phase.
- Segment/crop editing.
- Download resume across app restarts.

## Model Package Contract

For MVP, the configured base URL is expected to host these zip files:

- `funasr-asr-model.zip`
- `funasr-punc-model.zip`

After extraction, each package must contain either `model.onnx` or `model_quant.onnx` at the package root or inside a single top-level directory. OfficeTools stores extracted models under the app user data directory and passes the resulting directories to the helper as:

- `OFFICE_TOOLS_FUNASR_ASR_MODEL_DIR`
- `OFFICE_TOOLS_FUNASR_PUNC_MODEL_DIR`

## Acceptance Criteria

- [ ] Speech screen has a settings button for model download address.
- [ ] Default address comes from a package resource config file and is `https://2.22.2.2`.
- [ ] User can change and persist model download address.
- [ ] First conversion detects missing models and prompts before download.
- [ ] Download progress is visible in the speech UI/logs.
- [ ] After download, transcription uses local downloaded model directories.
- [ ] Existing fake helper tests still pass without real model downloads.
- [ ] Save-path box top border aligns with button top edge.
- [ ] `pnpm typecheck`, `pnpm lint`, functional tests, and build pass.
