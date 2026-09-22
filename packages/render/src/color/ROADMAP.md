# Color Module Roadmap

## Purpose

The module abstracts color for the rendering pipeline. It sits between
game code that thinks in logical color spaces and GPU backends that
want concrete enums and structs.

This doc tracks features for the module. It is organized by priority
tier. Completed items are marked. Open questions are resolved.

## Location

Source lives at `packages/render/src/color`. The package barrel is
`packages/render/src/index.ts`.

Tests live at `packages/render/test`. They are outside `src`.

## Import rules

The rule depends on where the code lives.

```
  Application code      import { make } from '@games/render';
  Tests                 import { make } from '@games/render';
  Source in src/color   import { make } from './convert';
  Source in src/color   import { sRGB } from '../space';
  Never                 import { make } from '@games/render/src/...';
```

## How to read this doc

Each entry has four lines.

- **What.** The feature in one sentence.
- **Why.** The reason to build it.
- **Where.** The file or files.
- **Status.** Done, in progress, or open.

Priority tiers are rough guides. Tier 1 entries block common work.
Tier 4 entries are nice but optional.

## Resolved decisions

| Question                | Decision                                                       |
| ----------------------- | -------------------------------------------------------------- |
| Mutation via `with()`   | Add a separate `MutableColor<S>` type. Done in Tier 1.7.       |
| `Result` vs throw       | Always throw. No `Result` return type.                         |
| Backend warn vs throw   | Always throw.                                                  |
| Own gradient type       | Yes. Linear, radial, multi, pattern. Done in Tier 2.2.         |
| `Linear_Rec2020` Vulkan | Mapped to `VK_COLOR_SPACE_PASS_THROUGH_EXT`. Done in Tier 1.8. |

---

## Tier 1. Foundational gaps

These are things almost every game needs.

### 1.1 Color operations

- **What.** Add `lighten`, `darken`, `saturate`, `desaturate`,
  `rotateHue`, `invert`, `grayscale`, and `complement`.
- **Why.** Game code adjusts colors at runtime. Health bars darken
  when hurt. Selection rings saturate.
- **Where.** `src/color/operations.ts`.
- **Status.** Done.

### 1.2 Alpha compositing

- **What.** Add `over`, `under`, `premultiply`, `unpremultiply`, and
  `withAlpha`.
- **Why.** Sprite compositing and transparency need correct alpha
  math.
- **Where.** `src/color/composite.ts`.
- **Status.** Done. `withAlpha` lives in `convert.ts`.

### 1.3 Typed-array bridge

- **What.** Add `toFloat32Array`, `fromFloat32Array`, `toUint8Array`,
  `fromUint8Array`, and `convertBatch`.
- **Why.** GPU uploads take typed arrays. Per-color loops allocate and
  box.
- **Where.** `src/color/bridge.ts`.
- **Status.** Done. The `convertBatch` optimization is deferred to
  Tier 4.5.

### 1.4 Public Delta-E

- **What.** Export `deltaEOK`, `deltaE2000`, `deltaE76`, and
  `deltaEITP`.
- **Why.** Palette matching, quantization, and animation easing need a
  distance function.
- **Where.** `src/color/difference.ts`.
- **Status.** Done.

### 1.5 Luminance and contrast

- **What.** Add `luminance`, `contrast`, `isLight`, `isDark`, and
  `readableTextOn`.
- **Why.** UI overlays need to pick black or white text. Accessibility
  audits need the WCAG ratio.
- **Where.** `src/color/accessibility.ts`.
- **Status.** Done.

### 1.6 Immutable channel setters

- **What.** Add `withChannel(color, 'r', value)` and
  `withAlpha(color, a)`.
- **Why.** `ColorValue` is read-only. Callers build new objects by
  hand.
- **Where.** `src/color/convert.ts`.
- **Status.** Done.

### 1.7 Mutable color type

- **What.** Add a `MutableColor<S>` type plus `toMutable` and
  `toImmutable`.
- **Why.** Hot loops allocate a new `ColorValue` on every edit.
- **Where.** `src/color/mutable.ts`.
- **Status.** Done.

### 1.8 Vulkan mapping for `Linear_Rec2020`

- **What.** Map `Linear_Rec2020` to a Vulkan enum.
- **Why.** Callers should not catch an exception for a common HDR
  space.
- **Where.** `src/color/backend.ts`.
- **Status.** Done. Mapped to `VK_COLOR_SPACE_PASS_THROUGH_EXT` with a
  shader-side note.

---

## Tier 2. Common needs

These appear in most medium and large projects.

### 2.1 CSS parsing and serialization

- **What.** Add `fromCSS` and `toCSS`. Support `rgb()`, `rgba()`,
  `hsl()`, `hsla()`, `oklch()`, `color(display-p3 ...)`, and named
  colors.
- **Why.** Designers and tools speak CSS.
- **Where.** `src/color/w3c/css.ts` and `src/color/w3c/css-named.ts`.
- **Status.** Done. Moved into a `w3c/` subdirectory.

### 2.2 Gradient and raster types

- **What.** Add `LinearGradient`, `RadialGradient`,
  `MultiStopGradient`, and `PatternRaster`.
- **Why.** Health bars use linear. Light glows use radial. Sky boxes
  use multi-stop. UI backdrops use patterns.
- **Where.** `src/color/gradient/`.
- **Status.** Done.

### 2.3 More input spaces

- **What.** Add `HSL`, `HSV`, `HWB`, `CIE_Lab`, `CIE_LCh`, `YCbCr`,
  and `ICtCp`.
- **Why.** HSL and HSV are common in UI tools. CIE Lab is common in
  older tooling. YCbCr is common in video. ICtCp is common in HDR
  video.
- **Where.** `src/color/space.ts` and `src/color/convert.ts`.
- **Status.** Done.

### 2.4 HDR tone mapping

- **What.** Add `toneMap(color, operator, params)`. Ship Reinhard,
  extended Reinhard, ACES filmic, AgX, and exposure.
- **Why.** HDR output needs tone mapping to SDR.
- **Where.** `src/color/tone-mapping.ts`.
- **Status.** Done. AgX uses a compact fit.

### 2.5 Quantization and dithering

- **What.** Add `quantize(color, bits)` and `dither(image, mode)`.
  Ship Bayer ordered dithering and Floyd-Steinberg.
- **Why.** Retro-style games and low-bit-depth targets need this.
- **Where.** `src/color/quantize.ts`.
- **Status.** Done.

### 2.6 Packed integer formats

- **What.** Add `toRGBA8`, `fromRGBA8`, `toBGRA8`, `fromBGRA8`,
  `toRgb565`, and `fromRgb565`.
- **Why.** Font atlases and sprite sheets store colors as packed
  integers.
- **Where.** `src/color/packed.ts`.
- **Status.** Done.

---

## Tier 3. Advanced features

These are useful for specific pipelines.

### 3.1 Chromatic adaptation

- **What.** Add `adapt(color, fromWhite, toWhite, method)`. Ship
  Bradford, Von Kries, CAT02, and XYZ scaling.
- **Why.** Print, ICC, and some camera pipelines use D50.
- **Where.** `src/color/adaptation.ts`.
- **Status.** Done.

### 3.2 Log color spaces

- **What.** Add `ACEScct`, `ACEScc`, and `LogC3`.
- **Why.** Film pipelines and DI workflows use log spaces.
- **Where.** `src/color/space.ts`.
- **Status.** Done.

### 3.3 Modern HDR perceptual spaces

- **What.** Add `Jzazbz` and `JzCzHz`.
- **Why.** For HDR ranges above 1000 nits, Jzazbz is more uniform
  than OKLab.
- **Where.** `src/color/space.ts`.
- **Status.** Open. `ICtCp` already shipped in Tier 2.3.

### 3.4 CAM16 and HCT

- **What.** Add `CAM16` and `HCT`.
- **Why.** Material Design 3 uses HCT for dynamic theming.
- **Where.** `src/color/cam16.ts`.
- **Status.** Open. Niche.

### 3.5 ICC profile reader

- **What.** Parse ICC v2 and v4 profiles. Support matrix and TRC
  profiles. Support A2B and B2A LUTs.
- **Why.** Asset pipelines ingest TIFFs and PNGs tagged with ICC
  profiles.
- **Where.** `src/color/icc.ts`.
- **Status.** Open. Large.

### 3.6 Gamut expansion

- **What.** Add `expandGamut(color, targetSpace)`. The inverse of
  `mapToGamut`.
- **Why.** SDR content on an HDR display benefits from expansion.
- **Where.** `src/color/gamut-mapping.ts`.
- **Status.** Open.

---

## Tier 4. Nice to have

These are optional.

### 4.1 More backend adapters

- **What.** Add adapters for PlayStation 5, Nintendo Switch, and a
  software rasterizer reference.
- **Where.** `src/color/backend.ts`.
- **Status.** Open. Small per adapter.

### 4.2 Shader snippet generation

- **What.** Add `toShader(color, language)` for HLSL, GLSL, WGSL, and
  MSL.
- **Where.** `src/color/shader.ts`.
- **Status.** Open.

### 4.3 Development tools

- **What.** Add a debug color picker and a dev-only gamut warning.
- **Where.** `src/color/debug.ts` and a dev-tools package.
- **Status.** Open.

### 4.4 Native serialization

- **What.** Add JSON, MessagePack, and FlatBuffers serializers for
  palettes and gradients.
- **Where.** `src/color/serialize.ts`.
- **Status.** Open.

### 4.5 SIMD batch operations

- **What.** Add a WASM or WebAssembly SIMD path for `convertBatch`.
- **Why.** Large images and textures need fast batch conversion.
- **Where.** `src/color/wasm/`.
- **Status.** Open. Large.

### 4.6 Color science helpers

- **What.** Add `chromaticityCoordinates`, `dominantWavelength`,
  `colorTemperature`, and `metamerCheck`.
- **Where.** `src/color/science.ts`.
- **Status.** Open.

---

## Non-goals

These belong in other packages or in the consumer.

- **Full ICC v4 CMS.** Reading profiles is in scope. Full rendering
  intent handling is not.
- **Spectral rendering.** The module works with tristimulus values.
- **Print color management.** CMYK, spot colors, and Pantone are out
  of scope.
- **Perceptual color appearance models beyond CAM16.** CIECAM02,
  Hunt, and RLAB are research tools.
- **Image codecs.** PNG, JPEG, and EXR decoding belong in an asset
  pipeline package.

---

## Milestone history

```text
  Milestone 1 (Foundation)     Done.
    1.1 operations.ts
    1.2 composite.ts
    1.4 difference.ts
    1.5 accessibility.ts
    1.6 convert.ts additions
    1.7 mutable.ts
    1.8 backend.ts Vulkan fix

  Milestone 2 (GPU Bridge)     Done.
    1.3 bridge.ts
    2.6 packed.ts
    2.2 gradient/

  Milestone 3 (Authoring)      Done.
    2.3 space.ts additions
    2.1 w3c/css.ts
    2.1 w3c/css-named.ts
    2.4 tone-mapping.ts

  Milestone 4 (Retro and Advanced)  Done.
    3.2 space.ts log additions
    3.1 adaptation.ts
    2.5 quantize.ts
```

## Next steps

If the team wants to continue, use this order.

```text
  Milestone 5   Tier 3.3 (Jzazbz), 3.5 (ICC reader), 3.6 (expansion)
  Milestone 6   Tier 4 items as demand dictates
```

Milestone 5 serves HDR and asset pipelines. Milestone 6 is optional.

## Change log

| Date          | Change                                                   |
| ------------- | -------------------------------------------------------- |
| (initial)     | Roadmap created from a review of the module.             |
| (milestone 1) | Tier 1 features done.                                    |
| (milestone 2) | Typed-array bridge, packed formats, gradients done.      |
| (milestone 3) | CSS parsing, new spaces, tone mapping done.              |
| (milestone 4) | Adaptation, log spaces, quantization done.               |
| (current)     | Docs updated. Import paths aligned with `@games/render`. |

## Notes on the doc

1. The **Non-goals** section matters as much as the feature list. A
   color module can grow without bound. Stating what stays out keeps
   it small.
2. The **Resolved decisions** section records past choices. Do not
   reopen a resolved item without a new reason.
3. The tiers are ordered by frequency of need, not by difficulty.
4. The module uses the STE-flavored prose in code comments. Active
   voice. Short sentences. No em dashes. No semicolons in prose.
5. Every source file has a matching test file under
   `packages/render/test`. Add both together.
6. Every new public symbol is exported from `src/color/index.ts`
   and re-exported by `packages/render/src/index.ts`.
   Application code and tests import from `@games/render`.
   Source files inside `src/color/` import each other with
   relative paths.
7. Every new public symbol is exported from `src/color/index.ts` and
   re-exported by `packages/render/src/index.ts`. Tests import from
   `@games/render`.

---

## Notes on these updates

1. **Import style.** Every example now imports from `@games/render`. No example uses a relative file path. The Vitest config maps the package name to `packages/render/src/index.ts` so tests run against source.

2. **Location notes.** The README's module map shows the full tree under `packages/render`. The test directory is separate from `src`. The roadmap's "Location" section states the same.

3. **Space count.** The README now says twenty-two spaces. The table is split by category. Twelve original plus seven from Milestone 3 plus three from Milestone 4 equals twenty-two.

4. **Vulkan fix.** The "Known limits" section no longer says the Vulkan adapter throws for `Linear_Rec2020`. It now states the pass-through mapping and the shader responsibility.

5. **Roadmap status.** Every Tier 1 through Tier 4 item now has a `Status` line. Done items say "Done". Open items say "Open".

6. **Milestone history.** The roadmap ends with a Milestone history section. Each milestone lists its features and a status word.

7. **Test directory reference.** The README's module map shows `test/` as a sibling of `src/`. The roadmap's "How to read this doc" mentions the same. The design rules list "One test file per source file" as rule 7.

8. **Import path rule.** The design rules now include rule 6: "Import from the package barrel." This makes the convention explicit for future contributors.
