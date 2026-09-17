# Milestone 1: Foundation

## Goal

Fill the gaps that every game hits. Color math helpers, alpha
compositing, difference metrics, accessibility, and immutable setters.
Add the `MutableColor` type. Close the Vulkan mapping gap.

## Features

- 1.1 Color operations
- 1.2 Alpha compositing
- 1.4 Public Delta-E
- 1.5 Luminance and contrast
- 1.6 Immutable channel setters
- 1.7 Mutable color type
- 1.8 Vulkan mapping for `Linear_Rec2020`

## 1.1 Color operations

### Where

New file `src/color/operations.ts`.

### Public API

    lighten<S>(color: ColorValue<S>, amount: number): ColorValue<typeof OKLCh>
    darken<S>(color: ColorValue<S>, amount: number): ColorValue<typeof OKLCh>
    saturate<S>(color: ColorValue<S>, amount: number): ColorValue<typeof OKLCh>
    desaturate<S>(color: ColorValue<S>, amount: number): ColorValue<typeof OKLCh>
    rotateHue<S>(color: ColorValue<S>, degrees: number): ColorValue<typeof OKLCh>
    invert<S>(color: ColorValue<S>): ColorValue<S>
    grayscale<S>(color: ColorValue<S>): ColorValue<S>
    complement<S>(color: ColorValue<S>): ColorValue<typeof OKLCh>

### Implementation

Every operation works in OKLCh. That is the perceptual space. The
pattern is:

    export function lighten<S extends ColorSpaceDef<string>>(
      color: ColorValue<S>,
      amount: number,
    ): ColorValue<typeof OKLCh> {
      const lch = convert(color, OKLCh);
      return make(OKLCh, clamp01(lch.r + amount), lch.g, lch.b, lch.a);
    }

`clamp01` is a private helper. It clamps a number to 0 to 1.

`rotateHue` wraps the hue angle. Use `((H + degrees) % 360 + 360) % 360`.

`invert` works in the source space. Each channel becomes `max - v` where
`max` is the channel's upper bound.

`grayscale` sets OKLCh chroma to 0. It returns a value in the source
space.

`complement` calls `rotateHue` with 180 degrees.

### Edge cases

- Negative `amount` on `lighten` calls `darken`. Document this.
- `rotateHue` accepts any real number, including negative and large.
- `invert` on a non-RGB space follows the same rule per channel.
- `grayscale` on an already-gray color returns the same channels.

### Tests

File `src/color/operations.test.ts`. Cover:

- Each function with a mid-range input.
- Boundary values (0, 1, out-of-range).
- Round-trip: `invert(invert(c))` equals `c`.
- `lighten` and `darken` are inverses within float error.
- `complement(complement(c))` returns the original hue.

## 1.2 Alpha compositing

### Where

New file `src/color/composite.ts`.

### Public API

    over<Src, Dst>(src: ColorValue<Src>, dst: ColorValue<Dst>): ColorValue<Dst>
    under<Src, Dst>(src: ColorValue<Src>, dst: ColorValue<Dst>): ColorValue<Dst>
    premultiply<S>(color: ColorValue<S>): ColorValue<S>
    unpremultiply<S>(color: ColorValue<S>): ColorValue<S>
    withAlpha<S>(color: ColorValue<S>, a: number): ColorValue<S>

### Implementation

`over` uses the Porter-Duff source-over rule.

    out_a = src_a + dst_a * (1 - src_a)
    out_c = (src_c * src_a + dst_c * dst_a * (1 - src_a)) / out_a

Guard against `out_a == 0`.

Both colors are converted to a common working space first. Use `dst`'s
space as the result space.

`premultiply` multiplies `r`, `g`, `b` by `a`. `unpremultiply` divides
by `a`. Guard against `a == 0`.

### Edge cases

- Fully transparent source. Return `dst`.
- Fully transparent destination. Return `src`.
- Zero alpha in `unpremultiply`. Return the input unchanged.
- Colors in different spaces. Convert before compositing.

### Tests

- `over` with alpha 1 returns the source.
- `over` with alpha 0 returns the destination.
- `premultiply(unpremultiply(c))` equals `c`.
- `over` is associative when all alphas are 1.

## 1.4 Public Delta-E

### Where

New file `src/color/difference.ts`.

### Public API

    deltaEOK<A, B>(a: ColorValue<A>, b: ColorValue<B>): number
    deltaE2000<A, B>(a: ColorValue<A>, b: ColorValue<B>): number
    deltaE76<A, B>(a: ColorValue<A>, b: ColorValue<B>): number
    deltaEITP<A, B>(a: ColorValue<A>, b: ColorValue<B>): number

### Implementation

`deltaEOK` is the current private `deltaEOKLab`. Move it here and export
it.

`deltaE76` is Euclidean distance in CIE Lab. Convert both colors to CIE
Lab first. Use a D65 white point.

`deltaE2000` is the full CIEDE2000 formula. It is long. Copy the
published reference implementation. Add tests against the Sharma test
vectors.

`deltaEITP` is the Dolby ICtCp distance. Convert to ICtCp and take the
weighted Euclidean distance.

### Edge cases

- Identical inputs. Return 0.
- Large HDR values. Clamp the result or let it grow.
- Colors outside the visible spectrum. Do not clamp before computing.

### Tests

File `src/color/difference.test.ts`. Use the Sharma test vectors for
CIEDE2000. They are a public dataset.

## 1.5 Luminance and contrast

### Where

New file `src/color/accessibility.ts`.

### Public API

    luminance<S>(color: ColorValue<S>): number
    contrast<A, B>(a: ColorValue<A>, b: ColorValue<B>): number
    isLight<S>(color: ColorValue<S>): boolean
    isDark<S>(color: ColorValue<S>): boolean
    readableTextOn<S>(color: ColorValue<S>): ColorValue<typeof sRGB>

### Implementation

`luminance` uses the WCAG relative luminance formula.

    Convert to Linear_sRGB.
    Y = 0.2126 * r + 0.7152 * g + 0.0722 * b

`contrast` uses the WCAG formula.

    L1 = max(lum_a, lum_b)
    L2 = min(lum_a, lum_b)
    contrast = (L1 + 0.05) / (L2 + 0.05)

`isLight` returns `luminance > 0.5`.

`readableTextOn` returns sRGB black or white based on `isLight`.

### Edge cases

- Colors outside the sRGB gamut. Clamp before the luminance formula.
- Alpha is ignored. Compose over a known backdrop first if needed.

### Tests

- WCAG reference values: `#FFFFFF` vs `#000000` gives 21:1.
- `#FFFFFF` luminance is 1.0.
- `readableTextOn` on white returns black.

## 1.6 Immutable channel setters

### Where

Extend `src/color/convert.ts`.

### Public API

    withChannel<S, C extends 'r' | 'g' | 'b'>(
      color: ColorValue<S>,
      channel: C,
      value: number,
    ): ColorValue<S>

    withAlpha<S>(color: ColorValue<S>, a: number): ColorValue<S>

### Implementation

Build a new object. Copy the other channels. Keep the space tag.

    export function withChannel<S, C extends 'r' | 'g' | 'b'>(
      color: ColorValue<S>,
      channel: C,
      value: number,
    ): ColorValue<S> {
      const out = { ...color };
      (out as Record<C, number>)[channel] = value;
      return out;
    }

`withAlpha` is a thin wrapper over `withChannel` with the `a` field.

### Tests

- Each channel setter preserves the other channels.
- The space tag is preserved.
- The original object is not mutated.

## 1.7 Mutable color type

### Where

New file `src/color/mutable.ts`.

### Public API

    interface MutableColor<S extends ColorSpaceDef<string>> {
      r: number;
      g: number;
      b: number;
      a: number;
      readonly _space: S;
    }

    toMutable<S>(color: ColorValue<S>): MutableColor<S>
    toImmutable<S>(color: MutableColor<S>): ColorValue<S>

### Implementation

`MutableColor<S>` is the same shape as `ColorValue<S>` but with mutable
fields. The `_space` field stays read-only. The space tag must not
change. That is the whole point of the type.

`toMutable` returns a fresh object with copied values. The input is not
aliased.

`toImmutable` returns a fresh object with copied values. This gives a
snapshot. The mutable object can keep changing after the snapshot.

### Design note

Do not add mutating methods to `ColorValue`. Keep the immutable path
default. Mutable values are opt-in.

### Tests

- `toMutable` does not alias the input.
- `toImmutable` does not alias the input.
- Mutating a `MutableColor` does not change the original `ColorValue`.
- The space tag carries through both conversions.

## 1.8 Vulkan mapping for `Linear_Rec2020`

### Where

Extend `src/color/backend.ts`. Add one entry to `Vulkan.colorSpaceEnum`.

### Implementation

Use `VK_COLOR_SPACE_EXTENDED_SRGB_LINEAR_EXT` is wrong. That is a
scRGB-like space with linear encoding and a different transfer.

`VK_COLOR_SPACE_HDR10_ST2084_EXT` is wrong. That is PQ, which is
non-linear.

`VK_COLOR_SPACE_PASS_THROUGH_EXT` is the honest choice. The driver
passes the values through. The shader is responsible for the correct
interpretation.

Add this entry.

    Linear_Rec2020: 'VK_COLOR_SPACE_PASS_THROUGH_EXT',

Add a JSDoc note to the `Vulkan` constant. State that `Linear_Rec2020`
uses pass-through. The render pass must be set up to match.

Update the `Vulkan` docs to remove the "throws for `Linear_Rec2020`"
warning.

### Tests

- `Vulkan.colorSpaceEnum('Linear_Rec2020')` returns
  `'VK_COLOR_SPACE_PASS_THROUGH_EXT'`.
- The existing throw test for `Linear_Rec2020` is removed.

## Order of work

1. 1.6 Immutable setters. Smallest. No dependencies.
2. 1.7 Mutable color type. Depends on 1.6 for the shape.
3. 1.8 Vulkan mapping. Small.
4. 1.5 Accessibility. Depends on `convert` only.
5. 1.4 Delta-E. Extract the private helper first.
6. 1.1 Color operations. Depends on 1.4 for hue-preserving tests.
7. 1.2 Alpha compositing. Largest. Last.

## Definition of done

- Every public API has a JSDoc block with `@summary` and
  `@description`.
- Every public function has a test file with the cases listed above.
- The barrel `src/color/index.ts` re-exports every new file.
- `npm test` passes with zero failures.
- The README has a short section for each new file.