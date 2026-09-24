/**
 * @fileoverview
 * @summary WGSL shader sources for the WebGPU renderer.
 *
 * @description
 * Defines the two shader programs the WebGPU renderer uses. The solid
 * program fills triangles with a uniform color. The textured program
 * samples a sprite texture and multiplies by a uniform tint.
 *
 * Both programs share the same vertex layout. A vertex is a 2D position
 * in shape space. The transform uniform converts that position to clip
 * space. A third uniform provides the color or tint.
 *
 * ```text
 *   Vertex layout              Uniform layout (48 bytes)
 *   -------------              --------------------------
 *   position: vec2<f32>        row1: vec4<f32>  (a, b, c, d)
 *   @location(0)               row2: vec4<f32>  (e, f, 0, 0)
 *                              color: vec4<f32> (r, g, b, a)
 * ```
 *
 * The uniform is 48 bytes. The two `vec4` fields cover the six matrix
 * elements and pad the remaining slots. The `color` field is 16-byte
 * aligned, which matches the WebGPU uniform buffer rules.
 *
 * @example
 * Example 1: Use the shader sources
 * ```ts
 * import { SOLID_SHADER, TEXTURED_SHADER } from './shaders';
 * device.createShaderModule({ code: SOLID_SHADER });
 * ```
 *
 * @author MathAid
 */

/**
 * @summary The WGSL source for the solid-color pipeline.
 *
 * @description
 * The vertex shader transforms a 2D position by the uniform matrix. The
 * fragment shader returns the uniform color.
 *
 * @example
 * Example 1: Create the module
 * ```ts
 * const module = device.createShaderModule({ code: SOLID_SHADER });
 * ```
 *
 * @author MathAid
 */
export const SOLID_SHADER = /* wgsl */ `
struct Uniforms {
  row1: vec4<f32>,
  row2: vec4<f32>,
  color: vec4<f32>,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

struct VertexInput {
  @location(0) position: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
};

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  let x = u.row1.x * in.position.x + u.row1.z * in.position.y + u.row1.w;
  let y = u.row1.y * in.position.x + u.row1.w_placeholder * in.position.y + u.row2.x;
  out.position = vec4<f32>(x, y, 0.0, 1.0);
  return out;
}

@fragment
fn fs_main() -> @location(0) vec4<f32> {
  return u.color;
}
`;

/**
 * @summary The WGSL source for the textured sprite pipeline.
 *
 * @description
 * The vertex shader is identical to the solid pipeline. The fragment
 * shader samples a 2D texture and multiplies the sample by the uniform
 * color. The color acts as a tint.
 *
 * @example
 * Example 1: Create the module
 * ```ts
 * const module = device.createShaderModule({ code: TEXTURED_SHADER });
 * ```
 *
 * @author MathAid
 */
export const TEXTURED_SHADER = /* wgsl */ `
struct Uniforms {
  row1: vec4<f32>,
  row2: vec4<f32>,
  color: vec4<f32>,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(1) @binding(0) var spriteSampler: sampler;
@group(1) @binding(1) var spriteTexture: texture_2d<f32>;

struct VertexInput {
  @location(0) position: vec2<f32>,
  @location(1) uv: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.position = vec4<f32>(in.position, 0.0, 1.0);
  out.uv = in.uv;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let sampled = textureSample(spriteTexture, spriteSampler, in.uv);
  return sampled * u.color;
}
`;