import type { EntityKind } from '../types';

// ---------------------------------------------------------------------------
// Lane war: MOBA-style roads that both sides push down on a timer
// ---------------------------------------------------------------------------

/**
 * One road between the two HQs. Enemy waves drive `pathId` (enemy HQ → friendly HQ); friendly
 * waves drive the same path reversed. Units stop to fight whatever they meet on the way.
 */
export interface LaneDefinition {
  id: string;
  /** Radio / HUD name, e.g. "West road". */
  name: string;
  pathId: string;
  /** Seconds added to every wave's spawn time on this road (staggers the pressure). */
  offset: number;
  /**
   * The enemy forward depot feeding this road. While it stands, enemy waves here bring
   * `depotBonus`; once it is destroyed the road is "broken" and friendly waves bring `brokenBonus`.
   */
  depotRefId: string;
  depotBonus: EntityKind[];
  brokenBonus: EntityKind[];
  /** Objective whose HUD meter/detail shows this road's front line while it is active. */
  objectiveId?: string;
}

/** Units added to a team's waves from sim time `at` onward. */
export interface WaveEscalation {
  at: number;
  add: EntityKind[];
}

/** A team's repeating waves, one per road per cycle. */
export interface WaveDefinition {
  team: 'enemy' | 'friendly';
  /** Sim time of the first wave (before each road's `offset`). */
  firstAt: number;
  /** Seconds between waves on a road. */
  interval: number;
  speed: number;
  /** Distance between vehicles in the wave's file. */
  spacing: number;
  units: EntityKind[];
  escalation: WaveEscalation[];
  /** Living units of this team per road; a wave only spawns up to the cap. */
  laneCap: number;
}

/**
 * The enemy commits reserves every `every`-th enemy wave cycle, to the road where it is
 * losing worst (the deepest friendly push). Announced on the radio.
 */
export interface SurgeDefinition {
  every: number;
  units: EntityKind[];
}

export interface LaneWarDefinition {
  enemyHqRefId: string;
  /** The mission is lost the moment this falls. */
  friendlyHqRefId: string;
  lanes: LaneDefinition[];
  waves: WaveDefinition[];
  surge?: SurgeDefinition;
}
