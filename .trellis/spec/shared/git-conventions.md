# Git Conventions

Use concise Conventional Commit style messages. Existing history uses both scoped and unscoped forms, for example:

- `feat: scaffold officetools electron platform`
- `chore: ignore generated vite output in lint`
- `chore(task): archive 06-28-electron-platform`

## Commit Messages

Preferred shape:

```text
type(scope): description
```

The scope is optional when the change is repository-wide.

Common types:

| Type | Use For |
| --- | --- |
| `feat` | User-visible feature work |
| `fix` | Bug fixes |
| `docs` | Documentation and spec-only changes |
| `chore` | Tooling, Trellis task state, generated metadata |
| `refactor` | Behavior-preserving code restructuring |
| `test` | Test additions or test-only changes |

Useful scopes for this repo include `desktop`, `ipc`, `ui`, `build`, `task`, and `spec`.

## Before Committing

Run:

```bash
pnpm lint
pnpm typecheck
git status --short
```

Keep commits focused. Do not mix generated build output with source/spec changes.
