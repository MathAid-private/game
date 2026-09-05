export enum SecondMetric {
  SECONDS = 1,
  MILLISECONDS = 1_000,
  MICROSECONDS = 1_000_000,
  NANOSECONDS = 1_000_000_000,
}

export const DRAW_INTERVAL_NS = (fps: number) => SecondMetric.NANOSECONDS / fps;

export const FPS_CACHE_CAPACITY = 60;
