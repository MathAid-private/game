/**
 * @fileoverview
 * @summary Seeded pseudo-random number generators (PRNGs) — small, fast, deterministic.
 *
 * @description
 * This module collects several well-known PRNG families, each in its own namespace: `PCG`
 * (Permuted Congruential Generator), `Mulberry` (mulberry32), `Xoshiro` (xoshiro256**), `SFC64`,
 * `Wyrand`, and `Squares`. Every factory takes a seed and returns a generator, so a given seed
 * always reproduces the same sequence — which is what makes game logic and its tests deterministic.
 *
 * Generators produce either uniform floats in `[0, 1)` or unsigned `bigint` integers of a chosen
 * width, depending on the family.
 *
 * @author MathAid
 */

import { ones } from "../bitwise/words";

/**
 * @summary PCG — the Permuted Congruential Generator family (by Melissa O'Neill).
 *
 * @description
 * The `PCG` namespace holds a single factory, `pcg`, that runs a Linear Congruential Generator for
 * state advancement and then applies the XSH-RR output permutation (XorShift-High, then
 * Rotate-Right) to destroy the visible LCG pattern. Output width is selectable (8–256 bits) with the
 * internal state always double that width for LCG headroom. It produces unsigned `bigint` integers
 * rather than floats.
 *
 * @example
 * const rng = PCG.pcg(1n, 32); // 32-bit bigints, deterministic for seed 1n
 *
 * @see {@link PCG.pcg}
 * @author MathAid
 */
export namespace PCG {
  // ---------------------------------------------------------------------------
  // Supported bit widths. PCG's internal state must be DOUBLE the output width
  // because the LCG needs headroom — the high bits of the state are used to
  // permute the low bits, so you need more state than you output.
  // e.g. 32-bit output → 64-bit state, 64-bit output → 128-bit state, etc.
  // ---------------------------------------------------------------------------
  type BitLength = 8 | 16 | 24 | 32 | 64 | 128 | 256;

  // ---------------------------------------------------------------------------
  // PCG constants — each output width needs its own multiplier and increment.
  //
  // The multiplier must satisfy:
  //   - odd (so it is coprime to 2^n, guaranteeing full LCG period)
  //   - good "avalanche" — high bits affect low bits quickly
  //
  // The increment must be odd (same coprimality reason). It can be anything odd;
  // think of it as selecting which of the 2^(n-1) independent PCG streams you
  // are on. We hardcode one good increment per width for simplicity.
  //
  // These specific constants come from the PCG reference implementation and
  // L'Ecuyer's tables of good LCG multipliers.
  // ---------------------------------------------------------------------------
  const PCG_PARAMS: Record<BitLength, { mul: bigint; inc: bigint; stateBits: number }> = {
    //         mul                        inc                        stateBits
    //         (must be odd)              (must be odd)              (2× output)
    8: { mul: 0x3dn, inc: 0x01n, stateBits: 16 },
    16: { mul: 0x321dn, inc: 0x01n, stateBits: 32 },
    24: { mul: 0x0010624dn, inc: 0x01n, stateBits: 48 },
    32: { mul: 0x5851f42d4c957f2dn, inc: 0x14057b7ef767814fn, stateBits: 64 },
    64: { mul: 0x2360ed051fc65da44385df649fccf645n, inc: 0x5851f42d4c957f2dn, stateBits: 128 },
    128: { mul: 0x2360ed051fc65da44385df649fccf645n, inc: 0x5851f42d4c957f2dn, stateBits: 256 },
    256: { mul: 0x2360ed051fc65da44385df649fccf645n, inc: 0x5851f42d4c957f2dn, stateBits: 512 },
  };

  // ---------------------------------------------------------------------------
  // PCG output permutation — "XSH-RR" (XorShift High bits, then Rotate Right).
  //
  // This is the standard PCG-XSH-RR permutation. It works by:
  //   1. XOR the state with itself shifted right by half the state width.
  //      This folds high entropy (high bits of LCG are better) into the value.
  //   2. Rotate right by the top bits of the state.
  //      The rotation amount itself comes from the high bits, which are the
  //      most random part of the LCG — using them as a rotation selector
  //      breaks any visible periodicity in the output.
  //
  // `stateBits`  — width of the full LCG state (2× output)
  // `outputBits` — width we want to return
  // ---------------------------------------------------------------------------
  function xshRR(state: bigint, stateBits: number, outputBits: number): bigint {
    const stateBitsB = BigInt(stateBits);
    const outputBitsB = BigInt(outputBits);

    // How many bits to shift for the XorShift step.
    // We want to move the top half of state entropy into the lower half.
    const xorShift = (stateBitsB - outputBitsB) / 2n; // e.g. state=64,out=32 → 16

    // XOR state with itself shifted — mixes high-entropy bits into output region
    const xored = state ^ (state >> (outputBitsB + xorShift)); // shift by (out + xor) total

    // Rotation amount comes from the very top bits of state — most entropic region.
    // We only need log2(outputBits) bits to express a rotation in [0, outputBits).
    const rotBits = BigInt(Math.log2(outputBits)); // e.g. outputBits=32 → 5 bits
    const rot = state >> (stateBitsB - rotBits); // grab top `rotBits` bits of state

    // Truncate xored down to output width before rotating
    const outputMask = ones(outputBits);
    const truncated = (xored >> ((stateBitsB - outputBitsB) / 2n)) & outputMask;

    // Rotate right within outputBits:
    //   rotateRight(x, r, bits) = (x >> r) | (x << (bits - r))  masked to width
    const r = rot & (outputBitsB - 1n); // clamp rotation to [0, outputBits)
    return ((truncated >> r) | (truncated << (outputBitsB - r))) & outputMask;
  }

  // ---------------------------------------------------------------------------
  // LCG advance — the heart of the state machine.
  //
  // Standard LCG recurrence:  state = state * mul + inc  (mod 2^stateBits)
  //
  // The modular reduction is achieved by ANDing with stateMask rather than
  // using the % operator — AND is cheaper and equivalent for power-of-two moduli.
  // ---------------------------------------------------------------------------
  function lcgAdvance(state: bigint, mul: bigint, inc: bigint, stateMask: bigint): bigint {
    return (state * mul + inc) & stateMask;
  }

  // ---------------------------------------------------------------------------
  // Seed initialisation — we don't use the seed directly as the initial state.
  //
  // Reason: a seed of 0 would give a degenerate LCG start. The standard PCG
  // init is to run one extra LCG step after adding the increment to the seed.
  // This ensures even seed=0 starts in a non-trivial state.
  // ---------------------------------------------------------------------------
  function initState(seed: bigint, inc: bigint, mul: bigint, stateMask: bigint): bigint {
    // Start from zero, apply one LCG step to "warm up" with the increment
    let state = lcgAdvance(0n, mul, inc, stateMask);
    // Add seed into the running state — mixes the seed into LCG position
    state = (state + seed) & stateMask;
    // One more LCG step so the seed is fully mixed before first output
    state = lcgAdvance(state, mul, inc, stateMask);
    return state;
  }

  // ---------------------------------------------------------------------------
  // The generator factory.
  //
  // Returns a generator function that, given the same seed + bits, always
  // produces the same sequence. Each call to the returned function advances
  // the LCG and emits the next permuted output.
  //
  // `seed`    — any bigint; determines which point in the sequence we start
  // `bits`    — output bit width; must be one of the supported BitLength values
  // ---------------------------------------------------------------------------
  export function pcg(seed: bigint, bits: BitLength): () => bigint {
    const params = PCG_PARAMS[bits];

    if (!params) {
      throw new Error(
        `Unsupported bit length: ${bits}. Use one of: ${Object.keys(PCG_PARAMS).join(', ')}`,
      );
    }

    const { mul, inc, stateBits } = params;

    // State lives in a 2× wider word than the output
    const stateMask = ones(stateBits);

    // Initialise state from seed — deterministic, same seed → same sequence
    let state = initState(seed & stateMask, inc, mul, stateMask);

    // Return a closure. Each call advances state and returns next random bigint.
    // The output is guaranteed to fit within `bits` bits (masked by outputMask).
    return function next(): bigint {
      // Advance LCG state first (state is internal — never returned raw)
      state = lcgAdvance(state, mul, inc, stateMask);
      // Apply XSH-RR permutation to extract the output from current state
      return xshRR(state, stateBits, bits);
    };
  }
}

// ---------------------------------------------------------------------------
// Shared helpers for the 64-bit generators below. All arithmetic is `bigint`,
// masked to 64 bits, so the low-level word operations are exact.
// ---------------------------------------------------------------------------

/** `2^32` — scales a 32-bit integer to `[0, 1)`. */
const UINT32_SCALE = 4294967296;
/** `2^53` — the largest integer a float represents exactly; scales a 53-bit value to `[0, 1)`. */
const UINT53_SCALE = 9007199254740992;
/** 64-bit mask for `bigint` arithmetic. */
const UINT64_MASK = (1n << 64n) - 1n;

/**
 * @summary Rotate a 64-bit `bigint` left by `k` bits.
 * @param x - The value to rotate.
 * @param k - The rotation count in `[0, 64)`.
 * @return The rotated value, masked to 64 bits.
 * @author MathAid
 */
function rotl64(x: bigint, k: bigint): bigint {
  return ((x << k) | (x >> (64n - k))) & UINT64_MASK;
}

/**
 * @summary Normalise a 64-bit `bigint` to a uniform float in `[0, 1)`.
 *
 * @description
 * A 64-bit value has more precision than a float's 53-bit mantissa, so this keeps only the top 53
 * bits (`x >> 11`) and divides by `2^53`, producing a float with no lost-significance bias.
 *
 * @param x - A 64-bit unsigned value.
 * @return A float in `[0, 1)`.
 * @author MathAid
 */
function toFloat64(x: bigint): number {
  return Number(x >> 11n) / UINT53_SCALE;
}

/**
 * @summary SplitMix64 — a 64-bit seed expander used to initialise multi-word generators.
 *
 * @description
 * `splitmix64` is a simple, high-quality 64-bit PRNG used to stretch a single seed into the several
 * independent state words that `xoshiro256**` and `sfc64` require. It returns a generator that emits
 * the next 64-bit word each call.
 *
 * @param seed - The initial 64-bit state.
 * @return A generator producing successive 64-bit words.
 * @author MathAid
 */
function splitmix64(seed: bigint): () => bigint {
  let x = seed & UINT64_MASK;
  return () => {
    x = (x + 0x9e3779b97f4a7c15n) & UINT64_MASK;
    let z = x;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & UINT64_MASK;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & UINT64_MASK;
    return z ^ (z >> 31n);
  };
}

// ---------------------------------------------------------------------------
/**
 * @summary Mulberry32 — a small, fast 32-bit PRNG family (by Tommy Ettinger).
 *
 * @description
 * The `Mulberry` namespace provides `mulberry32` (float output in `[0, 1)`) and `mulberry32BigInt`
 * (n-bit `bigint` output), both driven by the same 32-bit integer-arithmetic core. The float path
 * needs no `bigint`, so it is the default for the games.
 *
 * @example
 * const rng = Mulberry.mulberry32(1);
 *
 * @see {@link Mulberry.mulberry32}
 * @author MathAid
 */
export namespace Mulberry {
  /**
   * @summary Mulberry32 — a small, fast 32-bit PRNG producing floats in `[0, 1)`.
   *
   * @description
   * `mulberry32` advances a 32-bit state with an LCG step, then avalanches the state through a
   * multiply-xorshift mix, returning a float in `[0, 1)` each call. All arithmetic is 32-bit
   * (`Math.imul` and `| 0`), so it is exact and needs no `bigint`.
   *
   * @param seed - The initial 32-bit state (forced unsigned).
   * @return A generator producing successive floats in `[0, 1)`.
   *
   * @example
   * const rng = Mulberry.mulberry32(1);
   * const roll = rng(); // deterministic given seed 1
   *
   * @author MathAid
   */
  export function mulberry32(seed: number): () => number {
    // Internal 32-bit state, coerced unsigned so arithmetic wraps mod 2^32.
    let a = seed >>> 0;
    return () => {
      // LCG step: advance the state by a fixed odd constant (mod 2^32).
      a = (a + 0x6d2b79f5) | 0;
      // Avalanche 1 — xorshift then multiply; Math.imul keeps the 32-bit wrap exact.
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      // Avalanche 2 — mixed multiply and xorshift, folded back into t.
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      // Final xorshift, then normalise the 32-bit result to [0, 1).
      return ((t ^ (t >>> 14)) >>> 0) / UINT32_SCALE;
    };
  }

  /**
   * @summary Mulberry32 — the same generator, producing `n`-bit `bigint` outputs.
   *
   * @description
   * `mulberry32BigInt` reuses the same 32-bit core and, for a requested bit width `bits`,
   * concatenates successive 32-bit words into a `bigint`, masking to exactly `bits` bits. It lets
   * mulberry32's cheap stream feed widths wider than 32 bits (64, 128, 256, …) without
   * floating-point precision loss.
   *
   * @param seed - The initial 32-bit state (forced unsigned).
   * @return A generator that takes `bits` and returns a uniform `bigint` in `[0, 2^bits)`.
   *
   * @example
   * const rng = Mulberry.mulberry32BigInt(1);
   * const key64 = rng(64);   // 64-bit value
   * const key256 = rng(256); // 256-bit value
   *
   * @see {@link Mulberry.mulberry32}
   * @author MathAid
   */
  export function mulberry32BigInt(seed: number): (bits: number) => bigint {
    // The raw 32-bit integer core (shared with the float wrapper above).
    let a = seed >>> 0;
    const next32 = (): number => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return (t ^ (t >>> 14)) >>> 0;
    };

    return (bits: number): bigint => {
      let result = 0n;
      let produced = 0;
      // Pack whole 32-bit words, most-significant first, until `bits` are covered.
      while (produced < bits) {
        result = (result << 32n) | BigInt(next32());
        produced += 32;
      }
      // Trim any excess beyond the requested width.
      return result & ((1n << BigInt(bits)) - 1n);
    };
  }
}

// ---------------------------------------------------------------------------
/**
 * @summary Xoshiro256** — a 256-bit state, 64-bit output generator (Blackman & Vigna).
 *
 * @description
 * The `Xoshiro` namespace provides `xoshiro256ss`, which keeps four 64-bit state words, scrambles one
 * with the `**` finaliser (multiply–rotate–multiply) for its output, and applies the xoshiro256
 * linear transition. It is fast and passes the stronger statistical suites. The seed is expanded into
 * the four words via `splitmix64`, so the state is never accidentally all-zero.
 *
 * @example
 * const rng = Xoshiro.xoshiro256ss(1n);
 *
 * @see {@link Xoshiro.xoshiro256ss}
 * @author MathAid
 */
export namespace Xoshiro {
  /**
   * @summary Xoshiro256** — a 256-bit state, 64-bit output generator.
   *
   * @description
   * `xoshiro256ss` keeps four 64-bit state words and produces each output by rotating, multiplying,
   * and scrambling one word (the `**` finaliser), then applying the xoshiro256 linear transition.
   * It is fast and passes the stronger statistical suites. The single seed is expanded into four
   * words with `splitmix64`, so the state is never accidentally all-zero.
   *
   * @param seed - The initial seed, expanded to the four state words.
   * @return A generator producing successive floats in `[0, 1)`.
   *
   * @example
   * const rng = Xoshiro.xoshiro256ss(1n);
   *
   * @author MathAid
   */
  export function xoshiro256ss(seed: bigint): () => number {
    const expand = splitmix64(seed);
    const s = [expand(), expand(), expand(), expand()];
    return () => {
      // Scrambled output of s[1]: the `**` finaliser (mul, rotate, mul).
      const result = (rotl64(s[1] * 5n, 7n) * 9n) & UINT64_MASK;
      const t = (s[1] << 17n) & UINT64_MASK;
      // xoshiro256 linear transition.
      s[2] ^= s[0];
      s[3] ^= s[1];
      s[1] ^= s[2];
      s[0] ^= s[3];
      s[2] ^= t;
      s[3] = rotl64(s[3], 45n);
      return toFloat64(result);
    };
  }
}

// ---------------------------------------------------------------------------
/**
 * @summary SFC64 — a Small Fast Chaotic 64-bit generator (Chris Doty-Humphrey).
 *
 * @description
 * The `SFC64` namespace provides `sfc64`, which keeps four 64-bit words, outputs their sum, and
 * updates the words with a counter, shifts, and a rotate. It is extremely fast with a long period —
 * a common choice for hot loops. The seed is expanded into the four words via `splitmix64`.
 *
 * @example
 * const rng = SFC64.sfc64(1n);
 *
 * @see {@link SFC64.sfc64}
 * @author MathAid
 */
export namespace SFC64 {
  /**
   * @summary SFC64 — a Small Fast Chaotic 64-bit generator.
   *
   * @description
   * `sfc64` keeps four 64-bit words and produces each output as the sum of three of them, then
   * updates the words with a counter, shifts, and a rotate. It is extremely fast with a long period,
   * a common choice for hot loops. The seed is expanded into the four words with `splitmix64`.
   *
   * @param seed - The initial seed, expanded to the four state words.
   * @return A generator producing successive floats in `[0, 1)`.
   *
   * @example
   * const rng = SFC64.sfc64(1n);
   *
   * @author MathAid
   */
  export function sfc64(seed: bigint): () => number {
    const expand = splitmix64(seed);
    let a = expand();
    let b = expand();
    let c = expand();
    let counter = expand();
    return () => {
      const tmp = (a + b + counter) & UINT64_MASK;
      counter = (counter + 1n) & UINT64_MASK;
      a = b ^ (b >> 11n);
      b = (c + (c << 3n)) & UINT64_MASK;
      c = (rotl64(c, 24n) + tmp) & UINT64_MASK;
      return toFloat64(tmp);
    };
  }
}

// ---------------------------------------------------------------------------
/**
 * @summary Wyrand — the 64-bit generator from wyhash (Wang Yi).
 *
 * @description
 * The `Wyrand` namespace provides `wyrand`, which advances a 64-bit state by a fixed constant and
 * mixes it through a 128-bit self-multiplication, folding the high half back into the low half. It is
 * the mixer used by the wyhash family and is extremely fast with good quality.
 *
 * @example
 * const rng = Wyrand.wyrand(1n);
 *
 * @see {@link Wyrand.wyrand}
 * @author MathAid
 */
export namespace Wyrand {
  /**
   * @summary Wyrand — the 64-bit generator from wyhash.
   *
   * @description
   * `wyrand` advances a 64-bit state by a fixed constant, then multiplies it by a shifted version of
   * itself using a 128-bit product, folding the high half back into the low half. It is the mixer
   * used by the wyhash family and is extremely fast with good quality.
   *
   * @param seed - The initial 64-bit state.
   * @return A generator producing successive floats in `[0, 1)`.
   *
   * @example
   * const rng = Wyrand.wyrand(1n);
   *
   * @author MathAid
   */
  export function wyrand(seed: bigint): () => number {
    const INCREMENT = 0xa076_1d64_78bd_642fn;
    const XOR = 0xe703_7ed1_a0b4_28dbn;
    let state = seed & UINT64_MASK;
    return () => {
      state = (state + INCREMENT) & UINT64_MASK;
      // 128-bit product: state * (state XOR constant); fold high 64 bits into low 64.
      const product = state * (state ^ XOR);
      return toFloat64(((product >> 64n) ^ product) & UINT64_MASK);
    };
  }
}

// ---------------------------------------------------------------------------
/**
 * @summary Squares — a counter-based 64-bit generator (Bernard Widynski).
 *
 * @description
 * The `Squares` namespace provides `squares`, a counter-mode generator that increments a counter each
 * call and runs three rounds of squaring (with a 32-bit half-swap between rounds) against a fixed
 * key, returning the top 32 bits of the final square. It is robust across many parallel streams
 * distinguished by their key.
 *
 * @example
 * const rng = Squares.squares(12345n);
 *
 * @see {@link Squares.squares}
 * @author MathAid
 */
export namespace Squares {
  /**
   * @summary Squares — a counter-based 64-bit generator.
   *
   * @description
   * `squares` is a counter-mode generator: each call increments a counter and runs three rounds of
   * squaring (with 64-bit multiplication and a 32-bit half-swap between rounds) against a fixed key.
   * It is designed to be robust across many parallel streams distinguished by their key. The output
   * is the top 32 bits of the final square, normalised to `[0, 1)`.
   *
   * @param seed - The key; the counter starts at `0` and increments each call.
   * @return A generator producing successive floats in `[0, 1)`.
   *
   * @example
   * const rng = Squares.squares(12345n);
   *
   * @author MathAid
   */
  export function squares(seed: bigint): () => number {
    const key = seed & UINT64_MASK;
    let counter = 0n;
    // Swap the high and low 32-bit halves of a 64-bit value.
    const swap32 = (x: bigint): bigint => ((x >> 32n) | (x << 32n)) & UINT64_MASK;
    return () => {
      let x = (counter * key) & UINT64_MASK;
      const y = x;
      const z = (y + key) & UINT64_MASK;
      x = swap32((x * x + y) & UINT64_MASK); // round 1
      x = swap32((x * x + z) & UINT64_MASK); // round 2
      const result = ((x * x + y) & UINT64_MASK) >> 32n; // round 3, top 32 bits
      counter = (counter + 1n) & UINT64_MASK;
      return Number(result) / UINT32_SCALE;
    };
  }
}
