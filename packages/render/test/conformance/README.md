# Renderer conformance suite

Renders a fixed set of fixtures on every available backend. Asserts
that each backend produces the same pixels within its tolerance band.

## Layout

```text
conformance/
  types.ts                Fixture, KnownPixel, ToleranceBand
  fixtures.ts             The fixture set
  comparator.ts           Pixel comparison helpers
  runner.ts               The runner and the backend entries
  conformance.test.ts     The Vitest entry point
  README.md               this file
```

## How it works

1. The suite loads `FIXTURES`.
2. For each backend in `BACKENDS`, it creates a fresh renderer.
3. For each fixture, it builds a fresh `FrameBuilder` and renders it.
4. It reads the backend's pixels and compares them against the
   fixture's known pixels with the backend's tolerance.
5. A mismatch becomes a `ConformanceFailure`.
6. The test asserts the failure list is empty.

## Adding a fixture

Append an object to `FIXTURES` in `fixtures.ts`. Do not insert into the
middle of the list. The index of an existing fixture must not change.

A fixture must:

- Build its frame with only public `FrameBuilder` methods.
- Carry at least one `KnownPixel` when its output is deterministic.
- Carry no `KnownPixel` when the output is backend-specific (text).

## Adding a backend

Add a `BackendEntry` to `BACKENDS` in `conformance.test.ts`. The entry
must provide:

- A stable `backendId`.
- A `perChannel` tolerance. Use `0` for a reference backend. Use `2`
  to `4` for a GPU backend.
- A `create` function that returns a renderer and a `readPixels`
  function.
- A `cleanup` function that releases the renderer.

A backend that cannot be created in the current environment should
throw from `create`. The runner skips the fixture and logs a warning.

## Tolerance bands

| Backend       | perChannel | Reason                    |
| ------------- | ---------- | ------------------------- |
| `canvas2d`    | 0          | Reference.                |
| `webgpu`      | 2          | Antialiasing differences. |
| `shim-opengl` | 4          | Native precision.         |
| `shim-vulkan` | 4          | Native precision.         |
| `shim-dx12`   | 4          | Native precision.         |
| `shim-metal`  | 4          | Native precision.         |

## CI

The suite runs in the `test` job. A failure names the fixture, the
backend, the pixel, and the difference. The report is the test's error
message.

## Deferred

- Golden-image baselines. A future milestone stores a PNG per fixture
  per backend and compares against it with a tolerance.
- Visual diff output. A failing fixture should save a PNG with the
  expected, actual, and diff images. A future milestone adds this.
- GPU backends. WebGPU and the native shims are added to `BACKENDS`
  when their devices are available in CI.

---

## Notes

1. **Fixtures are data.** Each fixture is a builder function plus a list of known pixels. The builder writes into a fresh `FrameBuilder`. No global state.
2. **The comparator is per-channel.** A tolerance of `2` means every channel may differ by at most 2. A pixel passes when every channel is within tolerance.
3. **Backends are pluggable.** The runner does not know about Canvas2D, WebGPU, or the native shims. It calls `create`, `render`, `readPixels`, `cleanup`.
4. **Failures are collected.** The runner does not throw on the first mismatch. It collects every failure and returns them. The test formats them into one report.
5. **Self-consistency is checked.** The suite renders every fixture twice and asserts identical bytes. This catches non-determinism independent of the known-pixel checks.
6. **Command coverage is explicit.** A test asserts that every command kind appears in at least one fixture. Adding a new command variant without a fixture fails this test.
7. **Tolerance bands live in one place.** `BUILTIN_TOLERANCES` in `runner.ts` names every backend. The `BACKENDS` list in the test uses the bands.

---

## Verification checklist for M32

1. `pnpm --filter @games/render test` runs the conformance suite.
2. The Canvas2D backend renders every fixture without error.
3. Every fixture's known pixels match within tolerance.
4. Every fixture renders identically on two consecutive runs.
5. Every fixture name is unique.
6. Every command kind is covered by at least one fixture.
7. A deliberately broken fixture produces a failure that names the fixture, the backend, the pixel, and the difference.

---

## Known limits

- No golden-image baselines. The suite relies on hand-written known-pixel assertions. A future milestone stores a PNG per fixture per backend.
- No visual diff. A failing fixture logs the numeric difference, not an image.
- The WebGPU and native shim backends are not wired up. They need a real device. A future milestone adds them to `BACKENDS` behind a device availability check.
- The suite runs on one backend in the default CI configuration. Adding more backends is a CI change, not a code change.

---
