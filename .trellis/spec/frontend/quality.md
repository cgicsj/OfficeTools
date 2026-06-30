# Renderer Quality

Reference files:

- `apps/desktop/eslint.config.mjs`
- `apps/desktop/src/renderer/src/main.tsx`
- `apps/desktop/src/renderer/src/App.tsx`
- `apps/desktop/src/renderer/src/components/**`
- `apps/desktop/src/renderer/src/styles/**`

## Quality Gate

Run from the repository root:

```bash
pnpm lint
pnpm typecheck
```

React is mounted under `React.StrictMode`; effects and cleanup should be written so they tolerate development double-invocation.

## Accessibility Checklist

- Interactive elements are real `button`, `select`, or form controls.
- Buttons have visible labels; icons are decorative with `aria-hidden="true"`.
- Sections that need names use `aria-label`.
- Active navigation uses `aria-current`.
- Progress updates use `aria-live="polite"`.
- Focus outlines stay visible through `:focus-visible` in `base.css`.

## UI Robustness

- Disable actions while the relevant workflow is busy.
- Keep long text truncation and stable dimensions for file rows, logs, and toolbar buttons.
- Preserve `min-width: 0` on grid/flex children that contain filenames or paths.
- Do not introduce modal/browser dialogs in renderer; route native dialogs through IPC.

## Avoid

- `alert`, `prompt`, or `confirm`.
- Direct Electron/Node imports.
- New CSS frameworks or component libraries without a design/task decision.
- Console logging in renderer code.
