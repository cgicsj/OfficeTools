# Align Save Path Controls

## Goal
Make split and merge save-path controls consistent and place save selection inside each workflow's settings area.

## User Value
Users choose output locations from the relevant settings panel and see save path information in a consistent one-line format.

## Requirements
- Move the split workflow `保存至` button from the top toolbar into the `拆分设置` panel.
- Keep split workflow save path display in the settings panel.
- In merge workflow settings, change `保存位置` to the same `保存路径：...` wording/one-line display used by split.
- Prevent merge save path label/value from wrapping into multiple rows.
- Preserve existing output-directory selection behavior.
- Increase the app version for this user-visible UI change.

## Acceptance Criteria
- Split toolbar no longer contains `保存至`.
- Split settings area contains both save path display and `保存至` button.
- Merge settings area displays `保存路径：{path}` in one line with truncation.
- Merge settings area still contains a `保存至` button.
- Split/merge jobs still use the selected output directory.
- `pnpm typecheck`, `pnpm lint`, `pnpm --filter @office-tools/desktop test:functional`, and `pnpm build` pass.
- A new `.deb` is generated with an incremented version.

## Out of Scope
- Changing output directory persistence behavior.
- Changing job progress/log behavior.

## Resolution Notes
- Removed `保存至` from the split workflow toolbar.
- Added a shared `save-path-setting` row inside split settings and merge settings.
- Split settings now contains the save path display plus `保存至` button.
- Merge settings now displays `保存路径：{path}` in the same one-line truncating style as split.
- Bumped desktop package version from `0.1.3` to `0.1.4`.

## Validation Completed
- `pnpm typecheck`
- `pnpm lint`
- `pnpm --filter @office-tools/desktop test:functional`
- `pnpm build`
- `pnpm make:deb:arm64`
- `dpkg-deb -I apps/desktop/out/make/deb/arm64/office-tools_0.1.4_arm64.deb` shows `Version: 0.1.4`.
- Verified packaged `app.asar` contains `.vite/build/main.js` and `.vite/renderer/main_window/index.html`.
