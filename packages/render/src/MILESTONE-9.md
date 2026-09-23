## Milestone 9: `@games/math` severance

**Goal.** Remove every import from `@games/math`. Replace `Color` with `ColorValue`. Add local geometry value types.

**Deliverables.**

- `geometry/point.ts` with `Point2D`, `Vector2D`, and operations.
- `geometry/rect.ts` with `Rect` and operations.
- `geometry/transform.ts` with `Mat2D`, `Transform2D`, and constructors.
- `geometry/index.ts` barrel.
- All existing files updated: `command.ts`, `frame.ts`, `frame-builder.ts`, `renderer.ts`, `renderers/*.ts`, `sprite-registry.ts`.
- `Canvas2DRenderer.toCssColor` updated to handle `ColorValue` and convert to sRGB if needed.
- All tests updated. The test files use `{ r, g, b, a }` today. They switch to `make(sRGB, ...)`.

**Not in scope.**

- No new commands.
- No new shapes.
- No capability changes.
- The `rect` command variant stays.

**Done when.**

- `npm test` passes.
- `grep '@games/math' packages/render/src` returns nothing.
- The package no longer depends on `@games/math` in `package.json`.

**Cost.** Two to three days for one engineer.
