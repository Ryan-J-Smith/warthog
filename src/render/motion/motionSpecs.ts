import type { SpriteKey } from '../../assets';
import type { EntityKind } from '../../sim/types';

/**
 * Movement cycle for a ground unit (see `UnitMotion`): `walk` = stepping mech (stride frames,
 * body recoil), `tracks` = scrolling tread frames (turret recoil).
 */
export interface MotionSpec {
  style: 'walk' | 'tracks';
  /** Base-sprite frames played in order by distance moved; the first is the unit's own sprite. */
  frames: readonly SpriteKey[];
  /** World units moved per full pass through `frames`, at unit display scale 1. */
  cycleLength: number;
}

/** Tread bars advance one bar pitch (4.6 sprite units) per three-frame pass. */
const tracks = (hull: SpriteKey, tread1: SpriteKey, tread2: SpriteKey): MotionSpec => ({
  style: 'tracks',
  frames: [hull, tread1, tread2],
  cycleLength: 4.6,
});

/** Eight steps: planted, three steps through to the mirror stance, three back (two strides). */
const walk = (idle: SpriteKey, w1: SpriteKey, w2: SpriteKey, w3: SpriteKey, w4: SpriteKey): MotionSpec => ({
  style: 'walk',
  frames: [idle, w1, w2, w3, w4, w3, w2, w1],
  cycleLength: 48,
});

/** Movement cycles by entity kind (kinds not listed keep a static sprite). */
export const MOTION_SPECS = {
  tank: tracks('tankHull', 'tankHullTread1', 'tankHullTread2'),
  friendlyTank: tracks('friendlyTankHull', 'friendlyTankHullTread1', 'friendlyTankHullTread2'),
  infantry: walk('infantry', 'infantryWalk1', 'infantryWalk2', 'infantryWalk3', 'infantryWalk4'),
  friendlyInfantry: walk('friendlyInfantry', 'friendlyInfantryWalk1', 'friendlyInfantryWalk2', 'friendlyInfantryWalk3', 'friendlyInfantryWalk4'),
} as const satisfies Partial<Record<EntityKind, MotionSpec>>;
