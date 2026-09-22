# `@games/render/color`

The color module of `@games/render`. It sits at
`packages/render/src/color`. It abstracts color for the rendering
pipeline. Application code works with logical color spaces. The module
handles conversion, gamut mapping, color operations, gradients, and
the per-backend encoding that each graphics API expects.

## Why this module exists

Color bugs are silent. A gamma-encoded value passed where a linear
value is expected does not crash. It produces a gradient that looks
slightly wrong. A wide-gamut color clamped to sRGB shifts hue. An HDR
value fed into an 8-bit framebuffer clips. These bugs are hard to find
in a running game.

This module moves those bugs to compile time. Every color carries its
space in the type system. Every conversion is explicit. Every backend
adapter states what it expects.

## Contents

- [What the module gives you](#what-the-module-gives-you)
- [Quick start](#quick-start)
- [Import conventions](#import-conventions)
- [Module map](#module-map)
- [Core concepts](#core-concepts)
- [Color spaces](#color-spaces)
- [The conversion pipeline](#the-conversion-pipeline)
- [Gamut mapping](#gamut-mapping)
- [Backend adapters](#backend-adapters)
- [Color operations](#color-operations)
- [Alpha compositing](#alpha-compositing)
- [Mutable color](#mutable-color)
- [Accessibility](#accessibility)
- [Delta-E metrics](#delta-e-metrics)
- [Gradients and rasters](#gradients-and-rasters)
- [Typed arrays and packed formats](#typed-arrays-and-packed-formats)
- [CSS parsing and serialization](#css-parsing-and-serialization)
- [Tone mapping](#tone-mapping)
- [Chromatic adaptation](#chromatic-adaptation)
- [Quantization and dithering](#quantization-and-dithering)
- [CAM16 appearance model](#cam16-appearance-model)
- [ICC profile reader](#icc-profile-reader)
- [Color science helpers](#color-science-helpers)
- [Shader snippet generation](#shader-snippet-generation)
- [Serialization](#serialization)
- [Fast batch conversion](#fast-batch-conversion)
- [Development tools](#development-tools)
- [Building your own space](#building-your-own-space)
- [Design rules](#design-rules)
- [Known limits](#known-limits)
- [References](#references)

## What the module gives you

- A phantom-typed `ColorValue<S>` for compile-time space tracking.
- A `ColorTuple<S>` view for GPU boundaries and structured data.
- Twenty-four built-in color spaces. SDR, HDR, wide gamut,
  perceptual, cylindrical, video, log, and film.
- A pure `convert()` function that routes through CIE XYZ D65.
- A CSS Color 4 gamut mapping algorithm in OKLCh. Plus gamut
  expansion.
- Eight backend adapters. DX12, Vulkan, Metal, OpenGL, WebGPU, PS5,
  Switch, and a software reference.
- Color operations. Lighten, darken, saturate, rotate hue, invert.
- Alpha compositing. Porter-Duff `over` and `under`.
- A `MutableColor<S>` variant for hot loops.
- Accessibility helpers. Luminance, WCAG contrast, readable text.
- Four Delta-E metrics. OK, 2000, 76, and ICtCp.
- Linear, radial, multi-stop, and pattern gradients.
- Typed-array bridge for GPU uploads.
- Packed RGBA8, BGRA8, and Rgb565 formats.
- CSS Color 4 parsing and serialization.
- HDR tone mapping. Reinhard, ACES filmic, AgX, and exposure.
- Chromatic adaptation. Bradford, Von Kries, CAT02, and XYZ scaling.
- Quantization and dithering. Bayer and Floyd-Steinberg.
- A CAM16 color appearance model.
- An ICC profile reader for matrix and TRC profiles.
- Color science helpers. Chromaticity, dominant wavelength,
  temperature, metamer check.
- A shader constant generator. HLSL, GLSL, WGSL, and MSL.
- JSON and MessagePack serialization, with a streaming decoder.
- A fast batch conversion path with a WASM stub.
- Development diagnostics. Gamut warnings and debug formatting.

## Quick start

```ts
import {
  make,
  convert,
  mapToGamut,
  lighten,
  over,
  format,
  sRGB,
  Linear_sRGB,
  Display_P3,
  DX12,
} from '@games/render';

// Build an encoded sRGB color.
const red = make(sRGB, 1, 0, 0);

// Convert to linear for lighting math.
const linearRed = convert(red, Linear_sRGB);

// Convert a P3 color into the sRGB gamut.
const wide = make(Display_P3, 0.0, 0.9, 0.5);
const safe = mapToGamut(wide, sRGB);

// Lighten the result for a hover state.
const hover = lighten(safe, 0.1);

// Composite over a transparent backdrop.
const backdrop = make(sRGB, 0, 0, 0, 0);
const composited = over(hover, backdrop);

// Emit a clear struct for DirectX 12.
const clear = DX12.clearColor(composited);
```

## Import conventions

The rule depends on where the code lives.

```ts
// Application code and tests. Import from the package barrel.
// This is the public entry.
import { make, sRGB, convert } from '@games/render';

// Files inside packages/render/src/color. Import with a
// relative path. Sibling or parent directory.
import { convert, make } from './convert';
import { sRGB } from './space';

// Wrong in every case. Deep imports break the package
// boundary. The barrel is the only public entry.
import { make } from '@games/render/src/color/convert';
```

Tests live at `packages/render/test`. They are outside `src`. So
tests use `@games/render`. Source files inside `src/color/` use
relative paths to each other.

The Vitest config maps `@games/render` to
`packages/render/src/index.ts`. Tests run against source with no
build step.

## Module map

```text
  packages/render/
    src/
      index.ts             Package barrel. Re-exports color and render.
      color/
        index.ts           Color barrel. Re-exports every file.
        space.ts           Space definitions and descriptors.
        convert.ts         ColorValue, ColorTuple, make, convert.
        tuple.ts           Re-exports the tuple helpers.
        gamut-mapping.ts   checkGamut, mapToGamut, expandGamut.
        backend.ts         Eight backend adapters.
        mutable.ts         MutableColor and converters.
        accessibility.ts   Luminance, contrast, readable text.
        difference.ts      Delta-E metrics.
        operations.ts      Lighten, darken, saturate, and friends.
        composite.ts       Alpha compositing.
        bridge.ts          Typed-array bridge.
        packed.ts          Packed integer formats.
        tone-mapping.ts    HDR tone mapping.
        adaptation.ts      Chromatic adaptation.
        quantize.ts        Quantization and dithering.
        cam16.ts           CAM16 forward and reverse.
        science.ts         Chromaticity, wavelength, temperature.
        shader.ts          Shader constant generation.
        debug.ts           Development diagnostics.
        gradient/
          index.ts         Gradient barrel.
          types.ts         GradientStop, Point2D, sampleStops.
          linear.ts        LinearGradient, sampleLinear.
          radial.ts        RadialGradient, sampleRadial.
          multi.ts         MultiStopGradient, sampleMultiStop.
          pattern.ts       PatternRaster, samplePattern.
          sample.ts        sample. Dispatches on kind.
        w3c/
          index.ts         W3C barrel.
          css.ts           fromCSS, toCSS, CSSFormat.
          css-named.ts     CSS_NAMED_COLORS.
        icc/
          index.ts         ICC barrel.
          profile.ts       ICCProfile and TRCFunction types.
          parser.ts        parseICC.
          transforms.ts    applyProfile and toProfileSpace.
        serialize/
          index.ts         Serialize barrel.
          types.ts         Serializable, Palette, SerializedGradient.
          palette.ts       packPalette, unpackPalette, packColor.
          gradient.ts      packGradient, unpackGradient.
          json.ts          toJSON, fromJSON.
          msgpack.ts       toMsgPack, fromMsgPack, and streams.
        wasm/
          index.ts         convertBatchSIMD.
          fallback.ts      convertBatchFast.

    test/                  Tests for the package, not under src.
      space.test.ts
      convert.test.ts
      convert-spaces.test.ts
      tuple.test.ts
      gamut-mapping.test.ts
      gamut-expansion.test.ts
      backend.test.ts
      mutable.test.ts
      accessibility.test.ts
      difference.test.ts
      operations.test.ts
      composite.test.ts
      bridge.test.ts
      packed.test.ts
      gradient.test.ts
      css.test.ts
      tone-mapping.test.ts
      log-spaces.test.ts
      jzazbz.test.ts
      adaptation.test.ts
      quantize.test.ts
      cam16.test.ts
      icc.test.ts
      science.test.ts
      shader.test.ts
      serialize.test.ts
      wasm.test.ts
      debug.test.ts
```

Tests live at `packages/render/test`. Source lives at
`packages/render/src`. The `src/index.ts` file is the package
barrel. Tests import from `@games/render`. Source files inside
`src/color/` import each other with relative paths.

## Core concepts

### The `ColorValue<S>` type

A `ColorValue<S>` is a plain object with four numeric channels and a
phantom space tag.

```ts
interface ColorValue<S extends ColorSpaceDef<string>> {
  readonly c1: number;
  readonly c2: number;
  readonly c3: number;
  readonly alpha: number;
  readonly _space: S;
}
```

The `S` parameter is a color space object. It is `typeof sRGB`,
`typeof Linear_sRGB`, or any other `ColorSpaceDef`. The tag has no
extra runtime cost. TypeScript uses it to stop cross-space mistakes.

```ts
make(sRGB, 0.5, 0.5, 0.5); // ColorValue<typeof sRGB>
make(Linear_sRGB, 0.5, 0.5, 0.5); // ColorValue<typeof Linear_sRGB>

const linear: ColorValue<typeof Linear_sRGB> = make(sRGB, 0.5, 0.5, 0.5);
//    Type error. sRGB is not assignable to Linear_sRGB.
```

The field names are honest. `c1` is the first channel. It is not
always red. `alpha` is always the transparency. `_space` carries the
runtime tag.

### The `ColorTuple<S>` view

A `ColorTuple<S>` is a readonly 4-tuple. It is a view for GPU
boundaries, JSON, and structured data. It is not the canonical
representation.

```ts
type ColorTuple<S extends ColorSpaceDef<string>> = readonly [
  c1: number,
  c2: number,
  c3: number,
  alpha: number,
] & { readonly [colorTupleBrand]?: S };
```

The brand is type-only. It has no runtime presence. The tuple does
not survive `[...c]`, `c.slice()`, `structuredClone(c)`, or a JSON
round-trip with the space tag intact. Use `fromTuple(tuple, space)`
to attach the space when you need a `ColorValue`.

```ts
import { asTuple, fromTuple, makeTuple, sRGB, Linear_sRGB } from '@games/render';

const t = makeTuple(sRGB, 1, 0, 0); // [1, 0, 0, 1]
const c = fromTuple(t, sRGB); // ColorValue<typeof sRGB>
const back = asTuple(c); // [1, 0, 0, 1]
```

Three functions accept a tuple in addition to a `ColorValue`:
`convert`, `mapToGamut`, and `checkGamut`. Every tuple that enters
one of them is converted to a `ColorValue` at the top of the
function. The conversion exists for three reasons.

1. The object carries the `_space` field. The tuple cannot. The
   function reads `_space` to know the source space.
2. TypeScript's structural typing and type predicates are reliable
   on objects. A tuple loses the space tag on any array copy. The
   object loses nothing.
3. A tuple-based tag would need a global `WeakMap<tuple, space>`.
   That map is a leak risk and a performance cost. The object shape
   avoids it entirely.

The tuple is a view. The object is the canonical form.

### The three-channel layout

The field names are always `c1`, `c2`, `c3`. Their meaning depends
on the space.

```text
  Space       c1      c2      c3
  -----       --      --      --
  sRGB        R       G       B
  OKLab       L       a       b
  OKLCh       L       C       H
  XYZ_D65     X       Y       Z
  HSL         H       S       L
  YCbCr       Y       Cb      Cr
  ICtCp       I       Ct      Cp
  Jzazbz      Jz      az      bz
```

Read `color._space.descriptor.channelNames` when you need the labels.
Do not assume `c1` is always red.

### Channel ranges

Each space declares one range per channel in
`descriptor.channelRanges`. The layout is `[rangeC1, rangeC2, rangeC3]`.

```text
  sRGB:     [ {0,1},   {0,1},   {0,1}   ]
  OKLab:    [ {0,1},   {-0.5,0.5}, {-0.5,0.5} ]
  OKLCh:    [ {0,1},   {0,0.5}, {-Inf,+Inf} ]
  XYZ_D65:  [ {-65504,65504}, {-65504,65504}, {-65504,65504} ]
  HSL:      [ {-Inf,+Inf}, {0,1}, {0,1}   ]
```

The `isInRange` and `clampToRange` helpers read these ranges. They
do not guess.

## Color spaces

Twenty-four spaces ship with the library.

### SDR and wide gamut

| Space         | Purpose                                         |
| ------------- | ----------------------------------------------- |
| `sRGB`        | The default SDR space for the web.              |
| `Linear_sRGB` | sRGB primaries, no curve. Use for lighting.     |
| `Display_P3`  | Wide-gamut SDR. Apple displays and many phones. |
| `Linear_P3`   | Linear P3. Use for wide-gamut shader inputs.    |

### HDR

| Space            | Purpose                                  |
| ---------------- | ---------------------------------------- |
| `Linear_Rec2020` | Linear BT.2020. The HDR container space. |
| `PQ_Rec2020`     | ST.2084 PQ. HDR10 and Dolby Vision.      |
| `HLG_Rec2020`    | BT.2100 HLG. Live HDR broadcast.         |

### ACES and film

| Space      | Purpose                                               |
| ---------- | ----------------------------------------------------- |
| `ACES_AP0` | The ACES archival space. Covers the visible spectrum. |
| `ACES_AP1` | ACEScg. The working space for ACES rendering.         |
| `ACEScct`  | ACES log with a toe. True black. Grading.             |
| `ACEScc`   | Pure ACES log. Continuous curve.                      |
| `LogC3`    | ARRI LogC3 at EI 800. ALEXA footage.                  |

### Perceptual and interchange

| Space     | Purpose                                             |
| --------- | --------------------------------------------------- |
| `XYZ_D65` | CIE XYZ with D65 white. The interchange space.      |
| `OKLab`   | Perceptually uniform. Best for blending.            |
| `OKLCh`   | The polar form of OKLab. Best for chroma reduction. |
| `CIE_Lab` | CIE 1976 Lab. Older perceptual space.               |
| `CIE_LCh` | The polar form of CIE Lab.                          |
| `ICtCp`   | Dolby ICtCp. HDR perceptual space.                  |
| `Jzazbz`  | Safdar 2017. HDR perceptual space.                  |
| `JzCzHz`  | The polar form of Jzazbz.                           |

### Cylindrical and video

| Space   | Purpose                                      |
| ------- | -------------------------------------------- |
| `HSL`   | Hue, saturation, lightness. Tooling and CSS. |
| `HSV`   | Hue, saturation, value. Color pickers.       |
| `HWB`   | Hue, whiteness, blackness. CSS interop.      |
| `YCbCr` | ITU-R BT.709 luma and chroma. Video.         |

### The three families

Spaces fall into three groups.

```text
  Matrix spaces:      sRGB, Linear_sRGB, Display_P3, Linear_P3,
                      Linear_Rec2020, PQ_Rec2020, HLG_Rec2020,
                      ACES_AP0, ACES_AP1, ACEScct, ACEScc, LogC3,
                      XYZ_D65

  Cube-root LMS:      OKLab, OKLCh

  Special cases:      HSL, HSV, HWB, CIE_Lab, CIE_LCh, YCbCr,
                      ICtCp, Jzazbz, JzCzHz
```

Matrix spaces declare `toXYZ` and `fromXYZ` matrices. The engine
applies the EOTF first and the matrix second.

Cube-root LMS spaces use two matrices with a cube root between them.
The cube root cannot fold into a matrix.

Special-case spaces use their own math. HSL and HSV use hue sector
functions. CIE Lab uses a piecewise f-function. ICtCp and Jzazbz
use a PQ-like curve. The engine wires these into `toXYZ` and
`fromXYZ` in `convert.ts`.

Application code does not need to know which family a space belongs
to. The `convert` function handles all three.

## The conversion pipeline

Every conversion routes through CIE XYZ D65.

```text
  source encoded  -->  [EOTF]  -->  source linear
  source linear   -->  [M_src]  -->  XYZ D65
  XYZ D65         -->  [M_dst]  -->  dest linear
  dest linear     -->  [OETF]  -->  dest encoded
```

OKLab, OKLCh, ICtCp, Jzazbz, and JzCzHz skip the matrix steps. They
use their own paths. The cylindrical and Lab spaces use their own
math on both sides.

The public API is one function.

```ts
convert(color, targetSpace); // ColorValue<Src> -> ColorValue<Dst>
convert(tuple, from, targetSpace); // ColorTuple<Src> -> ColorValue<Dst>
```

The function is pure. It returns a new value. It copies alpha
unchanged. When the source and destination match, it returns the same
object.

```ts
import { make, convert, sRGB, Linear_sRGB, OKLab } from '@games/render';

const red = make(sRGB, 1, 0, 0);
const lab = convert(red, OKLab);
const back = convert(lab, sRGB);
// back.c1 is approximately 1.
```

## Gamut mapping

Converting a color to a smaller gamut needs a mapping step. A simple
clamp shifts hue and lightness. The module offers two strategies.

```text
  clamp         Fast. Clamps each channel to its range. Shifts hue.
  css-chroma    CSS Color 4. Reduces OKLCh chroma. Preserves hue.
```

`css-chroma` is the default. It is slower. It gives a better result
for wide-gamut to SDR conversion.

```text
    Chroma
      ^
      |
      |     x  out of gamut
      |    /
      |   /  <-- reduce chroma along the hue ray
      |  /
      | /
      |/
      *  in gamut
      +---------------> Lightness
```

Use `checkGamut` to test a color without changing it.

```ts
import { make, checkGamut, mapToGamut, sRGB, Display_P3 } from '@games/render';

const wide = make(Display_P3, 0, 0.9, 0.5);
const r = checkGamut(wide, sRGB);
if (!r.inGamut) {
  const safe = mapToGamut(wide, sRGB);
}
```

Use `checkGamutAll` to test many spaces at once.

```ts
import { checkGamutAll, Display_P3, Linear_Rec2020, make, sRGB } from '@games/render';

const wide = make(Display_P3, 0, 0.9, 0.5);
const checks = checkGamutAll(wide, [sRGB, Display_P3, Linear_Rec2020]);
console.log(checks.sRGB.inGamut); // false
```

### Gamut expansion

`expandGamut` is the inverse of `mapToGamut`. It pushes the chroma
of an in-gamut color toward the target boundary. The hue and
lightness stay the same.

```ts
import { expandGamut, make, sRGB, Display_P3 } from '@games/render';

const red = make(sRGB, 1, 0, 0);
const wider = expandGamut(red, Display_P3);
const half = expandGamut(red, Display_P3, 0.5);
```

The result is in the target space. It is not in the source space.
The `amount` argument scales between the input chroma and the
boundary. Grays are returned unchanged.

## Backend adapters

Each graphics API has its own vocabulary for color. The adapters
translate between the abstract spaces and the concrete enums.

```text
  +-----------------+     +-----------------+     +------------------+
  | ColorValue<S>   |---->| BackendAdapter  |---->| API-specific     |
  | (logical space) |     | .clearColor()   |     | struct or value  |
  +-----------------+     +-----------------+     +------------------+
```

Each adapter exposes four methods.

```text
  colorSpaceEnum(id)    A logical ID to an API color-space enum.
  pixelFormatEnum(id)   A logical ID to an API pixel-format enum.
  clearColor(color)     A ColorValue to the API's clear-color struct.
  configure(id)         A surface or swap-chain configuration record.
```

The adapters are plain objects. There are no classes. Tree-shakers
can drop the backends you do not use.

### What each adapter expects

| Adapter    | Clear-color space | Notes                                                          |
| ---------- | ----------------- | -------------------------------------------------------------- |
| `DX12`     | Linear            | Pair with an `_UNORM_SRGB` back buffer. Let the driver encode. |
| `Vulkan`   | Linear            | Requires `VK_KHR_swapchain` and `VK_EXT_swapchain_colorspace`. |
| `Metal`    | Linear            | Enable extended dynamic range for HDR spaces.                  |
| `OpenGL`   | Linear            | Enable `GL_FRAMEBUFFER_SRGB` to match the shader path.         |
| `WebGPU`   | sRGB encoded      | Canvas spaces are limited to `srgb` and `display-p3`.          |
| `PS5`      | Linear            | AGC enums. Map string literals to your SDK.                    |
| `Switch`   | Linear            | NVN enums. Map string literals to your SDK.                    |
| `Software` | sRGB encoded      | Emits 8-bit RGBA bytes. Deterministic.                         |

Access the adapters by name or through the `backends` object.

```ts
import { backends, DX12, make, sRGB } from '@games/render';

const a = DX12.clearColor(make(sRGB, 1, 0, 0));
const b = backends.DX12.clearColor(make(sRGB, 1, 0, 0));
```

### Console adapters

`PS5` and `Switch` emit string literals for the color-space and
pixel-format enums. The strings match the SDK naming. The caller is
responsible for mapping a string to the SDK enum. This keeps the
library free of an SDK dependency.

### Software adapter

`Software` is a reference adapter. It emits an 8-bit sRGB byte
array. It has no surface and no GPU dependency. It is useful for
tests, debug overlays, and software rasterizers.

```ts
import { make, sRGB, Software } from '@games/render';

const bytes = Software.clearColor(make(sRGB, 1, 0, 0));
// Uint8ClampedArray [255, 0, 0, 255]
```

### Vulkan pass-through

`Linear_Rec2020` maps to `VK_COLOR_SPACE_PASS_THROUGH_EXT`. Vulkan
has no native linear BT.2020 enum. Pass-through tells the driver to
send the values as-is. The render pass and the shader must agree on
the interpretation.

## Color operations

The `operations` module adjusts colors in OKLCh. OKLCh is a
perceptually uniform space. Edits to L and C do not shift hue.

```ts
import { lighten, darken, saturate, rotateHue, complement } from '@games/render';

const red = make(sRGB, 1, 0, 0);

lighten(red, 0.1); // brighter
darken(red, 0.1); // darker
saturate(red, 0.05); // more chroma
desaturate(red, 0.1); // less chroma
rotateHue(red, 180); // complement
complement(red); // same as rotateHue(red, 180)
```

`invert` and `grayscale` return the source space. The others return
OKLCh. Convert back if you need the original space.

## Alpha compositing

The `composite` module implements the Porter-Duff source-over rule.

```ts
import { make, over, under, premultiply, unpremultiply, sRGB } from '@games/render';

const red = make(sRGB, 1, 0, 0, 0.5);
const blue = make(sRGB, 0, 0, 1, 1);

over(red, blue); // red on top of blue
under(red, blue); // red under blue
premultiply(red); // c1 *= alpha
unpremultiply(red); // c1 /= alpha
```

Use `over` for the common case. Use `premultiply` before a GPU
texture upload. Use `unpremultiply` after reading a premultiplied
image.

## Mutable color

`ColorValue<S>` is read-only. Every edit allocates a new object. That
is the safe default. It is also a cost in hot loops.

`MutableColor<S>` drops the `readonly` modifier on the four channels.
The `_space` field stays read-only. The space cannot change.

```ts
import { make, sRGB, toImmutable, toMutable } from '@games/render';

const src = make(sRGB, 0.5, 0.5, 0.5);
const m = toMutable(src);
m.c1 = 1;
// src.c1 is still 0.5

const snap = toImmutable(m);
m.c2 = 0;
// snap.c2 is still 0.5
```

Use this type only where profiling shows a cost. Keep the immutable
path as the default.

## Accessibility

The `accessibility` module follows the W3C WCAG 2.1 definitions.

```ts
import { contrast, isLight, make, readableTextOn, sRGB, luminance } from '@games/render';

const white = make(sRGB, 1, 1, 1);
const black = make(sRGB, 0, 0, 0);

luminance(white); // 1
contrast(white, black); // 21
isLight(white); // true
readableTextOn(white); // black
```

WCAG thresholds.

```text
  Normal text   4.5:1 minimum
  Large text    3.0:1 minimum
  UI borders    3.0:1 minimum
```

## Delta-E metrics

The `difference` module provides four color difference metrics.

```ts
import { deltaE2000, deltaE76, deltaEITP, deltaEOK, make, sRGB } from '@games/render';

const a = make(sRGB, 1, 0, 0);
const b = make(sRGB, 0.9, 0.1, 0);

deltaEOK(a, b); // OKLab distance. CSS Color 4 uses 0.02 as tolerance.
deltaE2000(a, b); // CIEDE2000. Most accurate for small differences.
deltaE76(a, b); // CIE Lab Euclidean. Legacy compatibility.
deltaEITP(a, b); // ICtCp. Designed for HDR content.
```

Use `deltaEOK` for gamut mapping and for real-time checks. Use
`deltaE2000` for color matching and for quality control. Use
`deltaEITP` for HDR.

## Gradients and rasters

The `gradient` directory provides four kinds.

```ts
import {
  make,
  sampleLinear,
  sampleRadial,
  sampleMultiStop,
  samplePattern,
  sRGB,
  type LinearGradient,
} from '@games/render';

const g: LinearGradient<typeof sRGB> = {
  kind: 'linear',
  from: { x: 0, y: 0 },
  to: { x: 1, y: 0 },
  stops: [
    { offset: 0, color: make(sRGB, 1, 0, 0) },
    { offset: 1, color: make(sRGB, 0, 0, 1) },
  ],
  workingSpace: sRGB,
};

sampleLinear(g, { x: 0.5, y: 0 }); // midway
```

### Gradient kinds

```text
  linear    Two points define a direction. Color changes along it.
  radial    A center and two radii define a ring.
  multi     An explicit list of stops.
  pattern   An image plus a tile rule and an optional transform.
```

### Tile rules for `PatternRaster`

```text
  repeat       repeat-x       repeat-y       no-repeat
  +----+       +----+----+    +----+         +----+
  |abcd|       |abcd|abcd|    |abcd|         |abcd|
  |efgh|       |efgh|efgh|    |efgh|         |efgh|
  |abcd|       +----+----+    |abcd|
  |efgh|                      |efgh|
  +----+                      +----+
```

The default working space for interpolation is OKLab. Pass a
different space when you want a different look.

## Typed arrays and packed formats

The `bridge` module moves colors between objects and typed arrays.
The `packed` module writes colors to single integers.

```ts
import {
  make,
  sRGB,
  toFloat32Array,
  fromFloat32Array,
  toUint8Array,
  fromUint8Array,
  toRGBA8,
  fromRGBA8,
  toRgb565,
  fromRgb565,
  convertBatch,
  Linear_sRGB,
} from '@games/render';

const colors = [make(sRGB, 1, 0, 0), make(sRGB, 0, 0, 1)];

// Interleaved RGBA. Four values per color.
const floats = toFloat32Array(colors);
const back = fromFloat32Array(floats, sRGB);

// Bytes, 0 to 255.
const bytes = toUint8Array(colors);

// Single integers.
const rgba = toRGBA8(make(sRGB, 1, 0, 0, 1)); // 0xff0000ff
const r565 = toRgb565(make(sRGB, 1, 0, 0)); // 0xf800

// Batch conversion.
const linear = convertBatch(colors, Linear_sRGB);
```

The layout is interleaved RGBA. Four values per color. No padding.

## CSS parsing and serialization

The `w3c` directory provides CSS Color 4 parsing and serialization.

```ts
import { fromCSS, toCSS } from '@games/render';

fromCSS('#f80'); // sRGB
fromCSS('rgb(255 128 0)'); // sRGB
fromCSS('hsl(30 100% 50%)'); // sRGB
fromCSS('oklch(0.7 0.15 60)'); // OKLCh
fromCSS('color(display-p3 1 0.5 0)'); // Display P3
fromCSS('rebeccapurple'); // sRGB

toCSS(make(sRGB, 1, 0, 0)); // "#ff0000"
toCSS(make(sRGB, 1, 0, 0, 0.5), 'rgb'); // "rgb(255 0 0 / 0.5)"
toCSS(make(Display_P3, 1, 0.5, 0), 'color-display-p3');
```

### Supported input forms

```text
  #RGB           #RGBA           #RRGGBB         #RRGGBBAA
  rgb(r, g, b)   rgb(r g b)      rgb(r g b / a)
  rgba(...)      same as rgb with explicit alpha
  hsl(h, s%, l%) hsl(h s% l% / a)
  hsla(...)      same as hsl
  oklch(l c h)   oklch(l c h / a)
  color(display-p3 r g b / a)
  color(rec2020 r g b / a)
  <named-color>  for example "red" or "rebeccapurple"
```

The named-color table has 148 entries. It is in `w3c/css-named.ts`.

## Tone mapping

The `tone-mapping` module compresses HDR into SDR.

```ts
import { make, Linear_Rec2020, toneMap } from '@games/render';

const hdr = make(Linear_Rec2020, 5, 5, 5);

toneMap(hdr, 'aces-filmic');
toneMap(hdr, 'reinhard');
toneMap(hdr, 'agx');
toneMap(hdr, 'exposure', { exposure: 1 });
```

The output is always sRGB. Alpha is copied unchanged.

### Operators

```text
  reinhard           The classic simple curve.
  reinhard-extended  Allows a white point.
  aces-filmic        The Narkowicz fit. Industry default for games.
  agx                The Sobotka 2022 fit. Film-like highlights.
  exposure           A plain multiply. For capture and debugging.
```

## Chromatic adaptation

The `adaptation` module converts a color between white points.

```ts
import { adapt, make, sRGB, whitePointXYZ } from '@games/render';

const red = make(sRGB, 1, 0, 0);

adapt(red, 'D65', 'D50'); // Bradford by default
adapt(red, 'D65', 'D50', 'cat02'); // Or CAT02
adapt(red, 'D65', 'D50', 'von-kries'); // Or Von Kries
adapt(red, 'D65', 'D50', 'xyz-scaling'); // Or a naive scale

whitePointXYZ('D65'); // [0.95047, 1.0, 1.08883]
```

### Methods

```text
  bradford      The industry default. Used by ICC.
  von-kries     The original 1902 model.
  cat02         The CIECAM02 model.
  xyz-scaling   A naive scale. Fast but not accurate.
```

### White points

```text
  D50    D55    D65    D93    E    A    C
```

## Quantization and dithering

The `quantize` module reduces a color to a lower bit depth. It also
spreads the error across neighboring pixels.

```ts
import { dither, make, quantize, sRGB } from '@games/render';

quantize(make(sRGB, 0.5, 0.5, 0.5), 4); // 4-bit per channel
quantize(make(sRGB, 1, 0, 0), 'rgb565'); // 5-6-5 layout
quantize(make(sRGB, 0.5, 0.5, 0.5), 'rgba4444');
quantize(make(sRGB, 0.5, 0.5, 0.5), 'rgb1010102');
quantize(make(sRGB, 0.5, 0.5, 0.5), 'rgb332');

dither(pixels, 320, 240, { mode: 'bayer', matrixSize: 4 });
dither(pixels, 320, 240, { mode: 'floyd-steinberg' });
```

### Formats

```text
  rgb565       5 bits red, 6 green, 5 blue. No alpha.
  rgba4444     4 bits per channel.
  rgb1010102   10 bits per RGB, 2 for alpha.
  rgb332       3 bits red, 3 green, 2 blue. Retro.
```

### Modes

```text
  bayer             An ordered threshold matrix. Fast, deterministic.
  floyd-steinberg   Error diffusion. Slower, higher quality.
  none              Quantize without dithering.
```

## CAM16 appearance model

The `cam16` module implements the CIE 248:2022 color appearance
model. CAM16 predicts how a color appears under a specific viewing
environment. The output is a set of perceptual attributes, not a
color value.

```ts
import { cam16FromXYZ, make, sRGB, xyzFromCAM16 } from '@games/render';

const c = make(sRGB, 0.5, 0.5, 0.5);
const cam = cam16FromXYZ(c);

cam.J; // lightness, 0 to 100
cam.C; // chroma
cam.h; // hue angle in degrees
cam.M; // colorfulness
cam.s; // saturation
cam.Q; // brightness

const back = xyzFromCAM16(cam);
```

### Viewing environment

```ts
import type { CAM16Env } from '@games/render';

const env: CAM16Env = {
  whitePoint: 'D65',
  adaptingLuminance: 20,
  backgroundLuminance: 0.2,
  surround: 'average',
};
```

The defaults match the CIE 248:2022 reference for "average" surround
viewing. `J` is nearly invariant to the adapting luminance. `Q`
scales with it. Lower ambient light gives lower `Q`. Higher ambient
light gives higher `Q`.

### When to use CAM16

CAM16 is a research and quality-control tool. It is not a rendering
space. Use it for perceptual studies, for accessibility checks, and
for verifying that two colors look the same under different
illuminants. Use OKLab for real-time blending.

## ICC profile reader

The `icc` module reads ICC v2 and v4 profiles. It supports matrix
and TRC profiles. It does not support LUT-based profiles yet.

```ts
import { applyProfile, make, parseICC, sRGB, toProfileSpace } from '@games/render';

const bytes = await fetch('./display.icc').then((r) => r.arrayBuffer());
const profile = parseICC(bytes);

// Device RGB to PCS. The PCS is D50. The result is adapted to D65.
const xyz = applyProfile(make(sRGB, 1, 0, 0), profile);

// PCS to a device space.
const back = toProfileSpace(xyz, profile, sRGB);
```

### Supported profiles

```text
  RGB matrix + TRC    Yes.
  Gray TRC            Yes.
  LUT (A2B0, B2A0)    No. Throws a clear error.
```

The parser detects the byte order from the profile size field. It
reads the header, the tag table, the primaries matrix, and the TRC
curves.

## Color science helpers

The `science` module provides four helpers for color grading and
calibration.

```ts
import {
  chromaticityCoordinates,
  colorTemperature,
  dominantWavelength,
  make,
  metamerCheck,
  sRGB,
} from '@games/render';

chromaticityCoordinates(make(sRGB, 1, 1, 1)); // { x: 0.3127, y: 0.329 }
dominantWavelength(make(sRGB, 1, 0, 0)); // near 611 nm
colorTemperature(make(sRGB, 1, 1, 1)); // near 6500 K
metamerCheck(colorA, colorB); // D65 vs A
```

### What each helper does

```text
  chromaticityCoordinates   xy coordinates of a color.
  dominantWavelength        Closest spectral locus wavelength in nm.
  colorTemperature          Correlated color temperature in Kelvin.
  metamerCheck              Do two colors match under one light
                            but differ under another?
```

`colorTemperature` uses the McCamy approximation. It is accurate
between 2000 K and 25000 K.

## Shader snippet generation

The `shader` module emits shader constants from the engine's own
colors. This stops hand-written constants from drifting.

```ts
import { make, sRGB, toShader } from '@games/render';

toShader(make(sRGB, 1, 0, 0), 'wgsl');
// "const Linear_sRGB = vec4<f32>(1.0, 0.0, 0.0, 1.0);"

toShader(make(sRGB, 1, 0, 0), 'hlsl', { name: 'kRed' });
// "static const float4 kRed = float4(1.0, 0.0, 0.0, 1.0);"
```

### Languages

```text
  hlsl   DirectX.       static const float4 name = float4(...);
  glsl   OpenGL.        const highp vec4 name = vec4(...);
  wgsl   WebGPU.        const name = vec4<f32>(...);
  msl    Metal.         constant float4 name = float4(...);
```

### Options

```text
  space       The output color space. Defaults to 'Linear_sRGB'.
  precision   GLSL only. 'lowp', 'mediump', or 'highp'.
  name        Overrides the auto-generated identifier.
```

## Serialization

The `serialize` module writes palettes and gradients to JSON or
MessagePack.

```ts
import { fromJSON, make, packPalette, sRGB, toJSON, toMsgPack, unpackPalette } from '@games/render';

const palette = packPalette([make(sRGB, 1, 0, 0), make(sRGB, 0, 0, 1)]);

// JSON. Human readable.
const text = toJSON(palette);
const back = unpackPalette(fromJSON(text));

// MessagePack. Compact for integers and repeated strings.
const bytes = toMsgPack(palette);
```

### Streaming

For large palettes, use the streaming API.

```ts
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fromMsgPackStream, packPalette, toMsgPackStream, unpackPalette } from '@games/render';

const palette = packPalette(largeColorArray);

await pipeline(
  Readable.from(toMsgPackStream(palette, { chunkSize: 128 * 1024 })),
  createWriteStream('palette.msgpack'),
);

const data = await fromMsgPackStream(createReadStream('palette.msgpack'));
const colors = unpackPalette(data);
```

The decoder accepts any `AsyncIterable<Uint8Array>`. That covers
Node streams, Web Streams, and file handles on the File System
Access API.

### When to use which format

```text
  JSON          Human-readable. Good for config and for small palettes.
  MessagePack   Compact for integer colors and repeated strings.
                Larger than JSON for arbitrary float64 channels.
  Stream        For palettes too large to fit comfortably in memory.
```

## Fast batch conversion

The `wasm` module provides `convertBatchSIMD` and `convertBatchFast`.
Both are faster than the standard `convertBatch` from `bridge.ts`.

```ts
import { convertBatchFast, make, Linear_sRGB, sRGB } from '@games/render';

const encoded = [make(sRGB, 0.5, 0.2, 0.8), make(sRGB, 0.1, 0.9, 0.3)];
const linear = convertBatchFast(encoded, Linear_sRGB);
```

### Paths

```text
  convertBatch       The safe baseline. Calls convert per color.
  convertBatchFast   Hoists the matrix lookups out of the loop.
  convertBatchSIMD   A future WASM SIMD path. Falls back today.
```

The WASM path is not yet implemented. The interface is stable so a
future implementation can drop in without a breaking change. The
`wasmReady` flag reports whether the WASM path is active. It is
`false` in this version.

## Development tools

The `debug` module provides diagnostics for development builds.

```ts
import { debugFormat, make, sRGB, warnOutOfGamut } from '@games/render';

warnOutOfGamut(wide, sRGB, 'sprite.tint');
// console.warn: [sprite.tint] Display_P3 -> sRGB out of gamut: ...

console.log(debugFormat(make(sRGB, 1, 0, 0)));
// sRGB (IEC 61966-2-1) [R, G, B]
//   c1: 1.0000 [0, 1] ok
//   c2: 0.0000 [0, 1] ok
//   c3: 0.0000 [0, 1] ok
//   alpha: 1.0000 [0, 1] ok
//   in sRGB gamut: yes
```

Both functions are no-ops when `NODE_ENV` is `production`. Bundlers
that replace `process.env.NODE_ENV` at build time can tree-shake the
whole module.

## Building your own space

The library supports custom spaces. Use `makeSpace` with a full
`SpaceDescriptor`.

```ts
import { make, makeSpace, sRGB, type ColorSpaceDef, type SpaceDescriptor } from '@games/render';

const myDescriptor: SpaceDescriptor = {
  name: 'Studio Log',
  isLinear: false,
  toXYZ: M_sRGB_to_XYZ,
  fromXYZ: M_XYZ_to_sRGB,
  transfer: {
    eotf: (c) => (c <= 0.1 ? c / 10 : (c + 0.1) / 1.1),
    oetf: (l) => (l <= 0.01 ? l * 10 : l * 1.1 - 0.1),
  },
  channelRanges: [
    { min: 0, max: 1 },
    { min: 0, max: 1 },
    { min: 0, max: 1 },
  ],
  channelNames: ['R', 'G', 'B'],
};

export const StudioLog: ColorSpaceDef<'StudioLog'> = makeSpace('StudioLog', myDescriptor);

const c = make(StudioLog, 0.5, 0.5, 0.5);
```

The new space is fully typed. `ColorValue<typeof StudioLog>` will not
mix with values from other spaces. `convert` will accept it. The
backend adapters will throw for it until you add a mapping.

A custom space that needs non-matrix math needs a special case in
`convert.ts`. The nine special-case spaces in the module show the
pattern.

If the custom space lives inside `src/color/`, import
`makeSpace`, `make`, and the types with a relative path:

```ts
import { make } from '../convert';
import { makeSpace, type ColorSpaceDef, type SpaceDescriptor } from '../space';
```

## Design rules

The module follows a small set of rules. Follow them when you extend
it.

1. **One name per concept.** "Encoded" means after the OETF.
   "Linear" means before the EOTF. Use these words in code and in
   comments.
2. **One direction per function.** `toXYZ` converts to XYZ.
   `fromXYZ` converts from XYZ. Do not mix the directions.
3. **One range per channel.** Never apply a single min and max to
   all three channels.
4. **Active voice in docs.** "The parser reads the file" beats "The
   file is read."
5. **Short sentences.** Under 25 words for descriptive text. Under
   20 for instructions.
6. **Match the import style to the location.** Application code and
   tests import from `@games/render`. Source files inside
   `src/color/` import each other with relative paths. Never import
   from a deep path such as `@games/render/src/color/convert`.
7. **One test file per source file.** Tests live under
   `packages/render/test`. Source lives under `packages/render/src`.
8. **The tuple is a view. The object is canonical.** Every function
   that accepts a tuple converts it to a `ColorValue` at the top.
   Do not try to smuggle the space tag through the tuple.

## Known limits

- The Vulkan backend maps `Linear_Rec2020` to
  `VK_COLOR_SPACE_PASS_THROUGH_EXT`. Vulkan has no native linear
  BT.2020 enum. The shader must interpret the values.
- The OKLab and OKLCh matrices have about 5e-4 precision on the blue
  channel of white. Round-trips between OKLab and sRGB can be off by
  that amount. Gamut mapping clamps the result.
- `fromHex` accepts `#RGB`, `#RGBA`, `#RRGGBB`, and `#RRGGBBAA`. It
  throws on anything else. The `#RGB` shorthand expands by
  duplicating each nibble.
- `mix` defaults to OKLab. OKLab gives perceptual blending. Pass an
  explicit working space when you want sRGB or another space.
- `convertBatch` loops over `convert`. `convertBatchFast` hoists the
  matrix lookups. A real SIMD path would need a build step for WASM.
  The `convertBatchSIMD` interface is stable but currently returns
  the fast path.
- The `sample` dispatcher on `MultiStopGradient` returns the first
  stop. A multi-stop gradient has no geometry. Call `sampleMultiStop`
  directly with a parameter.
- `PatternRaster` ignores the third row of the transform. Only the
  first six entries are used. Perspective transforms are not
  supported.
- The `agx` tone map is a compact fit. It is close to the Sobotka
  2022 curve for display use. Swap in the full polynomial for
  bit-exact color grading.
- The ICC reader supports matrix and TRC profiles. LUT-based
  profiles throw. This covers display profiles and standard working
  spaces.
- The `ColorTuple<S>` brand is type-only. It does not survive
  `[...c]`, `c.slice()`, `structuredClone(c)`, or a JSON round-trip.
  Use `fromTuple(tuple, space)` to reattach the space.
- CAM16 is a model, not a space. Its output is a `CAM16` object, not
  a `ColorValue`. It cannot flow through the interchange pipeline.
- `Jzazbz` and `JzCzHz` use an absolute luminance reference of
  10000 cd/m^2. Inputs relative to a different reference must scale
  first.
- `PS5` and `Switch` emit string literals, not real SDK enums. Map
  them in your renderer. Pin the mapping to a specific SDK version.

## References

- CSS Color 4: https://www.w3.org/TR/css-color-4/
- CSS Color 4 gamut mapping: https://www.w3.org/TR/css-color-4/#css-gamut-mapping
- ITU-R BT.2100 (PQ and HLG): https://www.itu.int/rec/R-REC-BT.2100
- OKLab specification: https://bottosson.github.io/posts/oklab/
- Jzazbz (Safdar et al 2017): https://www.osapublishing.org/oe/fulltext.cfm?uri=oe-25-13-15131
- Colour-science reference matrices: https://www.colour-science.org/
- WebGPU canvas configuration: https://gpuweb.github.io/gpuweb/#canvas-configuration
- Porter-Duff compositing: https://keithp.com/~keithp/porterduff/p253-porter.pdf
- WCAG contrast ratio: https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
- CIEDE2000 reference: http://www2.ece.rochester.edu/~gsharma/ciede2000/
- Dolby ICtCp: https://professional.dolby.com/siteassets/pdfs/ictcp_dolbywhitepaper_v071.pdf
- ACEScct: https://docs.acescentral.com/specifications/acescct/
- ACEScc: https://docs.acescentral.com/specifications/acescc/
- ARRI LogC3: https://www.arri.com/en/learn-help/learn-help-camera-system/white-papers
- CAM16 (CIE 248:2022): https://cie.co.at/publications/cie-2482022
- ICC v4 specification: https://www.color.org/specification/ICC.1-2022-05.pdf
- MessagePack spec: https://github.com/msgpack/msgpack/blob/master/spec.md
- Bayer dithering: https://en.wikipedia.org/wiki/Ordered_dithering
- Floyd-Steinberg: https://en.wikipedia.org/wiki/Floyd%E2%80%93Steinberg_dithering

## Summary of changes

| Section                   | Change                                                                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Title                     | Prepended `#` back. Full path in the header line.                                                                                  |
| Contents                  | Added entries for CAM16, ICC, science, shader, serialize, WASM, debug.                                                             |
| What the module gives you | Updated counts. Twenty-four spaces. Eight backends. Added six bullets for the new modules.                                         |
| Quick start               | Unchanged. Field names in examples already use the new form.                                                                       |
| Import conventions        | Moved to its own section for clarity.                                                                                              |
| Module map                | Full update. Added `tuple.ts`, `cam16.ts`, `science.ts`, `shader.ts`, `debug.ts`, `icc/`, `serialize/`, `wasm/`. Added test files. |
| Core concepts             | Renamed all fields from `r/g/b/a` to `c1/c2/c3/alpha`. Added the `ColorTuple<S>` section with the boundary rule.                   |
| Three-channel layout      | Renamed table columns. Added Jzazbz row.                                                                                           |
| Channel ranges            | Renamed to `rangeC1` etc.                                                                                                          |
| Color spaces              | Twenty-four spaces. Added Jzazbz and JzCzHz. Updated the family table.                                                             |
| Conversion pipeline       | Added Jzazbz and JzCzHz to the special-case list. Showed the tuple overload.                                                       |
| Gamut mapping             | Added the `expandGamut` subsection.                                                                                                |
| Backend adapters          | Eight adapters. Added PS5, Switch, Software. Added notes per adapter.                                                              |
| Color operations          | Renamed fields in examples.                                                                                                        |
| Alpha compositing         | Renamed fields in examples.                                                                                                        |
| Mutable color             | Renamed `m.r` and `m.g` to `m.c1` and `m.c2`.                                                                                      |
| Accessibility             | Unchanged.                                                                                                                         |
| Delta-E metrics           | Unchanged.                                                                                                                         |
| Gradients and rasters     | Unchanged.                                                                                                                         |
| Typed arrays              | Unchanged.                                                                                                                         |
| CSS parsing               | Unchanged.                                                                                                                         |
| Tone mapping              | Unchanged.                                                                                                                         |
| Chromatic adaptation      | Unchanged.                                                                                                                         |
| Quantization              | Unchanged.                                                                                                                         |
| CAM16                     | New section.                                                                                                                       |
| ICC profile reader        | New section.                                                                                                                       |
| Color science helpers     | New section.                                                                                                                       |
| Shader snippet generation | New section.                                                                                                                       |
| Serialization             | Expanded. JSON, MessagePack, and streaming.                                                                                        |
| Fast batch conversion     | New section.                                                                                                                       |
| Development tools         | New section.                                                                                                                       |
| Building your own space   | Unchanged.                                                                                                                         |
| Design rules              | Added rule 8 about the tuple view.                                                                                                 |
| Known limits              | Added six entries for the new modules.                                                                                             |
| References                | Added six links for CAM16, ICC, MessagePack, Jzazbz.                                                                               |
