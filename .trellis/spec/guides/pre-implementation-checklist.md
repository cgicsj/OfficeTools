# Pre-Implementation Checklist

Use this before editing OfficeTools source.

## 1. Search First

Before adding a constant, helper, channel, type, component, or CSS class, search for the existing pattern:

```bash
rg "IPC_CHANNELS|officeTools|sourceId" apps/desktop/src
rg "JobEvent|WorkflowTab|FileProcessingStatus" apps/desktop/src
rg "button--|workflow-panel|empty-state" apps/desktop/src/renderer/src/styles
```

Prefer extending an existing pattern over adding a parallel one.

## 2. Constants and Configuration

Ask:

- Is the value used by both main and renderer? Put it in `src/shared/constants`.
- Is the value a product/app limit? Prefer `APP_CONFIG`.
- Is the value an IPC channel? Put it in `IPC_CHANNELS` first.
- Is it local to one component or service? Keep it local and named.

Current examples:

- `APP_CONFIG.LIMITS.MAX_FILES`
- `APP_CONFIG.SUPPORTED_EXCEL_EXTENSIONS`
- `IPC_CHANNELS.DIALOG.SELECT_EXCEL_FILES`

## 3. Types and Runtime Validation

Ask:

- Does the type cross IPC? Put it under `src/shared/types`.
- Does raw renderer input reach the main process? Add a Zod schema and validate with `safeParse`.
- Is the payload serializable? Avoid `Date`, `Map`, `Set`, functions, and Electron objects.

## 4. Layer Boundaries

Ask which layers are touched:

- Renderer UI and state
- Shared constants/types
- Preload bridge
- IPC handler
- Main-process service
- Filesystem, preferences, or temp workspace

If 3+ layers are touched, read `cross-layer-thinking-guide.md` before coding.

## 5. UI Components

Before creating a component:

- Can it use the existing `Button`, `FileList`, `ProgressPanel`, or `WorkflowLog` pattern?
- Does it need a lucide-react icon?
- Does long text need truncation plus `title`?
- Does it need `aria-label`, `aria-current`, or `aria-live`?

## 6. Verification Plan

Before reporting completion, know how you will verify the change:

```bash
pnpm lint
pnpm typecheck
```

Add a more specific manual or automated check when the task touches packaging, dialogs, filesystem processing, or long-running jobs.
