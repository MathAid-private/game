/**
 * @fileoverview Tests for the backend adapters.
 *
 * @summary
 * Covers `DX12`, `Vulkan`, `Metal`, `OpenGL`, `WebGPU`, and the
 * `backends` object.
 *
 * @description
 * The tests check that every adapter maps each supported color space
 * to an enum constant. They also check that the clear-color values are
 * in the expected space.
 *
 * @author MathAid
 */

import {
  backends,
  convert,
  Display_P3,
  DX12,
  Linear_Rec2020,
  Linear_sRGB,
  make,
  Metal,
  OpenGL,
  PS5,
  Software,
  sRGB,
  Switch,
  Vulkan,
  WebGPU,
} from '@games/render';
import { describe, expect, it } from 'vitest';

describe('backends object', () => {
  it('contains all five adapters', () => {
    expect(Object.keys(backends).sort()).toEqual(
      ['DX12', 'Metal', 'OpenGL', 'Vulkan', 'WebGPU'].sort(),
    );
  });
});

describe('DX12 adapter', () => {
  it('maps sRGB to a DXGI color-space enum', () => {
    expect(DX12.colorSpaceEnum('sRGB')).toBe('DXGI_COLOR_SPACE_RGB_FULL_G22_NONE_P709');
  });

  it('maps sRGB to a pixel format', () => {
    expect(DX12.pixelFormatEnum('sRGB')).toBe('DXGI_FORMAT_B8G8R8A8_UNORM_SRGB');
  });

  it('throws for a space with no mapping', () => {
    expect(() => DX12.colorSpaceEnum('XYZ_D65' as never)).toThrow(/DX12/);
  });

  it('clearColor emits linear values', () => {
    const out = DX12.clearColor(make(sRGB, 1, 0, 0));
    const ref = convert(make(sRGB, 1, 0, 0), Linear_sRGB);
    expect(out.Color[0]).toBeCloseTo(ref.r, 5);
    expect(out.Color[1]).toBeCloseTo(ref.g, 5);
    expect(out.Color[2]).toBeCloseTo(ref.b, 5);
  });

  it('configure returns a swap-chain and back-buffer pair', () => {
    const out = DX12.configure('sRGB');
    expect(out.SwapChainColorSpace).toBe('DXGI_COLOR_SPACE_RGB_FULL_G22_NONE_P709');
    expect(out.BackBufferFormat).toBe('DXGI_FORMAT_B8G8R8A8_UNORM_SRGB');
  });
});

describe('Vulkan adapter', () => {
  it('maps sRGB to a Vulkan color space', () => {
    expect(Vulkan.colorSpaceEnum('sRGB')).toBe('VK_COLOR_SPACE_SRGB_NONLINEAR_KHR');
  });

  it('maps Linear_P3 to the linear P3 enum', () => {
    expect(Vulkan.colorSpaceEnum('Linear_P3')).toBe('VK_COLOR_SPACE_DISPLAY_P3_LINEAR_EXT');
  });

  it('maps Linear_Rec2020 to pass-through', () => {
    expect(Vulkan.colorSpaceEnum('Linear_Rec2020')).toBe('VK_COLOR_SPACE_PASS_THROUGH_EXT');
  });

  it('maps Linear_Rec2020 to pass-through', () => {
    expect(Vulkan.colorSpaceEnum('Linear_Rec2020')).toBe('VK_COLOR_SPACE_PASS_THROUGH_EXT');
  });

  it('clearColor emits a float32 tuple', () => {
    const out = Vulkan.clearColor(make(sRGB, 0.5, 0.5, 0.5));
    expect(out.float32).toHaveLength(4);
  });

  it('configure returns format and colorSpace', () => {
    const out = Vulkan.configure('sRGB');
    expect(out.format).toBe('VK_FORMAT_B8G8R8A8_SRGB');
    expect(out.colorSpace).toBe('VK_COLOR_SPACE_SRGB_NONLINEAR_KHR');
  });
});

describe('Metal adapter', () => {
  it('maps sRGB to kCGColorSpaceSRGB', () => {
    expect(Metal.colorSpaceEnum('sRGB')).toBe('kCGColorSpaceSRGB');
  });

  it('maps PQ to kCGColorSpaceITUR_2100_PQ', () => {
    expect(Metal.colorSpaceEnum('PQ_Rec2020')).toBe('kCGColorSpaceITUR_2100_PQ');
  });

  it('clearColor returns red, green, blue, alpha keys', () => {
    const out = Metal.clearColor(make(sRGB, 1, 0, 0));
    expect(out).toHaveProperty('red');
    expect(out).toHaveProperty('green');
    expect(out).toHaveProperty('blue');
    expect(out).toHaveProperty('alpha');
  });

  it('configure sets extended dynamic range for HDR spaces', () => {
    expect(Metal.configure('PQ_Rec2020').wantsExtendedDynamicRange).toBe(true);
    expect(Metal.configure('sRGB').wantsExtendedDynamicRange).toBe(false);
  });
});

describe('OpenGL adapter', () => {
  it('maps sRGB to GL_FRAMEBUFFER_SRGB', () => {
    expect(OpenGL.colorSpaceEnum('sRGB')).toBe('GL_FRAMEBUFFER_SRGB');
  });

  it('does not use invented enum strings', () => {
    for (const id of ['sRGB', 'Display_P3', 'Linear_P3'] as const) {
      const v = OpenGL.colorSpaceEnum(id);
      expect(v).not.toMatch(/\(/);
    }
  });

  it('sets framebufferSRGB for sRGB and Display P3', () => {
    expect(OpenGL.configure('sRGB').framebufferSRGB).toBe(true);
    expect(OpenGL.configure('Display_P3').framebufferSRGB).toBe(true);
    expect(OpenGL.configure('Linear_sRGB').framebufferSRGB).toBe(false);
  });
});

describe('WebGPU adapter', () => {
  it('maps sRGB to srgb canvas color space', () => {
    expect(WebGPU.colorSpaceEnum('sRGB')).toBe('srgb');
  });

  it('maps Display_P3 to display-p3', () => {
    expect(WebGPU.colorSpaceEnum('Display_P3')).toBe('display-p3');
  });

  it('maps Linear_P3 to display-p3', () => {
    expect(WebGPU.colorSpaceEnum('Linear_P3')).toBe('display-p3');
  });

  it('maps Linear_Rec2020 to display-p3', () => {
    expect(WebGPU.colorSpaceEnum('Linear_Rec2020')).toBe('display-p3');
  });

  it('configure sets extended tone mapping for HDR spaces', () => {
    expect(WebGPU.configure('PQ_Rec2020').toneMappingMode).toBe('extended');
    expect(WebGPU.configure('sRGB').toneMappingMode).toBe('standard');
  });

  it('clearColor returns r, g, b, a keys', () => {
    const out = WebGPU.clearColor(make(Display_P3, 0.0, 0.9, 0.5));
    expect(out).toHaveProperty('r');
    expect(out).toHaveProperty('g');
    expect(out).toHaveProperty('b');
    expect(out).toHaveProperty('a');
  });
});

describe('backends object', () => {
  it('contains all eight adapters', () => {
    expect(Object.keys(backends).sort()).toEqual(
      ['DX12', 'Metal', 'OpenGL', 'PS5', 'Software', 'Switch', 'Vulkan', 'WebGPU'].sort(),
    );
  });
});

describe('PS5 adapter', () => {
  it('maps sRGB', () => {
    expect(PS5.colorSpaceEnum('sRGB')).toBe('kColorSpaceSRGB');
  });

  it('clearColor emits a 4-tuple', () => {
    const out = PS5.clearColor(make(sRGB, 1, 0, 0));
    expect(out.color).toHaveLength(4);
    expect(out.format).toBe('kB8G8R8A8SRGB');
  });

  it('configure sets hdr for PQ', () => {
    expect(PS5.configure('PQ_Rec2020').hdr).toBe(true);
    expect(PS5.configure('sRGB').hdr).toBe(false);
  });

  it('throws on unknown space', () => {
    expect(() => PS5.colorSpaceEnum('XYZ_D65' as never)).toThrow(/PS5/);
  });
});

describe('Switch adapter', () => {
  it('maps sRGB', () => {
    expect(Switch.colorSpaceEnum('sRGB')).toBe('NVN_COLOR_SPACE_SRGB');
  });

  it('clearColor emits a 4-tuple', () => {
    const out = Switch.clearColor(make(Display_P3, 0, 0.9, 0.5));
    expect(out.rgba).toHaveLength(4);
  });

  it('configure sets hdr for PQ', () => {
    expect(Switch.configure('PQ_Rec2020').hdr).toBe(true);
  });
});

describe('Software adapter', () => {
  it('emits 8-bit sRGB bytes', () => {
    const out = Software.clearColor(make(sRGB, 1, 0, 0));
    expect(Array.from(out)).toEqual([255, 0, 0, 255]);
  });

  it('clamps out-of-range values', () => {
    const out = Software.clearColor(make(Linear_Rec2020, 2, -1, 0.5));
    expect(out[0]).toBe(255);
    expect(out[1]).toBe(0);
  });

  it('configure returns the fixed format and space', () => {
    const c = Software.configure('sRGB');
    expect(c.format).toBe('rgba8unorm');
    expect(c.colorSpace).toBe('srgb');
  });

  it('configure ignores the id argument', () => {
    const a = Software.configure();
    const b = Software.configure('sRGB');
    const c = Software.configure('Display_P3');
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });
});
