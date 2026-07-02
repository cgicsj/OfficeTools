# Hide Unfinished Phase One Modules

## Goal
Keep the phase-one app navigation focused on available functionality by hiding unfinished module entries.

## User Value
Users only see modules that are usable in the current release, avoiding confusion from placeholders for features that are not ready.

## Confirmed Facts
- User clarified that `文档排版`, `图片转文字`, and `语音转文字` should not be displayed for now.
- Those entries should become visible only after their functionality is completed in a future task.
- Current available phase-one workflows are Excel split and Excel merge.

## Requirements
- Inspect the left navigation/module list.
- Ensure `文档排版`, `图片转文字`, and `语音转文字` are not shown in the UI.
- Do not add “稍后上线” placeholder screens for these modules.
- Preserve current usable modules and existing workflow behavior.
- Increase the app version for this user-visible UI scope change.

## Acceptance Criteria
- Left navigation does not display `文档排版`.
- Left navigation does not display `图片转文字`.
- Left navigation does not display `语音转文字`.
- Existing split/merge workflows remain accessible.
- `pnpm typecheck`, `pnpm lint`, and `pnpm build` pass.
- Version increases for this UI change.

## Out of Scope
- Implementing document formatting, OCR, or speech-to-text features.
- Adding placeholder routes/screens for unfinished modules.

## Resolution Notes
- Removed unfinished module entries from the left navigation: `文档排版`, `图片转文字`, and `语音转文字`.
- Kept only the currently usable `表格处理` module with `表格拆分` and `表格合并` tabs.
- Bumped desktop package version from `0.1.2` to `0.1.3` for this user-visible navigation change.

## Validation Completed
- `pnpm typecheck`
- `pnpm lint`
- `pnpm --filter @office-tools/desktop test:functional`
- `pnpm build`
- `pnpm make:deb:arm64`
- `dpkg-deb -I apps/desktop/out/make/deb/arm64/office-tools_0.1.3_arm64.deb` shows `Version: 0.1.3`.
- Verified packaged `app.asar` contains `.vite/build/main.js` and `.vite/renderer/main_window/index.html`.
