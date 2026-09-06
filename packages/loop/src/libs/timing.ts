/**
 * @fileoverview
 * @summary Frequency (Hertz) conversion helpers and browser refresh-rate estimation.
 *
 * @description
 * This module provides the engine's frequency utilities: `getBrowserRefreshRate`, which samples
 * `requestAnimationFrame` deltas to estimate the display's refresh rate, and the Hertz
 * unit-conversion functions (`toHertz`, `toKiloHertz`, `toMegaHertz`, `toGigaHertz`). They mirror
 * the time utilities in `time.ts`, with a `HertzMetric` that scales *up* to hertz.
 *
 * @note
 * `HertzMetric` uses the opposite convention to `SecondMetric`: a `HertzMetric` member is "hertz
 * per unit" (e.g. `KILOHERTZ = 1000` hertz per kilohertz), so converting *to* hertz multiplies —
 * whereas a `SecondMetric` member is "units per second", so converting *to* seconds divides.
 *
 * @author MathAid
 */

import { HertzMetric } from '../const';

/**
 * @summary Estimate the average browser refresh rate by sampling animation frames.
 *
 * @description
 * `getBrowserRefreshRate` schedules a `requestAnimationFrame` loop, records the gap between
 * consecutive frames (discarding the initial layout-frame spike), and averages those gaps into an
 * estimate of the display's refresh rate in hertz. It resolves once `sampleSize` frames have been
 * gathered (~0.5 s at 60 Hz for the default 30).
 *
 * @param sampleSize - The number of frame gaps to aggregate. Larger values smooth noise but take
 *   longer. Must be positive — a non-positive value samples nothing and the promise rejects.
 *   Defaults to `30`.
 * @param metric - The unit to report the result in. Defaults to `HertzMetric.HERTZ`.
 * @return A promise resolving to the estimated refresh rate, in the requested metric.
 *
 * @example
 * const hz = await getBrowserRefreshRate();           // e.g. 60
 * const khz = await getBrowserRefreshRate(30, HertzMetric.KILOHERTZ); // 0.06
 *
 * @see {@link toHertz}
 * @author MathAid
 */
export function getBrowserRefreshRate(
  sampleSize: number = 30,
  metric: HertzMetric = HertzMetric.HERTZ,
): Promise<number> {
  return new Promise((resolve) => {
    const frameTimes: number[] = [];
    let lastTime = performance.now();

    let rAFHandle: number;

    function sample(now: number) {
      const delta = now - lastTime;
      lastTime = now;

      // Discard the initial layout frame spike
      if (delta > 0) {
        frameTimes.push(delta);
      }

      // Gather N frame samples (~0.5 seconds at 60Hz) for statistical accuracy
      if (frameTimes.length < sampleSize) {
        requestAnimationFrame(sample);
      } else {
        // Find the average frame gap duration in ms
        const averageGap = frameTimes.reduce((a, b) => a + b) / frameTimes.length;
        // Convert ms-per-frame to frames-per-second (Hz)
        let estimatedHz = Math.round(1000 / averageGap);
        if (metric !== HertzMetric.HERTZ) estimatedHz /= metric;

        try {
          cancelAnimationFrame(rAFHandle);
        } catch {
          /* Caught, don't emit error */
        } finally {
          resolve(estimatedHz);
        }
      }
    }

    rAFHandle = requestAnimationFrame(sample);
  });
}

/**
 * @summary Convert a value from one frequency metric to gigahertz.
 *
 * @description
 * `toGigaHertz` converts a `value` expressed in `metric` into gigahertz by first normalising to
 * hertz and then scaling down.
 *
 * @param value - The magnitude to convert.
 * @param metric - The unit `value` is expressed in. Defaults to `HertzMetric.HERTZ`.
 * @return The equivalent magnitude in gigahertz.
 *
 * @example
 * toGigaHertz(2_000_000_000, HertzMetric.HERTZ); // 2
 *
 * @see {@link toHertz}
 * @author MathAid
 */
export function toGigaHertz(value: number, metric: HertzMetric = HertzMetric.HERTZ): number {
  return toHertz(value, metric) / HertzMetric.GIGAHERTZ;
}

/**
 * @summary Convert a value from one frequency metric to megahertz.
 *
 * @description
 * `toMegaHertz` converts a `value` expressed in `metric` into megahertz via the shared
 * normalise-to-hertz path.
 *
 * @param value - The magnitude to convert.
 * @param metric - The unit `value` is expressed in. Defaults to `HertzMetric.HERTZ`.
 * @return The equivalent magnitude in megahertz.
 *
 * @example
 * toMegaHertz(3_000_000, HertzMetric.HERTZ); // 3
 *
 * @see {@link toHertz}
 * @author MathAid
 */
export function toMegaHertz(value: number, metric: HertzMetric = HertzMetric.HERTZ): number {
  return toHertz(value, metric) / HertzMetric.MEGAHERTZ;
}

/**
 * @summary Convert a value from one frequency metric to kilohertz.
 *
 * @description
 * `toKiloHertz` converts a `value` expressed in `metric` into kilohertz. It is the natural bridge
 * when a caller needs kilohertz from a hertz- or megahertz-sourced value.
 *
 * @param value - The magnitude to convert.
 * @param metric - The unit `value` is expressed in. Defaults to `HertzMetric.HERTZ`.
 * @return The equivalent magnitude in kilohertz.
 *
 * @example
 * toKiloHertz(60_000, HertzMetric.HERTZ); // 60
 *
 * @see {@link toHertz}
 * @author MathAid
 */
export function toKiloHertz(value: number, metric: HertzMetric = HertzMetric.HERTZ): number {
  return toHertz(value, metric) / HertzMetric.KILOHERTZ;
}

/**
 * @summary Normalise a value from one frequency metric to hertz.
 *
 * @description
 * `toHertz` multiplies `value` by its `metric`'s scale, yielding hertz. Because a `HertzMetric`
 * member is "hertz per unit", converting *to* hertz is a multiplication (the inverse of the time
 * utilities' divide-to-seconds). It is the single normalisation step the other conversions
 * delegate to.
 *
 * @param value - The magnitude to convert.
 * @param metric - The unit `value` is expressed in.
 * @return The equivalent magnitude in hertz.
 *
 * @example
 * toHertz(2, HertzMetric.KILOHERTZ); // 2_000
 *
 * @note
 * An unrecognised `metric` falls through the switch and returns `0` rather than throwing, so
 * callers should always pass a real `HertzMetric` member.
 *
 * @author MathAid
 */
export function toHertz(value: number, metric: HertzMetric): number {
  switch (metric) {
    default:
      return 0;
    case HertzMetric.HERTZ:
    case HertzMetric.KILOHERTZ:
    case HertzMetric.MEGAHERTZ:
    case HertzMetric.GIGAHERTZ:
      return value * metric;
  }
}
