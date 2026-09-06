export enum SecondMetric {
  SECONDS = 1,
  MILLISECONDS = 1_000,
  MICROSECONDS = 1_000_000,
  NANOSECONDS = 1_000_000_000,
}

export const DRAW_INTERVAL_NS = (fps: number) => SecondMetric.NANOSECONDS / fps;

export const FPS_CACHE_CAPACITY = 60;

/** Upper bound on simulation catch-up steps run in a single host frame. */
export const MAX_CATCHUP_STEPS = 5;

export enum HertzMetric {
  HERTZ = 1,
  KILOHERTZ = 1_000,
  MEGAHERTZ = 1_000_000,
  GIGAHERTZ = 1_000_000_000,
}
