## Milestone 10: Geometry primitives

**Goal.** Add the shape, paint, and style types. Add constructors and operations. No command changes.

**Deliverables.**

- `geometry/shape.ts` with the full `Shape` union and `make*` constructors.
- `geometry/paint.ts` with the `Paint` union and `makeSolid`.
- `geometry/style.ts` with `StrokeStyle` and `TextStyle` (moved from `command.ts`).
- Shape operations: `bounds(shape)`, `area(shape)`, `contains(shape, point)`.
- Transform operations that accept shapes: `applyToShape(m, shape)`.
- Unit tests for every constructor and operation.
- No changes to `command.ts`, `frame.ts`, `frame-builder.ts`, or renderers.

**Not in scope.**

- No integration with the command union.
- No renderer support.
- No pattern or gradient paints.

**Done when.**

- Every shape constructor has a test.
- Every transform operation has a test.
- `bounds` works for every shape kind.
- The geometry module has no imports from outside `geometry/` except `color/`.

**Cost.** Three to five days.
