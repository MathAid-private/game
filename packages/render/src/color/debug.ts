/**
 * @fileoverview Development diagnostics.
 *
 * @summary
 * Provides `warnOutOfGamut` and `debugFormat`. Use these in dev
 * builds only. Production builds should tree-shake this module.
 *
 * @description
 * The module is guarded by a `NODE_ENV` check. In production the
 * functions are no-ops. Bundlers drop the entire module when the
 * check is statically resolvable.
 *
 * ```text
 *   warnOutOfGamut      Logs a console.warn when a color is outside
 *                       the target gamut.
 *
 *   debugFormat         Returns a multi-line string with the space,
 *                       the channels, and the gamut check.
 * ```
 *
 * @author MathAid
 */

import { type ColorValue, convert, format, isInRange } from './convert';
import { type ColorSpaceDef, sRGB } from './space';

declare const process: any;

// -----------------------------------------------------------------
//  Environment detection
// -----------------------------------------------------------------

/**
 * @summary
 * True when running in a production build.
 *
 * @description
 * The check is safe in browsers, in Node, and in edge runtimes. When
 * `process` is not defined (browsers), the value is false.
 */
const IS_PRODUCTION: boolean =
  typeof process !== 'undefined' &&
  typeof process.env !== 'undefined' &&
  process.env.NODE_ENV === 'production';

// -----------------------------------------------------------------
//  Warning cache
// -----------------------------------------------------------------

/**
 * @summary
 * Set of recently warned colors.
 *
 * @description
 * The cache stores a string key per warned color. It stops the same
 * color from being warned twice in a row. The cache is never cleared.
 * For a dev session this is fine. The cache is small.
 */
const warnedKeys = new Set<string>();

function cacheKey<S extends ColorSpaceDef<string>>(color: ColorValue<S>): string {
  return `${color._space.id}:${color.c1},${color.c2},${color.c3},${color.alpha}`;
}

// -----------------------------------------------------------------
//  Public API
// -----------------------------------------------------------------

/**
 * @summary
 * Warn when a color is outside the target gamut.
 *
 * @description
 * The function checks the color against the target space. When the
 * color is out of gamut, it logs a `console.warn`. The warning names
 * the source space, the target space, the channel values, and an
 * optional caller context.
 *
 * The function does nothing in production.
 *
 * @template S - The source color space type.
 *
 * @param color - The color to check.
 * @param targetSpace - The target space.
 * @param context - An optional label. Defaults to `'color'`.
 *
 * @example
 * warnOutOfGamut(wideColor, sRGB, 'sprite.tint');
 * // console.warn: [color] Display_P3 -> sRGB out of gamut: ...
 */
export function warnOutOfGamut<S extends ColorSpaceDef<string>>(
  color: ColorValue<S>,
  targetSpace: ColorSpaceDef<string>,
  context = 'color',
): void {
  if (IS_PRODUCTION) return;

  const converted = convert(color, targetSpace);
  if (isInRange(converted)) return;

  const key = cacheKey(color);
  if (warnedKeys.has(key)) return;
  warnedKeys.add(key);

  const src = color._space.id;
  const dst = targetSpace.id;
  console.warn(
    `[${context}] ${src} -> ${dst} out of gamut: ${format(color)}`,
  );
}

/**
 * @summary
 * Return a multi-line debug string for a color.
 *
 * @description
 * The string lists the space, the channel names, the channel values,
 * the legal range for each channel, and the sRGB gamut check. The
 * format is stable within a major version but may change between
 * versions.
 *
 * @template S - The color space type.
 *
 * @param color - The color to describe.
 * @returns A multi-line string.
 *
 * @example
 * console.log(debugFormat(make(sRGB, 1, 0, 0)));
 * // sRGB (IEC 61966-2-1) [R, G, B]
 * //   c1: 1.0000 [0, 1] ok
 * //   c2: 0.0000 [0, 1] ok
 * //   c3: 0.0000 [0, 1] ok
 * //   alpha: 1.0000 [0, 1] ok
 * //   in sRGB gamut: yes
 */
export function debugFormat<S extends ColorSpaceDef<string>>(
  color: ColorValue<S>,
): string {
  const d = color._space.descriptor;
  const names = d.channelNames;
  const ranges = d.channelRanges;

  const lines: string[] = [];
  lines.push(`${color._space.id} (${d.name}) [${names.join(', ')}]`);

  const channel = (label: string, v: number, min: number, max: number): string => {
    const status = v < min ? 'low' : v > max ? 'high' : 'ok';
    return `  ${label}: ${v.toFixed(4)} [${min}, ${max}] ${status}`;
  };

  lines.push(channel('c1', color.c1, ranges[0].min, ranges[0].max));
  lines.push(channel('c2', color.c2, ranges[1].min, ranges[1].max));
  lines.push(channel('c3', color.c3, ranges[2].min, ranges[2].max));
  lines.push(channel('alpha', color.alpha, 0, 1));

  const srgb = convert(color, sRGB);
  const inSRGB = isInRange(srgb);
  lines.push(`  in sRGB gamut: ${inSRGB ? 'yes' : 'no'}`);

  return lines.join('\n');
}

/**
 * @summary
 * Clear the warning cache.
 *
 * @description
 * Use this in tests to reset the cache between cases.
 *
 * @example
 * clearWarningCache();
 * warnOutOfGamut(wideColor, sRGB);
 * // Logs again.
 */
export function clearWarningCache(): void {
  warnedKeys.clear();
}