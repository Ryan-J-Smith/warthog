import type { SpriteKey } from '../../assets';
import type { EntityKind } from '../../sim/types';
import { MOTION_SPECS } from '../motion';
import type { MotionSpec } from '../motion';

/** How each entity kind is drawn. */
export interface EntityVisualSpec {
  base: SpriteKey;
  /** Rotating top (turret / launcher), if any. */
  top: SpriteKey | null;
  /** Origin of the top sprite (normalised), i.e. its pivot. */
  topOrigin: { x: number; y: number };
  /** Sprite shown once destroyed; null = fade out and remove. */
  wreck: SpriteKey | null;
  /** Structures draw under vehicles. */
  structure: boolean;
  /** Flies: drawn by `HelicopterRenderer` (at height, with a drop shadow) instead of as a ground sprite. */
  airborne?: boolean;
  /** Animated while moving (and recoils when firing); absent = static sprite. */
  motion?: MotionSpec;
}

const vehicle = (base: SpriteKey, top: SpriteKey | null, wreck: SpriteKey | null, topOrigin = { x: 0.5, y: 0.5 }): EntityVisualSpec => ({
  base,
  top,
  topOrigin,
  wreck,
  structure: false,
});

const structure = (base: SpriteKey, wreck: SpriteKey | null): EntityVisualSpec => ({
  base,
  top: null,
  topOrigin: { x: 0.5, y: 0.5 },
  wreck,
  structure: true,
});

const TANK_TURRET_PIVOT = { x: 24 / 68, y: 0.5 };


export const ENTITY_VISUALS: Record<EntityKind, EntityVisualSpec> = {
  tank: { ...vehicle('tankHull', 'tankTurret', 'tankWreck', TANK_TURRET_PIVOT), motion: MOTION_SPECS.tank },
  truck: vehicle('truck', null, 'truckWreck'),
  infantry: { ...vehicle('infantry', null, null), motion: MOTION_SPECS.infantry },
  aaGun: vehicle('aaSite', 'aaTurret', 'aaSiteWreck'),
  mobileAa: vehicle('aaHull', 'aaTurret', 'aaWreck'),
  samSite: { ...structure('samBase', 'samWreck'), top: 'samLauncher' },
  helicopter: { ...vehicle('heliBody', 'heliRotor', 'heliWreck'), airborne: true },
  mlrs: vehicle('mlrs', null, 'mlrsWreck'),
  bridge: structure('bridge', 'bridgeDestroyed'),
  ammoDump: structure('ammoDump', 'ammoDumpWreck'),
  cache: structure('cache', null),
  enemyHq: structure('enemyHq', 'enemyHqDestroyed'),
  outpost: structure('outpost', 'outpostDestroyed'),
  homeBase: structure('homeBase', null),
  friendlyTank: {
    ...vehicle('friendlyTankHull', 'friendlyTankTurret', 'tankWreck', TANK_TURRET_PIVOT),
    motion: MOTION_SPECS.friendlyTank,
  },
  friendlyInfantry: {
    ...vehicle('friendlyInfantry', null, null),
    motion: MOTION_SPECS.friendlyInfantry,
  },
  friendlyHq: structure('friendlyHq', 'friendlyHqDestroyed'),
};
