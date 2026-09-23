## Milestone 12: Renderer updates

**Goal.** Update every renderer to handle the new union. Extend capabilities.

**Deliverables.**

- `renderer.ts` updated with the extended `IRendererCapabilities`.
- `renderers/canvas2d-renderer.ts` handles every new command.
- `renderers/noop-renderer.ts` updated capabilities.
- `renderers/recording-renderer.ts` updated capabilities.
- Canvas2D state stack for transforms, fill, stroke, background, and clip.
- Canvas2D shape tessellation for paths and groups.
- Capabilities tests for every renderer.
- Canvas2D tests using a mock context.

**Not in scope.**

- No capture.
- No serialization.
- No new renderers.

**Done when.**

- Every renderer compiles against the extended union.
- Every capability flag is tested.
- Canvas2D draws every shape kind.
- The mock context records the calls the renderer makes.

**Cost.** Three to five days.
