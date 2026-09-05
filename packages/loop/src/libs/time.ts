import { SecondMetric } from '../const';

export function nanoTime() {
  return Math.trunc(toNanoseconds(performance.now(), SecondMetric.MILLISECONDS));
}
export function toNanoseconds(value: number, metric: SecondMetric = SecondMetric.SECONDS) {
  return toSeconds(value, metric) * SecondMetric.NANOSECONDS;
}
export function toMicroseconds(value: number, metric: SecondMetric = SecondMetric.SECONDS) {
  return toSeconds(value, metric) * SecondMetric.MICROSECONDS;
}
export function toMilliseconds(value: number, metric: SecondMetric = SecondMetric.SECONDS) {
  return toSeconds(value, metric) * SecondMetric.MILLISECONDS;
}
export function toSeconds(value: number, metric: SecondMetric) {
  switch (metric) {
    default:
      return 0;
    case SecondMetric.SECONDS:
    case SecondMetric.MILLISECONDS:
    case SecondMetric.MICROSECONDS:
    case SecondMetric.NANOSECONDS:
      return value / metric;
  }
}
