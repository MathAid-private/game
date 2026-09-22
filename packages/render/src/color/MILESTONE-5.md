# Milestone 5: Advanced Spaces and Gamut

## Goal

Extend the space library for HDR, dynamic theming, and asset
ingestion. Add the inverse of gamut mapping. Add Jzazbz and JzCzHz.
Add CAM16 and HCT. Add an ICC profile reader.

Four features. The order matters. Start with gamut expansion. It is
the smallest. End with the ICC reader. It is the largest.

## Features

- 3.6 Gamut expansion
- 3.3 Jzazbz and JzCzHz
- 3.4 CAM16 and HCT
- 3.5 ICC profile reader

## 3.6 Gamut expansion

### Where

Extend `packages/render/src/color/gamut-mapping.ts`. No new files.

### Public API
```ts
    expandGamut<S, T>(
      color: ColorValue<S>,
      targetSpace: T,
    ): ColorValue<T>
```
### Implementation

`expandGamut` is the inverse of `mapToGamut`. It takes an in-gamut
color and pushes it toward the target gamut boundary. The result may
exceed the target range on some channels.

The algorithm uses the same OKLCh chroma path as `mapToGamut`. It
starts at the current chroma and searches upward. It stops when the
color crosses the target gamut boundary, minus a small tolerance.

```text
    Chroma
      ^
      |     boundary
      |    /
      |   /  <-- search up the hue ray
      |  /
      | /
      |/
      *  in-gamut start
      +---------------> Lightness
```

Steps.

```text
  1. Convert the color to OKLCh.
  2. If the color is already outside the target gamut, return it
     unchanged. Expansion only moves inward-to-outward.
  3. Binary-search the OKLCh chroma value where the color first exits
     the gamut. Cap the search at the max OKLCh chroma.
  4. Return the color at the boundary minus a small epsilon.
```

The tolerance is `DELTA_E_EPSILON` from `gamut-mapping.ts`.

### Edge cases

- A gray color has chroma 0. Expansion has no direction. Return the
  input.
- The target gamut is narrower than the source. Return the input.
- Fully saturated source. Return the input. There is no headroom.

### Tests

New test file `packages/render/test/gamut-expansion.test.ts`.

- `expandGamut` on a gray returns the same gray.
- `expandGamut` on an sRGB color to Display P3 moves the chroma up.
- Round-trip: `expandGamut(mapToGamut(c, p3), sRGB)` returns close to
  the original.
- The result is inside the target gamut within epsilon.

## 3.3 Jzazbz and JzCzHz

### Where

Extend `packages/render/src/color/space.ts` and
`packages/render/src/color/convert.ts`.

### Public API

Two new space constants.

    Jzazbz    Rectangular. Channels Jz, az, bz.
    JzCzHz    Polar form. Channels Jz, Cz, Hz.

### Implementation

Jzazbz is a perceptual space by Safdar et al 2017. It is designed
for HDR. It is more uniform than OKLab at very high luminance.

The path from XYZ to Jzazbz is:

```text
  XYZ D65  -->  [M_1]  -->  LMS
  LMS      -->  PQ-like curve  -->  LMS'
  LMS'     -->  [M_2]  -->  Izazbz
  Izazbz   -->  [scale]  -->  Jzazbz
```

Add the two matrices and the PQ-like curve to `convert.ts`. Add the
two space descriptors to `space.ts`.

```text
  M_1 = XYZ to LMS (Jzazbz)
      = [ 0.41478972, 0.57999900, 0.01464800,
         -0.20151000, 1.12064900, 0.05310080,
         -0.01660080, 0.26480000, 0.66847990 ]

  M_2 = Izazbz to Jzazbz
      = [ 0.50000000, 0.50000000, 0.00000000,
          3.52400000, -4.06670800, 0.54270800,
          0.19907600, 1.09679900, -1.29587500 ]
```

The PQ-like curve uses the constants from the Jzazbz paper. They are
different from the ST.2084 constants.

### Edge cases

- The space uses an absolute luminance reference of 10000 cd/m^2.
  Document this. Callers who work in relative luminance must scale
  first.
- Values outside [0, 1] are legal. Jzazbz handles HDR.
- The polar form JzCzHz wraps H. Use `wrapHue` from `operations.ts`
  or the same formula.

### Tests

New test file `packages/render/test/jzazbz.test.ts`.

- Jzazbz round-trips through XYZ within 1e-4.
- JzCzHz round-trips through Jzazbz within 1e-4.
- A known reference: `XYZ_D65(0.95047, 1.0, 1.08883)` maps to
  `Jzazbz(0.222, 0.0, 0.0)`.
- The `channelRanges` admit negative values on az and bz.

## 3.4 CAM16 and HCT

### Where

New file `packages/render/src/color/cam16.ts`.

### Public API

```ts
    cam16FromXYZ(xyz: ColorValue<typeof XYZ_D65>, env?: CAM16Env): CAM16
    xyzFromCAM16(cam: CAM16, env?: CAM16Env): ColorValue<typeof XYZ_D65>

    interface CAM16 {
      readonly J: number;     // Lightness
      readonly C: number;     // Chroma
      readonly h: number;     // Hue angle
      readonly M: number;     // Colorfulness
      readonly s: number;     // Saturation
      readonly Q: number;     // Brightness
    }

    interface CAM16Env {
      readonly whitePoint: WhitePoint;
      readonly adaptingLuminance: number;  // cd/m^2
      readonly backgroundLuminance: number;  // Y of background, 0 to 1
      readonly surround: 'dark' | 'dim' | 'average';
    }
```

### Implementation

CAM16 is an appearance model. It predicts how a color appears under a
specific viewing environment. The output is not a color value. It is a
set of perceptual attributes.

The core is a set of forward equations from XYZ to CAM16. The reverse
equations go from CAM16 back to XYZ. Copy the reference implementation
from the CIE 248:2022 specification. Do not invent a shortcut.

Steps for the forward direction.

```text
  1. Adapt XYZ to the white point.
  2. Convert to cone response LMS via the CAT16 matrix.
  3. Apply the non-linear compression.
  4. Apply the post-adaptation matrix.
  5. Compute the perceptual attributes J, C, h, M, s, Q.
```

The `surround` parameter controls the `F`, `c`, and `N_c` constants.

```text
  dark       F=0.8    c=0.525    N_c=0.8
  dim        F=0.9    c=0.590    N_c=0.9
  average    F=1.0    c=0.690    N_c=1.0
```

Default surround is `'average'`.

HCT is not a separate space. It is a hybrid from Material Design 3.
It combines CIE Lab hue with CAM16 chroma and tone. The Material
team's reference implementation is public. Adapt it.

### Edge cases

- Adapting luminance of 0 or below. Throw a clear error.
- Background luminance outside 0 to 1. Throw.
- The reverse direction must round-trip within 1e-3.

### Tests

New test file `packages/render/test/cam16.test.ts`.

- Forward and reverse round-trip within 1e-3 for several colors.
- A neutral gray has `C` near 0.
- A pure hue has `h` in the expected range.
- HCT uses the Lab hue and the CAM16 chroma and tone.

## 3.5 ICC profile reader

### Where

New directory `packages/render/src/color/icc/`. Files.

```
    index.ts       Public API.
    parser.ts      Byte-level ICC file parser.
    profile.ts     In-memory profile types.
    transforms.ts  Apply a profile to colors.
    luts.ts        A2B and B2A LUT evaluation.
```

### Public API

```ts
    parseICC(data: ArrayBuffer | Uint8Array): ICCProfile
    applyProfile<S>(
      color: ColorValue<S>,
      profile: ICCProfile,
    ): ColorValue<typeof XYZ_D65>

    interface ICCProfile {
      readonly version: string;
      readonly deviceClass: 'input' | 'display' | 'output' | 'link'
        | 'abstract' | 'colorspace' | 'named';
      readonly colorSpace: string;       // 'RGB', 'CMYK', 'GRAY', ...
      readonly pcs: 'XYZ' | 'Lab';       // Profile connection space
      readonly whitePoint: readonly [number, number, number];
      readonly tags: ReadonlyMap<string, unknown>;
    }
```

### Implementation

Parse the ICC file header (128 bytes) and the tag table. Support the
matrix and TRC profile class. Support A2B0 and B2A0 LUT tags.

Steps for a matrix and TRC profile.

```text
  1. Read the header. Get the PCS, the device class, and the white.
  2. Read the rXYZ, gXYZ, bXYZ tags. These are the primaries matrix.
  3. Read the rTRC, gTRC, bTRC tags. These are the channel curves.
  4. Read the wtpt tag. This is the media white point.
```

Steps for a LUT profile.

```text
  1. Read the A2B0 or B2A0 tag.
  2. Parse the CLUT, the input tables, and the output tables.
  3. Sample the LUT with trilinear or tetrahedral interpolation.
```

For the first version, support matrix and TRC only. LUT support is a
follow-up.

### Edge cases

- Malformed file. Throw with the failing tag name.
- Wrong version. Support v2 and v4. Throw on v5 and above.
- Big-endian and little-endian headers. Check the first four bytes.
- Profile with no valid PCS. Throw.

### Tests

New test file `packages/render/test/icc.test.ts`.

- Parse a known sRGB ICC profile from a test fixture.
- Verify the primaries matrix matches the module's sRGB matrix.
- Apply the profile to `sRGB(1, 0, 0)`. Check the XYZ result.
- Round-trip through a B2A profile and back within 1e-3.
- A malformed file throws a clear error.

## Order of work

```text
  Step 1    3.6 Gamut expansion. Smallest. Extends one file.
  Step 2    3.3 Jzazbz and JzCzHz. Adds spaces. Tests the pipeline.
  Step 3    3.4 CAM16 and HCT. New file. Uses CIE Lab.
  Step 4    3.5 ICC reader. Largest. Last.
```

## Definition of done

- Every new public API has JSDoc with `@summary` and `@description`.
- Every new space has a `channelRanges` entry.
- Every new file has a matching test file under
  `packages/render/test`.
- The barrel `packages/render/src/color/index.ts` re-exports every
  new file.
- `npm test` passes with zero failures.
- The README has a section for each new file.

---
