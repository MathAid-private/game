# Milestone 6: Integration and Tooling

## Goal

Bridge the module to more platforms and to shader code. Add color
science helpers. Add a shader snippet generator.

Three features. They are independent of each other. Run them in
parallel if you have the bandwidth.

## Features

- 4.1 More backend adapters
- 4.6 Color science helpers
- 4.2 Shader snippet generation

## 4.1 More backend adapters

### Where

Extend `packages/render/src/color/backend.ts`, or split into
`packages/render/src/color/backend/` when the file grows past 1500
lines.

### Public API

Three new adapters.

```text
    PS5        PlayStation 5. Uses AGC enums.
    Switch     Nintendo Switch. Uses NVN enums.
    Software   A reference rasterizer. No real GPU. For tests.
```

Each adapter satisfies the existing `BackendAdapter` interface. No
interface changes.

### Implementation

Every adapter has the same four methods.

```text
  colorSpaceEnum(id)    A logical ID to a platform enum.
  pixelFormatEnum(id)   A logical ID to a platform pixel format.
  clearColor(color)     A ColorValue to the platform clear struct.
  configure(id)         A surface or swap-chain config.
```

For PS5, use the AGC `Gnm::TileMode` and `Gnm::DataFormat` types. The
clear color is a 4-float struct. PS5 expects linear values for HDR.

For Switch, use the NVN `NVNformat` and `NVNcolorSpace` types. Clear
color is also a 4-float struct.

For Software, the "adapter" is a plain object that returns a
`Uint8ClampedArray` of RGBA bytes. It is not used in production. It
gives tests a deterministic reference.

```text
  SoftwareAdapter.clearColor(color)  -->  Uint8ClampedArray [R, G, B, A]
```

### Edge cases

- PS5 and Switch enums change between SDK versions. Pin to a specific
  version in the doc comment.
- Unknown space. Throw, as with the other adapters.
- Software adapter output is always sRGB 8-bit.

### Tests

Extend `packages/render/test/backend.test.ts`.

- Each new adapter maps every supported space.
- Each new adapter throws for unknown spaces.
- The software adapter emits the expected byte sequence for red,
  green, blue, and white.

## 4.6 Color science helpers

### Where

New file `packages/render/src/color/science.ts`.

### Public API

```ts
    chromaticityCoordinates<S>(color: ColorValue<S>): { x: number; y: number }
    dominantWavelength<S>(color: ColorValue<S>): number
    colorTemperature<S>(color: ColorValue<S>): number
    metamerCheck<A, B>(a: ColorValue<A>, b: ColorValue<B>): boolean
```

### Implementation

`chromaticityCoordinates` converts to XYZ D65. It returns `x = X / (X

- Y + Z)`and`y = Y / (X + Y + Z)`.

`dominantWavelength` projects the chromaticity onto the spectral
locus. It uses a table of 5 nm steps from 380 to 780 nm. Copy the CIE
1931 2-degree standard observer data. The table is about 81 entries.

`colorTemperature` uses the Robertson method. It finds the closest
point on the Planckian locus. It returns the temperature in Kelvin.
For chromaticities above the locus, add a tint offset. For
chromaticities below, subtract one.

`metamerCheck` compares two colors under two different illuminants. If
the two colors match under one illuminant but not the other, they are
metamers. The function returns true when this happens. It uses CIE Lab
and `deltaE2000` from `difference.ts`.

### Edge cases

- Black has no chromaticity. Return `(0, 0)`.
- A chromaticity outside the spectral locus. `dominantWavelength`
  returns the complement. Document this.
- `colorTemperature` above 25000 K or below 1000 K. Return the
  nearest bound.

### Tests

New test file `packages/render/test/science.test.ts`.

- `chromaticityCoordinates` of D65 white is near `(0.3127, 0.3290)`.
- `colorTemperature` of D65 white is near 6500 K.
- `colorTemperature` of a 2700 K warm white returns near 2700.
- `dominantWavelength` of pure red is near 611 nm.
- Two visually different colors are not metamers.
- Two colors that match under D65 but differ under A are metamers.

## 4.2 Shader snippet generation

### Where

New file `packages/render/src/color/shader.ts`.

### Public API

```ts
toShader<S>(
  color: ColorValue<S>,
  language: ShaderLanguage,
  options?: ShaderOptions,
): string

type ShaderLanguage = 'hlsl' | 'glsl' | 'wgsl' | 'msl';

interface ShaderOptions {
  readonly space?: 'sRGB' | 'Linear_sRGB' | 'Linear_Rec2020';
  readonly precision?: 'lowp' | 'mediump' | 'highp';
  readonly name?: string;
}
```

### Implementation

The function converts the input to the requested output space. It
formats a shader constant in the target language.

```text
  HLSL   float4 name = float4(r, g, b, a);
  GLSL   const vec4 name = vec4(r, g, b, a);
  WGSL   const name = vec4<f32>(r, g, b, a);
  MSL    constant float4 name = float4(r, g, b, a);
```

The default name is the input color's space ID. For example,
`toShader(make(sRGB, 1, 0, 0), 'wgsl')` returns:

```wgsl
const sRGB = vec4<f32>(1.0, 0.0, 0.0, 1.0);
```

### Edge cases

- Name is not a valid identifier. Sanitize it. Replace spaces and
  dashes with underscores.
- Precision on GLSL applies to the type. `highp vec4`.
- MSL uses `constant` for compile-time constants. Use `constexpr` for
  C++14 and above.

### Tests

New test file `packages/render/test/shader.test.ts`.

- Each language emits the expected string for red.
- The name option overrides the default name.
- A name with a dash becomes an underscore.
- The `space` option converts the color before formatting.

## Order of work

The three features are independent. Pick any order.

```text
  Step 1    4.1 More backends. Smallest per adapter.
  Step 2    4.6 Color science. Self-contained.
  Step 3    4.2 Shader snippets. Uses every space. Do last.
```

## Definition of done

- Every new adapter appears in the `backends` object.
- Every new public API has JSDoc with `@summary` and `@description`.
- The barrel re-exports the new files.
- `npm test` passes.
- The README has a section for each new file.

---
