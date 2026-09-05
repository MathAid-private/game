/**
 * Generates a cryptographically secure random integer within a given range.
 *
 * @returns {number} A secure random integer between min and max.
 */
export function cryptRandom(): number {
  // The maximum value for a 32-bit unsigned integer (4 bytes)
  const MAX_UINT32 = 0xffff_ffff;

  const buf = new Uint8Array(4);

  // 1. Generate 4 bytes of random data.
  const buffer = crypto.getRandomValues(buf);

  // 2. Convert the 4 bytes to a 32-bit unsigned integer.
  const randomInt = buffer.reduce((p, c, i) => ((p << i) | c) >>> 0, 0);

  // 3. Normalize the integer to a float between 0 and 1.
  const normalized = randomInt / MAX_UINT32;

  return normalized;
}

export function randomRange(lower: number, upper: number) {
  const range = Math.floor(Math.random() * upper) + lower;
  console.log(range);
  return range;
}

export function raffleDraw<T>(a: T[], lower = 0, upper = a.length) {
  return a[randomRange(lower, upper - 1)];
}
