# Milestone 3: Authoring

## Goal

Bridge the module to authoring tools. Import and export CSS. Add more
input spaces so tooling can speak the same language. Add HDR tone
mapping so captured frames look right.

## Features

- 2.1 CSS parsing and serialization
- 2.3 More input spaces
- 2.4 HDR tone mapping

## 2.1 CSS parsing and serialization

### Where

New file `src/color/css.ts`.

### Public API

    fromCSS(input: string): ColorValue<ColorSpaceDef<string>>
    toCSS<S>(color: ColorValue<S>, format?: CSSFormat): string

    type CSSFormat =
      | 'hex'
      | 'rgb'
      | 'hsl'
      | 'oklch'
      | 'color-display-p3'
      | 'color-rec2020';

### Implementation

Parse with a small recursive-descent parser. Do not use a regex. The
CSS Color 4 grammar has nested functions and optional commas.

Grammar coverage:

    hex:          #RGB | #RGBA | #RRGGBB | #RRGGBBAA
    rgb:          rgb(r, g, b) | rgb(r g b / a)
    rgba:         same as rgb with alpha
    hsl:          hsl(h, s%, l%) | hsl(h s% l% / a)
    oklch:        oklch(l c h) | oklch(l c h / a)
    color:        color(display-p3 r g b / a)
    named:        a table of the CSS named colors

The parser returns a `ColorValue` in the natural space for each form.
`rgb()` returns sRGB. `oklch()` returns OKLCh. `color(display-p3 ...)`
returns Display_P3. `hex` returns sRGB.

`toCSS` converts to the requested output space and formats the string.
Default format is `'hex'` for sRGB colors with alpha 1, and `'rgb'`
otherwise.

### Named colors

Ship a `Record<string, string>` of the 148 CSS named colors, each mapped
to a hex string. Tree-shaking friendly: separate file
`src/color/css-named.ts`.

### Edge cases

- Whitespace and comments. The CSS grammar allows both.
- Percentage vs number for `rgb`. `50%` is 0.5. `128` is 128/255.
- Alpha values. Accept both `0.5` and `50%`.
- `none` keyword. Map to `NaN` or to 0. Pick one and document it.

### Tests

- Parse each grammar form. Assert the resulting space and channels.
- Round-trip `toCSS(fromCSS(s))` for every form.
- Every named color parses without error.
- Bad input throws with a message that names the input.

## 2.3 More input spaces

### Where

Extend `src/color/space.ts`.

### New spaces

    HSL        Cylindrical. H in degrees, S and L in 0 to 1.
    HSV        Cylindrical. H in degrees, S and V in 0 to 1.
    HWB        Cylindrical. H in degrees, W and B in 0 to 1.
    CIE_Lab    CIE 1976 Lab with D65 white.
    CIE_LCh    The polar form of CIE Lab.
    YCbCr      ITU-R BT.709 coefficients. Y in 0 to 1, Cb and Cr in -0.5 to 0.5.
    ICtCp      Dolby ICtCp for HDR.

### Implementation pattern

For matrix spaces like `CIE_Lab` and `YCbCr`, add a `toXYZ` and `fromXYZ`
matrix. Reuse the identity transfer pair or the sRGB pair as appropriate.

For cylindrical spaces like `HSL`, `HSV`, `HWB`, `CIE_LCh`, and `ICtCp`,
add a special case to `toXYZ` and `fromXYZ` in `convert.ts`. The pattern
is the same as OKLCh. Convert to the rectangular parent, then to XYZ.

Example for HSL:

    if (id === HSL.id) {
      const [r, g, b] = hslToRgb(r, g, b);
      return toXYZ(sRGB, r, g, b);
    }

Keep the conversion functions in a private module
`src/color/cylindrical.ts`.

### Edge cases

- Hue wraps. Clamp or wrap as the space requires.
- HSL and HSV are not perceptually uniform. They are tooling spaces.
- `CIE_Lab` a and b channels can be negative.
- `YCbCr` is a video space. It uses the BT.709 coefficients. Document
  this. Games that use BT.601 or BT.2020 need a different space.

### Tests

- Round-trip each new space through sRGB.
- Test known reference values. For example `hsl(0, 1, 0.5)` is red.
- Verify the D65 white point for `CIE_Lab`: `(100, 0, 0)`.
- Verify `YCbCr` of sRGB white is `(1, 0, 0)`.

## 2.4 HDR tone mapping

### Where

New file `src/color/tone-mapping.ts`.

### Public API

    toneMap<S>(
      color: ColorValue<S>,
      operator: ToneMapOperator,
      params?: ToneMapParams,
    ): ColorValue<typeof sRGB>

    type ToneMapOperator =
      | 'reinhard'
      | 'reinhard-extended'
      | 'aces-filmic'
      | 'agx'
      | 'exposure';

    interface ToneMapParams {
      readonly exposure?: number;         // EV, default 0
      readonly peakLuminance?: number;    // nits, default 10000
      readonly targetLuminance?: number;  // nits, default 100
    }

### Implementation

Convert the input to `Linear_Rec2020`. Apply the exposure multiplier:
`color * 2 ** exposure`. Apply the operator. Convert the result to sRGB.

Reinhard:

    L_out = L / (1 + L)

Reinhard extended:

    L_out = L * (1 + L / L_white**2) / (1 + L)

ACES filmic:

    The Narkowicz fit of the ACES curve.

    a = 2.51
    b = 0.03
    c = 2.43
    d = 0.59
    e = 0.14

    L_out = (L * (a * L + b)) / (L * (c * L + d) + e)

AgX:

    The Sobotka 2022 fit. Longer. Copy the reference implementation.

Exposure:

    Just multiply. No curve. Useful for capture and debugging.

### Edge cases

- Negative luminance. Clamp to 0 before the operator.
- Very large luminance. The operator should saturate gracefully.
- Alpha is copied unchanged.

### Tests

- Each operator at luminance 0 returns 0.
- Each operator at luminance 1 returns roughly 1 for Reinhard and ACES.
- Exposure operator doubles luminance at `exposure = 1`.
- Round-trip tone-mapped output fits in sRGB 0 to 1.

## Order of work

1. 2.3 More input spaces. Unblocks CSS parsing of `hsl()` and `oklch()`.
2. 2.1 CSS parser. Uses the new spaces.
3. 2.4 Tone mapping. Independent of the others.

## Definition of done

- Every new space has a JSDoc block and a `channelRanges` entry.
- The CSS parser handles every grammar form listed above.
- Tone mapping has a visual reference image in `docs/`.
- The README shows an HDR capture example.