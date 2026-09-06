import { HertzMetric } from '../const';

/**
 * @summary Estimates and returns the average browser refresh rate
 * @param {number} [sampleSize=30] the number of frames to aggregate. The higher the number,
 * the longer the oscillation, the more accurate, the result will be. This value is not
 * checked at runtime, hence a negative value will return `0`.
 * @default 30
 * @param {HertzMetric} [metric=HertzMetric.HERTZ] the hertz measurement of the result
 * @default HertzMetric.HERTZ
 * @returns {Promise<number>} the refresh-rate in hertz
 */
export function getBrowserRefreshRate(sampleSize: number = 30, metric = HertzMetric.HERTZ): Promise<number> {
  return new Promise((resolve) => {
    let frameTimes: number[] = [];
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
        if (metric !== HertzMetric.HERTZ)
            estimatedHz /= metric;

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

export function toGigaHertz(value: number, metric: HertzMetric = HertzMetric.HERTZ) {
  return toHertz(value, metric) / HertzMetric.GIGAHERTZ;
}
export function toMegaHertz(value: number, metric: HertzMetric = HertzMetric.HERTZ) {
  return toHertz(value, metric) / HertzMetric.MEGAHERTZ;
}
export function toKiloHertz(value: number, metric: HertzMetric = HertzMetric.HERTZ) {
  return toHertz(value, metric) / HertzMetric.KILOHERTZ;
}
export function toHertz(value: number, metric: HertzMetric) {
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
