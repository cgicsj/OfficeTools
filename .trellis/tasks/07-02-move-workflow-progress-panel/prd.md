# Move Workflow Progress Panel

## Goal
Move the split and merge workflow progress/“等待处理” prompt out of the settings panels and into a lower full-width row aligned with the workflow log width.

## User Value
Users can read progress status in a wider, clearer area instead of inside the split/merge settings column, improving layout balance and visibility.

## Confirmed Facts
- `SplitWorkflow` and `MergeWorkflow` currently render `ProgressPanel` inside the right settings panel.
- The workflow layout currently has toolbar, two-column content grid, and log rows.
- The user wants the progress prompt moved downward and stretched to the same width as the log display.

## Requirements
- Move `ProgressPanel` out of the split settings panel.
- Move `ProgressPanel` out of the merge settings panel.
- Render the progress area below the two-column workflow content and above the log.
- Make the progress area full workflow width, visually matching the log width.
- Preserve existing progress data and job behavior.
- Keep split and merge workflow layout consistent.

## Acceptance Criteria
- Split workflow no longer shows “等待处理” inside split settings.
- Merge workflow no longer shows “等待处理” inside merge settings.
- Both workflows show the progress panel below the main two-column area and above logs.
- The progress panel spans the same horizontal width as the log area.
- `pnpm typecheck`, `pnpm lint`, and `pnpm build` pass.
- Version increases for the user-visible layout change.

## Out of Scope
- Changing progress wording or job states.
- Changing log behavior.
- Changing Excel processing behavior.

## Resolution Notes
- Moved `ProgressPanel` out of both split and merge settings panels.
- Added a shared full-width `workflow-progress` row between the main two-column workflow content and the workflow log.
- Removed panel-local `margin-top: auto` behavior from `progress-panel` so it renders naturally in the full-width row.
- Bumped desktop package version from `0.1.1` to `0.1.2` for this user-visible layout change.

## Validation Completed
- `pnpm typecheck`
- `pnpm lint`
- `pnpm --filter @office-tools/desktop test:functional`
- `pnpm build`
- `pnpm make:deb:arm64`
- `dpkg-deb -I apps/desktop/out/make/deb/arm64/office-tools_0.1.2_arm64.deb` shows `Version: 0.1.2`.
- Verified packaged `app.asar` contains `.vite/build/main.js` and `.vite/renderer/main_window/index.html`.
