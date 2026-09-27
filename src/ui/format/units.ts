/**
 * Display units. The simulation works in world units; the HUD dresses them up as avionics
 * readouts. The scales are chosen for feel (rule of cool), not realism: Low ≈ 190 kt,
 * High ≈ 450 kt (an A-10's never-exceed speed), and 1 world unit = 1 m on the map.
 */
export const KNOTS_PER_UNIT = 1.25;
export const METERS_PER_UNIT = 1;

/** Altitude readout in feet at the centre of each band (Low, Medium, High). */
const FEET_AT_BAND = [300, 6000, 15000] as const;

/** World units per second → knots, rounded. */
export function speedKnots(unitsPerSecond: number): number {
  return Math.round(unitsPerSecond * KNOTS_PER_UNIT);
}

/** Continuous altitude (0..2) → feet, rounded to 50 ft. */
export function altitudeFeet(alt: number): number {
  const a = Math.max(0, Math.min(2, alt));
  const [low, medium, high] = FEET_AT_BAND;
  const feet = a <= 1 ? low + (medium - low) * a : medium + (high - medium) * (a - 1);
  return Math.round(feet / 50) * 50;
}

/** World units → "850 m" / "2.4 km". */
export function formatDistance(units: number): string {
  const meters = Math.max(0, units * METERS_PER_UNIT);
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
