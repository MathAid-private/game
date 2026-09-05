/**
 * @fileoverview
 * @summary A seeded pseudo-random number generator shared by the games.
 *
 * @description
 * This module provides `mulberry32`, a tiny deterministic PRNG that returns a function producing
 * floats in `[0, 1)` from a 32-bit seed. The games use it so their random behaviour (piece
 * queues, food placement) is reproducible: the same seed yields the same sequence, which is what
 * makes a game and its tests replay identically.
 *
 * @author MathAid
 */

/**
 * @summary Create a deterministic PRNG (mulberry32) from a seed.
 *
 * @description
 * `mulberry32` returns a zero-argument function producing successive pseudo-random floats in
 * `[0, 1)`. Given the same seed it always yields the same sequence, so callers that need
 * reproducibility (tests, replays) share one seeded generator.
 *
 * @param seed - A 32-bit unsigned seed.
 * @return A function producing the next pseudo-random float in `[0, 1)`.
 *
 * @example
 * const rng = mulberry32(42);
 * const first = rng(); // deterministic given seed 42
 *
 * @author MathAid
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
