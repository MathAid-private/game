## Milestone 13: Capture and serialization

**Goal.** Add pixel capture and frame serialization.

**Deliverables.**

- `renderer.ts` capture methods added to the interface.
- `renderers/canvas2d-renderer.ts` implements capture, async capture, and streaming capture.
- `renderers/noop-renderer.ts` reports `capture: false` and throws on capture.
- `renderers/recording-renderer.ts` reports `capture: false` by default. Optional capture for tests.
- `serialize/frame-json.ts` with `toFrameJSON` and `fromFrameJSON`.
- `serialize/frame-msgpack.ts` with `toFrameMsgPack` and `fromFrameMsgPack`.
- Streaming variants for both.
- `serialize/index.ts` barrel.
- Tests for round-trips, error cases, and streaming.

**Not in scope.**

- No new renderers.
- No capture on non-canvas backends. The WebGL and WebGPU renderers will implement capture in their own milestones.

**Done when.**

- Frame round-trips through JSON and MessagePack.
- Capture returns correct pixels for a known frame.
- The streaming variants work with a byte-by-byte source.
- The tests match the style of `color/serialize/serialize.test.ts`.

**Cost.** Three to five days.
