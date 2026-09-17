# Milestone 2: GPU Bridge

## Goal

Move data to and from the GPU efficiently. Batch conversion for typed
arrays. Gradient and raster types for sprite and sky rendering. Packed
integer formats for sprite sheets and font atlases.

## Features

- 1.3 Typed-array bridge
- 2.2 Gradient and raster types
- 2.6 Packed integer formats

## 1.3 Typed-array bridge

### Where

New file `src/color/bridge.ts`.

### Public API

    toFloat32Array<S>(colors: ReadonlyArray<ColorValue<S>>): Float32Array
    fromFloat32Array<S>(
      data: Float32Array,
      space: S,
    ): ReadonlyArray<ColorValue<S>>

    toUint8Array<S>(colors: ReadonlyArray<ColorValue<S>>): Uint8Array
    fromUint8Array<S>(data: Uint8Array, space: S): ReadonlyArray<ColorValue<S>>

    convertBatch<Src, Dst>(
      colors: ReadonlyArray<ColorValue<Src>>,
      dst: Dst,
    ): ReadonlyArray<ColorValue<Dst>>

### Implementation

Layout is interleaved RGBA. Four floats per color. No padding.

    toFloat32Array:
      out[i * 4 + 0] = colors[i].r
      out[i * 4 + 1] = colors[i].g
      out[i * 4 + 2] = colors[i].b
      out[i * 4 + 3] = colors[i].a

`toUint8Array` scales each channel to 0 to 255. Use `Math.round`, not
`Math.floor`. Rounding gives better precision at the cost of a tiny bias.

`convertBatch` uses the shared `toXYZ` and `fromXYZ` helpers. It hoists
the matrix lookup out of the loop. Only the matrix multiply and the
transfer functions run per color.

### Performance target

`convertBatch` on 10,000 sRGB to Linear_sRGB colors should run in under
5 ms on a modern laptop. Add a benchmark in `bench/bridge.bench.ts`.
Fail the CI if the benchmark regresses by more than 20 percent.

### Edge cases

- Empty input. Return an empty array.
- Odd data length in `fromFloat32Array`. Throw a clear error.
- Values outside 0 to 1 in `toUint8Array`. Clamp before scaling.

### Tests

- Round-trip `toFloat32Array` then `fromFloat32Array` preserves values.
- Round-trip through `Uint8Array` preserves values within 1/255.
- `convertBatch` matches a per-color `convert` loop.
- The interleaved layout is RGBA, not BGRA.

## 2.2 Gradient and raster types

### Where

New directory `src/color/gradient/`. Files:

    index.ts          Public API and shared types.
    linear.ts         LinearGradient.
    radial.ts         RadialGradient.
    multi.ts          MultiStopGradient.
    pattern.ts        PatternRaster.
    evaluate.ts       Sampling helpers.

### Shared types

    interface GradientStop<S extends ColorSpaceDef<string>> {
      readonly offset: number;     // 0 to 1
      readonly color: ColorValue<S>;
    }

    type GradientKind = 'linear' | 'radial' | 'multi' | 'pattern';

### LinearGradient

    interface LinearGradient<S> {
      readonly kind: 'linear';
      readonly from: { x: number; y: number };
      readonly to: { x: number; y: number };
      readonly stops: ReadonlyArray<GradientStop<S>>;
      readonly workingSpace?: ColorSpaceDef<string>;
    }

    sampleLinear<S>(g: LinearGradient<S>, x: number, y: number): ColorValue<S>

### Implementation

Project the point onto the line `from` to `to`. The projection `t` runs
0 at `from` and 1 at `to`. Clamp `t` to 0 to 1. Find the two stops that
bracket `t`. Call `mix(stopA, stopB, localT, workingSpace)`.

    t = dot(P - from, to - from) / dot(to - from, to - from)

### RadialGradient

    interface RadialGradient<S> {
      readonly kind: 'radial';
      readonly center: { x: number; y: number };
      readonly innerRadius: number;
      readonly outerRadius: number;
      readonly stops: ReadonlyArray<GradientStop<S>>;
      readonly workingSpace?: ColorSpaceDef<string>;
    }

### Implementation

Compute the distance from the point to the center. Map that distance to
`t` with the two radii.

    t = (distance - innerRadius) / (outerRadius - innerRadius)

Clamp `t` to 0 to 1. Find the bracketing stops. Call `mix`.

### MultiStopGradient

This is the general form. `LinearGradient` and `RadialGradient` are
special cases that compute `t` differently. The stop lookup is shared.

    function sampleStops<S>(
      stops: ReadonlyArray<GradientStop<S>>,
      t: number,
      workingSpace: ColorSpaceDef<string>,
    ): ColorValue<S>

### Implementation

Sort stops by offset. Binary-search for the bracketing pair. Cache the
sorted order on first call.

### PatternRaster

    interface PatternRaster<S> {
      readonly kind: 'pattern';
      readonly image: ReadonlyArray<ColorValue<S>>;
      readonly width: number;
      readonly height: number;
      readonly tile: 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat';
      readonly transform?: Mat3;
      readonly workingSpace?: ColorSpaceDef<string>;
    }

    samplePattern<S>(p: PatternRaster<S>, x: number, y: number): ColorValue<S>

### Implementation

Apply the transform to `(x, y)`. That gives the source pixel. Apply the
tile rule to wrap or reject. Read the pixel from the image array. Return
it.

The transform is a 3 by 3 matrix. It supports translate, rotate, scale,
and skew. The matrix multiplies the point as a column vector.

### Raster sampler

Provide a single entry point.

    sample<S>(g: LinearGradient<S> | RadialGradient<S> | MultiStopGradient<S> | PatternRaster<S>, x: number, y: number): ColorValue<S>

This dispatches on `kind`.

### Tests

- Linear gradient at `t=0` returns the first stop.
- Linear gradient at `t=1` returns the last stop.
- Radial gradient inside the inner radius returns the first stop.
- Radial gradient outside the outer radius returns the last stop.
- Multi-stop with three stops interpolates correctly between each pair.
- Pattern with `repeat` tiles a 4x4 image across a 16x16 sample grid.
- Pattern with `no-repeat` returns transparent outside the image.

## 2.6 Packed integer formats

### Where

New file `src/color/packed.ts`.

### Public API

    toRGBA8<S>(color: ColorValue<S>): number
    fromRGBA8(packed: number): ColorValue<typeof sRGB>
    toBGRA8<S>(color: ColorValue<S>): number
    fromBGRA8(packed: number): ColorValue<typeof sRGB>
    toRgb565<S>(color: ColorValue<S>): number
    fromRgb565(packed: number): ColorValue<typeof sRGB>

### Implementation

RGBA8 packs as `R << 24 | G << 16 | B << 8 | A`. Convert to sRGB first.
Scale each channel to 0 to 255 with `Math.round`.

BGRA8 packs as `B << 24 | G << 16 | R << 8 | A`. Same scaling.

Rgb565 packs as `R5 << 11 | G6 << 5 | B5`. Red and blue are 5 bits.
Green is 6 bits. Use bit shifts and masks.

    r5 = (r * 31) & 0x1F
    g6 = (g * 63) & 0x3F
    b5 = (b * 31) & 0x1F
    packed = (r5 << 11) | (g6 << 5) | b5

Note the operator precedence. `*` binds tighter than `&`. Add
parentheses.

### Edge cases

- Input outside 0 to 1. Clamp first.
- Alpha is premultiplied. Do not divide. Return it packed as-is.
- Rgb565 has no alpha. Drop the alpha channel.

### Tests

- Round-trip each format with several known values.
- Rgb565 green channel round-trips with the full 6-bit precision.
- Packed value matches the reference from a known test vector.

## Order of work

1. 1.3 Typed-array bridge. Independent.
2. 2.6 Packed integer formats. Independent.
3. 2.2 Gradient shared types and `sampleStops`.
4. 2.2 Linear and radial. They share the projection code shape.
5. 2.2 Multi-stop. Reuses the shared sampler.
6. 2.2 Pattern raster. Largest. Last.

## Definition of done

- Every public API has JSDoc with `@summary` and `@description`.
- Benchmarks for `convertBatch` pass the target.
- Every gradient kind has a test file.
- The barrel re-exports the new directory.
- The README shows a sprite-tint example and a sky-gradient example.