/**
 * @fileoverview Tuple and object conversions.
 *
 * @summary
 * Re-exports `ColorTuple<S>`, `asTuple`, `fromTuple`, `makeTuple`,
 * and `isColorValue`. The canonical types live in `convert.ts`. This
 * file re-exports them for callers that want a tuple-focused import
 * path.
 *
 * @description
 * The tuple is a view. The object is the canonical form. Every
 * public function that accepts a tuple converts it to an object at
 * the top of the function. The conversion exists for three reasons.
 *
 *   1. The object carries the `_space` field. The tuple cannot. The
 *      runtime space tag is required for `convert`, `format`, and
 *      every function that reads `descriptor`.
 *   2. TypeScript's structural typing and type predicates are
 *      reliable on objects. A tuple loses the space tag on `[...c]`,
 *      `c.slice()`, `structuredClone(c)`, and `JSON.parse(JSON.stringify(c))`.
 *      The object loses nothing.
 *   3. A tuple-based tag would need a global `WeakMap<tuple, space>`.
 *      That map is a leak risk and a performance cost. The object
 *      shape avoids it entirely.
 *
 * The conversions are two function calls and a type guard. They are
 * cheap. The tuple wins at GPU boundaries and in JSON payloads. The
 * object wins everywhere else.
 *
 * @example
 * import { asTuple, fromTuple, makeTuple, sRGB } from './index.js';
 *
 * const t = makeTuple(sRGB, 1, 0, 0);
 * const c = fromTuple(t, sRGB);
 * const back = asTuple(c);
 *
 * @author MathAid
 */

export {
  asTuple,
  fromTuple,
  isColorValue,
  makeTuple
} from './convert';

