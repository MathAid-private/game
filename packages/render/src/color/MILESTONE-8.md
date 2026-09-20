# Milestone 8: Naming and Tuple Interop

## Goal

Two changes. First, rename the four channels on `ColorValue<S>` so
they do not pretend to be red, green, blue. Second, add a tuple-based
type for GPU boundaries and structured data. The tuple is a view. It
is never the canonical representation.

The rename is a hard break. The tuple interop is additive.

## Features

- 8.1 Rename `ColorValue` fields
- 8.2 Add `ColorTuple<S>` type
- 8.3 Add tuple to object conversions
- 8.4 Add tuple-aware public APIs
- 8.5 Downstream migration

## The two types

```ts
// The canonical representation. An object.
interface ColorValue<S extends ColorSpaceDef<string>> {
  readonly c1: number;
  readonly c2: number;
  readonly c3: number;
  readonly alpha: number;
  readonly _space: S;
}

// The view. A tuple.
type ColorTuple<S extends ColorSpaceDef<string>> =
  readonly [c1: number, c2: number, c3: number, alpha: number]
  & { readonly [colorTupleBrand]?: S };
```

`ColorValue<S>` is authoritative. It carries the runtime space tag.
`ColorTuple<S>` is a projection. The brand is type-only. It has no
runtime presence.

## The boundary rule

Every public function that accepts a tuple converts it to a
`ColorValue` at the top of the function. The rest of the function
works on the object. The conversion is a single `fromTuple` call.

```ts
export function convert<Src, Dst>(
  color: ColorValue<Src> | ColorTuple<Src>,
  from: Src,
  to: Dst,
): ColorValue<Dst> {
  const c = isColorValue(color) ? color : fromTuple(color, from);
  // ... rest uses `c` with the object shape
}
```

### Why the conversion exists

The module needs the object shape for four reasons. The tuple cannot
provide any of them.

1. **Runtime space tag.** `ColorValue<S>` carries `_space`. A tuple
   carries nothing. `convert` reads `_space` to know the source space
   without a separate argument.
2. **Structural typing reliability.** TypeScript narrows objects with
   `in`, discriminant fields, and type predicates. A tuple loses the
   tag on `[...c]`, `c.slice()`, `c.map()`, `structuredClone(c)`, and
   `JSON.parse(JSON.stringify(c))`. An object loses nothing.
3. **No WeakMap.** A tuple-based tag would need a `WeakMap<tuple,
   space>` for runtime lookup. That map is a leak risk and a
   performance cost. The object shape avoids it entirely.
4. **Predicates that would otherwise fail.** The `isColorValue`
   guard, the `in` operator on `_space`, and any future discriminant
   field all work on objects. They do not work on bare tuples.

Every doc comment on a tuple-accepting function must state this. See
section 8.4 for the exact wording.

## 8.1 Rename `ColorValue` fields

### Where

`packages/render/src/color/convert.ts`.

### Change

```text
  Old                New
  ---                ---
  c.r                c.c1
  c.g                c.c2
  c.b                c.c3
  c.a                c.alpha
  c._space           c._space   (unchanged)
```

### Why

`r`, `g`, `b` lie for OKLab, OKLCh, CIE Lab, HSL, YCbCr, and ICtCp.
The `L` channel is not red. The `a` channel in OKLab is not alpha.
The rename makes the fields honest. `c1` does not pretend to be a
color. `alpha` does not clash with OKLab's `a`.

### Implementation

Use the descriptor's `channelNames` to document which field means
what.

```ts
interface ColorValue<S extends ColorSpaceDef<string>> {
  /** First channel. See `descriptor.channelNames[0]`. */
  readonly c1: number;
  /** Second channel. See `descriptor.channelNames[1]`. */
  readonly c2: number;
  /** Third channel. See `descriptor.channelNames[2]`. */
  readonly c3: number;
  /** Alpha. Always linear, 0 to 1. */
  readonly alpha: number;
  /** The space object. Written by `make`. Read by `convert`. */
  readonly _space: S;
}
```

### Editor migration

A regex pass finds every access.

```text
  Search:  \.r\b
  Replace: .c1

  Search:  \.g\b
  Replace: .c2

  Search:  \.b\b
  Replace: .c3

  Search:  \.a\b
  Replace: .alpha
```

The `.a` search is the risky one. It matches unrelated identifiers.
Scope the search to files under `src/color/` and `test/`. Review each
hit before applying.

## 8.2 Add `ColorTuple<S>` type

### Where

New file `packages/render/src/color/tuple.ts`.

### Type

```ts
/**
 * @summary
 * A tuple projection of a `ColorValue<S>`.
 *
 * @description
 * The tuple is a view for GPU boundaries and structured data. It is
 * not the canonical representation. Every public function that
 * accepts a tuple converts it to a `ColorValue` at the boundary. The
 * object shape is required for the runtime space tag, for structural
 * typing, and for type predicates. See the module JSDoc for the full
 * reasoning.
 *
 * The brand on this type is type-only. It has no runtime presence. Do
 * not read it. Use the `from` argument on the consuming function to
 * state the space.
 *
 * @template S - The color space type. A `ColorSpaceDef<string>`.
 *
 * @example
 * const red: ColorTuple<typeof sRGB> = [1, 0, 0, 1];
 * const c = fromTuple(red, sRGB);
 * // c._space === sRGB
 */
export type ColorTuple<S extends ColorSpaceDef<string>> = readonly [
  c1: number,
  c2: number,
  c3: number,
  alpha: number,
] & { readonly [colorTupleBrand]?: S };

/**
 * A phantom brand. Type-only. Never set at runtime.
 */
declare const colorTupleBrand: unique symbol;
```

## 8.3 Add tuple to object conversions

### Where

`packages/render/src/color/tuple.ts`.

### Public API

    asTuple<S>(color: ColorValue<S>): ColorTuple<S>
    fromTuple<S>(tuple: ColorTuple<S>, space: S): ColorValue<S>
    makeTuple<S>(space: S, c1: number, c2: number, c3: number, alpha?: number): ColorTuple<S>
    isColorValue(value: unknown): value is ColorValue<ColorSpaceDef<string>>

### Implementation

```ts
/**
 * @summary
 * Project a `ColorValue<S>` to a `ColorTuple<S>`.
 *
 * @description
 * The function returns a fresh array. The array is a plain tuple with
 * no runtime tag. Mutations to the result do not affect the input.
 *
 * @template S - The color space type.
 * @param color - The source color.
 * @returns A new `ColorTuple<S>`.
 */
export function asTuple<S extends ColorSpaceDef<string>>(
  color: ColorValue<S>,
): ColorTuple<S> {
  return [color.c1, color.c2, color.c3, color.alpha] as ColorTuple<S>;
}

/**
 * @summary
 * Lift a `ColorTuple<S>` to a `ColorValue<S>`.
 *
 * @description
 * The function wraps the tuple in the object shape. The space is
 * taken from the `space` argument. The tuple cannot carry the space
 * at runtime. The caller must state it.
 *
 * @template S - The color space type.
 * @param tuple - The source tuple.
 * @param space - The color space. Becomes `_space` on the result.
 * @returns A new `ColorValue<S>`.
 */
export function fromTuple<S extends ColorSpaceDef<string>>(
  tuple: ColorTuple<S>,
  space: S,
): ColorValue<S> {
  return {
    c1: tuple[0],
    c2: tuple[1],
    c3: tuple[2],
    alpha: tuple[3],
    _space: space,
  };
}

/**
 * @summary
 * Build a `ColorTuple<S>` directly from channel values.
 *
 * @description
 * The function is a convenience for callers that build tuples at a
 * boundary. The `space` argument binds the type parameter. It is not
 * stored.
 *
 * @template S - The color space type.
 * @param space - The color space.
 * @param c1 - First channel.
 * @param c2 - Second channel.
 * @param c3 - Third channel.
 * @param alpha - Alpha. Defaults to 1.
 * @returns A new `ColorTuple<S>`.
 */
export function makeTuple<S extends ColorSpaceDef<string>>(
  space: S,
  c1: number,
  c2: number,
  c3: number,
  alpha = 1,
): ColorTuple<S> {
  void space;
  return [c1, c2, c3, alpha] as ColorTuple<S>;
}

/**
 * @summary
 * Type guard. Returns true when the value looks like a `ColorValue`.
 *
 * @description
 * The check reads the `_space` field. It is the runtime tag that
 * tuples cannot carry. This is the predicate that tuple-based types
 * would fail without the object conversion.
 *
 * @param value - The value to test.
 * @returns True when the value is a `ColorValue`.
 */
export function isColorValue(value: unknown): value is ColorValue<ColorSpaceDef<string>> {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return false;
  const v = value as { _space?: unknown };
  return (
    typeof v._space === 'object' &&
    v._space !== null &&
    'id' in v._space &&
    'descriptor' in v._space
  );
}
```

## 8.4 Add tuple-aware public APIs

### Which functions accept tuples

Three functions accept a tuple in addition to an object. Every other
public function stays object-only. Callers use `fromTuple` first.

```text
  convert      Accepts both. Reads `_space` from the object, or uses
               the `from` argument for the tuple.
  mapToGamut   Accepts both. Same pattern.
  checkGamut   Accepts both. Same pattern.
```

### Which functions do not

`make`, `format`, `mix`, `over`, `lighten`, `deltaEOK`, `luminance`,
`contrast`, `toCSS`, `toneMap`, `adapt`, `quantize`, `clearColor` and
every other public function accept `ColorValue<S>` only. Callers
wrap the tuple with `fromTuple` first.

### The doc note

Every tuple-accepting function carries this note in its JSDoc.

```md
 * @note
 * This function accepts a `ColorTuple<S>` in addition to a
 * `ColorValue<S>`. The tuple is converted to a `ColorValue` at the
 * top of the function. The rest of the function works on the object
 * shape.
 *
 * The conversion is required for three reasons.
 *
 *   1. The object carries the `_space` field. The tuple cannot. The
 *      function reads `_space` for the source space.
 *   2. TypeScript's structural typing and type predicates are
 *      reliable on objects. A tuple loses the space tag on
 *      `[...c]`, `c.slice()`, `structuredClone(c)`, and
 *      `JSON.parse(JSON.stringify(c))`. The object loses nothing.
 *   3. No `WeakMap` is needed. A tuple-based tag would require a
 *      global registry. The object shape avoids it.
 *
 * The tuple is a view. The object is the canonical form.
```

### Function shapes

```ts
/**
 * @summary
 * Convert a color from its source space to a destination space.
 *
 * @description
 * All conversions route through CIE XYZ D65. Alpha is copied
 * unchanged. When the source and destination are the same space, the
 * input is returned as-is.
 *
 * @note
 * This function accepts a `ColorTuple<Src>` in addition to a
 * `ColorValue<Src>`. The tuple is converted to a `ColorValue` at the
 * top of the function. The rest of the function works on the object
 * shape. See the module JSDoc for the reasoning.
 *
 * @template Src - The source space type.
 * @template Dst - The destination space type.
 * @param color - The source color. Object or tuple.
 * @param from - The source space. Required when `color` is a tuple.
 * @param to - The destination space.
 * @returns A new `ColorValue<Dst>`.
 */
export function convert<Src extends ColorSpaceDef<string>, Dst extends ColorSpaceDef<string>>(
  color: ColorValue<Src> | ColorTuple<Src>,
  from: Src,
  to: Dst,
): ColorValue<Dst> {
  const c = isColorValue(color) ? color : fromTuple(color, from);
  if (c._space.id === to.id) return c as unknown as ColorValue<Dst>;
  const [X, Y, Z] = toXYZ(c._space, c.c1, c.c2, c.c3);
  const [r, g, b] = fromXYZ(to, X, Y, Z);
  return make(to, r, g, b, c.alpha);
}
```

Note the `from` argument is now required on every call. This is the
one ergonomic cost. It is honest: the source space must be known at
the call site. For object inputs the argument is redundant. It is
still required for uniformity.

Two ways to avoid the redundancy.

**Option A.** Keep `convert` object-only. Add a separate
`convertTuple` for tuples. Callers pick.

**Option B.** Overload.

```ts
export function convert<Src, Dst>(
  color: ColorValue<Src>,
  to: Dst,
): ColorValue<Dst>;
export function convert<Src, Dst>(
  color: ColorTuple<Src>,
  from: Src,
  to: Dst,
): ColorValue<Dst>;
```

The overload keeps the two-argument form for objects. It adds the
three-argument form for tuples. This is the cleanest. Use Option B.

## 8.5 Downstream migration

### Steps

```text
  Step 1    Land the rename in convert.ts.
            Update every function in that file.
            Update every test that touches convert.ts.

  Step 2    Update gamut-mapping.ts and backend.ts.
            Update their tests.

  Step 3    Update every helper module. One file per pull request.
            accessibility.ts, difference.ts, operations.ts,
            composite.ts, bridge.ts, packed.ts.

  Step 4    Update gradient/ and w3c/.
            Update their tests.

  Step 5    Update tone-mapping.ts, adaptation.ts, quantize.ts.

  Step 6    Land tuple.ts. No consumer change yet.

  Step 7    Add the overloads to convert, mapToGamut, and checkGamut.

  Step 8    Update downstream consumers in @games/games, @games/render,
            and any other package that imports from @games/render.

  Step 9    Update every doc and example in the README, ROADMAP, and
            milestone files.

  Step 10   Tag the release. Something like @games/render@0.3.0.
```

### Editor help

The rename is a mechanical regex pass. Run it in this order.

```text
  1. Scope to `packages/render/src/color/` and `packages/render/test/`.
  2. Search `\.r\b`. Replace with `.c1`. Review.
  3. Search `\.g\b`. Replace with `.c2`. Review.
  4. Search `\.b\b`. Replace with `.c3`. Review.
  5. Search `\.a\b`. Replace with `.alpha`. Review each hit.
  6. Manual pass on every `_space` access. No change needed for the
     object shape. The tuple shape has no `_space`.
```

### New tests

Add a file `packages/render/test/tuple.test.ts`.

```ts
/**
 * @fileoverview Tests for the tuple view and the conversions.
 *
 * @summary
 * Covers `asTuple`, `fromTuple`, `makeTuple`, `isColorValue`, and the
 * tuple overloads on `convert`, `mapToGamut`, and `checkGamut`.
 *
 * @description
 * The tests confirm the boundary rule. Every tuple that enters a
 * public function is converted to a `ColorValue` first. The object
 * shape carries the runtime tag. The tuple does not.
 *
 * @author MathAid
 */

import { describe, expect, it } from 'vitest';
import { convert, make } from '../src/color/convert';
import { checkGamut, mapToGamut } from '../src/color/gamut-mapping';
import { Display_P3, Linear_sRGB, sRGB } from '../src/color/space';
import {
  asTuple,
  fromTuple,
  isColorValue,
  makeTuple,
} from '../src/color/tuple';

describe('asTuple', () => {
  it('projects the four channels in order', () => {
    const t = asTuple(make(sRGB, 1, 0.5, 0.25, 0.75));
    expect(t).toEqual([1, 0.5, 0.25, 0.75]);
  });

  it('does not alias the input', () => {
    const c = make(sRGB, 1, 0, 0);
    const t = asTuple(c);
    expect(t.length).toBe(4);
    expect(Array.isArray(t)).toBe(true);
  });
});

describe('fromTuple', () => {
  it('produces an object with the space tag', () => {
    const t = makeTuple(sRGB, 1, 0, 0);
    const c = fromTuple(t, sRGB);
    expect(c.c1).toBe(1);
    expect(c._space).toBe(sRGB);
  });

  it('reads alpha from the fourth slot', () => {
    const c = fromTuple(makeTuple(sRGB, 0, 0, 0, 0.5), sRGB);
    expect(c.alpha).toBe(0.5);
  });
});

describe('makeTuple', () => {
  it('defaults alpha to 1', () => {
    const t = makeTuple(sRGB, 1, 0, 0);
    expect(t[3]).toBe(1);
  });

  it('produces a plain 4-tuple', () => {
    const t = makeTuple(sRGB, 1, 0, 0);
    expect(t.length).toBe(4);
    expect(Array.isArray(t)).toBe(true);
  });
});

describe('isColorValue', () => {
  it('returns true for a ColorValue', () => {
    expect(isColorValue(make(sRGB, 1, 0, 0))).toBe(true);
  });

  it('returns false for a tuple', () => {
    expect(isColorValue([1, 0, 0, 1])).toBe(false);
  });

  it('returns false for null', () => {
    expect(isColorValue(null)).toBe(false);
  });

  it('returns false for a plain object', () => {
    expect(isColorValue({ c1: 1, c2: 0, c3: 0, alpha: 1 })).toBe(false);
  });
});

describe('convert with tuples', () => {
  it('accepts a tuple plus a from-space', () => {
    const t = makeTuple(sRGB, 1, 0, 0);
    const out = convert(t, sRGB, Linear_sRGB);
    expect(out._space).toBe(Linear_sRGB);
  });

  it('accepts an object without a from-space', () => {
    const out = convert(make(sRGB, 1, 0, 0), Linear_sRGB);
    expect(out._space).toBe(Linear_sRGB);
  });

  it('produces the same result for both paths', () => {
    const a = convert(make(sRGB, 0.5, 0.2, 0.8), Linear_sRGB);
    const b = convert(makeTuple(sRGB, 0.5, 0.2, 0.8), sRGB, Linear_sRGB);
    expect(b.c1).toBeCloseTo(a.c1, 6);
    expect(b.c2).toBeCloseTo(a.c2, 6);
    expect(b.c3).toBeCloseTo(a.c3, 6);
  });
});

describe('mapToGamut with tuples', () => {
  it('accepts a tuple plus a from-space', () => {
    const t = makeTuple(Display_P3, 0, 0.9, 0.5);
    const out = mapToGamut(t, Display_P3, sRGB);
    expect(out._space).toBe(sRGB);
    expect(checkGamut(out, sRGB).inGamut).toBe(true);
  });
});

describe('checkGamut with tuples', () => {
  it('accepts a tuple plus a from-space', () => {
    const t = makeTuple(Display_P3, 0, 0.9, 0.5);
    const r = checkGamut(t, Display_P3, sRGB);
    expect(r.inGamut).toBe(false);
  });
});
```

## Order of work

```text
  Step 1    8.1 Rename. One file. One test file.
  Step 2    8.1 Rename. Every other file. One pull request per file.
  Step 3    8.2 tuple.ts type.
  Step 4    8.3 tuple.ts conversions and guard.
  Step 5    8.4 Tuple overloads on convert, mapToGamut, checkGamut.
  Step 6    8.5 Downstream consumers.
  Step 7    8.5 Docs.
```

Steps 1 and 2 must land before 5. Steps 3 and 4 are independent. Step
5 depends on 4. Step 6 depends on 5. Step 7 depends on 6.

## Rollback plan

Work on a branch `feature/color-naming-tuple`. Do not merge to `main`
until every test passes.

The rename is atomic. A half-renamed module does not compile.
The tuple interop is additive. You can land the rename and ship
without tuples if the branch is too large.

## Definition of done

- `ColorValue<S>` uses `c1`, `c2`, `c3`, `alpha`, `_space`.
- `ColorTuple<S>` exists in `tuple.ts`.
- `asTuple`, `fromTuple`, `makeTuple`, and `isColorValue` are
  exported.
- `convert`, `mapToGamut`, and `checkGamut` accept tuples via
  overloads.
- Every tuple-accepting function carries the `@note` block.
- Every test passes.
- Every downstream package compiles.
- The README and every doc example use `c1`, `c2`, `c3`, `alpha`.
- The README documents the tuple view and the boundary rule.
- The type `ColorTuple<S>` is exported from the package barrel.

## Why the tuple is a view, not a type

Two reasons a caller might want a tuple.

1. The GPU boundary wants a plain 4-array. `asTuple` gives it.
2. Structured data (JSON, MessagePack, vertex buffers) wants a
   plain 4-array. `makeTuple` gives it.

Neither case needs the space tag at runtime. The caller knows the
space. The tuple is a projection. The object is the source of truth.

If a caller wants the space tag, use a `ColorValue`. If a caller
wants the tuple shape, use `asTuple` at the boundary and drop the
tag. Do not try to smuggle the tag through the tuple. It will not
survive `[...c]`, `c.slice()`, `structuredClone(c)`, or a JSON
round-trip. The object shape is the reliable home for the tag.

---

## Notes on this milestone

1. **The rename is the primary win.** It removes the "is `a` alpha or OKLab's `a`" confusion and stops pretending `r` means red in OKLab. Every field name is now honest about being a channel position.

2. **The tuple is an interop type.** It exists for GPU boundaries and structured data. It is not the canonical representation. Every function that accepts a tuple converts to an object at the top.

3. **The doc requirement is explicit.** Every tuple-accepting function carries a `@note` block. The block explains the three reasons for the conversion: the runtime tag, structural typing reliability, and no WeakMap.

4. **The overload keeps two-argument `convert`.** Object inputs still call `convert(color, to)`. Tuple inputs call `convert(tuple, from, to)`. The two-argument form is the common case.

5. **The `isColorValue` guard is the payoff.** It reads `_space`. That predicate would fail on a tuple because the tuple has no `_space`. The object shape makes the predicate reliable. The doc note cites this as reason 2.

6. **Cost.** The rename is 3 to 5 days for one engineer. The tuple interop is another 3 to 5 days. Total 1 to 2 weeks. Downstream migration is on top of that.

7. **Risk.** Low. Every break is a compile error. The rename is mechanical. The tuple addition is isolated to `tuple.ts` and three overloads.