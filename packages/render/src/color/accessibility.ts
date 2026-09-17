/**
 * @fileoverview Luminance and contrast helpers.
 *
 * @summary
 * Provides `luminance`, `contrast`, `isLight`, `isDark`, and
 * `readableTextOn`. These follow the W3C WCAG 2.1 definitions.
 *
 * @description
 * The WCAG relative luminance formula is a weighted sum of the linear
 * sRGB channels. The weights match the human eye response. Green
 * contributes the most. Blue contributes the least.
 *
 * ```text
 *   Y = 0.2126 * R_lin + 0.7152 * G_lin + 0.0722 * B_lin
 * ```
 *
 * The WCAG contrast ratio compares two luminances. The ratio runs from
 * 1 (no contrast) to 21 (black on white). The formula is:
 *
 * ```text
 *   contrast = (L_light + 0.05) / (L_dark + 0.05)
 * ```
 *
 * The 0.05 offset models the eye response near zero light. It stops the
 * ratio from going to infinity for a pure black background.
 *
 * WCAG thresholds:
 *
 * ```text
 *   Normal text   4.5:1 minimum
 *   Large text    3.0:1 minimum
 *   UI borders    3.0:1 minimum
 * ```
 *
 * @see {@link https://www.w3.org/TR/WCAG21/#dfn-relative-luminance} WCAG relative luminance
 * @see {@link https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio} WCAG contrast ratio
 *
 * @author MathAid
 */

import { type ColorValue, convert, make } from './convert';
import { type ColorSpaceDef, Linear_sRGB, sRGB } from './space';

// -----------------------------------------------------------------
//  Luminance
// -----------------------------------------------------------------

/**
 * @summary
 * Return the WCAG relative luminance of a color.
 *
 * @description
 * The function converts the input to `Linear_sRGB`. It then applies the
 * WCAG weighted sum. The result runs from 0 (black) to 1 (white).
 *
 * Colors outside the sRGB gamut are clamped first. The luminance is
 * defined only for visible colors. An HDR value of 10 has no meaning
 * for a display contrast check.
 *
 * Alpha is ignored. Compose the color over a backdrop first if you need
 * the effective luminance of a translucent color.
 *
 * @template S - The color space type.
 *
 * @param color - The color to measure.
 * @returns The relative luminance, 0 to 1.
 *
 * @example
 * luminance(make(sRGB, 1, 1, 1));  // 1
 * luminance(make(sRGB, 0, 0, 0));  // 0
 * luminance(make(sRGB, 1, 0, 0));  // about 0.2126
 */
export function luminance<S extends ColorSpaceDef<string>>(color: ColorValue<S>): number {
  const lin = convert(color, Linear_sRGB);
  const r = Math.max(0, Math.min(1, lin.r));
  const g = Math.max(0, Math.min(1, lin.g));
  const b = Math.max(0, Math.min(1, lin.b));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// -----------------------------------------------------------------
//  Contrast
// -----------------------------------------------------------------

/**
 * @summary
 * Return the WCAG contrast ratio between two colors.
 *
 * @description
 * The function computes the luminance of each color. It then applies
 * the WCAG ratio formula. The result runs from 1 to 21.
 *
 * The order of the arguments does not matter. The function picks the
 * lighter and darker luminance internally.
 *
 * @template A - The first color space type.
 * @template B - The second color space type.
 *
 * @param a - The first color.
 * @param b - The second color.
 * @returns The contrast ratio, 1 to 21.
 *
 * @example
 * contrast(make(sRGB, 1, 1, 1), make(sRGB, 0, 0, 0));  // 21
 * contrast(make(sRGB, 0.5, 0.5, 0.5), make(sRGB, 0.5, 0.5, 0.5));  // 1
 */
export function contrast<
  A extends ColorSpaceDef<string>,
  B extends ColorSpaceDef<string>,
>(a: ColorValue<A>, b: ColorValue<B>): number {
  const la = luminance(a);
  const lb = luminance(b);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

// -----------------------------------------------------------------
//  Light or dark
// -----------------------------------------------------------------

/**
 * @summary
 * Return true when a color is light.
 *
 * @description
 * The function uses a luminance threshold of 0.5. Colors above the
 * threshold are light. Colors at or below are dark.
 *
 * The 0.5 threshold is a simple rule. The WCAG contrast ratio is a more
 * accurate test when readability matters. Use `readableTextOn` for that
 * case.
 *
 * @template S - The color space type.
 *
 * @param color - The color to test.
 * @returns True when the luminance is above 0.5.
 *
 * @example
 * isLight(make(sRGB, 1, 1, 1));  // true
 * isLight(make(sRGB, 0, 0, 0));  // false
 */
export function isLight<S extends ColorSpaceDef<string>>(color: ColorValue<S>): boolean {
  return luminance(color) > 0.5;
}

/**
 * @summary
 * Return true when a color is dark.
 *
 * @description
 * This is the inverse of `isLight`. The boundary at luminance 0.5 is
 * shared. A color at exactly 0.5 is neither light nor dark by this
 * rule.
 *
 * @template S - The color space type.
 *
 * @param color - The color to test.
 * @returns True when the luminance is at most 0.5.
 *
 * @example
 * isDark(make(sRGB, 1, 1, 1));  // false
 * isDark(make(sRGB, 0, 0, 0));  // true
 */
export function isDark<S extends ColorSpaceDef<string>>(color: ColorValue<S>): boolean {
  return !isLight(color);
}

// -----------------------------------------------------------------
//  Text recommendation
// -----------------------------------------------------------------

/**
 * @summary
 * Return black or white sRGB text for a given background.
 *
 * @description
 * The function compares the contrast ratio of black text and white text
 * against the background. It returns whichever color has the higher
 * ratio. The result is always `sRGB` with alpha 1.
 *
 * This gives readable text on any background. It does not respect a
 * brand palette. Use it as a fallback when no palette is defined.
 *
 * @template S - The color space type.
 *
 * @param background - The background color.
 * @returns Black or white sRGB.
 *
 * @example
 * readableTextOn(make(sRGB, 1, 1, 1));  // sRGB(0, 0, 0, 1)
 * readableTextOn(make(sRGB, 0, 0, 0));  // sRGB(1, 1, 1, 1)
 */
export function readableTextOn<S extends ColorSpaceDef<string>>(
  background: ColorValue<S>,
): ColorValue<typeof sRGB> {
  const black = make(sRGB, 0, 0, 0);
  const white = make(sRGB, 1, 1, 1);
  const onBlack = contrast(background, black);
  const onWhite = contrast(background, white);
  return onBlack >= onWhite ? black : white;
}