# Electron Desktop Platform

## Goal

Create the OfficeTools Electron desktop application foundation for UOS ARM64, ready for Excel split and merge feature implementation.

Parent task: `06-28-office-tools-phase1`.

## Requirements

- Initialize the app in the currently empty repository.
- Use Electron with TypeScript.
- Use a renderer stack suitable for a desktop productivity tool.
- Show only two tabs in Phase 1: `Excel 拆分` and `Excel 合并`.
- Provide independent log areas for each tab.
- Use desktop wording: `选择文件`, `选择文件夹`, `保存至`.
- Provide shared UI patterns for file lists, per-file states, loading/progress state, and cancellation.
- Provide typed IPC boundaries for dialogs, job control, output paths, and progress/log events.
- Resolve the system Downloads directory as the default output location.
- Allow remembering the last selected output directory.
- Create a cache/temp workspace abstraction for later Excel jobs.
- Keep future modules hidden.

## Acceptance Criteria

- [ ] The app can be launched in development mode.
- [ ] The app window title and product identity use `OfficeTools`.
- [ ] The first screen is the usable two-tab tool interface, not a landing page.
- [ ] Switching tabs switches visible logs without losing the other tab's log state.
- [ ] File/folder/output directory selection APIs are exposed through typed IPC.
- [ ] Job state can display pending, processing, completed, skipped, failed, and canceled states.
- [ ] Loading/progress UI can display current file index, total files, and current stage.
- [ ] A cancel action is wired through the app state and IPC contract even before Excel logic exists.
- [ ] The app has baseline type-check, lint, and build scripts.

## Out Of Scope

- Real Excel split or merge processing.
- `.deb` packaging.
- OCR, speech-to-text, PPT, text layout, login, licensing, or auto-update.
