# Components

Reference files:

- `apps/desktop/src/renderer/src/components/layout/AppShell.tsx`
- `apps/desktop/src/renderer/src/components/ui/Button.tsx`
- `apps/desktop/src/renderer/src/components/workflows/*.tsx`
- `apps/desktop/src/renderer/src/lib/format.ts`

## Component Shape

Use typed props near the component. Current components use `type ComponentProps = { ... }` and return `JSX.Element`.

Keep workflow components controlled: `SplitWorkflow` and `MergeWorkflow` receive files, logs, progress, busy state, output directory, and callbacks from `App.tsx`.

## Buttons and Icons

Use the shared `Button` component for command buttons. Pass lucide-react icons through the `icon` prop and set `aria-hidden="true"` on decorative icons.

Current examples:

- `SplitWorkflow` uses `FileSpreadsheet`, `Search`, `Save`, `Play`, and `Square`.
- `MergeWorkflow` uses `FolderOpen`, `Save`, `Play`, and `Square`.
- `AppShell` uses icons in tab buttons.

Use `variant="primary"` for the main positive action and `variant="danger"` for cancellation/destructive action.

## Accessibility

- Use semantic containers such as `nav`, `main`, `section`, and ordered lists where they match the content.
- Add `aria-label` to workflow toolbars and logs.
- Use `aria-current="page"` for the active tab.
- Use `aria-live="polite"` for progress updates.
- Use `title` for truncated filenames, output paths, and icon/text buttons.

## Empty and Busy States

Use the existing `empty-state` class for empty file/log panels. Disable actions that cannot run, as current workflows do for parse/start/cancel buttons.

## Copy and Domain Language

OfficeTools currently uses Chinese business UI copy for workflow actions, settings, progress, and logs. Keep new user-facing workflow copy consistent unless the product language direction changes.
