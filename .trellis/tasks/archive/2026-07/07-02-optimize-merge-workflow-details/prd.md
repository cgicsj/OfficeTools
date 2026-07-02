# Optimize Merge Workflow Details

## Goal
Polish the table merge workflow UX and packaging behavior based on user feedback.

## User Value
Users can focus on selected merge files without seeing unnecessary source folder paths, remove unwanted files after scanning, choose the output folder from the merge settings panel, and install updated builds with a visible app launcher.

## Confirmed Facts
- `MergeWorkflow` currently shows the selected folder name in the left panel header and the output path in the left panel.
- The merge toolbar currently contains both `选择文件夹` and `保存至`.
- `FileList` already supports optional remove buttons with `canRemove` and `onRemoveFile`, but `MergeWorkflow` does not pass those props.
- Merge start uses `mergeParsedWorkbooks` and `mergeSheetSelections`; removing a merge file must update all three: `mergeFiles`, `mergeParsedWorkbooks`, and `mergeSheetSelections`.
- The desktop package version is currently `0.1.0`.
- Electron Forge maker-deb supports desktop entry generation and maintainer scripts.
- Debian packages normally create an application menu launcher under `/usr/share/applications`; copying icons onto each user desktop requires a maintainer script and has user/session ownership tradeoffs.

## Requirements
1. Merge workflow must not display the selected folder path or source folder location.
2. After selecting a folder and loading files, each merge file row must show a delete icon button that removes the file from the current merge batch.
3. The merge settings panel must contain the `保存至` button and selected output directory display, so users choose save location from the right-side merge settings area.
4. Increment the app version for this requirements update.
5. Ensure Debian installs provide a launcher/shortcut behavior according to the confirmed packaging decision.

## Acceptance Criteria
- Merge left panel no longer displays selected folder path/source location.
- Merge file rows include delete icon buttons while merge is not busy.
- Deleting a file removes it from the visible file list, parsed workbook list, sheet selection map, and subsequent merge job input.
- If the last merge file is deleted, merge cannot start and the UI returns to an empty/no-merge-files state without stale sheet selections.
- `保存至` is moved from the merge toolbar into the right-side merge settings panel; split workflow behavior is unchanged.
- App version increases from `0.1.0` to the next patch version.
- Packaging behavior for desktop launcher/shortcut is implemented and validated.
- `pnpm --filter @office-tools/desktop test:functional`, `pnpm typecheck`, `pnpm lint`, and relevant build/package validation pass.

## Out of Scope
- Changing split workflow UX except shared component styling needed for consistency.
- Implementing a full file picker for individual merge files.
- Adding per-user preferences for hiding/showing file paths.

## Open Question
Desktop shortcut behavior must be confirmed: use standard Linux application menu launcher only, or additionally copy a `.desktop` file to users' Desktop directories during package installation.

## Decision: Desktop Launcher
Use the recommended standard Linux application menu launcher. Do not force-copy a `.desktop` file to each user's physical Desktop directory.

## Resolution Notes
- Merge toolbar now only contains folder selection, start, and cancel actions.
- Merge left panel shows file count, not selected folder path/location.
- Merge file rows now expose delete icon buttons while merge is not busy.
- Removing a merge file filters `mergeFiles`, `mergeParsedWorkbooks`, and `mergeSheetSelections`, so removed files are excluded from merge job input.
- Save-location selection moved into the right-side merge settings panel.
- Desktop package version bumped to `0.1.1`.
- Recommended launcher behavior implemented/validated via standard Debian FreeDesktop entry at `/usr/share/applications/office-tools.desktop`.

## Validation Completed
- `pnpm typecheck`
- `pnpm lint`
- `pnpm --filter @office-tools/desktop test:functional`
- `pnpm build`
- `pnpm make:deb:arm64`
- `dpkg-deb -I apps/desktop/out/make/deb/arm64/office-tools_0.1.1_arm64.deb` shows `Version: 0.1.1`.
- `dpkg-deb -c apps/desktop/out/make/deb/arm64/office-tools_0.1.1_arm64.deb` lists `/usr/share/applications/office-tools.desktop`.
