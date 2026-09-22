/**
 * @fileoverview Tests for the shader snippet generator.
 *
 * @summary
 * Covers `toShader` for every language and every option.
 *
 * @description
 * The tests check the exact string. They also check the identifier
 * sanitization and the number formatting.
 *
 * @author MathAid
 */

import { make, sRGB, toShader } from '@games/render';
import { describe, expect, it } from 'vitest';

describe('toShader', () => {
  it('emits HLSL', () => {
    const out = toShader(make(sRGB, 1, 0, 0), 'hlsl');
    expect(out).toMatch(/^static const float4 Linear_sRGB = float4\(/);
    expect(out).toMatch(/\);\s*$/);
  });

  it('emits GLSL with the default precision', () => {
    const out = toShader(make(sRGB, 1, 0, 0), 'glsl');
    expect(out).toMatch(/^const highp vec4 Linear_sRGB = vec4\(/);
  });

  it('emits GLSL with a custom precision', () => {
    const out = toShader(make(sRGB, 1, 0, 0), 'glsl', { precision: 'mediump' });
    expect(out).toMatch(/^const mediump vec4 /);
  });

  it('emits WGSL', () => {
    const out = toShader(make(sRGB, 1, 0, 0), 'wgsl');
    expect(out).toMatch(/^const Linear_sRGB = vec4<f32>\(/);
  });

  it('emits MSL', () => {
    const out = toShader(make(sRGB, 1, 0, 0), 'msl');
    expect(out).toMatch(/^constant float4 Linear_sRGB = float4\(/);
  });

  it('honors the name option', () => {
    const out = toShader(make(sRGB, 1, 0, 0), 'wgsl', { name: 'kRed' });
    expect(out).toContain('const kRed');
  });

  it('sanitizes a name with a dash', () => {
    const out = toShader(make(sRGB, 1, 0, 0), 'wgsl', { name: 'my-red' });
    expect(out).toContain('const my_red');
  });

  it('prefixes names that start with a digit', () => {
    const out = toShader(make(sRGB, 1, 0, 0), 'wgsl', { name: '1red' });
    expect(out).toContain('const _1red');
  });

  it('converts to the requested output space', () => {
    const sRGBOut = toShader(make(sRGB, 0.5, 0.5, 0.5), 'wgsl', { space: 'sRGB' });
    const linearOut = toShader(make(sRGB, 0.5, 0.5, 0.5), 'wgsl', { space: 'Linear_sRGB' });
    expect(sRGBOut).not.toBe(linearOut);
    expect(sRGBOut).toContain('0.5');
    expect(linearOut).not.toContain('0.5');
  });

  it('formats integers with a decimal point', () => {
    const out = toShader(make(sRGB, 1, 0, 0), 'wgsl', { space: 'sRGB' });
    expect(out).toContain('1.0');
    expect(out).toContain('0.0');
    expect(out).not.toContain(', 1,');
  });

  it('trims trailing zeros', () => {
    const out = toShader(make(sRGB, 0.5, 0.5, 0.5), 'wgsl', { space: 'sRGB' });
    expect(out).toContain('0.5');
    expect(out).not.toContain('0.500000');
  });

  it('throws on an unknown output space', () => {
    expect(() => toShader(make(sRGB, 1, 0, 0), 'wgsl', { space: 'OKLab' as never })).toThrow(
      /unknown output space/,
    );
  });
});
