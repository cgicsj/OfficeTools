# Error Handling

Reference files:

- `apps/desktop/src/shared/types/api.ts`
- `apps/desktop/src/main/ipc/path.handler.ts`
- `apps/desktop/src/main/ipc/dialog.handler.ts`
- `apps/desktop/src/main/services/preferences/preferences.ts`
- `apps/desktop/src/renderer/src/App.tsx`

## IPC Result Shape

IPC invoke handlers return `ApiResult<T>`:

- Success: `{ success: true, data }`
- Failure: `{ success: false, error, code? }`

Renderer code checks `result.success === false` and appends user-visible logs for expected failures.

## Expected Conditions

Model expected user choices as successful results:

- Canceled file selection returns an empty file list.
- Canceled folder/output directory selection returns `undefined` data.
- Canceling an idle job is a no-op success.

Do not turn user cancellation into an error log.

## Validation Failures

For raw renderer input, use Zod `safeParse`. On validation failure, return an `ApiResult` failure with a stable code. `SET_LAST_OUTPUT_DIRECTORY` currently returns `INVALID_OUTPUT_DIRECTORY_INPUT`.

## Unexpected Failures

Do not silently swallow filesystem or JSON parse errors that indicate corruption or runtime failure. Current preferences behavior:

- Missing `preferences.json` returns `{}`.
- Invalid preference shape returns `{}`.
- Other read/write errors are re-thrown.

For new long-running jobs, convert known business failures into `ApiResult` or `JobEvent` errors and let unexpected programmer/system failures fail loudly during development.
