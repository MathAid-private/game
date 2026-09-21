/**
 * @fileoverview Quantization and dithering for low-bit-depth targets.
 *
 * @summary
 * Provides `quantize` and `dither`. The first reduces a color to a
 * lower bit depth. The second spreads the quantization error across
 * neighboring pixels.
 *
 * @description
 * Quantization snaps each channel to the nearest level at a given bit
 * depth. On a smooth gradient, this creates visible bands. Dithering
 * breaks up the bands by adding a small threshold before quantizing.
 *
 * ```text
 *   No dither:              Bayer 4x4:
 *
 *   step  band  step        dot dot  dot  dot dot
 *   |     |     |           |   |    |    |   |
 *   |_____|_____|           |___|____|____|___|
 *
 *   Sharp edges.            Error is spread. Bands are hidden.
 * ```
 *
 * Two dithering modes are provided.
 *
 * ```text
 *   bayer             An ordered threshold matrix. Fast, deterministic.
 *                     Good for retro aesthetics and for animation.
 *   floyd-steinberg   Error diffusion. Slower, but higher quality.
 *                     Good for static images and for capture.
 * ```
 *
 * @see {@link https://en.wikipedia.org/wiki/Ordered_dithering} Ordered dithering
 * @see {@link https://en.wikipedia.org/wiki/Floyd%E2%80%93Steinberg_dithering} Floyd-Steinberg
 *
 * @author MathAid
 */

import { type ColorValue, convert, make } from './convert';
import { type ColorSpaceDef, sRGB } from './space';

// -----------------------------------------------------------------
//  Types
// -----------------------------------------------------------------

/**
 * @summary
 * The named quantization formats.
 *
 * @description
 * ```text
 *   rgb565       5 bits red, 6 green, 5 blue. No alpha.
 *   rgba4444     4 bits per channel.
 *   rgb1010102   10 bits per RGB, 2 for alpha.
 *   rgb332       3 bits red, 3 green, 2 blue. Retro.
 * ```
 */
export type QuantizeFormat = 'rgb565' | 'rgba4444' | 'rgb1010102' | 'rgb332';

/**
 * @summary
 * The dithering mode.
 *
 * @description
 * See the module JSDoc for a description of each mode.
 */
export type DitherMode = 'bayer' | 'floyd-steinberg' | 'none';

/**
 * @summary
 * Options for the `dither` function.
 *
 * @description
 * `matrixSize` applies to `bayer` only. Legal values are 2, 4, and 8.
 * The default is 4. Higher sizes give smoother gradients at the cost
 * of a more visible pattern.
 */
export interface DitherOptions {
  /** The dithering mode. */
  readonly mode: DitherMode;
  /** The Bayer matrix size. `2`, `4`, or `8`. Defaults to `4`. */
  readonly matrixSize?: 2 | 4 | 8;
}

// -----------------------------------------------------------------
//  Bayer matrices
// -----------------------------------------------------------------

/**
 * @summary
 * The 2x2 Bayer threshold matrix.
 *
 * @description
 * Normalized to the 0 to 1 range by dividing by `size * size`. The
 * constants below store the raw integer thresholds.
 */
const BAYER_2: readonly number[] = [0, 2, 3, 1];

/** @summary The 4x4 Bayer threshold matrix. */
const BAYER_4: readonly number[] = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** @summary The 8x8 Bayer threshold matrix. */
const BAYER_8: readonly number[] = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28,
  52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7,
  39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
];

function bayerMatrix(size: 2 | 4 | 8): readonly number[] {
  if (size === 2) return BAYER_2;
  if (size === 4) return BAYER_4;
  return BAYER_8;
}

// -----------------------------------------------------------------
//  Public API
// -----------------------------------------------------------------

/**
 * @summary
 * Quantize a color to a lower bit depth.
 *
 * @description
 * The function converts to sRGB. It rounds each channel to the nearest
 * level at the requested bit depth. When `bits` is a number, that many
 * bits apply to each channel. When `bits` is a `QuantizeFormat`, the
 * format's bit layout applies.
 *
 * The alpha channel is preserved at full precision when `bits` is a
 * number. The named formats handle alpha separately. `rgb565`,
 * `rgb1010102`, and `rgb332` discard alpha. `rgba4444` keeps 4 bits.
 *
 * @template S - The color space type.
 *
 * @param color - The source color.
 * @param bits - The bit depth per channel, or a named format.
 * @returns A new `ColorValue<typeof sRGB>`.
 *
 * @throws {Error} When `bits` is a number outside 1 to 8.
 *
 * @example
 * quantize(make(sRGB, 0.5, 0.5, 0.5), 4);       // 4-bit per channel
 * quantize(make(sRGB, 1, 0, 0), 'rgb565');      // 5-6-5 layout
 */
export function quantize<S extends ColorSpaceDef<string>>(
  color: ColorValue<S>,
  bits: number | QuantizeFormat,
): ColorValue<typeof sRGB> {
  const c = convert(color, sRGB);
  if (typeof bits === 'number') {
    if (bits < 1 || bits > 8) {
      throw new Error(`quantize: bits must be 1 to 8, got ${bits}.`);
    }
    const levels = 2 ** bits - 1;
    return make(
      sRGB,
      Math.round(c.c1 * levels) / levels,
      Math.round(c.c2 * levels) / levels,
      Math.round(c.c3 * levels) / levels,
      c.alpha,
    );
  }
  switch (bits) {
    case 'rgb565':
      return make(
        sRGB,
        Math.round(c.c1 * 31) / 31,
        Math.round(c.c2 * 63) / 63,
        Math.round(c.c3 * 31) / 31,
        c.alpha,
      );
    case 'rgba4444':
      return make(
        sRGB,
        Math.round(c.c1 * 15) / 15,
        Math.round(c.c2 * 15) / 15,
        Math.round(c.c3 * 15) / 15,
        Math.round(c.alpha * 15) / 15,
      );
    case 'rgb1010102':
      return make(
        sRGB,
        Math.round(c.c1 * 1023) / 1023,
        Math.round(c.c2 * 1023) / 1023,
        Math.round(c.c3 * 1023) / 1023,
        Math.round(c.alpha * 3) / 3,
      );
    case 'rgb332':
      return make(
        sRGB,
        Math.round(c.c1 * 7) / 7,
        Math.round(c.c2 * 7) / 7,
        Math.round(c.c3 * 3) / 3,
        c.alpha,
      );
  }
}

/**
 * @summary
 * Dither a rectangular region of colors.
 *
 * @description
 * The function takes a row-major array of colors and returns a dithered
 * array of the same shape. The image width and height must match the
 * array length: `colors.length === width * height`.
 *
 * `bayer` mode applies a fixed threshold from the matrix. It is fast
 * and deterministic. Each pixel is independent.
 *
 * `floyd-steinberg` mode diffuses the quantization error to four
 * neighbors. It must run in scan order. It produces higher-quality
 * results for static images.
 *
 * `none` mode returns the input quantized without dithering.
 *
 * The bit depth for the dithering is 8. That matches the common case
 * for screenshots and for texture compression preview.
 *
 * @template S - The color space type.
 *
 * @param colors - The input colors in row-major order.
 * @param width - The image width.
 * @param height - The image height.
 * @param options - The dithering options.
 * @returns A new array of `ColorValue<typeof sRGB>`.
 *
 * @throws {Error} When `colors.length !== width * height`.
 *
 * @example
 * const out = dither(pixels, 320, 240, { mode: 'bayer', matrixSize: 4 });
 */
export function dither<S extends ColorSpaceDef<string>>(
  colors: ReadonlyArray<ColorValue<S>>,
  width: number,
  height: number,
  options: DitherOptions,
): ReadonlyArray<ColorValue<typeof sRGB>> {
  if (colors.length !== width * height) {
    throw new Error(`dither: colors.length ${colors.length} does not match ${width} * ${height}.`);
  }

  const srgbColors = colors.map((c) => convert(c, sRGB));

  if (options.mode === 'none') {
    return srgbColors.map((c) => quantize(c, 'rgb565'));
  }

  if (options.mode === 'bayer') {
    const size = options.matrixSize ?? 4;
    const matrix = bayerMatrix(size);
    const denom = size * size;
    const out: ColorValue<typeof sRGB>[] = new Array(colors.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const c = srgbColors[i]!;
        const threshold = (matrix[(y % size) * size + (x % size)]! + 0.5) / denom;
        // Spread the threshold across one LSB of the 8-bit target.
        const step = 1 / 255;
        const offset = (threshold - 0.5) * step;
        out[i] = quantize(make(sRGB, c.c1 + offset, c.c2 + offset, c.c3 + offset, c.alpha), 'rgb565');
      }
    }
    return out;
  }

  // Floyd-Steinberg.
  const work: { r: number; g: number; b: number; a: number }[] = srgbColors.map((c) => ({
    r: c.c1,
    g: c.c2,
    b: c.c3,
    a: c.alpha,
  }));
  const out: ColorValue<typeof sRGB>[] = new Array(colors.length);
  const R_MAX = 31;
  const G_MAX = 63;
  const B_MAX = 31;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const p = work[i]!;
      const rq = Math.round(p.r * R_MAX) / R_MAX;
      const gq = Math.round(p.g * G_MAX) / G_MAX;
      const bq = Math.round(p.b * B_MAX) / B_MAX;
      out[i] = make(sRGB, rq, gq, bq, p.a);

      const er = p.r - rq;
      const eg = p.g - gq;
      const eb = p.b - bq;

      const spread = (dx: number, dy: number, w: number) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) return;
        const ni = ny * width + nx;
        const np = work[ni]!;
        np.r += er * w;
        np.g += eg * w;
        np.b += eb * w;
      };

      spread(1, 0, 7 / 16);
      spread(-1, 1, 3 / 16);
      spread(0, 1, 5 / 16);
      spread(1, 1, 1 / 16);
    }
  }
  return out;
}
