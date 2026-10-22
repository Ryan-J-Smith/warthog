import type { Vec2 } from '../math';
import type { EntityKind } from '../types';

// ---------------------------------------------------------------------------
// Base defence: build between waves, fly during them (Thronefall-style prototype)
// ---------------------------------------------------------------------------

/** One road the enemy attacks down; `pathId` runs from the map edge to the base. */
export interface DefenseLaneDefinition {
  id: string;
  /** HUD / preview name, e.g. "North road". */
  name: string;
  pathId: string;
}

/** A spot beside a road where a structure can be built between waves. */
export interface BuildPadDefinition {
  id: string;
  pos: Vec2;
  /** The road this pad's units fight on. */
  laneId: string;
}

/** One wave: what comes down each road. Shown to the player before it launches. */
export interface DefenseWaveDefinition {
  lanes: Array<{ laneId: string; units: EntityKind[] }>;
}

export interface DefenseDefinition {
  /** refId of the structure the enemy is trying to destroy; losing it loses the mission. */
  baseRefId: string;
  lanes: DefenseLaneDefinition[];
  pads: BuildPadDefinition[];
  waves: DefenseWaveDefinition[];
  startGold: number;
  /** Gold paid for clearing wave n (0-based): `waveBonus + waveBonusStep * n`. */
  waveBonus: number;
  waveBonusStep: number;
  /** Player kill points are converted to gold at this rate. */
  goldPerKillPoint: number;
  /** Seconds out of the fight after being shot down (there is no life limit). */
  respawnDelay: number;
  /** Speed of enemy wave units. */
  waveSpeed: number;
}
