# Renderer Directory Structure

Reference directory: `apps/desktop/src/renderer/src`.

## Current Layout

```text
src/renderer/src/
  App.tsx
  main.tsx
  vite-env.d.ts
  components/
    layout/AppShell.tsx
    ui/Button.tsx
    workflows/FileList.tsx
    workflows/MergeWorkflow.tsx
    workflows/ProgressPanel.tsx
    workflows/SplitWorkflow.tsx
    workflows/WorkflowLog.tsx
  lib/
    format.ts
    logs.ts
  styles/
    index.css
    tokens.css
    base.css
    layout.css
    components.css
```

## Placement Rules

- `App.tsx` owns top-level workflow state, IPC orchestration, and tab switching.
- `components/layout` is for application shell/navigation structure.
- `components/workflows` is for split/merge workflow UI surfaces.
- `components/ui` is for reusable primitives such as `Button`.
- `lib` is for renderer-only pure helpers such as formatting and log creation.
- `styles` owns global CSS. Import only `styles/index.css` from `main.tsx`.

## Adding New Features

For a new workflow, add:

1. Shared types/constants first if the feature crosses IPC.
2. Main/preload IPC support if privileged work is needed.
3. A workflow component under `components/workflows`.
4. State orchestration in `App.tsx` or a focused custom hook only when the state becomes reusable or too large.
5. CSS in `layout.css` for page/grid structure or `components.css` for reusable component classes.

Do not create a new routing layer, global store, CSS framework, or component library without a task that explicitly justifies it.
