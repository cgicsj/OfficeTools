# Thinking Flows for OfficeTools

These guides are lightweight checklists for avoiding cross-layer mistakes before coding. They are supporting material; the source-backed project rules live in `../backend`, `../frontend`, and `../shared`.

## Available Thinking Guides

| Guide | Purpose | When to Use |
| --- | --- | --- |
| [Cross-Layer Thinking](./cross-layer-thinking-guide.md) | Think through data flow across renderer, preload, IPC, main services, and local storage | Before implementing features that span 3+ layers |
| [Pre-Implementation Checklist](./pre-implementation-checklist.md) | Verify readiness before coding | Before starting any feature implementation |
| [Bug Root Cause Analysis](./bug-root-cause-thinking-guide.md) | Analyze bugs to understand preventability | After fixing any non-trivial bug |
| [Code Reuse Thinking](./code-reuse-thinking-guide.md) | Identify patterns and reduce duplication | When adding helpers or repeated logic |
| [Semantic Change Checklist](./semantic-change-checklist.md) | Ensure all code is updated when changing data interpretation | When changing what a field, status, or event means |

## OfficeTools Layer Model

```text
UI components
  -> renderer state and helpers
  -> window.officeTools preload bridge
  -> Electron IPC handlers
  -> main-process services
  -> local filesystem, userData preferences, temp workspaces
```

## Quick Routing

Use cross-layer thinking when a feature touches shared types, IPC, main services, and renderer UI together. Excel split/merge work is cross-layer because file selection, processing state, cancellation, progress events, and output paths must stay consistent across these layers.

Use code-reuse thinking before creating helpers under `src/main/services` or `src/renderer/src/lib`.

Use semantic-change thinking when changing `WorkflowTab`, `JobStage`, `JobEvent`, `FileProcessingStatus`, `ApiResult`, or any `IPC_CHANNELS` meaning.

If OfficeTools later adds a database or multi-write persistence layer, create new source-backed guides for schema changes and transactional consistency at that time.

## Core Principles

1. Search before adding new constants, helpers, or channels.
2. Think through every layer touched by an IPC contract.
3. Keep assumptions explicit in task artifacts or specs.
4. Verify with `pnpm lint` and `pnpm typecheck` before reporting completion.
5. Add project-specific lessons to `../big-question` only after real evidence.

**Language**: All documentation should be written in English.
