# Renderer Frontend Guidelines

This layer covers `apps/desktop/src/renderer`. The renderer is a React 18 desktop UI that talks to the main process only through `window.officeTools`.

## Tech Stack

- React 18 with TypeScript and JSX runtime.
- Vite renderer root at `apps/desktop/src/renderer`.
- lucide-react icons.
- Plain global CSS imported from `styles/index.css`.
- No utility CSS framework, data-fetching framework, router, or global state library today.

## Documentation Files

| File | When to Read |
| --- | --- |
| [directory-structure.md](./directory-structure.md) | Adding renderer files |
| [ipc-electron.md](./ipc-electron.md) | Calling main-process APIs |
| [components.md](./components.md) | Building or changing UI components |
| [state-management.md](./state-management.md) | App state, workflow state, logs, progress |
| [css-design.md](./css-design.md) | Styling, layout, tokens, responsive behavior |
| [type-safety.md](./type-safety.md) | Renderer imports and shared types |
| [react-pitfalls.md](./react-pitfalls.md) | Hooks, callbacks, derived state |
| [electron-browser-api-restrictions.md](./electron-browser-api-restrictions.md) | Browser APIs to avoid in Electron renderer |
| [quality.md](./quality.md) | Accessibility and quality checks |

Always also read `../shared/index.md`.

## Core Rules

| Rule | Reference |
| --- | --- |
| Use `window.officeTools`; never import Electron in renderer | [ipc-electron.md](./ipc-electron.md) |
| Keep workflow state controlled from `App.tsx` until reuse pressure appears | [state-management.md](./state-management.md) |
| Use shared types from `@shared/*` | [type-safety.md](./type-safety.md) |
| Use lucide-react icons in buttons and tabs | [components.md](./components.md) |
| Style through global CSS tokens and BEM-like classes | [css-design.md](./css-design.md) |
| Keep business UI copy in Chinese unless product direction changes | [components.md](./components.md) |

## Reference Source Files

- `apps/desktop/src/renderer/src/App.tsx`
- `apps/desktop/src/renderer/src/components/**`
- `apps/desktop/src/renderer/src/lib/**`
- `apps/desktop/src/renderer/src/styles/**`
- `apps/desktop/src/renderer/src/vite-env.d.ts`
