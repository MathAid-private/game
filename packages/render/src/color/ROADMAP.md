
# Color Module Roadmap

## Purpose

The module abstracts color for the rendering pipeline. It sits between
game code that thinks in logical color spaces and GPU backends that want
concrete enums and structs.

This doc lists features that are not yet implemented and would improve
the module. It is organized by priority tier. Any tier can be cut or
reordered.

## How to read this doc

Each entry has four lines.

- **What.** The feature in one sentence.
- **Why.** The reason to build it.
- **Where.** The likely file or files.
- **Cost.** Small, medium, or large.

Priority tiers are rough guides. Tier 1 entries block common work.
Tier 4 entries are nice but optional.

## Patch
Question Decision Action
1. Mutation helper Yes, via a separate MutableColor type. It inherits from ColorValue. Added as Tier 1.7 and to Milestone 1.
2. Result vs throw Always throw. No change. convert and fromHex keep throwing.
3. Backend warn vs throw Throw is fine. No change.
4. Gradient type Yes. Linear, radial, multi-stop, and pattern rasters. Expanded Tier 2.2 into four sub-items.
5. Linear_Rec2020 Vulkan mapping Add it. Added as Tier 1.8 and to Milestone 1.

---

## Tier 1. Foundational gaps

These are things almost every game needs. They are missing today.

### 1.1 Color operations

- **What.** Add `lighten`, `darken`, `saturate`, `desaturate`,
  `rotateHue`, `invert`, `grayscale`, and `complement`.
- **Why.** Game code adjusts colors at runtime. Health bars darken when
  hurt. Selection rings saturate. These operations are common. Today
  callers convert to OKLCh, edit channels by hand, and convert back.
  That is boilerplate at every call site.
- **Where.** A new file `src/color/operations.ts`.
- **Cost.** Small. Each operation is ten to twenty lines.

### 1.2 Alpha compositing

- **What.** Add `over`, `under`, `premultiply`, `unpremultiply`, and
  `withAlpha`.
- **Why.** Sprite compositing, layer blending, and transparency need
  correct alpha math. Straight alpha and premultiplied alpha are easy
  to mix up. A correct implementation in one place prevents bugs.
- **Where.** A new file `src/color/composite.ts`.
- **Cost.** Small.

### 1.3 Typed-array bridge

- **What.** Add `toFloat32Array`, `fromFloat32Array`, `toUint8Array`,
  and `fromUint8Array`. Add a batch variant `convertBatch` that takes
  and returns typed arrays.
- **Why.** GPU uploads take typed arrays. Per-pixel loops on individual
  `ColorValue` objects allocate and box. A batch API avoids that cost.
- **Where.** Extend `src/color/convert.ts` or a new file
  `src/color/bridge.ts`.
- **Cost.** Medium.

### 1.4 Public Delta-E

- **What.** Export `deltaEOK`, `deltaE2000`, `deltaE76`, and
  `deltaEITP`.
- **Why.** `deltaEOKLab` exists but is private. Palette matching, color
  quantization, and animation easing need a distance function. The
  CSS spec uses delta-E for gamut mapping. Users cannot access it
  today.
- **Where.** A new file `src/color/difference.ts`.
- **Cost.** Small. The formulas are published.

### 1.5 Luminance and contrast

- **What.** Add `luminance`, `contrast`, `isLight`, `isDark`, and
  `readableTextOn`.
- **Why.** UI overlays need to pick black or white text. Accessibility
  audits need the WCAG contrast ratio. These are common in games with
  HUDs and menus.
- **Where.** A new file `src/color/accessibility.ts`.
- **Cost.** Small.

### 1.6 Immutable channel setters

- **What.** Add `withChannel(color, 'r', value)` and
  `withAlpha(color, a)`.
- **Why.** `ColorValue` is read-only. Callers build new objects by
  hand. A setter removes the boilerplate and keeps the space tag.
- **Where.** Extend `src/color/convert.ts`.
- **Cost.** Small.

### 1.7 Mutable color type

- What. Add a `MutableColor<S>` type. It inherits from `ColorValue<S>` but drops the readonly modifiers on `r`, `g`, `b`, `a`. Add `toMutable(color)` and `toImmutable(color)` converters.
- Why. Hot loops in particle systems and per-frame tint updates allocate a new `ColorValue` on every edit. A mutable variant removes that allocation. The immutable variant stays the default so accidental aliasing stays rare.
- Where. A new file `src/color/mutable.ts`.
- Cost. Small.

### 1.8 Vulkan mapping for `Linear_Rec2020`

- What. Add a `VkColorSpace` value for `Linear_Rec2020`. Use `VK_COLOR_SPACE_EXTENDED_SRGB_LINEAR_EXT` is wrong. Vulkan has no native `BT.2020` linear enum. Fall back to `VK_COLOR_SPACE_HDR10_ST2084_EXT` is also wrong. The correct fallback is `VK_COLOR_SPACE_PASS_THROUGH_EXT` plus a shader-side note.
- Why. Callers should not have to catch an exception for a common HDR space.
- Where. Extend `src/color/backend.ts`.
- Cost. Small.

---

## Tier 2. Common needs

These appear in most medium and large projects.

### 2.1 CSS parsing and serialization

- **What.** Add `fromCSS` and `toCSS`. Support `rgb()`, `rgba()`,
  `hsl()`, `hsla()`, `oklch()`, `color(display-p3 ...)`, and named
  colors.
- **Why.** Designers and tools speak CSS. Level editors import CSS.
  Web builds share palettes with the web app. A round-trip path stops
  every team from writing their own parser.
- **Where.** A new file `src/color/css.ts`.
- **Cost.** Medium. The CSS Color 4 grammar is large.

### 2.2 Gradient and raster types

- What. Add four gradient kinds and one raster kind.
  - `LinearGradient` with two points.
  - `RadialGradient` with a center and two radii.
  - `MultiStopGradient` with an arbitrary stop list.
  - `PatternRaster` with an image plus tile and transform modes.
- Why. Games need all four. Health bars use linear. Light glows use radial. Sky boxes use multi-stop. UI backdrops use patterns.
· Where. A new directory `src/color/gradient/` with one file per kind plus an `index.ts`.
- Cost. Medium to large.

### 2.2 Gradient interpolation

- **What.** Add `gradient(stops, t, workingSpace)` for multi-stop
  ramps. Add a premultiplied-alpha option to `mix`.
- **Why.** Games use gradients for health bars, heat maps, sky boxes,
  and particle aging. Two-color `mix` covers the simple case only.
- **Where.** A new file `src/color/gradient.ts`.
- **Cost.** Small.

### 2.3 More input spaces

- **What.** Add `HSL`, `HSV`, `HWB`, `CIE_Lab`, `CIE_LCh`, `YCbCr`,
  and `ICtCp`.
- **Why.** HSL and HSV are common in UI tools. CIE Lab is common in
  older tooling. YCbCr is common in video. ICtCp is common in HDR
  video. Game engines that touch any of these need the spaces.
- **Where.** Extend `src/color/space.ts`.
- **Cost.** Medium.

### 2.4 HDR tone mapping

- **What.** Add `toneMap(color, operator, params)`. Ship Reinhard,
  ACES filmic, AgX, and a simple exposure operator.
- **Why.** HDR output needs tone mapping to SDR for capture, screenshots,
  and streaming. Today callers write their own curves.
- **Where.** A new file `src/color/tone-mapping.ts`.
- **Cost.** Medium.

### 2.5 Quantization and dithering

- **What.** Add `quantize(color, bits)` and `dither(image, mode)`.
  Ship Bayer ordered dithering and Floyd-Steinberg.
- **Why.** Retro-style games and low-bit-depth targets need this.
  Quantizing to 565, 4444, or 1010102 is a routine step for mobile
  and for pixel-art rendering.
- **Where.** A new file `src/color/quantize.ts`.
- **Cost.** Medium.

### 2.6 Packed integer formats

- **What.** Add `fromUint32` and `toUint32` for RGBA8 and BGRA8
  packed integers. Add `fromRgb565` and `toRgb565`.
- **Why.** Font atlases, sprite sheets, and icon packs store colors as
  packed integers. Reading and writing those needs a helper.
- **Where.** Extend `src/color/convert.ts` or a new file
  `src/color/packed.ts`.
- **Cost.** Small.

---

## Tier 3. Advanced features

These are useful for specific pipelines. Build them when a project
needs them.

### 3.1 Chromatic adaptation

- **What.** Add `adapt(color, fromWhite, toWhite, method)`. Ship
  Bradford, Von Kries, and CAT02.
- **Why.** Print, ICC, and some camera pipelines use D50. sRGB, P3,
  and Rec.2020 use D65. Moving between them needs adaptation. Today
  the engine assumes D65 everywhere.
- **Where.** A new file `src/color/adaptation.ts`.
- **Cost.** Medium.

### 3.2 Log color spaces

- **What.** Add `ACEScct`, `ACEScc`, and `LogC3`.
- **Why.** Film pipelines and DI workflows use log spaces. They
  compress a wide dynamic range into a small code space. Games that
  ingest cinematic assets need them.
- **Where.** Extend `src/color/space.ts`.
- **Cost.** Medium. Each log curve is its own formula.

### 3.3 Modern HDR perceptual spaces

- **What.** Add `Jzazbz`, `JzCzHz`, and `ICtCp`.
- **Why.** OKLab is good for SDR. For HDR ranges above 1000 nits,
  Jzazbz and ICtCp are more uniform. Netflix, Dolby, and ITU use
  them for HDR delivery.
- **Where.** Extend `src/color/space.ts`.
- **Cost.** Large. The formulas are long.

### 3.4 CAM16 and HCT

- **What.** Add `CAM16` and `HCT`.
- **Why.** Material Design 3 uses HCT for dynamic theming. Games with
  adaptive UI palettes may want the same. This is a niche feature.
- **Where.** A new file `src/color/cam16.ts`.
- **Cost.** Large.

### 3.5 ICC profile reader

- **What.** Parse ICC v2 and v4 profiles. Support matrix and TRC
  profiles. Support A2B and B2A LUTs.
- **Why.** Asset pipelines ingest TIFFs and PNGs tagged with ICC
  profiles. Without a reader, those colors are guessed.
- **Where.** A new file `src/color/icc.ts`.
- **Cost.** Large.

### 3.6 Gamut expansion

- **What.** Add `expandGamut(color, targetSpace)`. This is the inverse
  of `mapToGamut`.
- **Why.** SDR content shown on an HDR display benefits from expansion.
  The mapping is not symmetric. Chroma can be recovered toward the
  wide gamut.
- **Where.** Extend `src/color/gamut-mapping.ts`.
- **Cost.** Medium.

---

## Tier 4. Nice to have

These are optional. They help specific workflows.

### 4.1 More backend adapters

- **What.** Add adapters for PlayStation 5, Nintendo Switch, and a
  software rasterizer reference.
- **Why.** Console builds need native mappings. A software adapter
  gives a reference for tests.
- **Where.** Extend `src/color/backend.ts` or split into
  `src/color/backend/`.
- **Cost.** Small per adapter.

### 4.2 Shader snippet generation

- **What.** Add `toShader(color, language)` for HLSL, GLSL, WGSL, and
  MSL.
- **Why.** Hand-written shader constants drift from engine constants.
  Generating them from the same source removes the drift.
- **Where.** A new file `src/color/shader.ts`.
- **Cost.** Small.

### 4.3 Development tools

- **What.** Add a debug color picker, a space explorer, and a dev-only
  warning when a color is out of gamut for the target backend.
- **Why.** Most color bugs are found late. Dev warnings catch them at
  author time.
- **Where.** A new file `src/color/debug.ts` and a separate dev-tools
  package.
- **Cost.** Medium.

### 4.4 Native serialization

- **What.** Add JSON, MessagePack, and FlatBuffers serializers for
  palettes and gradients.
- **Why.** Editor tools and asset pipelines need a stable wire format.
- **Where.** A new file `src/color/serialize.ts`.
- **Cost.** Medium.

### 4.5 SIMD batch operations

- **What.** Add a WASM or WebAssembly SIMD path for `convertBatch`.
- **Why.** Large images and textures need fast batch conversion. A
  hand-tuned path is ten to fifty times faster than scalar.
- **Where.** A new module under `src/color/wasm/`.
- **Cost.** Large.

### 4.6 Color science helpers

- **What.** Add `chromaticityCoordinates`, `dominantWavelength`,
  `colorTemperature`, and `metamerCheck`.
- **Why.** These help color grading, white balance, and spectral
  matching. They are niche but powerful.
- **Where.** A new file `src/color/science.ts`.
- **Cost.** Medium.

---

## Non-goals

These are things the module should not do. They belong in other
packages or in the consumer.

- **Full ICC v4 CMS.** Reading profiles is in scope. Full rendering
  intent handling is not. Use `lcms2` or similar via a binding.
- **Spectral rendering.** The module works with tristimulus values.
  Spectral upsampling is a rendering feature, not a color abstraction.
- **Print color management.** CMYK, spot colors, and Pantone are out
  of scope. The module targets real-time rendering.
- **Perceptual color appearance models beyond CAM16.** CIECAM02,
  Hunt, and RLAB are research tools. Skip them.
- **Image codecs.** PNG, JPEG, and EXR decoding belong in an asset
  pipeline package, not here.

---

## Open questions

1. **Should `ColorValue` allow mutation via a `with()` helper?**
   Read-only values are safer. They also allocate on every edit. Ask
   the team before adding mutators.
2. **Should `convert` return `Result` instead of throwing?**
   A `Result` type removes try/catch from hot paths. It also makes
   every call site longer. Decide before v2.
3. **Should the backend adapters warn or throw for unknown spaces?**
   Throw is safe. Warn plus a fallback is friendly. The current code
   throws. Revisit if users complain.
4. **Should the module ship its own gradient type?**
   A gradient is a color feature. It is also an animation feature.
   Decide which package owns it before building.
5. **Should `Linear_Rec2020` gain a Vulkan mapping?**
   No native enum exists. A shader-side hint is possible. Decide if
   that is a lie or a helpful default.

## Resolved decisions

| Question | Decision | Date |
|----------|----------|------|
| Mutation via `with()` | Add a separate `MutableColor<S>` type. See Tier 1.7. | Resolved |
| `Result` vs throw | Always throw. No `Result` return type. | Resolved |
| Backend warn vs throw | Always throw. | Resolved |
| Own gradient type | Yes. Linear, radial, multi, pattern. See Tier 2.2. | Resolved |
| `Linear_Rec2020` Vulkan | Add a mapping. See Tier 1.8. | Resolved |


---

## Suggested order of work

If the team wants a plan, use this order.

```text
  Milestone 1   Tier 1.1, 1.2, 1.4, 1.5, 1.6
  Milestone 2   Tier 1.3, 2.2, 2.6
  Milestone 3   Tier 2.1, 2.3, 2.4
  Milestone 4   Tier 2.5, 3.1, 3.2
  Milestone 5   Tier 3.3, 3.5, 3.6
  Milestone 6   Tier 4 items as demand dictates
```

Milestone 1 fills the gaps that every game hits. Milestone 2 removes
boilerplate from GPU paths. Milestone 3 handles UI and video. Later
milestones serve specific pipelines.

## Change log

| Date | Change |
|------|--------|
| (initial) | Roadmap created from a review of the current module. |

## Notes on the doc

1. The **Non-goals** section matters as much as the feature list. A color module can grow without bound. Stating what stays out keeps it small.
2. The **Open questions** section flags decisions that need a human. Writing them down early prevents arguments later.
3. The **Suggested order of work** section is optional. Cut it if the team tracks work elsewhere.
4. The tiers are ordered by frequency of need, not by difficulty. Tier 1 items are small. Tier 3 and 4 items can be large. Cost is noted per item so the reader can see this.
5. The doc uses the same STE-flavored prose as the code comments. Active voice, short sentences, no em dashes, no semicolons in prose.