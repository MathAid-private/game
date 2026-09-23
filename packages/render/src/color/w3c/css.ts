/**
 * @fileoverview CSS color parsing and serialization.
 *
 * @summary
 * Provides `fromCSS` and `toCSS`. The parser covers the CSS Color 4
 * functional forms and the named colors. The serializer emits hex,
 * rgb, hsl, oklch, display-p3, and rec2020 forms.
 *
 * @description
 * The parser is a small recursive-descent parser. It avoids regex for
 * tokenizing the grammar, not for whitespace splitting. The CSS
 * grammar has nested functions and optional commas. A regex would
 * be fragile.
 *
 * ```text
 *   Supported input forms:
 *
 *   #RGB           #RGBA           #RRGGBB         #RRGGBBAA
 *   rgb(r, g, b)   rgb(r g b)      rgb(r g b / a)
 *   rgba(...)      same as rgb with explicit alpha
 *   hsl(h, s%, l%) hsl(h s% l% / a)
 *   hsla(...)      same as hsl
 *   oklch(l c h)   oklch(l c h / a)
 *   color(display-p3 r g b / a)
 *   <named-color>  for example "red" or "rebeccapurple"
 * ```
 *
 * @see {@link https://www.w3.org/TR/css-color-4/} CSS Color 4
 *
 * @author MathAid
 */

import { type ColorValue, convert, make } from '../convert';
import { type ColorSpaceDef, Display_P3, HSL, Linear_Rec2020, OKLCh, sRGB } from '../space';
import { CSS_NAMED_COLORS } from './css-named';

// -----------------------------------------------------------------
//  Output format
// -----------------------------------------------------------------

/**
 * @summary
 * The CSS output formats supported by `toCSS`.
 *
 * @description
 * `hex` uses `#RRGGBB` or `#RRGGBBAA`. `rgb` uses `rgb(...)` or
 * `rgba(...)`. `hsl` uses `hsl(...)`. `oklch` uses `oklch(...)`.
 * `color-display-p3` uses `color(display-p3 ...)`. `color-rec2020`
 * uses `color(rec2020 ...)`.
 */
export type CSSFormat = 'hex' | 'rgb' | 'hsl' | 'oklch' | 'color-display-p3' | 'color-rec2020';

// -----------------------------------------------------------------
//  Parser
// -----------------------------------------------------------------

/**
 * @summary
 * Parse a CSS color string into a `ColorValue`.
 *
 * @description
 * The function accepts hex, the `rgb`, `hsl`, `oklch`, and `color`
 * functions, and the CSS named colors. Whitespace and commas are
 * accepted in every functional form.
 *
 * The output space depends on the input. `rgb()` and `hsl()` return
 * sRGB. `oklch()` returns OKLCh. `color(display-p3 ...)` returns
 * Display P3. `color(rec2020 ...)` returns `Linear_Rec2020`.
 *
 * @param input - The CSS color string.
 * @returns A `ColorValue` in a natural space for the input form.
 *
 * @throws {Error} When the input does not match any supported form.
 *
 * @example
 * fromCSS('#f80');                  // sRGB red-orange
 * fromCSS('rgb(255 128 0)');        // same color
 * fromCSS('hsl(30 100% 50%)');      // same color
 * fromCSS('oklch(0.7 0.15 60)');    // OKLCh
 * fromCSS('color(display-p3 1 0.5 0)');
 * fromCSS('rebeccapurple');
 */
export function fromCSS(input: string): ColorValue<ColorSpaceDef<string>> {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new Error('fromCSS: the input is empty.');
  }

  const lower = trimmed.toLowerCase();

  // Named colors.
  const named = CSS_NAMED_COLORS[lower];
  if (named) return fromHexInternal(named);

  // Hex.
  if (trimmed.startsWith('#')) return fromHexInternal(trimmed);

  // Functional forms.
  const open = trimmed.indexOf('(');
  if (open < 0 || !trimmed.endsWith(')')) {
    throw new Error(`fromCSS: "${input}" is not a recognized form.`);
  }
  const fn = trimmed.slice(0, open).trim().toLowerCase();
  const args = trimmed.slice(open + 1, -1);

  switch (fn) {
    case 'rgb':
    case 'rgba':
      return parseRgb(args);
    case 'hsl':
    case 'hsla':
      return parseHsl(args);
    case 'oklch':
      return parseOklch(args);
    case 'color':
      return parseColorFunction(args);
    default:
      throw new Error(`fromCSS: unknown function "${fn}".`);
  }
}

// -----------------------------------------------------------------
//  Argument splitting
// -----------------------------------------------------------------

/**
 * @summary
 * Split a CSS argument string into a main list and an optional alpha.
 *
 * @description
 * The function accepts both comma-separated and space-separated forms.
 * The alpha part is separated by a slash.
 *
 * @param args - The raw argument string.
 * @returns The main parts and the alpha string, or undefined.
 */
function splitArgs(args: string): { parts: string[]; alpha?: string } {
  const slash = args.indexOf('/');
  const main = slash < 0 ? args : args.slice(0, slash);
  const alpha = slash < 0 ? undefined : args.slice(slash + 1).trim();
  const parts = main
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return { parts, alpha };
}

/**
 * @summary
 * Parse a number. Supports a `%` suffix.
 *
 * @param s - The raw string.
 * @param ref - The reference for percentage. `50%` becomes `ref * 0.5`.
 * @returns The parsed number.
 */
function numOrPct(s: string, ref = 1): number {
  if (s.endsWith('%')) {
    const v = parseFloat(s.slice(0, -1));
    if (Number.isNaN(v)) throw new Error(`fromCSS: bad percentage "${s}".`);
    return (v / 100) * ref;
  }
  const v = parseFloat(s);
  if (Number.isNaN(v)) throw new Error(`fromCSS: bad number "${s}".`);
  return v;
}

/**
 * @summary
 * Parse a hue. Supports `deg`, `rad`, `grad`, and `turn`.
 *
 * @param s - The raw string.
 * @returns The hue in degrees.
 */
function parseHue(s: string): number {
  const lower = s.toLowerCase();
  if (lower.endsWith('deg')) return parseFloat(lower.slice(0, -3));
  if (lower.endsWith('rad')) return (parseFloat(lower.slice(0, -3)) * 180) / Math.PI;
  if (lower.endsWith('grad')) return parseFloat(lower.slice(0, -4)) * 0.9;
  if (lower.endsWith('turn')) return parseFloat(lower.slice(0, -4)) * 360;
  return parseFloat(lower);
}

// -----------------------------------------------------------------
//  Individual parsers
// -----------------------------------------------------------------

function fromHexInternal(hex: string): ColorValue<typeof sRGB> {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  let r: number;
  let g: number;
  let b: number;
  let a = 1;
  if (h.length === 3) {
    r = parseInt(h[0]! + h[0]!, 16) / 255;
    g = parseInt(h[1]! + h[1]!, 16) / 255;
    b = parseInt(h[2]! + h[2]!, 16) / 255;
  } else if (h.length === 4) {
    r = parseInt(h[0]! + h[0]!, 16) / 255;
    g = parseInt(h[1]! + h[1]!, 16) / 255;
    b = parseInt(h[2]! + h[2]!, 16) / 255;
    a = parseInt(h[3]! + h[3]!, 16) / 255;
  } else if (h.length === 6) {
    r = parseInt(h.slice(0, 2), 16) / 255;
    g = parseInt(h.slice(2, 4), 16) / 255;
    b = parseInt(h.slice(4, 6), 16) / 255;
  } else if (h.length === 8) {
    r = parseInt(h.slice(0, 2), 16) / 255;
    g = parseInt(h.slice(2, 4), 16) / 255;
    b = parseInt(h.slice(4, 6), 16) / 255;
    a = parseInt(h.slice(6, 8), 16) / 255;
  } else {
    throw new Error(`fromCSS: bad hex "${hex}".`);
  }
  if ([r, g, b, a].some((v) => Number.isNaN(v))) {
    throw new Error(`fromCSS: non-hex characters in "${hex}".`);
  }
  return make(sRGB, r, g, b, a);
}

function parseRgb(args: string): ColorValue<typeof sRGB> {
  const { parts, alpha } = splitArgs(args);
  if (parts.length !== 3) {
    throw new Error(`fromCSS: rgb needs 3 values, got ${parts.length}.`);
  }
  const channel = (s: string): number => {
    if (s.endsWith('%')) return numOrPct(s, 1);
    return numOrPct(s, 1) / 255;
  };
  const r = channel(parts[0]!);
  const g = channel(parts[1]!);
  const b = channel(parts[2]!);
  const a = alpha === undefined ? 1 : numOrPct(alpha, 1);
  return make(sRGB, r, g, b, a);
}

function parseHsl(args: string): ColorValue<typeof sRGB> {
  const { parts, alpha } = splitArgs(args);
  if (parts.length !== 3) {
    throw new Error(`fromCSS: hsl needs 3 values, got ${parts.length}.`);
  }
  const h = parseHue(parts[0]!);
  const s = numOrPct(parts[1]!, 1);
  const l = numOrPct(parts[2]!, 1);
  const a = alpha === undefined ? 1 : numOrPct(alpha, 1);
  // Store as HSL with alpha. Convert to sRGB for the return.
  const hslColor = make(HSL, h, s, l, a);
  return convertToSrgb(hslColor);
}

function parseOklch(args: string): ColorValue<typeof OKLCh> {
  const { parts, alpha } = splitArgs(args);
  if (parts.length !== 3) {
    throw new Error(`fromCSS: oklch needs 3 values, got ${parts.length}.`);
  }
  const l = numOrPct(parts[0]!, 1);
  const c = parseFloat(parts[1]!);
  const h = parseHue(parts[2]!);
  const a = alpha === undefined ? 1 : numOrPct(alpha, 1);
  return make(OKLCh, l, c, h, a);
}

function parseColorFunction(args: string): ColorValue<ColorSpaceDef<string>> {
  const { parts, alpha } = splitArgs(args);
  if (parts.length !== 4) {
    throw new Error(`fromCSS: color() needs 4 values, got ${parts.length}.`);
  }
  const space = parts[0]!.toLowerCase();
  const r = parseFloat(parts[1]!);
  const g = parseFloat(parts[2]!);
  const b = parseFloat(parts[3]!);
  const a = alpha === undefined ? 1 : numOrPct(alpha, 1);
  if (space === 'display-p3') return make(Display_P3, r, g, b, a);
  if (space === 'rec2020') return make(Linear_Rec2020, r, g, b, a);
  if (space === 'srgb') return make(sRGB, r, g, b, a);
  throw new Error(`fromCSS: unknown color space "${space}".`);
}

function convertToSrgb<S extends ColorSpaceDef<string>>(c: ColorValue<S>): ColorValue<typeof sRGB> {
  return convert(c, sRGB);
}

// -----------------------------------------------------------------
//  Serializer
// -----------------------------------------------------------------

/**
 * @summary
 * Serialize a `ColorValue` to a CSS string.
 *
 * @description
 * The function converts the input to the output space and formats the
 * string. The output is compatible with CSS Color 4.
 *
 * When `format` is omitted, the function picks a default. sRGB colors
 * with alpha 1 use `hex`. Other colors use `rgb` or the natural space
 * function.
 *
 * @template S - The source color space type.
 *
 * @param color - The color to serialize.
 * @param format - The output format. Optional.
 * @returns A CSS color string.
 *
 * @example
 * toCSS(make(sRGB, 1, 0, 0));               // "#ff0000"
 * toCSS(make(sRGB, 1, 0, 0, 0.5), 'rgb');   // "rgb(255 0 0 / 0.5)"
 * toCSS(make(Display_P3, 1, 0.5, 0), 'color-display-p3');
 */
export function toCSS<S extends ColorSpaceDef<string>>(
  color: ColorValue<S>,
  format?: CSSFormat,
): string {
  const f = format ?? defaultFormat(color);
  switch (f) {
    case 'hex':
      return toHexCSS(color);
    case 'rgb':
      return toRgbCSS(color);
    case 'hsl':
      return toHslCSS(color);
    case 'oklch':
      return toOklchCSS(color);
    case 'color-display-p3':
      return toColorFunctionCSS(color, Display_P3, 'display-p3');
    case 'color-rec2020':
      return toColorFunctionCSS(color, Linear_Rec2020, 'rec2020');
  }
}

function defaultFormat<S extends ColorSpaceDef<string>>(color: ColorValue<S>): CSSFormat {
  if (color._space.id === 'sRGB' && color.alpha === 1) return 'hex';
  if (color._space.id === 'OKLCh') return 'oklch';
  if (color._space.id === 'Display_P3') return 'color-display-p3';
  return 'rgb';
}

function toHexCSS<S extends ColorSpaceDef<string>>(color: ColorValue<S>): string {
  const c = convert(color, sRGB);
  const hex = (v: number) =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, '0');
  const r = hex(c.c1);
  const g = hex(c.c2);
  const b = hex(c.c3);
  if (c.alpha === 1) return `#${r}${g}${b}`;
  const a = hex(c.alpha);
  return `#${r}${g}${b}${a}`;
}

function toRgbCSS<S extends ColorSpaceDef<string>>(color: ColorValue<S>): string {
  const c = convert(color, sRGB);
  const scale = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  const r = scale(c.c1);
  const g = scale(c.c2);
  const b = scale(c.c3);
  if (c.alpha === 1) return `rgb(${r} ${g} ${b})`;
  return `rgb(${r} ${g} ${b} / ${c.alpha.toFixed(3).replace(/\.?0+$/, '')})`;
}

function toHslCSS<S extends ColorSpaceDef<string>>(color: ColorValue<S>): string {
  const h = convert(color, HSL);
  const hh = Math.round(h.c1);
  const ss = (h.c2 * 100).toFixed(1).replace(/\.0$/, '');
  const ll = (h.c3 * 100).toFixed(1).replace(/\.0$/, '');
  if (h.alpha === 1) return `hsl(${hh} ${ss}% ${ll}%)`;
  return `hsl(${hh} ${ss}% ${ll}% / ${h.alpha.toFixed(3).replace(/\.?0+$/, '')})`;
}

function toOklchCSS<S extends ColorSpaceDef<string>>(color: ColorValue<S>): string {
  const c = convert(color, OKLCh);
  const l = c.c1.toFixed(4).replace(/\.?0+$/, '');
  const ch = c.c2.toFixed(4).replace(/\.?0+$/, '');
  const h = c.c3.toFixed(2).replace(/\.?0+$/, '');
  if (c.alpha === 1) return `oklch(${l} ${ch} ${h})`;
  return `oklch(${l} ${ch} ${h} / ${c.alpha.toFixed(3).replace(/\.?0+$/, '')})`;
}

function toColorFunctionCSS<S extends ColorSpaceDef<string>, T extends ColorSpaceDef<string>>(
  color: ColorValue<S>,
  space: T,
  name: string,
): string {
  const c = convert(color, space);
  const f = (v: number) => v.toFixed(4).replace(/\.?0+$/, '');
  if (c.alpha === 1) return `color(${name} ${f(c.c1)} ${f(c.c2)} ${f(c.c3)})`;
  return `color(${name} ${f(c.c1)} ${f(c.c2)} ${f(c.c3)} / ${c.alpha.toFixed(3).replace(/\.?0+$/, '')})`;
}
