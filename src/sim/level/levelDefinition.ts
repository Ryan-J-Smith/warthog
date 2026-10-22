import type { Vec2 } from '../math';
import type { EntityKind, RadioTone } from '../types';
import type { LaneWarDefinition } from './laneWarDefinition';

// ---------------------------------------------------------------------------
// Terrain (purely visual in v1; baked to textures by the render layer)
// ---------------------------------------------------------------------------

/** A river drawn as a smooth curve through `points`. */
export interface RiverDefinition {
  points: Vec2[];
  width: number;
}

export interface RoadDefinition {
  points: Vec2[];
  width: number;
  surface: 'dirt' | 'paved';
}

/** A roughly circular cluster of trees. `density` 0..1. */
export interface ForestDefinition {
  center: Vec2;
  radius: number;
  density: number;
}

/** A hill rendered with shading/contours. `height` 0..1 controls shading strength. */
export interface HillDefinition {
  center: Vec2;
  radius: number;
  height: number;
}

/** A rectangular crop field, rotated by `rotationDeg` around its centre. */
export interface FieldDefinition {
  center: Vec2;
  width: number;
  height: number;
  rotationDeg: number;
  crop: 'wheat' | 'green' | 'plowed';
}

/** A cluster of small neutral buildings (decor only). */
export interface VillageDefinition {
  center: Vec2;
  radius: number;
  buildings: number;
}

export interface TerrainDefinition {
  biome: 'steppe';
  rivers: RiverDefinition[];
  roads: RoadDefinition[];
  forests: ForestDefinition[];
  hills: HillDefinition[];
  fields: FieldDefinition[];
  villages: VillageDefinition[];
}

// ---------------------------------------------------------------------------
// Entities, groups, triggers
// ---------------------------------------------------------------------------

export interface EntitySpawn {
  /** Stable id referenced by objectives/triggers. */
  refId?: string;
  kind: EntityKind;
  pos: Vec2;
  /** Degrees, 0 = east, 90 = south. */
  headingDeg?: number;
  tags?: string[];
  /** Follow this path (by id) from spawn. */
  pathId?: string;
  speed?: number;
  hidden?: boolean;
}

/** Units that appear together later in the mission and drive a path in single file. */
export interface GroupSpawn {
  id: string;
  trigger: Trigger;
  pathId: string;
  /** Distance between vehicles along the path. */
  spacing: number;
  speed: number;
  tags: string[];
  units: Array<{ kind: EntityKind; refId?: string; tags?: string[] }>;
}

export type Trigger =
  | { kind: 'start' }
  | { kind: 'time'; at: number }
  | { kind: 'objectiveResolved'; objectiveId: string; status?: 'completed' | 'failed' }
  | { kind: 'entityDestroyed'; refId: string }
  | { kind: 'entitySpotted'; refId: string }
  | { kind: 'allPrimariesResolved' };

// ---------------------------------------------------------------------------
// Objectives
// ---------------------------------------------------------------------------

interface ObjectiveBase {
  id: string;
  title: string;
  primary: boolean;
}

/**
 * Stop a column of vehicles (tagged `columnTag`) that drives `pathId` over a bridge.
 * Completed if the bridge is destroyed before any column unit reaches `crossedWaypoint`,
 * or if every column unit is destroyed. Failed if any column unit reaches `crossedWaypoint`.
 * When the bridge falls, units halt at `haltWaypoint`; units on the span are destroyed.
 */
export interface StopColumnObjective extends ObjectiveBase {
  kind: 'stopColumn';
  columnTag: string;
  bridgeRefId: string;
  haltWaypoint: number;
  crossedWaypoint: number;
  /** On failure, surviving column units re-route along this path. */
  divertPathId?: string;
  /** Tags added to diverted units (e.g. so a defend objective counts them as attackers). */
  divertTags?: string[];
}

/**
 * Defend a structure. Completed when every unit tagged with one of `attackerTags` is dead
 * (units that haven't spawned yet count as alive). Failed if the target dies.
 */
export interface DefendObjective extends ObjectiveBase {
  kind: 'defend';
  targetRefId: string;
  attackerTags: string[];
  /** Also fails if this other objective fails (e.g. "take the bridge intact" fails if the column crosses). */
  failsWith?: string;
  /**
   * Open-ended defence (endless lane waves): completed when this other objective completes,
   * instead of when the attackers are all dead.
   */
  until?: string;
}

/** Destroy specific entities. Optional global effect on completion. */
export interface DestroyObjective extends ObjectiveBase {
  kind: 'destroy';
  targetRefIds: string[];
  effect?: 'aaFireRateHalved';
}

export type ObjectiveDefinition = StopColumnObjective | DefendObjective | DestroyObjective;

/**
 * A defence zone: every enemy AA gun / SAM site within `radius` of `center` at mission start.
 * Destroying all of them clears the zone: bonus points, a supply drop and a radio call.
 */
export interface DefenceZoneDefinition {
  id: string;
  name: string;
  center: Vec2;
  radius: number;
}

export interface RadioCue {
  trigger: Trigger;
  speaker: string;
  text: string;
  tone: RadioTone;
}

export interface LevelDefinition {
  id: string;
  name: string;
  /** One-line briefing blurb. */
  tagline: string;
  width: number;
  height: number;
  seed: number;
  terrain: TerrainDefinition;
  player: { spawn: Vec2; headingDeg: number };
  /** refId of the homeBase entity (rearm + respawn point). */
  homeBaseRefId: string;
  paths: Record<string, Vec2[]>;
  entities: EntitySpawn[];
  groups: GroupSpawn[];
  objectives: ObjectiveDefinition[];
  radio: RadioCue[];
  /** Air-defence clusters that pay out when cleared. */
  zones?: DefenceZoneDefinition[];
  /** Repeating waves pushing down roads between two HQs (lane missions). */
  laneWar?: LaneWarDefinition;
  /** Target mission time for the time bonus, seconds. */
  parTime: number;
}
