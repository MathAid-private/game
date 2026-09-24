# Refined Milestone Roadmap for `@games/render`

Version 2. Replaces the previous roadmap. The bridge decision is now per-platform C shim.

---

## Decisions recorded

| ID  | Decision             | Answer                                   |
| --- | -------------------- | ---------------------------------------- |
| 1   | Browser GPU backends | WebGPU only. WebGL2 deferred.            |
| 2   | Native bridge        | Per-platform C shim with a shared C ABI. |
| 3   | Non-JS targets       | v2. Phase 7 deferred.                    |

---

## Guiding principles

1. **Value types first.** Geometry lands before commands. Commands land before renderers.
2. **One tessellator, many backends.** Shape to triangles is a shared module.
3. **One state stack, many backends.** Transform, fill, stroke, clip, and push/pop are shared.
4. **One C ABI, many shims.** Every GPU API sits behind the same stable C ABI.
5. **Canvas2D is the reference.** It proves the seam until a GPU backend replaces it.
6. **WebGPU covers the browser.** No WebGL2 in v1. Add it later if demand appears.
7. **Native GPU access needs a shim.** DX12, Vulkan, Metal, and OpenGL are not reachable from pure TypeScript.

---

## The C shim architecture

This is the shape of the native bridge.

```text
  +---------------------------------------------------------------+
  |  TypeScript                                                    |
  |                                                                |
  |  +----------------+     +-------------------------------+      |
  |  |  IRenderer     |---->|  ShimRenderer                 |      |
  |  |  (seam)        |     |  Translates commands to C ABI |      |
  |  +----------------+     +---------------+---------------+      |
  |                                         |                      |
  |                                         v                      |
  |                         +-------------------------------+      |
  |                         |  Binding layer (koffi, FFI)   |      |
  |                         +---------------+---------------+      |
  +-----------------------------------------|----------------------+
                                            |
                                  C ABI (stable, versioned)
                                            |
        +-------------------+---------------+---------------+
        |                   |               |               |
        v                   v               v               v
  +-----------+      +-----------+    +-----------+   +-----------+
  | Metal     |      | Vulkan    |    | DX12      |   | OpenGL    |
  | shim      |      | shim      |    | shim      |   | shim      |
  | (.dylib)  |      | (.so/.dll)|    | (.dll)    |   | (.so)     |
  +-----------+      +-----------+    +-----------+   +-----------+
        |                   |               |               |
        v                   v               v               v
  +-----------+      +-----------+    +-----------+   +-----------+
  | Metal     |      | Vulkan    |    | DirectX   |   | OpenGL    |
  | framework |      | loader    |    | 12 runtime|   | driver    |
  +-----------+      +-----------+    +-----------+   +-----------+
```

The C ABI is one header. Every shim implements it. The TypeScript side binds to it once.

---

## Phase 1 - Foundation types

No behavior change. No command change. Pure additions.

### M9: Geometry value types

**Goal.** Add local point, vector, rect, and transform types. First step away from `@games/math`.

**Deliverables.**

- `geometry/point.ts`. `Point2D`, `Vector2D`, and operations.
- `geometry/rect.ts`. `Rect` and operations.
- `geometry/transform.ts`. `Mat2D`, `Transform2D`, and constructors.
- `geometry/index.ts` barrel.
- One test file per source file.

**Done when.** Every operation has a test. `grep '@games/math' packages/render/src/geometry` returns nothing.

**Depends on.** Nothing.

**Cost.** Two to three days.

### M10: Shape, paint, and style types

**Goal.** Add the shape and paint vocabulary. No command integration.

**Deliverables.**

- `geometry/shape.ts`. `Shape` union. `PathSegment` union. `make*` constructors.
- `geometry/paint.ts`. `Paint` union. `makeSolid`.
- `geometry/style.ts`. `StrokeStyle`, `TextStyle`.
- `geometry/operations.ts`. `bounds`, `area`, `contains`, `applyToShape`.
- Tests for every constructor and operation.

**Done when.** Every shape kind has a `bounds` test. Every transform operation has a test.

**Depends on.** M9.

**Cost.** Three to five days.

### M11: Sever `@games/math`

**Goal.** Remove the dependency. Use local geometry types everywhere.

**Deliverables.**

- Rewrite imports in every file that reaches `@games/math`.
- Replace `Color` with `ColorValue<ColorSpaceDef<string>>`.
- Replace `Point2D`, `Rect`, `Transform2D` with local types.
- Decouple `sprite-registry.ts` from the DOM. Introduce a local `SpriteImage` type.
- Remove `@games/math` from `packages/render/package.json`.
- Migrate tests to `make(sRGB, ...)`.

**Done when.** `grep '@games/math' packages/render/src` returns nothing. `pnpm test` and `pnpm lint` pass.

**Depends on.** M9, M10.

**Cost.** Two to three days.

---

## Phase 2 - Command vocabulary

The union grows. The builder grows.

### M12: Command union extension

**Goal.** Replace the `rect`-only vocabulary with state and shape commands.

**Deliverables.**

- Add `SetBackground`, `SetFill`, `SetStroke`, `SetTransform`.
- Add `FillShape`, `StrokeShape`, `Clip`.
- Remove the `rect` variant.
- Update `Text` and `Sprite` to use `Mat2D`.
- `null` disables a state slot. `undefined` is not used.
- JSDoc for every variant with an `@example`.

**Done when.** The union has twelve variants. Every variant has an example.

**Depends on.** M11.

**Cost.** One to two days.

### M13: Builder methods for state

**Goal.** Give the builder the state commands.

**Deliverables.**

- `clear`, `setBackground`, `setFill`, `setStroke`.
- `setTransform`, `resetTransform`, `translate`, `rotate`, `scale`, `transform`.
- `clip`, `clipRect`.
- Extend `IFrameBuilder` and `FrameBuilder`.
- Tests for every method.

**Done when.** Every method has a test. `translate`, `rotate`, and `scale` compose.

**Depends on.** M12.

**Cost.** Two days.

### M14: Builder methods for shapes

**Goal.** Give the builder the shape commands.

**Deliverables.**

- `fill`, `fillPolygon`, `fillRect`, `fillEllipse`, `fillCircle`.
- `stroke`, `strokeLine`, `strokePolygon`, `strokeRect`, `strokeEllipse`, `strokeCircle`.
- `rect` compatibility shim.
- Tests for every method.

**Done when.** Every method has a test. `rect` emits two commands with both arguments.

**Depends on.** M13.

**Cost.** Two days.

---

## Phase 3 - Renderer contract

Shared logic lands. Renderers consume it.

### M15: Capabilities extension

**Goal.** Every renderer advertises what it can do.

**Deliverables.**

- Nine flags: `color`, `text`, `images`, `depth`, `shapes`, `nativeShapes`, `clip`, `capture`, `captureStream`.
- `nativeShapes` lists shape kinds drawn without tessellation.
- Update every renderer. Tests for every flag.

**Done when.** Every flag is tested. A renderer that cannot do something throws when called anyway.

**Depends on.** M12.

**Cost.** One to two days.

### M16: Shared renderer state stack

**Goal.** One state stack that every renderer consumes.

**Deliverables.**

- `renderer/state.ts`. `RendererState` with `transform`, `fill`, `stroke`, `background`, `clip`.
- `RendererStateStack` with `push`, `pop`, `reset`.
- `apply(command)` handles every state command.
- Tests. No backend-specific code.

**Done when.** Every state command has a test. The stack is FIFO across pushes.

**Depends on.** M12.

**Cost.** Two days.

### M17: Shared shape tessellator

**Goal.** One tessellator. Turns any `Shape` into a triangle list.

**Deliverables.**

- `renderer/tessellate.ts`. `tessellate(shape): TriangleList`.
- Handles every shape kind. Flattens curves.
- Handles stroke expansion. Miter, round, bevel joins.
- Handles dash patterns.
- Tests. Known counts for simple shapes.

**Done when.** Every shape kind tessellates. A circle produces a triangle fan. A path with curves closes without gaps.

**Depends on.** M10.

**Cost.** Three to five days.

### M18: Canvas2D rewrite

**Goal.** The reference renderer consumes the new commands and the shared state.

**Deliverables.**

- `renderers/canvas2d-renderer.ts` handles every command.
- Uses `RendererStateStack` for `push` and `pop`.
- Handles every shape kind via `ctx.beginPath`.
- Uses `ctx.clip` for clips. Uses `ctx.setTransform` for transforms.
- Tests with a mock context.

**Done when.** Every command has a mock-context test.

**Depends on.** M12, M16.

**Cost.** Three to five days.

### M19: Canvas2D capture

**Goal.** Pixel capture on the reference renderer.

**Deliverables.**

- `capture`, `captureAsync`, `captureStream`.
- `CaptureOptions` with `format`, `quality`, `scale`, `background`.
- Capabilities `capture: true`, `captureStream: true`.
- Noop and Recording report `false` and throw on capture.
- Tests. Known frame captures to known pixels.

**Done when.** Capture returns correct pixels. Streaming yields at least one chunk.

**Depends on.** M18.

**Cost.** Two to three days.

---

## Phase 4 - Frame serialization

Frames become portable. Separate from pixel capture.

### M20: Frame schema

**Goal.** A JSON-compatible shape for every command.

**Deliverables.**

- `serialize/frame-types.ts`. `SerializedFrame`, `SerializedCommand`.
- Colors as `[spaceId, c1, c2, c3, alpha]`.
- Shapes as nested objects. Transforms as 6-element arrays.
- Validation helpers. Throw on unknown kinds and non-finite numbers.
- JSDoc for every type with an `@example`.

**Done when.** Every command variant has a JSON shape.

**Depends on.** M12.

**Cost.** Two days.

### M21: JSON frame codec

**Goal.** Human-readable frame serialization.

**Deliverables.**

- `toFrameJSON`, `fromFrameJSON`.
- Round-trip tests for every variant.
- Error cases. Golden-file test.

**Done when.** Every command round-trips. The golden file matches.

**Depends on.** M20.

**Cost.** One to two days.

### M22: MessagePack frame codec

**Goal.** Compact frame serialization.

**Deliverables.**

- `toFrameMsgPack`, `fromFrameMsgPack`.
- Streaming variants.
- Reuse the MessagePack encoder from `color/serialize/msgpack.ts`.
- Byte-by-byte stream test. Golden bytes test.

**Done when.** Frames round-trip through MessagePack. The streaming decoder handles a byte-by-byte source.

**Depends on.** M21.

**Cost.** Two to three days.

---

## Phase 5 - WebGPU backend

The browser GPU backend. Consumes the shared tessellator and state stack.

### M23: WebGPU renderer

**Goal.** A modern GPU backend for the browser.

**Deliverables.**

- `renderers/webgpu-renderer.ts`. Adapter and device request. Capabilities. Command encoder.
- `renderer/webgpu/pipelines.ts`. Solid fill pipeline. Stroke pipeline. Bind group layouts.
- `renderer/webgpu/buffers.ts`. Buffer and texture management.
- `renderer/webgpu/state.ts`. Uniform binding. Bind group cache.
- Reuses the shared tessellator and state stack.
- Clip via a scissor rect or a stencil attachment.
- Sprite and text via atlases.
- Tests with a mock GPU device.

**Done when.** A frame with every command kind renders without GPU validation errors.

**Depends on.** M15, M16, M17.

**Cost.** Five days.

### M24: WebGPU capture

**Goal.** Pixel capture on WebGPU.

**Deliverables.**

- Texture-to-buffer copy. `mapAsync`. Buffer readback.
- `capture`, `captureAsync`, `captureStream`.
- Capabilities `capture: true`.

**Done when.** Capture returns correct pixels for a known frame.

**Depends on.** M23, M19.

**Cost.** Two days.

---

## Phase 6 - Native GPU bridge via C shims

The bridge decision is per-platform C shim. One C ABI. One shim per (platform, API) pair.

### Architecture

The C ABI is a stable, versioned header. Every shim implements it. Every shim compiles to a native library for its platform.

```c
/* gfx.h -- the stable C ABI */

typedef struct gfx_device gfx_device;
typedef struct gfx_buffer gfx_buffer;
typedef struct gfx_pipeline gfx_pipeline;
typedef struct gfx_texture gfx_texture;

typedef enum {
  GFX_API_DX12   = 1,
  GFX_API_VULKAN = 2,
  GFX_API_METAL  = 3,
  GFX_API_OPENGL = 4,
} gfx_api;

typedef enum {
  GFX_OK                = 0,
  GFX_ERR_UNSUPPORTED   = 1,
  GFX_ERR_DEVICE_LOST   = 2,
  GFX_ERR_OUT_OF_MEMORY = 3,
  GFX_ERR_INVALID_ARG   = 4,
} gfx_result;

typedef struct {
  int supports_compute;
  int supports_geometry_shaders;
  int max_texture_size;
  int max_vertex_count;
  int max_index_count;
} gfx_capabilities;

gfx_result gfx_create_device(gfx_api api, void* window, gfx_device** out);
void       gfx_destroy_device(gfx_device* dev);
gfx_capabilities gfx_get_capabilities(gfx_device* dev);

gfx_result gfx_create_buffer(gfx_device* dev, const void* data, size_t size, int usage, gfx_buffer** out);
void       gfx_destroy_buffer(gfx_buffer* buf);

gfx_result gfx_create_pipeline(gfx_device* dev, const char* vs_src, const char* fs_src, gfx_pipeline** out);
void       gfx_destroy_pipeline(gfx_pipeline* pipe);

gfx_result gfx_begin_frame(gfx_device* dev);
gfx_result gfx_draw(gfx_device* dev, gfx_pipeline* pipe, gfx_buffer* verts, gfx_buffer* indices, size_t count);
gfx_result gfx_end_frame(gfx_device* dev);
gfx_result gfx_present(gfx_device* dev);

gfx_result gfx_read_pixels(gfx_device* dev, int x, int y, int w, int h, void* out, size_t out_size);
```

The header is versioned. `gfx_get_version()` returns the ABI version. A shim that does not match the binding layer fails fast.

### Shim matrix

| Platform | DX12 | Vulkan | Metal | OpenGL |
| -------- | ---- | ------ | ----- | ------ |
| Windows  | yes  | yes    | no    | yes    |
| macOS    | no   | yes    | yes   | yes    |
| Linux    | no   | yes    | no    | yes    |
| Android  | no   | yes    | no    | yes    |

Each cell is a separate native library. Each library implements the full C ABI. Unsupported APIs return `GFX_ERR_UNSUPPORTED`.

### M25: C ABI design and reference shim

**Goal.** A working C ABI with one reference shim. End-to-end proof.

**Deliverables.**

- `shims/gfx.h`. The C ABI header. Versioned. Documented.
- `shims/opengl/shim.c`. A reference shim using OpenGL. OpenGL has a C-native API and works on all three desktop platforms. It is the fastest path to a working end-to-end pipeline.
- `shims/opengl/CMakeLists.txt`. Build file.
- A test C program that creates a device, draws a triangle, and reads back pixels.
- Integration with the TS binding layer comes in M26.

**Done when.** The reference shim renders a triangle and reads back the correct pixels. The C ABI header is reviewed.

**Depends on.** M23. The ABI shape follows the WebGPU renderer's needs.

**Cost.** Three to five days.

### M26: Binding layer

**Goal.** TypeScript binds to the C ABI once. One binding covers every shim.

**Deliverables.**

- `renderer/shim/binding.ts`. Loads the shim library for the current platform.
- `renderer/shim/api.ts`. TypeScript types for every C ABI function.
- `renderer/shim/errors.ts`. Maps `gfx_result` to TypeScript exceptions.
- `renderer/shim/handles.ts`. Opaque handle wrapping. Lifecycle management.
- Uses `koffi` for FFI. `koffi` does not require a native build step and works on Windows, macOS, and Linux.
- Tests. Mock shim returns known values.

**Done when.** The binding layer calls every C ABI function against the reference shim. Handles survive a thousand create-and-destroy cycles without a leak.

**Depends on.** M25.

**Cost.** Three to five days.

### M27: ShimRenderer

**Goal.** An `IRenderer` that talks to the C ABI. Games and engine core are untouched.

**Deliverables.**

- `renderers/shim-renderer.ts`. Implements `IRenderer`.
- Translates every `RenderCommand` to C ABI calls.
- Uses the shared tessellator from M17.
- Uses the shared state stack from M16.
- Reuses the command dispatch from `Canvas2DRenderer`. Only the leaf calls differ.
- Capabilities from `gfx_get_capabilities`.
- Capture via `gfx_read_pixels`.
- Tests against the reference shim.

**Done when.** A frame with every command kind renders through the reference shim. Capture matches Canvas2D within tolerance.

**Depends on.** M26, M17, M16, M19.

**Cost.** Three to five days.

### M28: Vulkan shim

**Goal.** A Vulkan shim for Windows, Linux, and Android.

**Deliverables.**

- `shims/vulkan/shim.c`. Vulkan is a C API. The shim mostly forwards calls and manages handles.
- `shims/vulkan/CMakeLists.txt`.
- Instance, device, swapchain, pipeline, and buffer management.
- Pipeline cache. SPIR-V shader loading.
- Tests on Linux CI with a software Vulkan driver (SwiftShader or Lavapipe).

**Done when.** A frame renders on Vulkan. Capture works.

**Depends on.** M25.

**Cost.** Five days.

### M29: DX12 shim

**Goal.** A DX12 shim for Windows.

**Deliverables.**

- `shims/dx12/shim.cpp`. DX12 is COM-based. C++ is the usual choice.
- `extern "C"` exports match the C ABI.
- Device, command queue, swapchain, root signature, pipeline state.
- DXIL shader loading.
- Capture via a readback heap.
- Tests on Windows CI.

**Done when.** A frame renders on DX12. Capture works.

**Depends on.** M25.

**Cost.** Five days.

### M30: Metal shim

**Goal.** A Metal shim for macOS and iOS.

**Deliverables.**

- `shims/metal/shim.m`. Metal is Objective-C. The shim is an Obj-C file with `extern "C"` exports.
- Device, command queue, CAMetalLayer, render pipeline.
- MSL shader loading.
- Capture via `MTLTexture` readback.
- Tests on macOS hardware. Skipped elsewhere.

**Done when.** A frame renders on Metal. Capture matches Canvas2D within tolerance.

**Depends on.** M25.

**Cost.** Five days.

### M31: OpenGL shim (full)

**Goal.** The reference shim from M25 becomes production-ready.

**Deliverables.**

- Full command coverage. Text, sprites, clips, transforms.
- State caching to reduce redundant GL calls.
- VAO and VBO pooling.
- Texture atlas support.
- Capture via `glReadPixels`.
- Tests on Linux CI with Mesa.

**Done when.** Every command kind renders. Capture works.

**Depends on.** M25.

**Cost.** Three to five days.

---

## Phase 7 - Tooling

Tooling that pays off after two or more backends exist.

### M32: Renderer conformance suite

**Goal.** Every backend renders the same frame to the same pixels, within tolerance.

**Deliverables.**

- A fixture set. Ten to twenty frames that exercise every command kind.
- A test runner that renders each fixture on every available backend.
- A pixel comparator with per-backend tolerance bands.
- CI integration. Failures name the backend and the fixture.

**Done when.** Every backend passes every fixture. Failures produce a visual diff.

**Depends on.** M18, M23, M27.

**Cost.** Three days.

### M33: Frame trace and replay

**Goal.** Record a live frame. Replay it on any renderer.

**Deliverables.**

- A recording renderer that writes a serialized frame to disk.
- A replay tool that reads a serialized frame and renders it.
- A diff tool that compares two frames command by command.
- Uses the frame codec from M21 and M22.

**Done when.** A recorded frame replays identically. The diff tool names the first differing command.

**Depends on.** M22.

**Cost.** Two days.

### M34: Performance harness

**Goal.** Benchmarks for dispatch, tessellation, and capture.

**Deliverables.**

- A benchmark for command dispatch. Frames per second.
- A benchmark for tessellation. Shapes per second.
- A benchmark for capture. Pixels per second.
- A report per backend.

**Done when.** Every backend has a report. Regressions are visible.

**Depends on.** M32.

**Cost.** Two days.

---

## Dependency graph

```text
  M9  --> M10 --> M11
                   |
                   v
                  M12 --> M13 --> M14
                   |
                   v
                  M15 --> M16 --> M17
                                   |
                                   v
                                  M18 --> M19
                                   |
                                   +--> M23 --> M24
                                   |
                                   v
                                  M25 --> M26 --> M27
                                   |       |
                                   |       +--> M28 (Vulkan)
                                   |       +--> M29 (DX12)
                                   |       +--> M30 (Metal)
                                   |       +--> M31 (OpenGL)
                                   |
  M12 --> M20 --> M21 --> M22

  M18, M23, M27 --> M32 --> M34
  M22 --> M33
```

---

## Critical path

`M9 -> M10 -> M11 -> M12 -> M16 -> M17 -> M18 -> M19 -> M23 -> M24 -> M25 -> M26 -> M27`

About 34 working days to a working ShimRenderer with capture.

---

## Parallelization

After M12 lands, three tracks run in parallel:

- **Renderer track.** M15, M16, M17, M18, M19.
- **Serialization track.** M20, M21, M22.
- **Shim track.** M25 starts after M23.

After M25 lands, four shim tracks run in parallel:

- Vulkan (M28).
- DX12 (M29).
- Metal (M30).
- OpenGL (M31).

Each shim is one engineer. Each shim is independent.

---

## Milestone summary

| ID  | Milestone                       | Depends on         | Cost  |
| --- | ------------------------------- | ------------------ | ----- |
| M9  | Geometry value types            | -                  | 2-3 d |
| M10 | Shape, paint, and style types   | M9                 | 3-5 d |
| M11 | Sever `@games/math`             | M9, M10            | 2-3 d |
| M12 | Command union extension         | M11                | 1-2 d |
| M13 | Builder methods for state       | M12                | 2 d   |
| M14 | Builder methods for shapes      | M13                | 2 d   |
| M15 | Capabilities extension          | M12                | 1-2 d |
| M16 | Shared renderer state stack     | M12                | 2 d   |
| M17 | Shared shape tessellator        | M10                | 3-5 d |
| M18 | Canvas2D rewrite                | M12, M16           | 3-5 d |
| M19 | Canvas2D capture                | M18                | 2-3 d |
| M20 | Frame schema                    | M12                | 2 d   |
| M21 | JSON frame codec                | M20                | 1-2 d |
| M22 | MessagePack frame codec         | M21                | 2-3 d |
| M23 | WebGPU renderer                 | M15, M16, M17      | 5 d   |
| M24 | WebGPU capture                  | M23, M19           | 2 d   |
| M25 | C ABI and reference OpenGL shim | M23                | 3-5 d |
| M26 | Binding layer                   | M25                | 3-5 d |
| M27 | ShimRenderer                    | M26, M17, M16, M19 | 3-5 d |
| M28 | Vulkan shim                     | M25                | 5 d   |
| M29 | DX12 shim                       | M25                | 5 d   |
| M30 | Metal shim                      | M25                | 5 d   |
| M31 | OpenGL shim (full)              | M25                | 3-5 d |
| M32 | Renderer conformance suite      | M18, M23, M27      | 3 d   |
| M33 | Frame trace and replay          | M22                | 2 d   |
| M34 | Performance harness             | M32                | 2 d   |

---

## Deferred to v2

| Item                       | Reason                                              |
| -------------------------- | --------------------------------------------------- |
| WebGL2 renderer            | WebGPU coverage is sufficient for v1                |
| JDK AWT/Swing bridge       | Separate FFI story                                  |
| JavaFX bridge              | Separate FFI story                                  |
| RayLib bridge              | Separate FFI story                                  |
| Qt bridge                  | Separate FFI story                                  |
| WASM SIMD conversion       | Interface is stable. Implementation can land later. |
| Edge.js, .NETJS evaluation | Wrong layer for per-frame GPU work                  |

---

## Risks

| Risk                               | Mitigation                                                                                                            |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| The C ABI is wrong for one API     | Land the ABI with the reference shim. Add `gfx_get_version` from day one.                                             |
| Metal from C is awkward            | The Metal shim is Objective-C with `extern "C"` exports. The ABI does not change.                                     |
| DX12 is COM-based                  | The DX12 shim is C++. The `extern "C"` exports match the ABI.                                                         |
| Build tooling per platform         | Each shim has its own `CMakeLists.txt`. CI builds each on its target OS.                                              |
| Binding layer performance          | `koffi` is fast. Measure early in M26. A native addon is the fallback.                                                |
| Shader compilation differs per API | The TS side emits source in one language. Each shim translates to its native form. A shared shader cache lands in v2. |

---
