/**
 * @fileoverview
 * @summary Bitwise and arithmetic operations for big-endian unsigned `Uint8Array`.
 *
 * @description
 * Provides AND, OR, XOR, NOT, NAND, NOR, ADD, SUBTRACT, MULTIPLY,
 * DIVIDE, and REMAINDER for `Uint8Array` values where index `0` holds
 * the most significant byte (big-endian).
 *
 * This is the `HighResVPadData` companion to the `number[]` utilities
 * in `bitwise-words.ts`. Together they give `AdvancedVPadData`-equivalent
 * bit manipulation ergonomics to the two multi-word `VPadData` variants.
 *
 * **Element contract** — every element is an unsigned 8-bit value
 * `[0, 255]`, which `Uint8Array` enforces natively. No coercion needed.
 *
 * **Length contract**
 * - Bitwise operations return `max(a.length, b.length)` bytes.
 *   The shorter operand is zero-extended on the left (big-endian padding).
 * - `not` returns the same length as its single operand.
 * - `add` returns `max(a.length, b.length) + 1` bytes (carry slot).
 * - `subtract` returns `max(a.length, b.length)` bytes, saturating at zero.
 * - `multiply` returns `a.length + b.length` bytes.
 * - `divide` and `remainder` return `max(a.length, b.length)` bytes.
 *
 * **Immutability** — no function mutates its arguments. Every operation
 * allocates and returns a new `Uint8Array`. Operands may safely be the
 * same reference.
 *
 * **Big-endian** — index `0` is the most significant byte throughout.
 * Padding for unequal-length operands inserts zeros at the front.
 *
 * **Unsigned** — all operations treat their operands as non-negative.
 * Subtraction saturates at zero rather than wrapping. Division and
 * remainder follow unsigned (truncating toward zero) semantics.
 *
 * @example
 * import { and, or, not, add, subtract } from '@game/math/bitwise/uint8';
 *
 * // Mask the D-pad byte out of a controller snapshot
 * const dpad = and(snapshot, mask);
 *
 * // Combine two partial states
 * const merged = or(stateA, stateB);
 *
 * // Build an inverted clear mask
 * const clearMask = not(buttonMask);
 *
 * @see {@linkcode HighResVPadData}
 * @see {@linkcode ./words} for the `number[]` / `ComposedVPadData` equivalents
 *
 * @author MathAid
 */

// ── Internal helpers ─────────────────────────────────────────────────────────

/**
 * @summary Zero-extend both operands to `max(a.length, b.length)` bytes.
 *
 * @description
 * Big-endian padding: copies each source right-aligned into a fresh
 * `Uint8Array` of the target length, leaving leading bytes as zero.
 * `Uint8Array.set(src, offset)` handles the copy efficiently.
 *
 * @param a - First operand.
 * @param b - Second operand.
 * @returns `[paddedA, paddedB, sharedLength]`
 */
export function pad(a: Uint8Array, b: Uint8Array): [Uint8Array, Uint8Array, number] {
  const len = Math.max(a.length, b.length);
  const pa = new Uint8Array(len);
  pa.set(a, len - a.length);
  const pb = new Uint8Array(len);
  pb.set(b, len - b.length);
  return [pa, pb, len];
}

/**
 * @summary Convert a `Uint8Array` to `bigint` for division/remainder.
 *
 * @description
 * Reduces the byte array MSB-first. Used internally by `divide` and
 * `remainder` where a byte-by-byte long-division implementation would
 * require multi-precision comparison logic; the `bigint` bridge is
 * correct and cost-equivalent for non-hot-path use.
 */
export function toBig(a: Uint8Array): bigint {
  let result = 0n;
  for (let i = 0; i < a.length; i++) {
    result = (result << 8n) | BigInt(a[i]);
  }
  return result;
}

/**
 * @summary Convert a non-negative `bigint` to a `Uint8Array` of fixed length.
 *
 * @description
 * Fills from the least significant byte (rightmost) backwards, so
 * index 0 holds the most significant byte. Saturates at zero if `n`
 * is negative. Excess high bits beyond `len` bytes are silently
 * truncated — callers should ensure `len` is large enough.
 *
 * @param n   - Non-negative `bigint` value.
 * @param len - Desired output byte length.
 * @returns Big-endian unsigned byte array of exactly `len` elements.
 */
export function fromBig(n: bigint, len: number): Uint8Array {
  const out = new Uint8Array(len);
  let v = n < 0n ? 0n : n;
  for (let i = len - 1; i >= 0 && v > 0n; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

/**
 * @summary Compare two `Uint8Array` operands as unsigned integers.
 *
 * @description
 * Zero-pads both to the same length then compares byte by byte MSB-first.
 *
 * @returns `-1` if `a < b`, `0` if `a === b`, `1` if `a > b`.
 */
function cmp(a: Uint8Array, b: Uint8Array): -1 | 0 | 1 {
  const [pa, pb, len] = pad(a, b);
  for (let i = 0; i < len; i++) {
    if (pa[i] < pb[i]) return -1;
    if (pa[i] > pb[i]) return 1;
  }
  return 0;
}

// ── Bitwise operations ────────────────────────────────────────────────────────

/**
 * @summary Bitwise AND of two unsigned big-endian byte arrays.
 *
 * @description
 * Shorter operand is zero-padded on the left. A zero-padded high byte
 * ANDed with any value produces zero, which is numerically correct.
 *
 * Result length: `max(a.length, b.length)`.
 *
 * @param a - First operand (big-endian, unsigned bytes).
 * @param b - Second operand (big-endian, unsigned bytes).
 * @returns New `Uint8Array` with the element-wise AND.
 *
 * @example
 * and(
 *   new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF]),
 *   new Uint8Array([0x00, 0xFF]),
 * );
 * // Shorter operand padded: [0x00, 0x00, 0x00, 0xFF]
 * // → Uint8Array [0x00, 0x00, 0x00, 0xEF]
 */
export function and(a: Uint8Array, b: Uint8Array): Uint8Array {
  const [pa, pb, len] = pad(a, b);
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = pa[i] & pb[i];
  return out;
}

/**
 * @summary Bitwise OR of two unsigned big-endian byte arrays.
 *
 * @description
 * Shorter operand is zero-padded on the left. A zero-padded high byte
 * ORed with any value preserves the other operand's bits.
 *
 * Result length: `max(a.length, b.length)`.
 *
 * @param a - First operand.
 * @param b - Second operand.
 * @returns New `Uint8Array` with the element-wise OR.
 *
 * @example
 * or(new Uint8Array([0xF0]), new Uint8Array([0x00, 0x0F]));
 * // Shorter padded: [0x00, 0xF0]
 * // → Uint8Array [0x00, 0xFF]
 */
export function or(a: Uint8Array, b: Uint8Array): Uint8Array {
  const [pa, pb, len] = pad(a, b);
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = pa[i] | pb[i];
  return out;
}

/**
 * @summary Bitwise XOR of two unsigned big-endian byte arrays.
 *
 * @description
 * Shorter operand is zero-padded on the left. XOR of a zero byte with
 * any value preserves the other operand's bits unchanged.
 *
 * Result length: `max(a.length, b.length)`.
 *
 * @param a - First operand.
 * @param b - Second operand.
 * @returns New `Uint8Array` with the element-wise XOR.
 *
 * @example
 * // Detect which buttons changed between two ticks
 * xor(previousState, currentState);
 */
export function xor(a: Uint8Array, b: Uint8Array): Uint8Array {
  const [pa, pb, len] = pad(a, b);
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = pa[i] ^ pb[i];
  return out;
}

/**
 * @summary Bitwise NOT (one's complement) of a single unsigned byte array.
 *
 * @description
 * Flips every bit. `Uint8Array` automatically masks each result to 8
 * bits on assignment, so no explicit mask is needed.
 *
 * Result length: `a.length` (unary — length is preserved).
 *
 * @param a - Operand (big-endian, unsigned bytes).
 * @returns New `Uint8Array` with every bit flipped.
 *
 * @example
 * not(new Uint8Array([0xFF, 0x00])); // → Uint8Array [0x00, 0xFF]
 * not(new Uint8Array([0xF0]));       // → Uint8Array [0x0F]
 */
export function not(a: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = ~a[i];
  // Uint8Array stores only the low 8 bits, so ~x is automatically masked
  return out;
}

/**
 * @summary Bitwise NAND: `NOT(AND(a, b))`.
 *
 * @description
 * Equivalent to `not(and(a, b))` but computed in a single pass,
 * avoiding an intermediate allocation.
 *
 * Result length: `max(a.length, b.length)`.
 *
 * @param a - First operand.
 * @param b - Second operand.
 * @returns New `Uint8Array` where every bit is the NAND of the corresponding bits.
 *
 * @example
 * // Buttons that are NOT pressed in both states simultaneously
 * nand(stateA, stateB);
 */
export function nand(a: Uint8Array, b: Uint8Array): Uint8Array {
  const [pa, pb, len] = pad(a, b);
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = ~(pa[i] & pb[i]);
  return out;
}

/**
 * @summary Bitwise NOR: `NOT(OR(a, b))`.
 *
 * @description
 * Equivalent to `not(or(a, b))` but computed in a single pass,
 * avoiding an intermediate allocation.
 *
 * Result length: `max(a.length, b.length)`.
 *
 * @param a - First operand.
 * @param b - Second operand.
 * @returns New `Uint8Array` where every bit is the NOR of the corresponding bits.
 *
 * @example
 * // Bits that are 0 in both states — neither button active anywhere
 * nor(stateA, stateB);
 */
export function nor(a: Uint8Array, b: Uint8Array): Uint8Array {
  const [pa, pb, len] = pad(a, b);
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = ~(pa[i] | pb[i]);
  return out;
}

// ── Arithmetic operations ─────────────────────────────────────────────────────

/**
 * @summary Unsigned big-endian addition with carry.
 *
 * @description
 * Adds two byte arrays with carry propagation from the least significant
 * byte (rightmost, highest index) to the most significant.
 *
 * Each intermediate sum is at most `255 + 255 + 1 = 511`, which fits
 * in a plain JavaScript number without precision loss. No `BigInt`
 * bridge is needed here.
 *
 * Result length: `max(a.length, b.length) + 1`.
 * Index `0` holds the carry-out (`0` or `1`). Callers who know no
 * overflow occurred may slice it off; retaining it is the safe default.
 *
 * @param a - First operand (big-endian, unsigned bytes).
 * @param b - Second operand (big-endian, unsigned bytes).
 * @returns New `Uint8Array` whose value equals `a + b`, with carry at index 0.
 *
 * @example
 * add(new Uint8Array([0xFF]), new Uint8Array([0x01]));
 * // → Uint8Array [0x01, 0x00]  (carry in high byte)
 *
 * @example
 * add(new Uint8Array([0x01, 0xFF]), new Uint8Array([0x00, 0x01]));
 * // → Uint8Array [0x00, 0x02, 0x00]
 */
export function add(a: Uint8Array, b: Uint8Array): Uint8Array {
  const [pa, pb, len] = pad(a, b);
  const out = new Uint8Array(len + 1);
  let carry = 0;
  for (let i = len - 1; i >= 0; i--) {
    const sum = pa[i] + pb[i] + carry;
    out[i + 1] = sum & 0xff;
    carry = sum >> 8;
  }
  out[0] = carry;
  return out;
}

/**
 * @summary Unsigned big-endian subtraction with zero saturation.
 *
 * @description
 * Subtracts `b` from `a` with borrow propagation from LSB to MSB.
 * When `a ≤ b` the result saturates to an all-zero array — no
 * wrap-around. This preserves the unsigned semantic: controller
 * magnitudes have no meaningful negative representation.
 *
 * Result length: `max(a.length, b.length)`.
 *
 * @param a - Minuend (big-endian, unsigned bytes).
 * @param b - Subtrahend (big-endian, unsigned bytes).
 * @returns `max(0, a − b)` as a big-endian byte array.
 *
 * @example
 * subtract(new Uint8Array([0x10]), new Uint8Array([0x03]));
 * // → Uint8Array [0x0D]
 *
 * subtract(new Uint8Array([0x03]), new Uint8Array([0x10]));
 * // → Uint8Array [0x00]  (saturated)
 *
 * @example
 * // Multi-byte borrow
 * subtract(
 *   new Uint8Array([0x10, 0x00]),
 *   new Uint8Array([0x00, 0x01]),
 * );
 * // → Uint8Array [0x0F, 0xFF]
 */
export function subtract(a: Uint8Array, b: Uint8Array): Uint8Array {
  const outLen = Math.max(a.length, b.length);
  if (cmp(a, b) <= 0) return new Uint8Array(outLen);
  const [pa, pb, len] = pad(a, b);
  const out = new Uint8Array(len);
  let borrow = 0;
  for (let i = len - 1; i >= 0; i--) {
    let diff = pa[i] - pb[i] - borrow;
    if (diff < 0) {
      diff += 256;
      borrow = 1;
    } else borrow = 0;
    out[i] = diff;
  }
  return out;
}

/**
 * @summary Unsigned big-endian multiplication.
 *
 * @description
 * Schoolbook O(m·n) long multiplication, byte by byte from LSB upward.
 * The maximum intermediate value per cell is:
 * `255 × 255 + 255 + 255 = 65 535` — well within float53 range,
 * so no `BigInt` bridge is needed for the inner loop.
 *
 * Result length: `a.length + b.length`.
 * The result has enough room for the full product. Leading zero bytes
 * are retained to keep the length contract predictable.
 *
 * @param a - Multiplicand (big-endian, unsigned bytes).
 * @param b - Multiplier   (big-endian, unsigned bytes).
 * @returns Product as a big-endian byte array of length `a.length + b.length`.
 *
 * @example
 * multiply(new Uint8Array([0xFF]), new Uint8Array([0xFF]));
 * // 255 × 255 = 65025 = 0xFE01
 * // → Uint8Array [0xFE, 0x01]
 *
 * @example
 * multiply(
 *   new Uint8Array([0x01, 0x00]),  // 256
 *   new Uint8Array([0x02]),        // 2
 * );
 * // 256 × 2 = 512 = 0x0200
 * // → Uint8Array [0x00, 0x02, 0x00]
 */
export function multiply(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  for (let i = a.length - 1; i >= 0; i--) {
    let carry = 0;
    for (let j = b.length - 1; j >= 0; j--) {
      const pos = i + j + 1;
      // max: 255*255 + 255 + 255 = 65535 — safe in float53
      const prod = a[i] * b[j] + out[pos] + carry;
      out[pos] = prod & 0xff;
      carry = prod >> 8;
    }
    out[i] += carry;
  }
  return out;
}

/**
 * @summary Unsigned big-endian integer division (truncating toward zero).
 *
 * @description
 * Delegates to the `BigInt` bridge. Byte-level long division requires
 * multi-precision comparison and conditional subtraction at each step;
 * `bigint` is correct and the performance difference is negligible for
 * operations that do not appear on the game loop hot path.
 *
 * Result length: `max(a.length, b.length)`.
 *
 * @param a - Dividend (big-endian, unsigned bytes).
 * @param b - Divisor  (big-endian, unsigned bytes).
 * @returns Quotient as a big-endian byte array.
 *
 * @throws {RangeError} When `b` is zero.
 *
 * @example
 * divide(new Uint8Array([0x0A]), new Uint8Array([0x03]));
 * // 10 ÷ 3 = 3  → Uint8Array [0x03]
 *
 * @example
 * divide(
 *   new Uint8Array([0x01, 0x00]),  // 256
 *   new Uint8Array([0x10]),        // 16
 * );
 * // 256 ÷ 16 = 16 → Uint8Array [0x00, 0x10]
 */
export function divide(a: Uint8Array, b: Uint8Array): Uint8Array {
  const nb = toBig(b);
  if (nb === 0n) throw new RangeError('divide: divisor is zero');
  return fromBig(toBig(a) / nb, Math.max(a.length, b.length));
}

/**
 * @summary Unsigned big-endian remainder (modulo).
 *
 * @description
 * Returns the remainder of `a ÷ b`. Delegates to the `BigInt` bridge.
 * The result is always in `[0, b − 1]` because both operands are unsigned.
 *
 * Result length: `max(a.length, b.length)`.
 *
 * @param a - Dividend (big-endian, unsigned bytes).
 * @param b - Divisor  (big-endian, unsigned bytes).
 * @returns Remainder as a big-endian byte array.
 *
 * @throws {RangeError} When `b` is zero.
 *
 * @example
 * remainder(new Uint8Array([0x0A]), new Uint8Array([0x03]));
 * // 10 % 3 = 1  → Uint8Array [0x01]
 */
export function remainder(a: Uint8Array, b: Uint8Array): Uint8Array {
  const nb = toBig(b);
  if (nb === 0n) throw new RangeError('remainder: divisor is zero');
  return fromBig(toBig(a) % nb, Math.max(a.length, b.length));
}

// ── Comparison (exported for consumers who need ordering) ─────────

/**
 * @summary Compare two unsigned big-endian byte arrays.
 *
 * @description
 * Both arrays are zero-padded to the same length, then compared
 * byte by byte from MSB to LSB. Useful for threshold comparisons
 * on `HighResVPadData` analog values (e.g. trigger pressure).
 *
 * @param a - First operand.
 * @param b - Second operand.
 * @returns `-1` if `a < b`, `0` if `a === b`, `1` if `a > b`.
 *
 * @example
 * compare(new Uint8Array([0x01]), new Uint8Array([0x02])); // → -1
 * compare(new Uint8Array([0x02]), new Uint8Array([0x02])); // →  0
 * compare(new Uint8Array([0x03]), new Uint8Array([0x02])); // →  1
 */
export function compare(a: Uint8Array, b: Uint8Array): -1 | 0 | 1 {
  return cmp(a, b);
}
