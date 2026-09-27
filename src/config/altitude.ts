import type { AltitudeBand } from '../sim/types';

/** Per-band flight profile. Values are interpolated across the continuous altitude. */
export interface BandProfile {
  /** Cruise speed, world units / s. */
  speed: number;
  /** Max turn rate, degrees / s. */
  turnRateDeg: number;
  /** Camera zoom. */
  zoom: number;
}

export const BAND_PROFILES: Record<AltitudeBand, BandProfile> = {
  low: { speed: 150, turnRateDeg: 150, zoom: 1.0 },
  medium: { speed: 230, turnRateDeg: 105, zoom: 0.72 },
  high: { speed: 360, turnRateDeg: 60, zoom: 0.45 },
};

/** Continuous altitude value at the centre of each band. */
export const BAND_ALTITUDE: Record<AltitudeBand, number> = { low: 0, medium: 1, high: 2 };

/** How fast altitude moves toward a higher target band, bands per second. */
export const CLIMB_RATE = 1.0;

/** Diving is faster than climbing, so a dive on the SAM lock tone works even from High. */
export const DIVE_RATE = 1.6;

/** Effective-band thresholds on the continuous altitude. */
export const BAND_THRESHOLDS = { lowToMedium: 0.5, mediumToHigh: 1.5 } as const;

/**
 * Height above ground (band units) of an aircraft at altitude 0. The player never touches the
 * ground: rendered/physical height = `alt + AIRCRAFT_BASE_HEIGHT`. Projectile `alt` is height
 * above ground in the same units (0 = on the ground).
 */
export const AIRCRAFT_BASE_HEIGHT = 0.35;

/** Energy: dive speed bonus / climb speed penalty, and how fast it decays back to 1. */
export const ENERGY = { diveBonus: 0.25, climbPenalty: 0.15, recoveryPerSecond: 0.3 } as const;

/** Interpolated flight profile at a continuous altitude (0..2). */
export function bandProfileAt(alt: number): BandProfile {
  const a = Math.min(2, Math.max(0, alt));
  const [from, to, t] = a <= 1 ? [BAND_PROFILES.low, BAND_PROFILES.medium, a] : [BAND_PROFILES.medium, BAND_PROFILES.high, a - 1];
  const mix = (x: number, y: number): number => x + (y - x) * t;
  return { speed: mix(from.speed, to.speed), turnRateDeg: mix(from.turnRateDeg, to.turnRateDeg), zoom: mix(from.zoom, to.zoom) };
}

/** Effective gameplay band for a continuous altitude. */
export function bandOf(alt: number): AltitudeBand {
  if (alt < BAND_THRESHOLDS.lowToMedium) return 'low';
  if (alt < BAND_THRESHOLDS.mediumToHigh) return 'medium';
  return 'high';
}
