# Electron Desktop Platform Design

## Structure

Create a conventional Electron + TypeScript app with clear folders for:

- main process;
- preload bridge;
- renderer UI;
- shared types;
- future Excel services;
- tests or validation scripts.

The exact scaffold tool can be selected during implementation, but it must support Electron, TypeScript, React-style component development, and `.deb` packaging later.

## UI Shape

The renderer should be a quiet desktop tool, not a marketing page. The main screen should contain:

- top-level tabs for `Excel 拆分` and `Excel 合并`;
- a work area for each workflow;
- a per-tab log area at the bottom;
- progress and cancellation controls that can be reused by split and merge.

Avoid showing placeholder future modules.

## IPC Contract

Expose a narrow API through preload, for example:

- select files;
- select folder;
- select output directory;
- get default Downloads directory;
- get/set last output directory;
- start/cancel jobs;
- subscribe to job events.

Renderer code should not import Electron APIs directly.

## State Model

Use typed state for:

- active tab;
- split logs and merge logs;
- selected files/folder;
- file processing states;
- progress;
- current stage;
- cancellation state;
- output directory.

This model will become the contract that split and merge implementations plug into.
