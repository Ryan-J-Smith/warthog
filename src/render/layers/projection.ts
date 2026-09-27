import { AIRCRAFT_BASE_HEIGHT } from '../../config';

/**
 * 2.5D projection helpers shared by every renderer so shadows and scaling agree.
 * `height` is height above ground in band units (0 = ground, ~2.35 = player at High).
 */

/** Screen-space offset of a shadow cast by something at `height` (light from the upper-left). */
export function shadowOffset(height: number): { x: number; y: number } {
  return { x: height * 30, y: height * 40 };
}

/** Sprite scale for something at `height` (closer to the camera = slightly bigger). */
export function heightScale(height: number): number {
  return 1 + height * 0.12;
}

/** Shadow alpha fades a little with height. */
export function shadowAlpha(height: number): number {
  return Math.max(0.12, 0.38 - height * 0.08);
}

/** Render height of an aircraft at continuous altitude `alt`. */
export function aircraftHeight(alt: number): number {
  return alt + AIRCRAFT_BASE_HEIGHT;
}
