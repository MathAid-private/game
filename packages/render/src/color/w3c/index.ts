/**
 * @fileoverview W3C standards bridge.
 *
 * @summary
 * Re-exports the CSS parsing, serialization, and named-color tables.
 * This module covers the parts of CSS Color 4 that the color engine
 * accepts at its boundary.
 *
 * @description
 * The `w3c` directory groups everything that speaks a W3C standard.
 * Today that is CSS Color 4. Future W3C bridges such as HDR CSS or
 * ICC-tagged CSS can land here without touching the rest of the module.
 *
 * ```text
 *   css.ts          fromCSS, toCSS, CSSFormat
 *   css-named.ts    CSS_NAMED_COLORS
 * ```
 *
 * @example
 * import { fromCSS, toCSS } from './w3c/index.js';
 *
 * const c = fromCSS('rebeccapurple');
 * toCSS(c, 'hex');  // "#663399"
 *
 * @author MathAid
 */

export * from './css';
export * from './css-named';
