/**
 * @fileoverview
 * @summary Bitwise and arithmetic operations for big-endian unsigned `number[]`.
 *
 * @description
 * Provides AND, OR, XOR, NOT, NAND, NOR, ADD, SUBTRACT, MULTIPLY,
 * DIVIDE, and REMAINDER for arrays of unsigned 32-bit words where
 * index `0` holds the most significant word (big-endian).
 *
 * This is the `ComposedVPadData` companion to the `Uint8Array` utilities
 * in `bitwise-u8.ts`. Together they give `AdvancedVPadData`-equivalent
 * bit manipulation ergonomics to the two multi-word `VPadData` variants
 * that JavaScript cannot represent as a native `bigint` operation.
 *
 * **Element contract** — every element is treated as an unsigned 32-bit
 * integer. Values outside `[0, 0xFFFFFFFF]` produce undefined behaviour.
 * Use `value >>> 0` before passing in to force the unsigned interpretation
 * (JavaScript bitwise operators produce signed 32-bit results).
 *
 * **Length contract**
 * - Bitwise operations return `max(a.length, b.length)` words.
 *   The shorter operand is zero-extended on the left (big-endian padding).
 * - `not` returns the same length as its single operand.
 * - `add` returns `max(a.length, b.length) + 1` words (carry slot).
 * - `subtract` returns `max(a.length, b.length)` words, saturating at zero.
 * - `multiply` returns `a.length + b.length` words.
 * - `divide` and `remainder` return `max(a.length, b.length)` words.
 *
 * **Immutability** — no function mutates its arguments. Every operation
 * allocates and returns a new array. Operands may safely be the same
 * reference.
 *
 * **Big-endian** — index `0` is the most significant word throughout.
 * Padding for unequal-length operands inserts zeros at the front.
 *
 * **Unsigned** — all operations treat their operands as non-negative.
 * Subtraction saturates at zero rather than wrapping. Division and
 * remainder follow unsigned (truncating toward zero) semantics.
 *
 * @example
 * import { and, or, not, add, subtract } from '@game/math/bitwise/words';
 *
 * // Bit-mask a controller word: extract D-pad bits from word 0
 * const dpad   = and([0xF000_0000, 0x0000_0000], [0xF000_0000]);
 *
 * // Combine two controller states
 * const merged = or(stateA, stateB);
 *
 * // Invert all bits (e.g. to build a clear mask)
 * const mask   = not([0xFFFF_FF00]);
 *
 * @see {@linkcode ComposedVPadData}
 * @see {@linkcode ./uint8} for the `Uint8Array` / `HighResVPadData` equivalents
 *
 * @author MathAid
 */

// ── Internal helpers ─────────────────────────────────────────────────────────

/**
 * @summary Zero-extend both operands to `max(a.length, b.length)` words.
 *
 * @description
 * Big-endian padding: zeros are prepended (inserted at lower indices),
 * preserving the numeric value of each operand. Returns a tuple of the
 * two padded arrays and their shared length.
 *
 * @param a - First operand.
 * @param b - Second operand.
 * @returns `[paddedA, paddedB, sharedLength]`
 */
export function pad(a: readonly number[], b: readonly number[]): [number[], number[], number] {
  const len = Math.max(a.length, b.length);
  const pa = new Array<number>(len).fill(0);
  const pb = new Array<number>(len).fill(0);
  // Copy right-aligned (big-endian: MSW at index 0, so src goes to the RIGHT of dest)
  for (let i = 0; i < a.length; i++) pa[len - a.length + i] = a[i] >>> 0;
  for (let i = 0; i < b.length; i++) pb[len - b.length + i] = b[i] >>> 0;
  return [pa, pb, len];
}

/**
 * @summary Convert a `number[]` to `bigint` for division/remainder.
 *
 * @description
 * Each word contributes 32 bits. Index 0 is the most significant.
 * Used internally by `divide` and `remainder` where schoolbook long
 * division would require multi-precision comparison and subtraction;
 * the `bigint` bridge is cleaner and equally correct.
 */
export function toBig(a: readonly number[]): bigint {
  let result = 0n;
  for (let i = 0; i < a.length; i++) {
    result = (result << 32n) | BigInt(a[i] >>> 0);
  }
  return result;
}

/**
 * @summary Convert a non-negative `bigint` back to a `number[]` of fixed length.
 *
 * @description
 * Fills from the least significant word (rightmost) backwards, so index
 * 0 ends up holding the most significant word. Saturates at zero if `n`
 * is negative (should never happen under normal use).
 *
 * @param n   - Non-negative `bigint` value.
 * @param len - Desired output array length.
 * @returns Big-endian unsigned word array of exactly `len` elements.
 */
export function fromBig(n: bigint, len: number): number[] {
  const out = new Array<number>(len).fill(0);
  let v = n < 0n ? 0n : n;
  for (let i = len - 1; i >= 0 && v > 0n; i--) {
    out[i] = Number(v & 0xffff_ffffn) >>> 0;
    v >>= 32n;
  }
  return out;
}

/**
 * @summary Compare two operands as unsigned integers.
 *
 * @description
 * Both arrays are zero-padded to the same length before comparison,
 * then compared word by word from MSW to LSW.
 *
 * @returns `-1` if `a < b`, `0` if `a === b`, `1` if `a > b`.
 */
function cmp(a: readonly number[], b: readonly number[]): -1 | 0 | 1 {
  const [pa, pb, len] = pad(a, b);
  for (let i = 0; i < len; i++) {
    const wa = pa[i] >>> 0;
    const wb = pb[i] >>> 0;
    if (wa < wb) return -1;
    if (wa > wb) return 1;
  }
  return 0;
}

// ── Bitwise operations ────────────────────────────────────────────────────────

/**
 * @summary Bitwise AND of two unsigned big-endian word arrays.
 *
 * @description
 * Shorter operand is zero-padded on the left. A zero-padded high word
 * ANDed with any value produces zero, which is the mathematically
 * correct result: a number with fewer significant words has implicit
 * leading zeros.
 *
 * Result length: `max(a.length, b.length)`.
 *
 * @param a - First operand (big-endian, unsigned 32-bit words).
 * @param b - Second operand (big-endian, unsigned 32-bit words).
 * @returns New array with the element-wise AND.
 *
 * @example
 * // Extract the low byte of the high word
 * and([0xDEAD_BEEF, 0x0000_0000], [0x0000_00FF, 0x0000_0000]);
 * // → [0x0000_00EF, 0x0000_0000]
 */
export function and(a: readonly number[], b: readonly number[]): number[] {
  const [pa, pb, len] = pad(a, b);
  const out = new Array<number>(len);
  for (let i = 0; i < len; i++) out[i] = (pa[i] & pb[i]) >>> 0;
  return out;
}

/**
 * @summary Bitwise OR of two unsigned big-endian word arrays.
 *
 * @description
 * Shorter operand is zero-padded on the left. A zero-padded high word
 * ORed with any value preserves the other operand's bits.
 *
 * Result length: `max(a.length, b.length)`.
 *
 * @param a - First operand.
 * @param b - Second operand.
 * @returns New array with the element-wise OR.
 *
 * @example
 * // Merge two partial controller states
 * or([0xFF00_0000, 0x0000_0000], [0x0000_0000, 0x0000_00FF]);
 * // → [0xFF00_0000, 0x0000_00FF]
 */
export function or(a: readonly number[], b: readonly number[]): number[] {
  const [pa, pb, len] = pad(a, b);
  const out = new Array<number>(len);
  for (let i = 0; i < len; i++) out[i] = (pa[i] | pb[i]) >>> 0;
  return out;
}

/**
 * @summary Bitwise XOR of two unsigned big-endian word arrays.
 *
 * @description
 * Shorter operand is zero-padded on the left. XOR of a zero-padded word
 * with any value preserves the other operand's bits unchanged, identical
 * to the numeric XOR semantic.
 *
 * Result length: `max(a.length, b.length)`.
 *
 * @param a - First operand.
 * @param b - Second operand.
 * @returns New array with the element-wise XOR.
 *
 * @example
 * // Toggle specific button bits
 * xor(currentState, toggleMask);
 */
export function xor(a: readonly number[], b: readonly number[]): number[] {
  const [pa, pb, len] = pad(a, b);
  const out = new Array<number>(len);
  for (let i = 0; i < len; i++) out[i] = (pa[i] ^ pb[i]) >>> 0;
  return out;
}

/**
 * @summary Bitwise NOT (one's complement) of a single unsigned word array.
 *
 * @description
 * Flips every bit in every word. JavaScript's `~` operator produces a
 * signed 32-bit result; `>>> 0` converts it back to unsigned.
 *
 * Result length: `a.length` (unary — length is preserved).
 *
 * @param a - Operand (big-endian, unsigned 32-bit words).
 * @returns New array with every bit flipped.
 *
 * @example
 * not([0xFFFF_FF00]); // → [0x0000_00FF]
 * not([0x0000_0000, 0xFFFF_FFFF]); // → [0xFFFF_FFFF, 0x0000_0000]
 */
export function not(a: readonly number[]): number[] {
  const out = new Array<number>(a.length);
  for (let i = 0; i < a.length; i++) out[i] = ~a[i] >>> 0;
  return out;
}

/**
 * @summary Bitwise NAND: `NOT(AND(a, b))`.
 *
 * @description
 * Equivalent to `not(and(a, b))` but computed in a single pass.
 * Result length: `max(a.length, b.length)`.
 *
 * @param a - First operand.
 * @param b - Second operand.
 * @returns New array where every bit is the NAND of the corresponding bits.
 *
 * @example
 * // All buttons NOT simultaneously pressed in both states
 * nand(stateA, stateB);
 */
export function nand(a: readonly number[], b: readonly number[]): number[] {
  const [pa, pb, len] = pad(a, b);
  const out = new Array<number>(len);
  for (let i = 0; i < len; i++) out[i] = ~(pa[i] & pb[i]) >>> 0;
  return out;
}

/**
 * @summary Bitwise NOR: `NOT(OR(a, b))`.
 *
 * @description
 * Equivalent to `not(or(a, b))` but computed in a single pass.
 * Result length: `max(a.length, b.length)`.
 *
 * @param a - First operand.
 * @param b - Second operand.
 * @returns New array where every bit is the NOR of the corresponding bits.
 *
 * @example
 * // Bits that are 0 in BOTH states
 * nor(stateA, stateB);
 */
export function nor(a: readonly number[], b: readonly number[]): number[] {
  const [pa, pb, len] = pad(a, b);
  const out = new Array<number>(len);
  for (let i = 0; i < len; i++) out[i] = ~(pa[i] | pb[i]) >>> 0;
  return out;
}

// ── Arithmetic operations ─────────────────────────────────────────────────────

/**
 * @summary Unsigned big-endian addition.
 *
 * @description
 * Adds two word arrays with carry propagation from the least significant
 * word (rightmost, highest index) to the most significant.
 *
 * The carry is accumulated using IEEE 754 double-precision float
 * arithmetic. The maximum intermediate value per word is:
 * `0xFFFF_FFFF + 0xFFFF_FFFF + 1 = 0x1_FFFF_FFFF` (≈ 8.6 × 10⁹),
 * which is well within the 53-bit safe integer range (`2^53 ≈ 9 × 10¹⁵`),
 * so no precision is lost.
 *
 * Result length: `max(a.length, b.length) + 1`.
 * The extra leading word holds the carry-out and is `0` or `1`.
 * Callers that know overflow is impossible may slice it off; retaining
 * it is the safe default.
 *
 * @param a - First operand (big-endian, unsigned 32-bit words).
 * @param b - Second operand (big-endian, unsigned 32-bit words).
 * @returns New array whose value equals `a + b`, with a carry slot at index 0.
 *
 * @example
 * add([0xFFFF_FFFF], [0x0000_0001]);
 * // → [0x0000_0001, 0x0000_0000]  (carry promoted to new high word)
 *
 * @example
 * add([0x0000_0001, 0xFFFF_FFFF], [0x0000_0000, 0x0000_0001]);
 * // → [0x0000_0000, 0x0000_0002, 0x0000_0000]
 */
export function add(a: readonly number[], b: readonly number[]): number[] {
  const [pa, pb, len] = pad(a, b);
  const out = new Array<number>(len + 1).fill(0);
  let carry = 0;
  for (let i = len - 1; i >= 0; i--) {
    // Sum fits in float53: max = 0xFFFFFFFF + 0xFFFFFFFF + 1 = 0x1_FFFFFFFF
    const sum = (pa[i] >>> 0) + (pb[i] >>> 0) + carry;
    out[i + 1] = sum >>> 0; // low 32 bits
    carry = Math.floor(sum / 0x1_0000_0000); // 0 or 1
  }
  out[0] = carry;
  return out;
}

/**
 * @summary Unsigned big-endian subtraction with zero saturation.
 *
 * @description
 * Subtracts `b` from `a` using borrow propagation from the least
 * significant word upward. When `a ≤ b`, the result saturates to an
 * all-zero array rather than wrapping around (unsigned floor at zero).
 *
 * This saturation behaviour is deliberate: `VPadData` represents
 * controller state magnitudes, which have no meaningful negative value.
 * Wrapping would produce a very large number from a small one, which
 * would be a silent correctness bug in any mask/threshold comparison.
 *
 * Result length: `max(a.length, b.length)`.
 *
 * @param a - Minuend (big-endian, unsigned 32-bit words).
 * @param b - Subtrahend (big-endian, unsigned 32-bit words).
 * @returns `max(0, a - b)` as a big-endian word array.
 *
 * @example
 * subtract([0x0000_0005], [0x0000_0003]); // → [0x0000_0002]
 * subtract([0x0000_0003], [0x0000_0005]); // → [0x0000_0000]  (saturated)
 *
 * @example
 * // Multi-word borrow
 * subtract([0x0000_0001, 0x0000_0000], [0x0000_0000, 0x0000_0001]);
 * // → [0x0000_0000, 0xFFFF_FFFF]
 */
export function subtract(a: readonly number[], b: readonly number[]): number[] {
  const outLen = Math.max(a.length, b.length);
  if (cmp(a, b) <= 0) return new Array<number>(outLen).fill(0);
  const [pa, pb, len] = pad(a, b);
  const out = new Array<number>(len).fill(0);
  let borrow = 0;
  for (let i = len - 1; i >= 0; i--) {
    let diff = (pa[i] >>> 0) - (pb[i] >>> 0) - borrow;
    if (diff < 0) {
      diff += 0x1_0000_0000;
      borrow = 1;
    } else borrow = 0;
    out[i] = diff >>> 0;
  }
  return out;
}

/**
 * @summary Unsigned big-endian multiplication.
 *
 * @description
 * Schoolbook O(m·n) long multiplication, working word by word from
 * the least significant upward. Each per-word product uses a `BigInt`
 * bridge for the inner accumulation to avoid precision loss:
 * `0xFFFF_FFFF × 0xFFFF_FFFF = 0xFFFF_FFFE_0000_0001`
 * exceeds JavaScript's 53-bit safe integer limit (`Number.MAX_SAFE_INTEGER
 * = 2^53 − 1 ≈ 9.0 × 10¹⁵`) when accumulated with a carry, so native
 * float arithmetic cannot be used directly.
 *
 * Result length: `a.length + b.length`.
 * The result always has enough room for the full product. Leading zero
 * words are retained to make the length contract predictable. Callers
 * may trim them if desired.
 *
 * @param a - Multiplicand (big-endian, unsigned 32-bit words).
 * @param b - Multiplier   (big-endian, unsigned 32-bit words).
 * @returns Product as a big-endian word array of length `a.length + b.length`.
 *
 * @example
 * multiply([0xFFFF_FFFF], [0xFFFF_FFFF]);
 * // → [0xFFFF_FFFE, 0x0000_0001]
 * // (i.e. (2³²−1)² = 2⁶⁴ − 2³³ + 1)
 *
 * @example
 * multiply([0x0000_0002, 0x0000_0000], [0x0000_0003]);
 * // → [0x0000_0000, 0x0000_0006, 0x0000_0000]
 */
export function multiply(a: readonly number[], b: readonly number[]): number[] {
  const out = new Array<number>(a.length + b.length).fill(0);
  for (let i = a.length - 1; i >= 0; i--) {
    let carry = 0n;
    const ai = BigInt(a[i] >>> 0);
    for (let j = b.length - 1; j >= 0; j--) {
      const pos = i + j + 1;
      const prod = ai * BigInt(b[j] >>> 0) + BigInt(out[pos] >>> 0) + carry;
      out[pos] = Number(prod & 0xffff_ffffn) >>> 0;
      carry = prod >> 32n;
    }
    // carry at position i — guaranteed to fit in uint32 for schoolbook mult
    out[i] = Number(BigInt(out[i] >>> 0) + carry) >>> 0;
  }
  return out;
}

/**
 * @summary Unsigned big-endian integer division (truncating toward zero).
 *
 * @description
 * Delegates to the `BigInt` bridge for correctness. Schoolbook long
 * division over arbitrary-precision word arrays requires multi-precision
 * comparison and conditional subtraction at each step, which is error-
 * prone to implement and offers no meaningful performance advantage here
 * since division is not on the hot path of `tick()`.
 *
 * Result length: `max(a.length, b.length)`.
 *
 * @param a - Dividend  (big-endian, unsigned 32-bit words).
 * @param b - Divisor   (big-endian, unsigned 32-bit words).
 * @returns Quotient as a big-endian word array.
 *
 * @throws {RangeError} When `b` is zero.
 *
 * @example
 * divide([0x0000_000A], [0x0000_0003]); // → [0x0000_0003]
 * divide([0x0000_0000, 0x0000_0007], [0x0000_0000, 0x0000_0002]);
 * // → [0x0000_0000, 0x0000_0003]
 */
export function divide(a: readonly number[], b: readonly number[]): number[] {
  const nb = toBig(b);
  if (nb === 0n) throw new RangeError('divide: divisor is zero');
  return fromBig(toBig(a) / nb, Math.max(a.length, b.length));
}

/**
 * @summary Unsigned big-endian remainder (modulo).
 *
 * @description
 * Returns the remainder of `a ÷ b`. Delegates to the `BigInt` bridge
 * for the same reasons as `divide`. The result is always in
 * `[0, b − 1]` because both operands are unsigned.
 *
 * Result length: `max(a.length, b.length)`.
 *
 * @param a - Dividend (big-endian, unsigned 32-bit words).
 * @param b - Divisor  (big-endian, unsigned 32-bit words).
 * @returns Remainder as a big-endian word array.
 *
 * @throws {RangeError} When `b` is zero.
 *
 * @example
 * remainder([0x0000_000A], [0x0000_0003]); // → [0x0000_0001]
 */
export function remainder(a: readonly number[], b: readonly number[]): number[] {
  const nb = toBig(b);
  if (nb === 0n) throw new RangeError('remainder: divisor is zero');
  return fromBig(toBig(a) % nb, Math.max(a.length, b.length));
}

// ── Comparison (exported for consumers who need ordering) ─────────

/**
 * @summary Compare two unsigned big-endian word arrays.
 *
 * @description
 * Both arrays are zero-padded to the same length, then compared
 * word by word from MSW to LSW. Useful for range checks and
 * threshold comparisons on `ComposedVPadData` values.
 *
 * @param a - First operand.
 * @param b - Second operand.
 * @returns `-1` if `a < b`, `0` if `a === b`, `1` if `a > b`.
 *
 * @example
 * compare([0x0000_0001], [0x0000_0002]); // → -1
 * compare([0x0000_0002], [0x0000_0002]); // →  0
 * compare([0x0000_0003], [0x0000_0002]); // →  1
 */
export function compare(a: readonly number[], b: readonly number[]): -1 | 0 | 1 {
  return cmp(a, b);
}
