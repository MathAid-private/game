/**
 * @fileoverview Backend adapters for DX12, Vulkan, Metal, OpenGL, and
 * WebGPU.
 *
 * @summary
 * Translates a `ColorValue<S>` in any logical space into the concrete
 * enum constants, struct values, and configuration objects that each
 * graphics API expects.
 *
 * @description
 * The file exports five typed adapters, one per API. Each adapter
 * exposes the same shape.
 *
 * ```text
 *   colorSpaceEnum(id)   Maps a ColorSpaceId to an API enum constant.
 *   pixelFormatEnum(id)  Maps a ColorSpaceId to a pixel-format constant.
 *   clearColor(color)    Converts a color to the clear-color struct.
 *   configure(id)        Returns a surface or swap-chain configuration.
 * ```
 *
 * Each API has its own vocabulary for the same concepts. This module is
 * the single place where the mapping lives.
 *
 * The adapters are plain objects. There are no classes and no
 * instantiation. Tree-shakers can drop the backends you do not use.
 *
 * ```text
 *   +-----------------+     +-----------------+     +-----------------+
 *   | ColorValue<S>   |---->| BackendAdapter  |---->| API-specific    |
 *   | (logical space) |     | .clearColor()   |     | struct or value |
 *   +-----------------+     +-----------------+     +-----------------+
 * ```
 *
 * @example
 * import { make, DX12, WebGPU, sRGB } from './index.js';
 *
 * const red  = make(sRGB, 1, 0, 0);
 * const dx12 = DX12.clearColor(red);
 * const wgpu = WebGPU.clearColor(red);
 *
 * @author MathAid
 */

import { type ColorValue, convert } from './convert';
import { type ColorSpaceDef, type ColorSpaceId, Linear_sRGB, sRGB } from './space';

// -----------------------------------------------------------------
//  Shared return types
// -----------------------------------------------------------------

/**
 * @summary
 * The generic shape every backend adapter satisfies.
 *
 * @description
 * Four type parameters describe the API. The color-space enum type, the
 * pixel-format enum type, the clear-color struct type, and the config
 * struct type.
 *
 * @template TColorSpaceEnum - The API's color-space enum type.
 * @template TPixelFormatEnum - The API's pixel-format enum type.
 * @template TClearColor - The API's clear-color struct type.
 * @template TConfig - The API's surface-config struct type.
 *
 * @example
 * const myAdapter: BackendAdapter<
 *   'MY_COLOR_SPACE_SRGB',
 *   'MY_FORMAT_RGBA8',
 *   { r: number; g: number; b: number; a: number },
 *   { format: string; colorSpace: string }
 * > = {
 *   colorSpaceEnum: () => 'MY_COLOR_SPACE_SRGB',
 *   pixelFormatEnum: () => 'MY_FORMAT_RGBA8',
 *   clearColor: (c) => ({ r: c.c1, g: c.c2, b: c.c3, a: c.alpha }),
 *   configure: () => ({
 *     format: 'MY_FORMAT_RGBA8',
 *     colorSpace: 'MY_COLOR_SPACE_SRGB',
 *   }),
 * };
 */
export interface BackendAdapter<
  TColorSpaceEnum extends string,
  TPixelFormatEnum extends string,
  TClearColor,
  TConfig,
> {
  /**
   * @summary
   * Map a logical color space ID to this API's enum constant.
   *
   * @description
   * Throws when the space has no native representation on this backend.
   *
   * @param id - The logical color space ID.
   * @returns The API's enum constant.
   * @throws {Error} If the space is not natively representable.
   */
  colorSpaceEnum(id: ColorSpaceId): TColorSpaceEnum;

  /**
   * @summary
   * Map a logical color space ID to a typical pixel-format constant.
   *
   * @description
   * The mapping is a suggestion. The actual pixel format depends on the
   * swap-chain and the render-target setup.
   *
   * @param id - The logical color space ID.
   * @returns The API's pixel-format constant.
   */
  pixelFormatEnum(id: ColorSpaceId): TPixelFormatEnum;

  /**
   * @summary
   * Convert a `ColorValue` to this API's clear-color struct.
   *
   * @description
   * The clear-color space depends on the API. Some APIs expect linear
   * values. Some expect encoded values in the target space. See the
   * per-adapter docs.
   *
   * @template S - The source color space.
   * @param color - The color to convert.
   * @returns The API's clear-color struct.
   */
  clearColor<S extends ColorSpaceDef<string>>(color: ColorValue<S>): TClearColor;

  /**
   * @summary
   * Return a configuration record for surface or swap-chain setup.
   *
   * @description
   * The record is a suggestion. Wire it into your API's surface
   * configuration as-is or adapt the fields.
   *
   * @param id - The logical color space ID.
   * @returns The API's surface-config struct.
   */
  configure(id: ColorSpaceId): TConfig;
}

// -----------------------------------------------------------------
//  DirectX 12
// -----------------------------------------------------------------

/** @summary The DXGI color-space enum constants this library emits. */
export type DX12ColorSpace =
  | 'DXGI_COLOR_SPACE_RGB_FULL_G22_NONE_P709'
  | 'DXGI_COLOR_SPACE_RGB_FULL_G10_NONE_P709'
  | 'DXGI_COLOR_SPACE_RGB_FULL_G22_NONE_P3'
  | 'DXGI_COLOR_SPACE_RGB_STUDIO_G22_NONE_P709'
  | 'DXGI_COLOR_SPACE_RGB_FULL_G2084_NONE_P2020'
  | 'DXGI_COLOR_SPACE_RGB_STUDIO_G2084_NONE_P2020'
  | 'DXGI_COLOR_SPACE_RGB_FULL_G22_NONE_P2020';

/** @summary The DXGI pixel-format enum constants this library emits. */
export type DX12PixelFormat =
  | 'DXGI_FORMAT_B8G8R8A8_UNORM'
  | 'DXGI_FORMAT_B8G8R8A8_UNORM_SRGB'
  | 'DXGI_FORMAT_R16G16B16A16_FLOAT'
  | 'DXGI_FORMAT_R32G32B32A32_FLOAT'
  | 'DXGI_FORMAT_R10G10B10A2_UNORM';

/**
 * @summary
 * The DX12 clear-color struct.
 *
 * @description
 * `Color` maps to `D3D12_CLEAR_VALUE::Color[4]`. `Format` is the
 * suggested `DXGI_FORMAT` for the render target.
 */
export interface DX12ClearColor {
  /** Maps to D3D12_CLEAR_VALUE::Color[4]. */
  readonly Color: readonly [number, number, number, number];
  /** Suggested DXGI_FORMAT for the render target. */
  readonly Format: DX12PixelFormat;
}

/**
 * @summary
 * The DX12 surface and swap-chain configuration.
 *
 * @description
 * `SwapChainColorSpace` maps to `DXGI_SWAP_CHAIN_DESC1::ColorSpace`.
 * `BackBufferFormat` maps to `DXGI_SWAP_CHAIN_DESC1::Format`.
 */
export interface DX12Config {
  /** The swap-chain color space. Maps to DXGI_SWAP_CHAIN_DESC1.ColorSpace. */
  readonly SwapChainColorSpace: DX12ColorSpace;
  /** The back-buffer format. Maps to DXGI_SWAP_CHAIN_DESC1.Format. */
  readonly BackBufferFormat: DX12PixelFormat;
}

/**
 * @summary
 * The DirectX 12 backend adapter.
 *
 * @description
 * DX12 clear-color values are passed in the encoded space of the render
 * target. For sRGB render targets the driver converts internally when
 * the format ends in `_UNORM_SRGB`. For HDR targets, supply linear
 * values.
 *
 * This adapter always converts to `Linear_sRGB` before emitting the
 * struct. Supply an `_UNORM_SRGB` back-buffer format and let the driver
 * encode.
 */
export const DX12: BackendAdapter<DX12ColorSpace, DX12PixelFormat, DX12ClearColor, DX12Config> = {
  colorSpaceEnum(id): DX12ColorSpace {
    const map: Partial<Record<ColorSpaceId, DX12ColorSpace>> = {
      sRGB: 'DXGI_COLOR_SPACE_RGB_FULL_G22_NONE_P709',
      Linear_sRGB: 'DXGI_COLOR_SPACE_RGB_FULL_G10_NONE_P709',
      Display_P3: 'DXGI_COLOR_SPACE_RGB_FULL_G22_NONE_P3',
      Linear_P3: 'DXGI_COLOR_SPACE_RGB_FULL_G22_NONE_P3',
      Linear_Rec2020: 'DXGI_COLOR_SPACE_RGB_FULL_G22_NONE_P2020',
      PQ_Rec2020: 'DXGI_COLOR_SPACE_RGB_FULL_G2084_NONE_P2020',
      HLG_Rec2020: 'DXGI_COLOR_SPACE_RGB_FULL_G22_NONE_P2020',
    };
    const v = map[id];
    if (!v) throw new Error(`DX12: no color-space mapping for "${id}"`);
    return v;
  },

  pixelFormatEnum(id): DX12PixelFormat {
    const map: Partial<Record<ColorSpaceId, DX12PixelFormat>> = {
      sRGB: 'DXGI_FORMAT_B8G8R8A8_UNORM_SRGB',
      Linear_sRGB: 'DXGI_FORMAT_R16G16B16A16_FLOAT',
      Display_P3: 'DXGI_FORMAT_R16G16B16A16_FLOAT',
      Linear_P3: 'DXGI_FORMAT_R16G16B16A16_FLOAT',
      Linear_Rec2020: 'DXGI_FORMAT_R16G16B16A16_FLOAT',
      PQ_Rec2020: 'DXGI_FORMAT_R10G10B10A2_UNORM',
      HLG_Rec2020: 'DXGI_FORMAT_R16G16B16A16_FLOAT',
    };
    return map[id] ?? 'DXGI_FORMAT_R32G32B32A32_FLOAT';
  },

  clearColor<S extends ColorSpaceDef<string>>(color: ColorValue<S>): DX12ClearColor {
    // DX12 expects linear values in the clear struct.
    const c = convert(color, Linear_sRGB);
    const fmt = this.pixelFormatEnum(sRGB.id);
    return {
      Color: [c.c1, c.c2, c.c3, c.alpha],
      Format: fmt,
    };
  },

  configure(id): DX12Config {
    return {
      SwapChainColorSpace: this.colorSpaceEnum(id),
      BackBufferFormat: this.pixelFormatEnum(id),
    };
  },
};

// -----------------------------------------------------------------
//  Vulkan
// -----------------------------------------------------------------

/** @summary The Vulkan color-space enum constants this library emits. */
export type VkColorSpace =
  | 'VK_COLOR_SPACE_SRGB_NONLINEAR_KHR'
  | 'VK_COLOR_SPACE_DISPLAY_P3_NONLINEAR_EXT'
  | 'VK_COLOR_SPACE_DISPLAY_P3_LINEAR_EXT'
  | 'VK_COLOR_SPACE_EXTENDED_SRGB_LINEAR_EXT'
  | 'VK_COLOR_SPACE_HDR10_ST2084_EXT'
  | 'VK_COLOR_SPACE_HDR10_HLG_EXT'
  | 'VK_COLOR_SPACE_DOLBYVISION_EXT'
  | 'VK_COLOR_SPACE_ADOBERGB_LINEAR_EXT'
  | 'VK_COLOR_SPACE_PASS_THROUGH_EXT';

/** @summary The Vulkan pixel-format enum constants this library emits. */
export type VkFormat =
  | 'VK_FORMAT_B8G8R8A8_SRGB'
  | 'VK_FORMAT_R8G8B8A8_SRGB'
  | 'VK_FORMAT_R16G16B16A16_SFLOAT'
  | 'VK_FORMAT_R32G32B32A32_SFLOAT'
  | 'VK_FORMAT_A2B10G10R10_UNORM_PACK32';

/**
 * @summary
 * The Vulkan clear-color struct.
 *
 * @description
 * Maps to `VkClearColorValue::float32[4]`.
 */
export interface VkClearColor {
  /** Maps to VkClearColorValue::float32[4]. */
  readonly float32: readonly [number, number, number, number];
}

/**
 * @summary
 * The Vulkan surface configuration.
 *
 * @description
 * Mirrors `VkSurfaceFormatKHR`.
 */
export interface VkSurfaceConfig {
  /** Maps to VkSurfaceFormatKHR.format. */
  readonly format: VkFormat;
  /** Maps to VkSurfaceFormatKHR.colorSpace. */
  readonly colorSpace: VkColorSpace;
}

/**
 * @summary
 * The Vulkan backend adapter.
 *
 * @description
 * Requires `VK_KHR_swapchain` and `VK_EXT_swapchain_colorspace`.
 *
 * Vulkan clear colors are in the linear space for floating-point
 * formats. The driver does not apply the EOTF. Configure the render
 * pass with the correct `VkSurfaceFormatKHR.colorSpace`.
 *
 * `Linear_Rec2020` maps to `VK_COLOR_SPACE_PASS_THROUGH_EXT`. Vulkan
 * has no native linear BT.2020 enum. Pass-through tells the driver to
 * send the values as-is. The render pass and the shader must agree on
 * the interpretation. Document the shader expectation in your renderer.
 *
 * @note `VK_COLOR_SPACE_PASS_THROUGH_EXT` requires the
 * `VK_EXT_swapchain_colorspace` extension.
 */
export const Vulkan: BackendAdapter<VkColorSpace, VkFormat, VkClearColor, VkSurfaceConfig> = {
  colorSpaceEnum(id): VkColorSpace {
    const map: Partial<Record<ColorSpaceId, VkColorSpace>> = {
      sRGB: 'VK_COLOR_SPACE_SRGB_NONLINEAR_KHR',
      Linear_sRGB: 'VK_COLOR_SPACE_EXTENDED_SRGB_LINEAR_EXT',
      Display_P3: 'VK_COLOR_SPACE_DISPLAY_P3_NONLINEAR_EXT',
      Linear_P3: 'VK_COLOR_SPACE_DISPLAY_P3_LINEAR_EXT',
      Linear_Rec2020: 'VK_COLOR_SPACE_PASS_THROUGH_EXT',
      PQ_Rec2020: 'VK_COLOR_SPACE_HDR10_ST2084_EXT',
      HLG_Rec2020: 'VK_COLOR_SPACE_HDR10_HLG_EXT',
      XYZ_D65: 'VK_COLOR_SPACE_PASS_THROUGH_EXT',
    };
    const v = map[id];
    if (!v) throw new Error(`Vulkan: no color-space mapping for "${id}"`);
    return v;
  },

  pixelFormatEnum(id): VkFormat {
    const map: Partial<Record<ColorSpaceId, VkFormat>> = {
      sRGB: 'VK_FORMAT_B8G8R8A8_SRGB',
      Linear_sRGB: 'VK_FORMAT_R16G16B16A16_SFLOAT',
      Display_P3: 'VK_FORMAT_R16G16B16A16_SFLOAT',
      Linear_P3: 'VK_FORMAT_R16G16B16A16_SFLOAT',
      Linear_Rec2020: 'VK_FORMAT_R16G16B16A16_SFLOAT',
      PQ_Rec2020: 'VK_FORMAT_A2B10G10R10_UNORM_PACK32',
      HLG_Rec2020: 'VK_FORMAT_R16G16B16A16_SFLOAT',
    };
    return map[id] ?? 'VK_FORMAT_R32G32B32A32_SFLOAT';
  },

  clearColor<S extends ColorSpaceDef<string>>(color: ColorValue<S>): VkClearColor {
    // Vulkan float targets expect linear values.
    const c = convert(color, Linear_sRGB);
    return { float32: [c.c1, c.c2, c.c3, c.alpha] };
  },

  configure(id): VkSurfaceConfig {
    return {
      format: this.pixelFormatEnum(id),
      colorSpace: this.colorSpaceEnum(id),
    };
  },
};

// -----------------------------------------------------------------
//  Metal
// -----------------------------------------------------------------

/** @summary The Metal pixel-format enum constants this library emits. */
export type MTLPixelFormat =
  | 'MTLPixelFormatBGRA8Unorm'
  | 'MTLPixelFormatBGRA8Unorm_sRGB'
  | 'MTLPixelFormatRGBA16Float'
  | 'MTLPixelFormatRGB10A2Unorm'
  | 'MTLPixelFormatRGBA32Float';

/** @summary The CoreGraphics color-space name constants this library emits. */
export type CGColorSpaceName =
  | 'kCGColorSpaceSRGB'
  | 'kCGColorSpaceLinearSRGB'
  | 'kCGColorSpaceDisplayP3'
  | 'kCGColorSpaceLinearDisplayP3'
  | 'kCGColorSpaceITUR_2020'
  | 'kCGColorSpaceITUR_2100_PQ'
  | 'kCGColorSpaceITUR_2100_HLG';

/**
 * @summary
 * The Metal clear-color struct.
 *
 * @description
 * Maps to `MTLClearColor`. All fields are `double` in the Metal API.
 */
export interface MTLClearColor {
  /** Maps to MTLClearColor.red. */
  readonly red: number;
  /** Maps to MTLClearColor.green. */
  readonly green: number;
  /** Maps to MTLClearColor.blue. */
  readonly blue: number;
  /** Maps to MTLClearColor.alpha. */
  readonly alpha: number;
}

/**
 * @summary
 * The Metal surface and layer configuration.
 *
 * @description
 * The three fields wire into `CAMetalLayer` setup. `pixelFormat` is
 * `CAMetalLayer.pixelFormat`. `colorspace` is the `CGColorSpace` for
 * the layer. `wantsExtendedDynamicRange` sets the EDR flag on
 * supporting displays.
 */
export interface MetalConfig {
  /** The Metal pixel format for the drawable. */
  readonly pixelFormat: MTLPixelFormat;
  /** The CoreGraphics color space for the layer. */
  readonly colorspace: CGColorSpaceName;
  /** True for HDR output on displays that support EDR. */
  readonly wantsExtendedDynamicRange: boolean;
}

/**
 * @summary
 * The Metal backend adapter.
 *
 * @description
 * Metal clear colors are in the linear space for floating-point pixel
 * formats such as `RGBA16Float` and `RGBA32Float`. For
 * `BGRA8Unorm_sRGB` the driver applies the sRGB EOTF internally.
 */
export const Metal: BackendAdapter<CGColorSpaceName, MTLPixelFormat, MTLClearColor, MetalConfig> = {
  colorSpaceEnum(id): CGColorSpaceName {
    const map: Partial<Record<ColorSpaceId, CGColorSpaceName>> = {
      sRGB: 'kCGColorSpaceSRGB',
      Linear_sRGB: 'kCGColorSpaceLinearSRGB',
      Display_P3: 'kCGColorSpaceDisplayP3',
      Linear_P3: 'kCGColorSpaceLinearDisplayP3',
      Linear_Rec2020: 'kCGColorSpaceITUR_2020',
      PQ_Rec2020: 'kCGColorSpaceITUR_2100_PQ',
      HLG_Rec2020: 'kCGColorSpaceITUR_2100_HLG',
    };
    const v = map[id];
    if (!v) throw new Error(`Metal: no CGColorSpace mapping for "${id}"`);
    return v;
  },

  pixelFormatEnum(id): MTLPixelFormat {
    const map: Partial<Record<ColorSpaceId, MTLPixelFormat>> = {
      sRGB: 'MTLPixelFormatBGRA8Unorm_sRGB',
      Linear_sRGB: 'MTLPixelFormatRGBA16Float',
      Display_P3: 'MTLPixelFormatRGBA16Float',
      Linear_P3: 'MTLPixelFormatRGBA16Float',
      Linear_Rec2020: 'MTLPixelFormatRGBA16Float',
      PQ_Rec2020: 'MTLPixelFormatRGB10A2Unorm',
      HLG_Rec2020: 'MTLPixelFormatRGBA16Float',
    };
    return map[id] ?? 'MTLPixelFormatRGBA32Float';
  },

  clearColor<S extends ColorSpaceDef<string>>(color: ColorValue<S>): MTLClearColor {
    const c = convert(color, Linear_sRGB);
    return { red: c.c1, green: c.c2, blue: c.c3, alpha: c.alpha };
  },

  configure(id): MetalConfig {
    const hdr = ['PQ_Rec2020', 'HLG_Rec2020', 'Linear_Rec2020'].includes(id);
    return {
      pixelFormat: this.pixelFormatEnum(id),
      colorspace: this.colorSpaceEnum(id),
      wantsExtendedDynamicRange: hdr,
    };
  },
};

// -----------------------------------------------------------------
//  OpenGL
// -----------------------------------------------------------------

/** @summary The OpenGL internal-format enum constants this library emits. */
export type GLInternalFormat =
  'GL_SRGB8_ALPHA8' | 'GL_RGBA8' | 'GL_RGBA16F' | 'GL_RGBA32F' | 'GL_RGB10_A2';

/** @summary The OpenGL color-space hint strings this library emits. */
export type GLColorSpaceHint = 'GL_FRAMEBUFFER_SRGB' | 'GL_LINEAR' | 'GL_HDR_METADATA_EXT';

/**
 * @summary
 * The OpenGL clear-color struct. Values for `glClearColor`.
 *
 * @description
 * Values are always linear. Enable `GL_FRAMEBUFFER_SRGB` so OpenGL
 * applies the sRGB EOTF on write.
 */
export interface GLClearColor {
  /** Values passed to glClearColor(). Always linear. */
  readonly r: number;
  /** Values passed to glClearColor(). Always linear. */
  readonly g: number;
  /** Values passed to glClearColor(). Always linear. */
  readonly b: number;
  /** Values passed to glClearColor(). Always linear. */
  readonly a: number;
}

/**
 * @summary
 * The OpenGL framebuffer configuration.
 *
 * @description
 * `internalFormat` is the texture internal format. `colorSpaceHint`
 * describes the expected framebuffer mode. `framebufferSRGB` is true
 * when the caller should enable `GL_FRAMEBUFFER_SRGB`.
 */
export interface GLConfig {
  /** The texture internal format. */
  readonly internalFormat: GLInternalFormat;
  /** The color-space hint for the framebuffer. */
  readonly colorSpaceHint: GLColorSpaceHint;
  /** True when the caller should enable GL_FRAMEBUFFER_SRGB. */
  readonly framebufferSRGB: boolean;
}

/**
 * @summary
 * The OpenGL backend adapter.
 *
 * @description
 * With `GL_FRAMEBUFFER_SRGB` enabled, OpenGL expects linear values from
 * shaders and converts to sRGB internally. `glClearColor` accepts
 * values in the target's encoded space. This adapter always converts to
 * linear to match the shader path.
 *
 * @see {@link https://www.khronos.org/registry/OpenGL/extensions/ARB/ARB_framebuffer_sRGB.txt} ARB_framebuffer_sRGB
 */
export const OpenGL: BackendAdapter<GLColorSpaceHint, GLInternalFormat, GLClearColor, GLConfig> = {
  colorSpaceEnum(id): GLColorSpaceHint {
    const map: Partial<Record<ColorSpaceId, GLColorSpaceHint>> = {
      sRGB: 'GL_FRAMEBUFFER_SRGB',
      Linear_sRGB: 'GL_LINEAR',
      Display_P3: 'GL_FRAMEBUFFER_SRGB',
      Linear_P3: 'GL_LINEAR',
      Linear_Rec2020: 'GL_LINEAR',
      PQ_Rec2020: 'GL_HDR_METADATA_EXT',
      HLG_Rec2020: 'GL_HDR_METADATA_EXT',
    };
    return map[id] ?? 'GL_LINEAR';
  },

  pixelFormatEnum(id): GLInternalFormat {
    const map: Partial<Record<ColorSpaceId, GLInternalFormat>> = {
      sRGB: 'GL_SRGB8_ALPHA8',
      Linear_sRGB: 'GL_RGBA16F',
      Display_P3: 'GL_RGBA16F',
      Linear_P3: 'GL_RGBA16F',
      Linear_Rec2020: 'GL_RGBA16F',
      PQ_Rec2020: 'GL_RGB10_A2',
      HLG_Rec2020: 'GL_RGBA16F',
    };
    return map[id] ?? 'GL_RGBA32F';
  },

  clearColor<S extends ColorSpaceDef<string>>(color: ColorValue<S>): GLClearColor {
    // OpenGL with GL_FRAMEBUFFER_SRGB: supply linear values.
    const c = convert(color, Linear_sRGB);
    return { r: c.c1, g: c.c2, b: c.c3, a: c.alpha };
  },

  configure(id): GLConfig {
    const isSRGB = ['sRGB', 'Display_P3'].includes(id);
    return {
      internalFormat: this.pixelFormatEnum(id),
      colorSpaceHint: this.colorSpaceEnum(id),
      framebufferSRGB: isSRGB,
    };
  },
};

// -----------------------------------------------------------------
//  WebGPU
// -----------------------------------------------------------------

/** @summary The WebGPU texture-format enum constants this library emits. */
export type GPUTextureFormat =
  | 'bgra8unorm'
  | 'bgra8unorm-srgb'
  | 'rgba8unorm'
  | 'rgba8unorm-srgb'
  | 'rgba16float'
  | 'rgba32float'
  | 'rgb10a2unorm';

/** @summary The WebGPU canvas color-space strings this library emits. */
export type GPUCanvasColorSpace = 'srgb' | 'display-p3';

/** @summary The WebGPU tone-mapping mode strings. */
export type GPUToneMappingMode = 'standard' | 'extended';

/**
 * @summary
 * The WebGPU clear-color struct.
 *
 * @description
 * Matches the `GPUColor` dictionary. All fields are `double`.
 */
export interface GPUClearColor {
  /** The red channel. */
  readonly r: number;
  /** The green channel. */
  readonly g: number;
  /** The blue channel. */
  readonly b: number;
  /** The alpha channel. */
  readonly a: number;
}

/**
 * @summary
 * The WebGPU canvas configuration.
 *
 * @description
 * A subset of `GPUCanvasConfiguration`. The three fields are the ones
 * that matter for color management.
 */
export interface WebGPUConfig {
  /** Maps to GPUCanvasConfiguration.format. */
  readonly format: GPUTextureFormat;
  /** Maps to GPUCanvasConfiguration.colorSpace. */
  readonly colorSpace: GPUCanvasColorSpace;
  /** Maps to GPUCanvasConfiguration.toneMapping.mode. */
  readonly toneMappingMode: GPUToneMappingMode;
}

/**
 * @summary
 * The WebGPU backend adapter.
 *
 * @description
 * Works with `wgpu` and with `navigator.gpu`.
 *
 * WebGPU canvas color spaces are limited to `"srgb"` and `"display-p3"`.
 * HDR is accessed through `toneMapping.mode = "extended"` and a 16-bit
 * float texture format.
 *
 * `Linear_P3` and `Linear_Rec2020` map to `"display-p3"` since P3 is
 * the closest available canvas space.
 *
 * @see {@link https://gpuweb.github.io/gpuweb/#canvas-configuration} WebGPU canvas configuration
 */
export const WebGPU: BackendAdapter<
  GPUCanvasColorSpace,
  GPUTextureFormat,
  GPUClearColor,
  WebGPUConfig
> = {
  colorSpaceEnum(id): GPUCanvasColorSpace {
    if (['Display_P3', 'Linear_P3', 'Linear_Rec2020', 'PQ_Rec2020', 'HLG_Rec2020'].includes(id)) {
      return 'display-p3';
    }
    return 'srgb';
  },

  pixelFormatEnum(id): GPUTextureFormat {
    const map: Partial<Record<ColorSpaceId, GPUTextureFormat>> = {
      sRGB: 'bgra8unorm-srgb',
      Linear_sRGB: 'rgba16float',
      Display_P3: 'rgba16float',
      Linear_P3: 'rgba16float',
      Linear_Rec2020: 'rgba16float',
      PQ_Rec2020: 'rgb10a2unorm',
      HLG_Rec2020: 'rgba16float',
    };
    return map[id] ?? 'rgba32float';
  },

  clearColor<S extends ColorSpaceDef<string>>(color: ColorValue<S>): GPUClearColor {
    const c = convert(color, sRGB);
    return { r: c.c1, g: c.c2, b: c.c3, a: c.alpha };
  },

  configure(id): WebGPUConfig {
    const hdr = ['PQ_Rec2020', 'HLG_Rec2020', 'Linear_Rec2020', 'Linear_P3'].includes(id);
    return {
      format: this.pixelFormatEnum(id),
      colorSpace: this.colorSpaceEnum(id),
      toneMappingMode: hdr ? 'extended' : 'standard',
    };
  },
};

// -----------------------------------------------------------------
//  PlayStation 5 (AGC)
// -----------------------------------------------------------------

/**
 * @summary
 * The PS5 AGC color-space enum constants this library emits.
 *
 * @description
 * Values come from the AGC Gnm API. The exact enum names change
 * between SDK versions. Verify against your SDK version. The shape
 * of the mapping is stable.
 *
 * @note These are string literals, not real AGC enums. The caller is
 *   responsible for mapping the string to the SDK enum. This keeps
 *   the library free of a hard SDK dependency.
 */
export type PS5ColorSpace =
  | 'kColorSpaceSRGB'
  | 'kColorSpaceLinear'
  | 'kColorSpaceDisplayP3'
  | 'kColorSpaceBT2020'
  | 'kColorSpaceHDR10';

/** @summary The PS5 AGC pixel-format enum constants this library emits. */
export type PS5PixelFormat =
  'kB8G8R8A8UNorm' | 'kB8G8R8A8SRGB' | 'kR16G16B16A16Float' | 'kR10G10B10A2UNorm';

/**
 * @summary
 * The PS5 AGC clear-color struct.
 *
 * @description
 * Maps to the `Gnm::RenderTarget` clear color. The array order is
 * R, G, B, A. Values are linear for float targets and encoded for
 * UNorm targets.
 */
export interface PS5ClearColor {
  /** Clear color as an [R, G, B, A] array. */
  readonly color: readonly [number, number, number, number];
  /** The pixel format for the render target. */
  readonly format: PS5PixelFormat;
}

/**
 * @summary
 * The PS5 AGC surface configuration.
 *
 * @description
 * Drives `sce::Gnm::RenderTarget` and swap-chain setup.
 */
export interface PS5Config {
  /** The color space for the swap chain. */
  readonly colorSpace: PS5ColorSpace;
  /** The pixel format for the back buffer. */
  readonly format: PS5PixelFormat;
  /** True when the target supports HDR. */
  readonly hdr: boolean;
}

/**
 * @summary
 * The PlayStation 5 backend adapter.
 *
 * @description
 * PS5 uses the AGC Gnm API. Clear colors are linear for float targets
 * and encoded for UNorm targets. This adapter always emits linear
 * values. Pair with a float format for HDR or let the driver encode
 * for an SRGB format.
 *
 * @note The enum strings are placeholders. Map them to the real
 *   AGC enums in your renderer. Pin the mapping to a specific SDK
 *   version.
 */
export const PS5: BackendAdapter<PS5ColorSpace, PS5PixelFormat, PS5ClearColor, PS5Config> = {
  colorSpaceEnum(id): PS5ColorSpace {
    const map: Partial<Record<ColorSpaceId, PS5ColorSpace>> = {
      sRGB: 'kColorSpaceSRGB',
      Linear_sRGB: 'kColorSpaceLinear',
      Display_P3: 'kColorSpaceDisplayP3',
      Linear_P3: 'kColorSpaceDisplayP3',
      Linear_Rec2020: 'kColorSpaceBT2020',
      PQ_Rec2020: 'kColorSpaceHDR10',
      HLG_Rec2020: 'kColorSpaceBT2020',
    };
    const v = map[id];
    if (!v) throw new Error(`PS5: no color-space mapping for "${id}"`);
    return v;
  },

  pixelFormatEnum(id): PS5PixelFormat {
    const map: Partial<Record<ColorSpaceId, PS5PixelFormat>> = {
      sRGB: 'kB8G8R8A8SRGB',
      Linear_sRGB: 'kR16G16B16A16Float',
      Display_P3: 'kR16G16B16A16Float',
      Linear_P3: 'kR16G16B16A16Float',
      Linear_Rec2020: 'kR16G16B16A16Float',
      PQ_Rec2020: 'kR10G10B10A2UNorm',
      HLG_Rec2020: 'kR16G16B16A16Float',
    };
    return map[id] ?? 'kR16G16B16A16Float';
  },

  clearColor<S extends ColorSpaceDef<string>>(color: ColorValue<S>): PS5ClearColor {
    const c = convert(color, Linear_sRGB);
    const fmt = this.pixelFormatEnum(sRGB.id);
    return {
      color: [c.c1, c.c2, c.c3, c.alpha],
      format: fmt,
    };
  },

  configure(id): PS5Config {
    const hdr = ['Linear_Rec2020', 'PQ_Rec2020', 'HLG_Rec2020'].includes(id);
    return {
      colorSpace: this.colorSpaceEnum(id),
      format: this.pixelFormatEnum(id),
      hdr,
    };
  },
};

// -----------------------------------------------------------------
//  Nintendo Switch (NVN)
// -----------------------------------------------------------------

/**
 * @summary
 * The Switch NVN color-space enum constants this library emits.
 *
 * @description
 * Values come from the NVN API. As with the PS5 adapter, these are
 * string literals. Map them to the real NVN enums in your renderer.
 */
export type NVNColorSpace =
  | 'NVN_COLOR_SPACE_LINEAR'
  | 'NVN_COLOR_SPACE_SRGB'
  | 'NVN_COLOR_SPACE_DISPLAY_P3'
  | 'NVN_COLOR_SPACE_BT2020';

/** @summary The Switch NVN pixel-format enum constants this library emits. */
export type NVNFormat =
  | 'NVN_FORMAT_RGBA8'
  | 'NVN_FORMAT_RGBA8_SRGB'
  | 'NVN_FORMAT_RGBA16F'
  | 'NVN_FORMAT_RGB10_A2'
  | 'NVN_FORMAT_RGBA32F';

/**
 * @summary
 * The Switch NVN clear-color struct.
 *
 * @description
 * Maps to the `NVNcolorData` used by `nvnClearColor`. The array order
 * is R, G, B, A.
 */
export interface NVNClearColor {
  /** Clear color as an [R, G, B, A] array. */
  readonly rgba: readonly [number, number, number, number];
}

/**
 * @summary
 * The Switch NVN surface configuration.
 *
 * @description
 * Drives `NVNwindow` and `NVNtexture` setup for the back buffer.
 */
export interface NVNConfig {
  /** The color space for the window. */
  readonly colorSpace: NVNColorSpace;
  /** The pixel format for the back buffer. */
  readonly format: NVNFormat;
  /** True when the target supports HDR. */
  readonly hdr: boolean;
}

/**
 * @summary
 * The Nintendo Switch backend adapter.
 *
 * @description
 * Switch uses the NVN API. Clear colors are linear for float formats.
 * For SRGB formats, the driver applies the EOTF internally.
 *
 * @note The enum strings are placeholders. Map them to the real
 *   NVN enums in your renderer.
 */
export const Switch: BackendAdapter<NVNColorSpace, NVNFormat, NVNClearColor, NVNConfig> = {
  colorSpaceEnum(id): NVNColorSpace {
    const map: Partial<Record<ColorSpaceId, NVNColorSpace>> = {
      sRGB: 'NVN_COLOR_SPACE_SRGB',
      Linear_sRGB: 'NVN_COLOR_SPACE_LINEAR',
      Display_P3: 'NVN_COLOR_SPACE_DISPLAY_P3',
      Linear_P3: 'NVN_COLOR_SPACE_DISPLAY_P3',
      Linear_Rec2020: 'NVN_COLOR_SPACE_BT2020',
      PQ_Rec2020: 'NVN_COLOR_SPACE_BT2020',
      HLG_Rec2020: 'NVN_COLOR_SPACE_BT2020',
    };
    const v = map[id];
    if (!v) throw new Error(`Switch: no color-space mapping for "${id}"`);
    return v;
  },

  pixelFormatEnum(id): NVNFormat {
    const map: Partial<Record<ColorSpaceId, NVNFormat>> = {
      sRGB: 'NVN_FORMAT_RGBA8_SRGB',
      Linear_sRGB: 'NVN_FORMAT_RGBA16F',
      Display_P3: 'NVN_FORMAT_RGBA16F',
      Linear_P3: 'NVN_FORMAT_RGBA16F',
      Linear_Rec2020: 'NVN_FORMAT_RGBA16F',
      PQ_Rec2020: 'NVN_FORMAT_RGB10_A2',
      HLG_Rec2020: 'NVN_FORMAT_RGBA16F',
    };
    return map[id] ?? 'NVN_FORMAT_RGBA32F';
  },

  clearColor<S extends ColorSpaceDef<string>>(color: ColorValue<S>): NVNClearColor {
    const c = convert(color, Linear_sRGB);
    return { rgba: [c.c1, c.c2, c.c3, c.alpha] };
  },

  configure(id): NVNConfig {
    const hdr = ['Linear_Rec2020', 'PQ_Rec2020', 'HLG_Rec2020'].includes(id);
    return {
      colorSpace: this.colorSpaceEnum(id),
      format: this.pixelFormatEnum(id),
      hdr,
    };
  },
};

// -----------------------------------------------------------------
//  Software reference adapter
// -----------------------------------------------------------------

/**
 * @summary
 * The Software reference adapter.
 *
 * @description
 * The Software adapter does not target a real GPU. It emits an
 * 8-bit sRGB byte array suitable for tests, debug overlays, and
 * software rasterizers. It is deterministic. It does not depend on
 * any driver.
 *
 * The adapter does not implement `BackendAdapter`. Its output format
 * is fixed to 8-bit sRGB. It ignores the color space ID in every
 * method. This is a deliberate simplification. Use the other adapters
 * when you need a space-specific mapping.
 *
 * @example
 * const bytes = Software.clearColor(make(sRGB, 1, 0, 0));
 * // bytes is Uint8ClampedArray [255, 0, 0, 255]
 */
export const Software = {
  /**
   * @summary
   * Return the fixed color-space name.
   *
   * @description
   * The Software adapter always uses sRGB. The `id` argument is
   * accepted for signature compatibility with `BackendAdapter` and
   * is ignored.
   *
   * @param id - The logical color space. Ignored.
   * @returns The string `'srgb'`.
   */
  colorSpaceEnum(_id: ColorSpaceId): 'srgb' {
    return 'srgb';
  },

  /**
   * @summary
   * Return the fixed pixel-format name.
   *
   * @description
   * The Software adapter always uses 8-bit RGBA. The `id` argument
   * is accepted for signature compatibility and is ignored.
   *
   * @param id - The logical color space. Ignored.
   * @returns The string `'rgba8unorm'`.
   */
  pixelFormatEnum(_id: ColorSpaceId): 'rgba8unorm' {
    return 'rgba8unorm';
  },

  /**
   * @summary
   * Convert a color to 8-bit sRGB bytes.
   *
   * @description
   * The function converts to sRGB. It clamps each channel to 0 to 1.
   * It scales by 255 and rounds.
   *
   * @template S - The source color space.
   * @param color - The color to convert.
   * @returns A 4-element `Uint8ClampedArray` in RGBA order.
   */
  clearColor<S extends ColorSpaceDef<string>>(color: ColorValue<S>): Uint8ClampedArray {
    const c = convert(color, sRGB);
    const out = new Uint8ClampedArray(4);
    out[0] = Math.round(Math.max(0, Math.min(1, c.c1)) * 255);
    out[1] = Math.round(Math.max(0, Math.min(1, c.c2)) * 255);
    out[2] = Math.round(Math.max(0, Math.min(1, c.c3)) * 255);
    out[3] = Math.round(Math.max(0, Math.min(1, c.alpha)) * 255);
    return out;
  },

  /**
   * @summary
   * Return the fixed surface configuration.
   *
   * @description
   * The Software adapter has no surface. This returns a constant
   * record. The `id` argument is accepted for signature compatibility
   * and is ignored.
   *
   * @param id - The logical color space. Ignored.
   * @returns A constant record with `format` and `colorSpace`.
   */
  configure(_id?: ColorSpaceId): {
    readonly format: 'rgba8unorm';
    readonly colorSpace: 'srgb';
  } {
    return { format: 'rgba8unorm', colorSpace: 'srgb' };
  },
} as const;

// -----------------------------------------------------------------
//  Convenience: all backends
// -----------------------------------------------------------------

/**
 * @summary
 * All eight backend adapters, keyed by a short identifier.
 *
 * @description
 * The object is frozen with `as const`. The keys are stable. Use the
 * `BackendKey` type for exhaustive switches.
 *
 * @example
 * import { backends, make, sRGB } from '@games/render';
 *
 * const clear = backends.DX12.clearColor(make(sRGB, 1, 0, 0));
 */
export const backends = {
  DX12,
  Vulkan,
  Metal,
  OpenGL,
  WebGPU,
  PS5,
  Switch,
  Software,
} as const;

/**
 * @summary
 * The key type for the `backends` object.
 *
 * @description
 * The union is `'DX12' | 'Vulkan' | 'Metal' | 'OpenGL' | 'WebGPU'`.
 *
 * @example
 * const k: BackendKey = 'DX12';
 */
export type BackendKey = keyof typeof backends;
