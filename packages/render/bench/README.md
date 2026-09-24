# Performance harness

Benchmarks for the render package. Three files:

```text
bench/
  dispatch.bench.ts     build and dispatch cost
  tessellate.bench.ts   fill and stroke tessellation
  capture.bench.ts      frame codecs
```

## Run

From the repo root:

```bash
pnpm bench
```

Or from the package:

```bash
cd packages/render
pnpm vitest bench
```

A single file:

```bash
pnpm vitest bench bench/dispatch.bench.ts
```

## What each benchmark measures

### dispatch.bench.ts

| Benchmark            | Measures                                  |
| -------------------- | ----------------------------------------- |
| `build+dispatch-1k`  | Build 1000 commands, then render.         |
| `build+dispatch-10k` | Build 10000 commands, then render.        |
| `build-only-10k`     | Build 10000 commands without dispatch.    |
| `dispatch-only-10k`  | Dispatch a pre-built 10000-command frame. |

### tessellate.bench.ts

| Benchmark           | Measures                                     |
| ------------------- | -------------------------------------------- |
| `fill-rect`         | Fill a rectangle.                            |
| `fill-circle-64`    | Fill a circle at default tolerance.          |
| `fill-circle-256`   | Fill a circle at high precision.             |
| `fill-path-curves`  | Fill a cubic path.                           |
| `fill-polygon-64`   | Fill a 64-vertex polygon.                    |
| `fill-group-8`      | Fill a group of 8 rects.                     |
| `stroke-rect`       | Stroke a rectangle.                          |
| `stroke-line`       | Stroke a straight line.                      |
| `stroke-dash`       | Stroke a dashed line.                        |
| `stroke-circle`     | Stroke a circle.                             |
| `stroke-polygon-64` | Stroke a 64-vertex polygon with round joins. |

### capture.bench.ts

| Benchmark            | Measures                              |
| -------------------- | ------------------------------------- |
| `json-encode-1k`     | Encode a 1000-command frame to JSON.  |
| `json-encode-10k`    | Encode a 10000-command frame to JSON. |
| `json-decode-1k`     | Decode the JSON.                      |
| `json-decode-10k`    | Decode the JSON.                      |
| `msgpack-encode-1k`  | Encode to MessagePack.                |
| `msgpack-encode-10k` | Encode to MessagePack.                |
| `msgpack-decode-1k`  | Decode from MessagePack.              |
| `msgpack-decode-10k` | Decode from MessagePack.              |

## Reading the results

Vitest prints a table with `name`, `hz`, `min`, `max`, `mean`, `p75`,
`p99`, and `rme`. `hz` is the number of operations per second. Higher
is better. `rme` is the relative margin of error. A value above 5
means the benchmark is noisy and needs more iterations.

## CI

The benchmarks are not part of the default test job. A future
milestone adds a `bench` job that compares against a stored baseline
and fails on a regression larger than 10 percent.

## Adding a benchmark

1. Create `bench/<area>.bench.ts`.
2. Import `bench` and `describe` from `vitest`.
3. Call `bench(name, fn)` inside a `describe` block.
4. Keep each benchmark under one second.

## Deferred

- Baseline storage. The harness does not compare against a stored
  baseline yet.
- Per-backend reports. The dispatch benchmark uses the recording
  renderer. A future milestone runs the same suite against Canvas2D,
  WebGPU, and each native shim.
- Memory benchmarks. Allocations per operation are not measured.

---

## `package.json` (repo root, addition)

Add a `bench` script:

```json
{
  "scripts": {
    "bench": "vitest bench --root packages/render",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
