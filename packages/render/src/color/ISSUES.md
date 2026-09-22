# Batch 1: Implementation Error Report

Before the documentation, here are the implementation errors I found. Please decide what to fix.

| # | File | Location | Severity | Problem |
|---|------|----------|----------|---------|
| 1 | `space.ts` | `_brand` + `makeSpace` | High | `declare const _brand: unique symbol` has no runtime value. The object literal `{ [_brand]: id }` refers to an undefined variable. In an ES module this throws `ReferenceError` at load time. Fix: use `const _brand = Symbol('ColorSpace')` at runtime, or drop the key. |
| 2 | `space.ts` | `OKLCh.channelRange` | High | `{ min: 0, max: 360 }` applies to L, C, and H. Only H is 0 to 360. L is 0 to 1. C is roughly 0 to 0.4. This breaks `isInRange`, `clampToRange`, and `mapToGamut` for OKLCh. |
| 3 | `space.ts` | `XYZ_D65.channelRange` | Medium | `{ min: 0, max: 1 }` rejects HDR XYZ values. XYZ can exceed 1 for HDR and for wide-gamut primaries. |
| 4 | `gamut-mapping.ts` | `mapToGamut` | Medium | `'oklch-raytrace'` falls through to `cssChromaBisect`. The raytrace method is declared but not implemented. Callers get CSS chroma bisection silently. |
| 5 | `gamut-mapping.ts` | `cssChromaBisect` (white/black poles) | Medium | The white pole returns `(max, max, max)`. For OKLab this is `(1, 1, 1)`, which is not white. For OKLCh it is `(360, 360, 360)`, which is not white. |
| 6 | `backend.ts` | `Vulkan.colorSpaceEnum` | High | `Linear_P3` maps to `VK_COLOR_SPACE_DISPLAY_P3_NONLINEAR_EXT` (non-linear). `Linear_Rec2020` maps to `VK_COLOR_SPACE_HDR10_ST2084_EXT` (PQ, not linear). |
| 7 | `backend.ts` | `OpenGL.colorSpaceEnum` | Low | `'GL_FRAMEBUFFER_SRGB (EXT)'` is not a real GL enum. The `(EXT)` suffix is invented. |
| 8 | `backend.ts` | `DX12.clearColor` | Medium | Values are converted to sRGB encoded and paired with `DXGI_FORMAT_B8G8R8A8_UNORM_SRGB`. DX12 expects linear clear values for sRGB formats. Verify against the D3D12 clear-value spec. |
| 9 | `convert.ts` | `ColorValue._space` doc | Doc | The comment says the field is "erased at runtime" and "not written". `make` writes it. `convert` reads it. Fix the comment. |
| 10 | `convert.ts` | `fromHex` | Low | No input validation. No support for `#RGB` or `#RGBA`. Bad input gives `NaN` silently. |
| 11 | `backend.ts` | `RGBA4f` | Low | Declared but unused in the file. |
| 12 | `convert.ts` | `isInRange`, `clampToRange` | High | One min/max pair is used for all three channels. Wrong for OKLab, OKLCh, XYZ, and ACES. Linked to #2. |
| 13 | `backend.ts` | `WebGPU.colorSpaceEnum` | Medium | `Linear_P3` returns `'display-p3'` (non-linear). `Linear_Rec2020` returns `'srgb'`. |
| 14 | `space.ts` | `Mat3` doc | Doc | The comment says "column-major". `mulMat3` uses row-major indexing. |
| 15 | `space.ts` | `ColorSpaceDef` | High | Same root cause as #1. The computed key uses a runtime-undefined symbol. |
