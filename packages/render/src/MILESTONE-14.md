## Milestone 14: Additional backends

**Goal.** Add renderers for the remaining platforms.

**Deliverables.** Each is a separate pull request.

- WebGL renderer.
- WebGPU renderer.
- Terminal renderer (text-only, `shapes: false`).
- WebAPI canvas renderer for offscreen use.
- JDK AWT/Swing bridge.
- JavaFX bridge.
- RayLib bridge.
- Qt bridge.

The last four need a foreign function boundary. They are out of reach from a pure TypeScript package. A design discussion is required before any of them start. Milestone 14 is a placeholder.

**Not in scope.**

- The bridge architecture for non-JS targets.

**Cost.** Three to five days per browser renderer. The non-JS targets need a design pass first.
