import type { SpriteKey } from '../../assets';
import type { EntityKind } from '../../sim/types';

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
  tank: vehicle('tankHull', 'tankTurret', 'tankWreck', TANK_TURRET_PIVOT),
  truck: vehicle('truck', null, 'truckWreck'),
  infantry: vehicle('infantry', null, null),
  aaGun: vehicle('aaHull', 'aaTurret', 'aaWreck'),
  mobileAa: vehicle('aaHull', 'aaTurret', 'aaWreck'),
  samSite: { ...structure('samBase', 'samWreck'), top: 'samLauncher' },
  bridge: structure('bridge', 'bridgeDestroyed'),
  ammoDump: structure('ammoDump', 'ammoDumpWreck'),
  cache: structure('cache', null),
  outpost: structure('outpost', 'outpostDestroyed'),
  homeBase: structure('homeBase', null),
  friendlyTank: vehicle('friendlyTankHull', 'friendlyTankTurret', 'tankWreck', TANK_TURRET_PIVOT),
  friendlyInfantry: vehicle('friendlyInfantry', null, null),
};
