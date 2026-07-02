# Design: Optimize Merge Workflow Details

## Boundaries
- Renderer-only UX changes for merge workflow layout and removable file rows.
- Packaging metadata/version changes in the desktop package and Forge maker-deb config/scripts if needed.
- No main-process Excel processing changes expected.

## Data Flow
1. Folder selection scans and parses merge files as today.
2. `parseMergeFolder` result hydrates:
   - `mergeFiles`
   - `mergeParsedWorkbooks`
   - `mergeSheetSelections`
3. Removing a file by `sourceId` filters `mergeFiles` and `mergeParsedWorkbooks`, removes the same `sourceId` from `mergeSheetSelections`, and updates merge progress to reflect remaining files.
4. Merge start continues to derive job input from `mergeParsedWorkbooks`, so deleted files cannot be submitted.

## UI Shape
- Merge toolbar keeps `选择文件夹`, `开始汇总并下载`, and `取消`.
- Left panel header says `文件` and shows count/status, not folder path.
- `FileList` receives `canRemove={!isBusy}` and `onRemoveFile` from `MergeWorkflow`.
- Right settings panel includes a save-location row with `保存至` button and a compact display of the chosen output directory.

## Versioning
- Bump `apps/desktop/package.json` from `0.1.0` to `0.1.1` for this user-visible update.

## Desktop Launcher Decision
- Electron installer already creates a FreeDesktop application launcher when building `.deb`.
- If user confirms actual Desktop copy, add a maintainer script that copies the generated launcher to likely user Desktop directories as best effort; this can be brittle on localized desktops and root installs.
