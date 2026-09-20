# Milestone 7: Output and Performance

## Goal

Give the module a stable wire format, a fast batch path, and
development tools. This is the last milestone in the roadmap.

Three features. Serialization first. SIMD only if a profile justifies
it. Dev tools last.

## Features

- 4.4 Native serialization
- 4.5 SIMD batch operations
- 4.3 Development tools

## 4.4 Native serialization

### Where

New directory `packages/render/src/color/serialize/`. Files.

```
    index.ts       Public API.
    json.ts        JSON encoder and decoder.
    msgpack.ts     MessagePack encoder and decoder.
    palette.ts     Palette type and helpers.
    gradient.ts    Gradient serializer.
```

### Public API

```ts
    toJSON(input: Serializable): string
    fromJSON(text: string): Serializable

    toMsgPack(input: Serializable): Uint8Array
    fromMsgPack(data: Uint8Array): Serializable

    type Serializable = Palette | SerializedGradient;

    interface Palette {
      readonly kind: 'palette';
      readonly spaces: ReadonlyArray<string>;  // Space IDs
      readonly colors: ReadonlyArray<readonly number[]>;
    }

    interface SerializedGradient {
      readonly kind: 'linear' | 'radial' | 'multi' | 'pattern';
      readonly workingSpace: string;
      readonly stops: ReadonlyArray<{
        readonly offset: number;
        readonly color: readonly [string, number, number, number, number];
      }>;
    }
```

### Implementation

JSON is straightforward. Use `JSON.stringify` and `JSON.parse`. The
schema has a `kind` field on top. The version is optional.

MessagePack is a binary format. Install the `@msgpack/msgpack`
package. Do not write your own encoder. The format is compact and
well-tested.

Space IDs are strings. A serialized palette names its space with the
space ID. The decoder looks up the space in the module's registry.

```json
{
  "kind": "palette",
  "spaces": ["sRGB", "OKLab"],
  "colors": [
    [1, 0, 0, 1],
    [0.6, 0.15, 0.2, 1]
  ]
}
```

### Edge cases

- Unknown space ID. Throw with a clear message.
- Old format version. Support the current version only. Add version
  migration when the schema changes.
- Empty palette. Legal. Returns `[]`.
- NaN or Infinity in a channel. Throw. JSON and MessagePack cannot
  round-trip these.

### Tests

New test file `packages/render/test/serialize.test.ts`.

- JSON round-trips a palette of five colors.
- JSON round-trips each gradient kind.
- MessagePack produces a smaller output than JSON for the same data.
- Unknown space ID throws.
- NaN in a channel throws.

## 4.5 SIMD batch operations

### Where

New module `packages/render/src/color/wasm/`. Files.

    convert.wat      WebAssembly text source.
    build.ts         Build the .wat into .wasm.
    index.ts         Public API and the JS fallback.

Build the `.wat` to `.wasm` with `wabt` or `wat2wasm`. Commit both
files.

### Public API

The public API is the same `convertBatch` from Milestone 2. The
implementation changes.

```ts
    convertBatch<Src, Dst>(
      colors: ReadonlyArray<ColorValue<Src>>,
      dst: Dst,
    ): ReadonlyArray<ColorValue<Dst>>
```

The function detects WASM SIMD support at load time. If available, it
uses the WASM path. If not, it falls back to the JS path.

### Implementation

The WASM path processes eight colors per loop. Each loop iteration
uses SIMD128 registers.

```text
  Load 8 colors into 8 SIMD vectors (r, g, b, a)
  Apply the matrix as 3 dot products per vector
  Apply the transfer function via a lookup table
  Store the results back into the output array
```

The transfer function is a 1024-entry lookup table. It is built once
at load time. It covers the input range of the source space. Linear
interpolation between table entries gives a precision of 1e-4.

The matrices are passed as uniforms. They are the 3 by 3 `toXYZ` and
`fromXYZ` matrices from the space descriptors.

### When to build this

Only build this if a profile shows `convertBatch` is a bottleneck.
The threshold is 5 ms for 10000 colors on a modern laptop. If the
current JS path is under that, skip SIMD.

### Edge cases

- WASM SIMD not supported. Fall back to the JS path. Log once.
- Input length not a multiple of 8. Process the tail with the JS
  path.
- Transfer function not a simple curve. Fall back for that space.

### Tests

Extend `packages/render/test/bridge.test.ts`.

- The WASM path matches the JS path within 1e-4.
- The fallback path produces the same result.
- Lengths from 0 to 33 are handled correctly.

## 4.3 Development tools

### Where

New file `packages/render/src/color/debug.ts`. This file is imported
only in development builds. Production builds tree-shake it away.

### Public API

```ts
    warnOutOfGamut<S>(
      color: ColorValue<S>,
      targetSpace: ColorSpaceDef<string>,
      context?: string,
    ): void

    debugFormat<S>(color: ColorValue<S>): string
```

### Implementation

`warnOutOfGamut` checks the color against the target gamut. If the
color is outside, it logs a `console.warn` with the source space, the
target space, the channel values, and an optional caller context.

The function is a no-op when `process.env.NODE_ENV === 'production'`.
Guard the body with that check.

`debugFormat` is a richer version of `format`. It includes the space
name, the channel names, the range check, and the gamut check for
sRGB.

```text
  sRGB (IEC 61966-2-1) "R, G, B"
    r: 1.0000  [0, 1]  ok
    g: 0.0000  [0, 1]  ok
    b: 0.0000  [0, 1]  ok
    a: 1.0000  [0, 1]  ok
    in sRGB gamut: yes
```

### Edge cases

- Do not throw. Only warn.
- Do not warn twice for the same color. Cache the last warning.
- Production builds drop the whole module.

### Tests

New test file `packages/render/test/debug.test.ts`.

- `warnOutOfGamut` calls `console.warn` for an out-of-gamut color.
- It does not warn for an in-gamut color.
- It does not warn when `NODE_ENV` is `production`.
- `debugFormat` emits the expected multi-line string.

## Order of work

```text
  Step 1    4.4 Serialization. Independent.
  Step 2    4.5 SIMD batch. Profile first.
  Step 3    4.3 Dev tools. Ship last.
```

## Definition of done

- The serialization schema is documented in the README.
- The WASM module has a benchmark under `bench/`.
- The dev-tools module is excluded from production builds.
- `npm test` passes.
- The README has a section for each new file.

---

## Relationship between the milestones

The three milestones are independent. You can skip any one of them
and still ship the other two.

```text
  Milestone 5     Advanced spaces and gamut.
                  Required for HDR delivery and asset pipelines.

  Milestone 6     Platform and tooling.
                  Required for console builds and shader interop.

  Milestone 7     Output and performance.
                  Required for asset pipelines and dev workflows.
```

If you have one engineer, follow the order 5, 6, 7. If you have two,
run 5 and 6 in parallel. Merge them before starting 7. If you have
three, run all three in parallel. They touch different files.

## What ships when

```text
  After M5   Jzazbz, JzCzHz, CAM16, HCT, ICC, expandGamut
  After M6   PS5, Switch, Software adapters, science, shaders
  After M7   JSON, MessagePack, WASM SIMD, debug tools
```

Each milestone is a good release boundary. Tag a version after each.

## What is still out of scope

The roadmap's Non-goals section does not change.

```text
  No full ICC v4 CMS. Reading profiles is in scope. Rendering
  intent handling is not.

  No spectral rendering. Tristimulus only.

  No print color management. No CMYK, no Pantone.

  No appearance models beyond CAM16.

  No image codecs.
```

Those stay out of the module. Use a dedicated library for each.
