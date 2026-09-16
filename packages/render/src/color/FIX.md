# Batch 1: Applied Fixes and New Files

## Summary of changes

| Error | Fix |
|-------|-----|
| #1, #15 | `_brand` is now a runtime `const` with `unique symbol` type. Exported so users can build their own spaces. `makeSpace` is exported for the same reason. |
| #2, #12 | `channelRange` (one pair) is replaced by `channelRanges` (one pair per channel). `isInRange`, `clampToRange`, and `clampGamut` now read per-channel bounds. |
| #3 | `XYZ_D65.channelRanges` widened to `-65504` to `65504`. |
| #4 | `oklch-raytrace` removed from the union. Only implemented methods remain. |
| #5 | White and black poles now convert `OKLab` white and black to the target space. |
| #6 | Vulkan `Linear_P3` maps to `VK_COLOR_SPACE_DISPLAY_P3_LINEAR_EXT`. `Linear_Rec2020` removed from the map so it throws instead of silently lying. |
| #7 | `'GL_FRAMEBUFFER_SRGB (EXT)'` removed. `Display_P3` now uses `'GL_FRAMEBUFFER_SRGB'`. |
| #8 | `DX12.clearColor` now converts to `Linear_sRGB` before emitting the struct. |
| #9 | `ColorValue._space` docs corrected in `convert.ts`. |
| #10 | `fromHex` now validates input and accepts `#RGB`, `#RGBA`, `#RRGGBB`, and `#RRGGBBAA`. |
| #11 | `RGBA4f` removed. |
| #13 | WebGPU `Linear_P3` and `Linear_Rec2020` now map to `'display-p3'`. |
| #14 | `Mat3` doc corrected to row-major in the previous round. |
