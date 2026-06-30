# Timestamp Handling

Use Unix milliseconds for application data that crosses layers.

Reference files:

- `apps/desktop/src/shared/types/jobs.ts`
- `apps/desktop/src/renderer/src/lib/logs.ts`
- `apps/desktop/src/renderer/src/lib/format.ts`

## Current Pattern

- `LogEntry.timestampMs` is a number in Unix milliseconds.
- `createLogEntry` sets `timestampMs` with `Date.now()`.
- `formatTime` converts `timestampMs` to localized display text in the renderer.

Keep storage and IPC payloads numeric. Format dates only at the display edge.

## Rules

- Name timestamp fields with a unit suffix, for example `timestampMs`.
- Use `Date.now()` for current Unix milliseconds.
- Use `new Date(timestampMs)` only when formatting for display.
- Do not send `Date` objects through IPC.
- Do not mix seconds and milliseconds in the same feature.

## If Persistence Is Added

The current app has no database. If a database layer is introduced, document the storage format before implementation and keep the external contract in milliseconds unless there is a strong compatibility reason not to.
