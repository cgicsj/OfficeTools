# React Pitfalls

Reference files:

- `apps/desktop/src/renderer/src/App.tsx`
- `apps/desktop/src/renderer/src/components/workflows/ProgressPanel.tsx`
- `apps/desktop/eslint.config.mjs`

## Effect Cleanup

Any effect that subscribes to `window.officeTools.jobs.onJobEvent` must return the unsubscribe function from the effect. React StrictMode can run effects more than once in development, so cleanup must be reliable.

## Async Effects

Follow the current `App.tsx` pattern: define an async function inside `useEffect` and call it with `void loadOutputDirectory()`.

Do not make the effect callback itself `async`.

## Stable Handlers

Handlers passed into child components should use `useCallback`, as current workflow actions do. Keep dependency arrays complete; `react-hooks/exhaustive-deps` is enabled.

## Derived Values

Use `useMemo` for derived values passed to children when it avoids unnecessary recalculation or makes dependencies explicit. `selectedLogs` is the current example.

## State Initialization

For shared object defaults such as `idleProgress`, keep the object outside the component if it is immutable. When setting a new progress state, create a new object rather than mutating the existing one.

## Storing Functions

If future state needs to store a function value, wrap it in a function initializer or setter callback so React does not treat it as an updater. Prefer not storing functions in state unless there is a clear need.
