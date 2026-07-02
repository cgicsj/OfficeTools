# Main Process Quality

Reference files:

- `apps/desktop/eslint.config.mjs`
- `apps/desktop/src/main/index.ts`
- `apps/desktop/src/main/ipc/index.ts`
- `apps/desktop/src/main/services/**`
- `apps/desktop/src/preload/index.ts`

## Before Editing

Search for the existing domain first:

```bash
rg "IPC_CHANNELS" apps/desktop/src
rg "officeTools" apps/desktop/src
rg "sourceId" apps/desktop/src
```

Prefer extending an existing domain handler/service over adding a parallel structure.

## Quality Gate

Run from the repository root:

```bash
pnpm lint
pnpm typecheck
```

## Review Checklist

- IPC channels are declared in `src/shared/constants/channels.ts`.
- Preload exposes only typed methods, not raw Electron APIs.
- Handlers return `ApiResult<T>` for invoke calls.
- Raw input is typed `unknown` and validated with Zod.
- Main-process services, not renderer code, touch filesystem paths.
- `env-setup` ordering remains intact.
- No `any`, non-null assertions, or console calls were added.

## Functional Excel Workflow Tests

### 1. Scope / Trigger
- Trigger this contract when adding or changing Node-runnable functional tests for main-process Excel services.
- Use this pattern when Electron UI automation is not required but the test must exercise real split/merge service code.

### 2. Signatures
- Command: `pnpm --filter @office-tools/desktop test:functional`.
- Test entry: `apps/desktop/tests/functional/excel-workflows.test.ts`.
- Test bundle config: `apps/desktop/tests/functional/vite.config.ts`.
- Generated output: `apps/desktop/.functional-tests/`.

### 3. Contracts
- The functional test must use existing dependencies plus Node built-in `node:test` and `node:assert/strict`.
- Tests must create temporary workbook fixtures under `tmpdir()` and remove them in a `finally` block.
- The Vite test bundle must alias `electron` to a test mock when importing services that use `app.getPath('userData')`.
- The test-only `OFFICE_TOOLS_TEST_USER_DATA` environment key points mocked `app.getPath('userData')` at a temporary directory.
- Generated `.functional-tests` output must stay ignored by ESLint and Git.

### 4. Validation & Error Matrix
- Missing Electron mock -> Node test fails before execution because the real Electron CommonJS package cannot provide ESM named exports.
- Missing `OFFICE_TOOLS_TEST_USER_DATA` -> tests may write job cache under the fallback temp userData path instead of the per-test workspace.
- Persistent fixture path inside the repo -> reject the test; fixtures must be generated and cleaned.
- Generated bundle not ignored -> `pnpm lint` may inspect bundled code and fail on generated globals or unused internals.

### 5. Good/Base/Bad Cases
- Good: a test registers generated `.xlsx` files, calls `runSplitJob` / `runMergeJob`, asserts output files and completed progress events, then removes the temp workspace.
- Base: a pure helper unit test can use the same Node test APIs without Vite bundling if it does not import Electron-dependent services.
- Bad: a functional test duplicates split/merge logic without importing app services, or checks only that a script exits without validating workbook contents.

### 6. Tests Required
- Run `pnpm --filter @office-tools/desktop test:functional` after changing Excel workflow behavior or this test harness.
- Run `pnpm typecheck` so test sources included by `apps/desktop/tsconfig.json` remain strictly typed.
- Run `pnpm lint` and verify generated `.functional-tests` output is ignored.

### 7. Wrong vs Correct

#### Wrong

```typescript
// Duplicates workflow behavior and leaves repo-local fixtures behind.
await splitWorkbookWithTestOnlyCode('fixtures/source.xlsx');
```

#### Correct

```typescript
const sourceFile = getOnlySelectedFile(await registerSelectedFiles([sourcePath]));
await runSplitJob({ outputDirectory, files: [{ sourceId: sourceFile.sourceId, sheetName, fieldRow, splitColumn }] }, emit);
```
