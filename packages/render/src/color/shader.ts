/**
 * @fileoverview Shader constant generation.
 *
 * @summary
 * Provides `toShader`. The function converts a color to a chosen
 * output space and formats it as a shader constant in HLSL, GLSL,
 * WGSL, or MSL.
 *
 * @description
 * Hand-written shader constants drift from engine constants. The
 * generator reads the same source and emits the same values. That
 * removes the drift.
 *
 * ```text
 *   HLSL   static const float4 name = float4(r, g, b, a);
 *   GLSL   const highp vec4 name = vec4(r, g, b, a);
 *   WGSL   const name = vec4<f32>(r, g, b, a);
 *   MSL    constant float4 name = float4(r, g, b, a);
 * ```
 *
 * The output color space is one of `sRGB`, `Linear_sRGB`, or
 * `Linear_Rec2020`. The default is `Linear_sRGB` for GPU math.
 *
 * @author MathAid
 */

import { type ColorValue, convert } from './convert';
import {
    type ColorSpaceDef,
    Linear_Rec2020,
    Linear_sRGB,
    sRGB,
} from './space';

// -----------------------------------------------------------------
//  Types
// -----------------------------------------------------------------

/**
 * @summary
 * The shader language to emit.
 *
 * @description
 * `hlsl` is used by DirectX and by HLSL-compatible tools. `glsl` is
 * used by OpenGL and by Vulkan. `wgsl` is used by WebGPU. `msl` is
 * used by Metal.
 */
export type ShaderLanguage = 'hlsl' | 'glsl' | 'wgsl' | 'msl';

/**
 * @summary
 * Options for `toShader`.
 *
 * @description
 * `space` selects the output color space. `precision` applies to GLSL
 * only. `name` overrides the auto-generated identifier.
 */
export interface ShaderOptions {
  /** The output color space. Defaults to `'Linear_sRGB'`. */
  readonly space?: 'sRGB' | 'Linear_sRGB' | 'Linear_Rec2020';
  /** The GLSL precision qualifier. Defaults to `'highp'`. */
  readonly precision?: 'lowp' | 'mediump' | 'highp';
  /** The identifier name. Defaults to the output space ID. */
  readonly name?: string;
}

// -----------------------------------------------------------------
//  Public API
// -----------------------------------------------------------------

/**
 * @summary
 * Emit a shader constant for a color.
 *
 * @description
 * The function converts the color to the requested output space. It
 * formats a string in the requested language. The string is a single
 * line ending with a semicolon.
 *
 * Float values are emitted with up to six decimal places. Trailing
 * zeros are trimmed. Every value gets a decimal point to force a
 * floating-point literal.
 *
 * @template S - The source color space type.
 *
 * @param color - The input color.
 * @param language - The shader language.
 * @param opts - Optional settings.
 * @returns A shader language snippet.
 *
 * @example
 * toShader(make(sRGB, 1, 0, 0), 'wgsl');
 * // "const Linear_sRGB = vec4<f32>(1.0, 0.0, 0.0, 1.0);"
 *
 * @example
 * toShader(make(sRGB, 1, 0, 0), 'hlsl', { name: 'kRed' });
 * // "static const float4 kRed = float4(1.0, 0.0, 0.0, 1.0);"
 */
export function toShader<S extends ColorSpaceDef<string>>(
  color: ColorValue<S>,
  language: ShaderLanguage,
  opts: ShaderOptions = {},
): string {
  const outSpace = pickSpace(opts.space ?? 'Linear_sRGB');
  const c = convert(color, outSpace);
  const name = sanitizeIdentifier(opts.name ?? outSpace.id);
  const r = formatNumber(c.c1);
  const g = formatNumber(c.c2);
  const b = formatNumber(c.c3);
  const a = formatNumber(c.alpha);

  switch (language) {
    case 'hlsl':
      return `static const float4 ${name} = float4(${r}, ${g}, ${b}, ${a});`;
    case 'glsl': {
      const p = opts.precision ?? 'highp';
      return `const ${p} vec4 ${name} = vec4(${r}, ${g}, ${b}, ${a});`;
    }
    case 'wgsl':
      return `const ${name} = vec4<f32>(${r}, ${g}, ${b}, ${a});`;
    case 'msl':
      return `constant float4 ${name} = float4(${r}, ${g}, ${b}, ${a});`;
  }
}

// -----------------------------------------------------------------
//  Internals
// -----------------------------------------------------------------

function pickSpace(id: string): typeof sRGB | typeof Linear_sRGB | typeof Linear_Rec2020 {
  switch (id) {
    case 'sRGB':
      return sRGB;
    case 'Linear_sRGB':
      return Linear_sRGB;
    case 'Linear_Rec2020':
      return Linear_Rec2020;
    default:
      throw new Error(`toShader: unknown output space "${id}".`);
  }
}

function sanitizeIdentifier(name: string): string {
  // Replace any non-word character with an underscore.
  let s = name.replace(/[^A-Za-z0-9_]/g, '_');
  // Prefix with an underscore if it starts with a digit.
  if (/^[0-9]/.test(s)) s = '_' + s;
  // Avoid reserved words in the target languages.
  return s;
}

function formatNumber(v: number): string {
  if (!Number.isFinite(v)) {
    throw new Error(`toShader: non-finite channel value ${v}.`);
  }
  // Six decimals, then trim trailing zeros.
  let s = v.toFixed(6);
  if (s.includes('.')) {
    s = s.replace(/0+$/, '').replace(/\.$/, '');
  }
  if (!s.includes('.')) s += '.0';
  return s;
}