# CSS and Design

Reference files:

- `apps/desktop/src/renderer/src/styles/index.css`
- `apps/desktop/src/renderer/src/styles/tokens.css`
- `apps/desktop/src/renderer/src/styles/base.css`
- `apps/desktop/src/renderer/src/styles/layout.css`
- `apps/desktop/src/renderer/src/styles/components.css`

## CSS Organization

`main.tsx` imports `styles/index.css`, which imports CSS in this order:

1. `tokens.css`
2. `base.css`
3. `layout.css`
4. `components.css`

Keep that order. Tokens must be available before layout/component rules.

## Tokens

Use CSS variables from `tokens.css` for color, radius, and shadows. Do not hard-code new colors unless the value is intentionally added to the token set.

Current tokens include neutral surfaces, primary green, accent blue, warning, error, and success colors. Keep the interface restrained and work-focused.

## Layout Rules

`layout.css` owns app shell, header, workflow grid, panels, and responsive layout. Current patterns:

- CSS Grid for the app shell and workflow layout.
- `minmax(0, 1fr)` and `min-width: 0` to prevent overflow.
- `scrollbar-gutter: stable` for scrollable regions.
- A mobile breakpoint at `max-width: 900px`.

When adding fixed-format UI, give it stable dimensions and overflow behavior so filenames, labels, or progress text do not shift the layout.

## Component Rules

`components.css` owns reusable UI classes such as buttons, file list, settings grid, output path, progress panel, workflow log, and empty state.

Use BEM-like class names already in the code (`workflow-panel__header`, `button--primary`, `file-list__item--processing`).

## Text Overflow

Long filenames and output paths should use truncation with `title` attributes, following `FileList` and `output-path`.

Do not scale font sizes with viewport width. `base.css` sets `letter-spacing: 0`; keep it that way.
