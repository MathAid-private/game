# Milestone 4: Retro and Advanced

## Goal

Serve low-bit-depth targets and advanced pipelines. Quantization for
retro rendering. Chromatic adaptation for D50 pipelines. Log spaces for
film ingestion.

## Features

- 2.5 Quantization and dithering
- 3.1 Chromatic adaptation
- 3.2 Log color spaces

## 2.5 Quantization and dithering

### Where

New file `src/color/quantize.ts`.

### Public API

    quantize<S>(color: ColorValue<S>, bits: number | QuantizeFormat): ColorValue<typeof sRGB>
    dither<S>(
      colors: ReadonlyArray<ColorValue<S>>,
      width: number,
      height: number,
      options: DitherOptions,
    ): ReadonlyArray<ColorValue<typeof sRGB>>

    type QuantizeFormat = 'rgb565' | 'rgba4444' | 'rgb1010102' | 'rgb332';

    interface DitherOptions {
      readonly mode: 'bayer' | 'floyd-steinberg' | 'none';
      readonly matrixSize?: 2 | 4 | 8;
    }

### Implementation

`quantize` is the same as `Math.round(v * levels) / levels` per channel.
`levels = 2 ** bits - 1`. For named formats, look up the bit counts.

`dither` with Bayer uses a precomputed threshold matrix. Add the
threshold before quantizing. The 2x2, 4x4, and 8x8 Bayer matrices are
constants.

`dither` with Floyd-Steinberg walks the image in scan order. Each pixel
distributes its error to four neighbors with weights 7/16, 3/16, 5/16,
and 1/16.

### Edge cases

- Zero bits. Throw.
- More than 8 bits. Return the input unchanged.
- Dither with a matrix larger than the image. Wrap or clamp. Document.
- Alpha channel. Quantize separately at 4 or 8 bits.

### Tests

- Quantize red to 565. The result has a red channel in 0, 1/31, ..., 1.
- Bayer dithering of a gray ramp produces a periodic pattern.
- Floyd-Steinberg reduces banding on a smooth gradient.
- Every output value is exactly representable in the target format.

## 3.1 Chromatic adaptation

### Where

New file `src/color/adaptation.ts`.

### Public API

    adapt<S>(
      color: ColorValue<S>,
      fromWhite: WhitePoint,
      toWhite: WhitePoint,
      method?: AdaptationMethod,
    ): ColorValue<S>

    type AdaptationMethod = 'bradford' | 'von-kries' | 'cat02' | 'xyz-scaling';

    type WhitePoint = 'D50' | 'D55' | 'D65' | 'D93' | 'E' | 'A' | 'C';

### Implementation

Each method is a 3 by 3 matrix. Compute the matrix from the source and
target white points.

    M = M_to_cone^-1 * diag(target_cone / source_cone) * M_to_cone

`M_to_cone` is the method's cone response matrix. `source_cone` and
`target_cone` are the method matrix applied to the white points.

The Bradford matrix is the industry default.

    M_bradford = [
      0.8951,  0.2664, -0.1614,
     -0.7502,  1.7135,  0.0367,
      0.0389, -0.0685,  1.0296,
    ]

### Edge cases

- Same white point in and out. Return the input.
- `XYZ_D65` to `XYZ_D65`. No-op.
- Unknown method. Throw.

### Tests

- `adapt(c, 'D65', 'D65')` returns the input.
- `adapt(c, 'D65', 'D50')` then `adapt(c, 'D50', 'D65')` returns `c`
  within float error.
- The D65 white point adapted to D50 matches the known value
  `(0.9642, 1.0, 0.8249)`.

## 3.2 Log color spaces

### Where

Extend `src/color/space.ts`.

### New spaces

    ACEScct     ACES with a Cineon-style log curve.
    ACEScc      ACES with a pure log curve.
    LogC3       ARRI LogC version 3.

### Implementation

Each space has a transfer pair in `space.ts`. The `toXYZ` and `fromXYZ`
matrices reuse the ACES AP1 or the ARRI Wide Gamut matrices.

ACEScct transfer:

    eotf:
      if v > 0.155251141552511:
        (10 ** ((v - 0.0729055341958355) / 0.0570776252050058) - 0.0) * 0.18
      else:
        (v - 0.0729055341958355) / 10.5402377416545

    oetf:
      if v <= 0.0078125:
        10.5402377416545 * v + 0.0729055341958355
      else:
        log10(v / 0.18) * 0.0570776252050058 + 0.0729055341958355

LogC3 transfer: copy the published ARRI curve. It is a piecewise
function with six coefficients.

### Edge cases

- Values below the linear segment threshold. Use the linear branch.
- Values above the log segment threshold. Use the log branch.
- Negative inputs. Clamp to 0 or return the linear segment value.

### Tests

- Round-trip log space to linear and back.
- Known ARRI reference values for LogC3.
- `ACEScct` of 0.18 linear is 0.413588.

## Order of work

1. 2.5 Quantization. Independent. Ship first.
2. 3.1 Chromatic adaptation. Uses existing matrix helpers.
3. 3.2 Log color spaces. Last. Each curve is its own formula.

## Definition of done

- Every new space has a JSDoc block and a matrix.
- Quantization has visual reference images for dithering modes.
- Adaptation round-trips are exact within float error.
- The README shows a retro quantize example and a D50 workflow example.