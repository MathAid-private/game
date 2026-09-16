# `src/color`

The color module of `@games/render`. It abstracts color for the rendering pipeline. Application code works with logical color spaces. The module handles the details of conversion, gamut mapping, and the per-backend encoding that each graphics API expects.

## Why this module exists

Color bugs are silent. A gamma-encoded value passed where a linear value is expected does not crash. It produces a gradient that looks slightly wrong. A wide-gamut color clamped to sRGB shifts hue. An HDR value fed into an 8-bit framebuffer clips. These bugs are hard to find in a running game.

This module moves those bugs to compile time. Every color carries its space in the type system. Every conversion is explicit. Every backend adapter states what it expects.

## What the module gives you

- A phantom-typed `ColorValue<S>` for compile-time space tracking.
- Twelve built-in color spaces, from sRGB to ACES AP0.
- A pure `convert()` function that routes through CIE XYZ D65.
- A CSS Color 4 gamut mapping algorithm in OKLCh.
- Five backend adapters that emit the correct enums and structs for DX12, Vulkan, Metal, OpenGL, and WebGPU.

## Quick start

```ts
import {
  make,
  convert,
  mapToGamut,
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

// Emit a clear struct for DirectX 12.
const clear = DX12.clearColor(safe);
```

## Module map

```text
  src/color/
    space.ts           Color space definitions and descriptors.
    convert.ts         ColorValue, make, convert, and helpers.
    gamut-mapping.ts   Gamut checking and chroma reduction.
    backend.ts         Backend adapters for five graphics APIs.
    index.ts           Public entry point. Re-exports every file.
```

The `@games/render` package barrel re-exports this directory. Import from `@games/render`, not from the file paths.

## Core concepts

### The `ColorValue<S>` type

A `ColorValue<S>` is a plain object with four numeric channels and a phantom space tag.

```ts
interface ColorValue<S extends ColorSpaceDef<string>> {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
  readonly _space: S;
}
```

The `S` parameter is a color space object. It is `typeof sRGB`, `typeof Linear_sRGB`, or any other `ColorSpaceDef`. The tag has no extra runtime cost. TypeScript uses it to stop cross-space mistakes.

```text
  make(sRGB, 0.5, 0.5, 0.5)  -->  ColorValue<typeof sRGB>
  make(Linear_sRGB, 0.5, 0.5, 0.5)  -->  ColorValue<typeof Linear_sRGB>

  const linear: ColorValue<typeof Linear_sRGB> = make(sRGB, 0.5, 0.5, 0.5);
  //    Type error. sRGB is not assignable to Linear_sRGB.
```

### The three-channel layout

The field names are always `r`, `g`, `b`. Their meaning depends on the space.

```text
  Space       r       g       b
  -----       --      --      --
  sRGB        R       G       B
  OKLab       L       a       b
  OKLCh       L       C       H
  XYZ_D65     X       Y       Z
```

Read `color._space.descriptor.channelNames` when you need the labels. Do not assume `r` is always red.

### Channel ranges

Each space declares one range per channel in `descriptor.channelRanges`. The layout is `[rangeR, rangeG, rangeB]`.

```text
  sRGB:     [ {0,1},   {0,1},   {0,1}   ]
  OKLab:    [ {0,1},   {-0.5,0.5}, {-0.5,0.5} ]
  OKLCh:    [ {0,1},   {0,0.5}, {-Inf,+Inf} ]
  XYZ_D65:  [ {-65504,65504}, {-65504,65504}, {-65504,65504} ]
```

The `isInRange` and `clampToRange` helpers read these ranges. They do not guess.

## Color spaces

Twelve spaces ship with the library.

| Space | Purpose |
|-------|---------|
| `sRGB` | The default SDR space for the web. |
| `Linear_sRGB` | sRGB primaries, no curve. Use for lighting math. |
| `Display_P3` | Wide-gamut SDR. Apple displays and many phones. |
| `Linear_P3` | Linear P3. Use for wide-gamut shader inputs. |
| `Linear_Rec2020` | Linear BT.2020. The HDR container space. |
| `PQ_Rec2020` | ST.2084 PQ. HDR10 and Dolby Vision. |
| `HLG_Rec2020` | BT.2100 HLG. Live HDR broadcast. |
| `ACES_AP0` | The ACES archival space. Covers the visible spectrum. |
| `ACES_AP1` | ACEScg. The working space for ACES rendering. |
| `XYZ_D65` | CIE XYZ with D65 white. The interchange space. |
| `OKLab` | Perceptually uniform. Best for blending and gamut work. |
| `OKLCh` | The polar form of OKLab. Best for chroma reduction. |

### The two families

Spaces fall into two groups.

```text
  Matrix spaces:      sRGB, Linear_sRGB, Display_P3, Linear_P3,
                      Linear_Rec2020, PQ_Rec2020, HLG_Rec2020,
                      ACES_AP0, ACES_AP1, XYZ_D65

  LMS spaces:         OKLab, OKLCh
```

Matrix spaces declare `toXYZ` and `fromXYZ` matrices. LMS spaces use a cube-root LMS path. The conversion engine handles both paths. Application code does not need to know which is which.

## The conversion pipeline

Every conversion routes through CIE XYZ D65.

```text
  source encoded  -->  [EOTF]  -->  source linear
  source linear   -->  [M_src]  -->  XYZ D65
  XYZ D65         -->  [M_dst]  -->  dest linear
  dest linear     -->  [OETF]  -->  dest encoded
```

OKLab and OKLCh skip the matrix steps. They use a cube-root LMS path on both sides of XYZ.

The public API is one function.

```ts
convert(color, targetSpace)  // ColorValue<Src> -> ColorValue<Dst>
```

The function is pure. It returns a new value. It copies alpha unchanged. When the source and destination match, it returns the same object.

```ts
const red = make(sRGB, 1, 0, 0);
const lab = convert(red, OKLab);
const back = convert(lab, sRGB);
// back.r is approximately 1.
```

## Gamut mapping

Converting a color to a smaller gamut needs a mapping step. A simple clamp shifts hue and lightness. The module offers two strategies.

```text
  clamp         Fast. Clamps each channel to its range. Shifts hue.
  css-chroma    CSS Color 4. Reduces OKLCh chroma. Preserves hue.
```

`css-chroma` is the default. It is slower. It gives a better result for wide-gamut to SDR conversion.

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
const r = checkGamut(wide, sRGB);
if (!r.inGamut) {
  const safe = mapToGamut(wide, sRGB);
}
```

Use `checkGamutAll` to test many spaces at once.

```ts
const checks = checkGamutAll(wide, [sRGB, Display_P3, Linear_Rec2020]);
console.log(checks.sRGB.inGamut);  // false
```

## Backend adapters

Each graphics API has its own vocabulary for color. The adapters translate between the abstract spaces and the concrete enums.

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

The adapters are plain objects. There are no classes. Tree-shakers can drop the backends you do not use.

### What each adapter expects

| Adapter | Clear-color space | Notes |
|---------|------------------|-------|
| `DX12` | Linear | Pair with an `_UNORM_SRGB` back buffer. Let the driver encode. |
| `Vulkan` | Linear | Requires `VK_KHR_swapchain` and `VK_EXT_swapchain_colorspace`. |
| `Metal` | Linear | Enable extended dynamic range for HDR spaces. |
| `OpenGL` | Linear | Enable `GL_FRAMEBUFFER_SRGB` to match the shader path. |
| `WebGPU` | sRGB encoded | Canvas spaces are limited to `srgb` and `display-p3`. |

Access the adapters by name or through the `backends` object.

```ts
import { DX12, backends } from '@games/render';

const a = DX12.clearColor(make(sRGB, 1, 0, 0));
const b = backends.DX12.clearColor(make(sRGB, 1, 0, 0));
```

## Building your own space

The library supports custom spaces. Use `makeSpace` when you have a new set of primaries or a new transfer curve. Pass a full `SpaceDescriptor`.

```ts
import { makeSpace, type SpaceDescriptor } from '@games/render';

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

export const StudioLog = makeSpace('StudioLog', myDescriptor);
```

The new space is fully typed. `ColorValue<typeof StudioLog>` will not mix with values from other spaces. `convert` will accept it. The backend adapters will throw for it until you add a mapping.

You can also write the object literal by hand. See the `_brand` doc in `space.ts` for that pattern.

## Design rules

The module follows a small set of rules. Follow them when you extend it.

1. **One name per concept.** "Encoded" means after the OETF. "Linear" means before the EOTF. Use these words in code and in comments.
2. **One direction per function.** `toXYZ` converts to XYZ. `fromXYZ` converts from XYZ. Do not mix the directions.
3. **One range per channel.** Never apply a single min and max to all three channels.
4. **Active voice in docs.** "The parser reads the file" beats "The file is read."
5. **Short sentences.** Under 25 words for descriptive text. Under 20 for instructions.

## Known limits

- `Linear_Rec2020` has no native Vulkan mapping. The Vulkan adapter throws for that ID. Use `PQ_Rec2020` or `HLG_Rec2020` instead.
- The OKLab and OKLCh matrices have about 5e-4 precision on the blue channel of white. Round-trips between OKLab and sRGB can be off by that amount. Gamut mapping clamps the result.
- `fromHex` accepts `#RGB`, `#RGBA`, `#RRGGBB`, and `#RRGGBBAA`. It throws on anything else. The `#RGB` shorthand expands by duplicating each nibble.
- The `mix` function defaults to OKLab. OKLab gives perceptual blending. Pass an explicit working space when you want sRGB or another space.

## References

- CSS Color Level 4 gamut mapping: https://www.w3.org/TR/css-color-4/#css-gamut-mapping
- ITU-R BT.2100 (PQ and HLG): https://www.itu.int/rec/R-REC-BT.2100
- OKLab specification: https://bottosson.github.io/posts/oklab/
- Colour-science reference matrices: https://www.colour-science.org/
- WebGPU canvas configuration: https://gpuweb.github.io/gpuweb/#canvas-configuration