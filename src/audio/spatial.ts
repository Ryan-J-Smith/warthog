import type { Vec2 } from '../sim/math';

/** Tuning for positional audio (world units; the camera shows ~1900 u across at Low, ~4300 u at High). */
export interface SpatialConfig {
  /** Full volume inside this distance. */
  nearUnits: number;
  /** Silent beyond this distance (with a fade over the last quarter). */
  farUnits: number;
  /** Exponent of the (near / d) fall-off. */
  rolloff: number;
  /** Extra "height" distance per altitude band: ground sounds are further away when you fly high. */
  altitudeUnitsPerBand: number;
  /** Horizontal offset that pans fully to one side at Low altitude … */
  panHalfWidthLow: number;
  /** … widened by this much per altitude band (the view is wider up high). */
  panHalfWidthPerBand: number;
  /** Never pan harder than this. */
  maxPan: number;
}

export const DEFAULT_SPATIAL: SpatialConfig = {
  nearUnits: 260,
  farUnits: 2800,
  rolloff: 0.9,
  altitudeUnitsPerBand: 220,
  panHalfWidthLow: 750,
  panHalfWidthPerBand: 550,
  maxPan: 0.85,
};

export interface SpatialResult {
  /** Linear gain 0..1. */
  gain: number;
  /** Stereo pan -1..1. */
  pan: number;
}

/**
 * Distance attenuation and stereo pan for a sound at `source` heard by a listener at `listener`
 * flying at continuous altitude `alt` (0 = Low … 2 = High).
 */
export function spatialize(listener: Vec2, alt: number, source: Vec2, cfg: SpatialConfig = DEFAULT_SPATIAL): SpatialResult {
  const dx = source.x - listener.x;
  const dy = source.y - listener.y;
  const h = Math.max(0, alt) * cfg.altitudeUnitsPerBand;
  const d = Math.sqrt(dx * dx + dy * dy + h * h);
  let gain = d <= cfg.nearUnits ? 1 : Math.pow(cfg.nearUnits / d, cfg.rolloff);
  const fadeStart = cfg.farUnits * 0.75;
  if (d >= cfg.farUnits) gain = 0;
  else if (d > fadeStart) gain *= (cfg.farUnits - d) / (cfg.farUnits - fadeStart);
  const halfWidth = cfg.panHalfWidthLow + Math.max(0, alt) * cfg.panHalfWidthPerBand;
  const pan = Math.max(-1, Math.min(1, dx / halfWidth)) * cfg.maxPan;
  return { gain, pan };
}
