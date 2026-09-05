import { fromBig as bigintToUint8, toBig as uint8ToBigInt } from './uint8';
import { fromBig as bigintToWord, toBig as wordToBigint } from './words';

/**
 * Converts an unsigned value from the given word format where each element is considered to
 * be a 32 bit integer into an 8 bit lane integer
 * @param {number} x the value to be converted
 * @param {number} len the total number of bits (from the MSB to the intended LSB) to convert.
 * The default includes the entire array, from the last element (most significant 32
 * bits) to the first element (least significant 32 bits)
 *
 * @returns {Uint8Array} an unsigned integer
 */
export function fromWordToUint8Array(x: number[], len: number = x.length * 32): Uint8Array {
  return bigintToUint8(wordToBigint(x), Math.floor(len / 8));
}
/**
 * Converts an 8 bit lane integer value from into the given word format where each element
 * is considered to be a 32 bit integer
 * @param x the value to be converted
 * @param len the total number of bits to convert
 * @returns an unsigned equivant of the input as an array of 32 bit integers
 */
export function fromUint8ArrayToWord(x: Uint8Array, len: number = x.length * 8): number[] {
  return bigintToWord(uint8ToBigInt(x), Math.max(Math.floor(len / 32), 1));
}
