# Semantic Change Checklist

Use this when changing what a value means, not just adding code.

## OfficeTools Values That Need Care

- `WorkflowTab`
- `LogLevel`
- `JobStage`
- `JobProgress`
- `JobEvent`
- `FileProcessingStatus`
- `SelectedFile` and `SelectedFolder`
- `ApiResult<T>`
- `IPC_CHANNELS`
- `APP_CONFIG.LIMITS`
- preference file fields

## Checklist

Before changing semantics, answer:

- Which shared type or constant is the source of truth?
- Which main handlers or services produce the value?
- Which preload methods expose it?
- Which renderer state and components consume it?
- Does persisted JSON in `preferences.json` need migration or fallback logic?
- Does old UI state need a default or compatibility path?
- Are logs/progress/error messages still correct?

## Search Pattern

```bash
rg "ValueName|literal-value|channel:name" apps/desktop/src
```

Update every consumer in the same change unless the task explicitly stages a migration.

## Verification

Run:

```bash
pnpm lint
pnpm typecheck
```

For IPC semantic changes, manually exercise the related renderer action or add a focused test when a test runner exists.
