import type { Entity } from '../entities';
import type { LaneDefinition } from '../level';
import { distance, type Vec2 } from '../math';
import type { World, WorldView } from '../world';

/** The read-only helpers only need the entity list (works on a `WorldView` too). */
type EntitySource = Pick<WorldView, 'entities'>;

/** Every lane-war wave unit carries this tag, plus its road's `laneTag` and a team tag. */
export const WAVE_TAG = 'wave';
/** Enemy wave units (level data uses it as the HQ defence's attacker tag). */
export const ENEMY_WAVE_TAG = 'enemyWave';
export const FRIENDLY_WAVE_TAG = 'friendlyWave';

export function laneTag(laneId: string): string {
  return `lane:${laneId}`;
}

/** Cumulative arc length at each waypoint, cached per path array. */
const cumulative = new WeakMap<readonly Vec2[], number[]>();

function arcLengths(path: readonly Vec2[]): number[] {
  let out = cumulative.get(path);
  if (!out) {
    out = [0];
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      out.push((out[i - 1] ?? 0) + (a && b ? distance(a, b) : 0));
    }
    cumulative.set(path, out);
  }
  return out;
}

/** Total length of a path. */
export function pathLength(path: readonly Vec2[]): number {
  const s = arcLengths(path);
  return s[s.length - 1] ?? 0;
}

/** 0..1: how far a mover is along its own path (0 at the start, 1 at the end). */
export function moverProgress(unit: Entity): number {
  const mover = unit.mover;
  if (!mover || mover.path.length < 2) return 0;
  const s = arcLengths(mover.path);
  const total = s[s.length - 1] ?? 0;
  if (total <= 0) return 0;
  if (mover.waypoint <= 0) return 0;
  if (mover.waypoint >= mover.path.length) return 1;
  const from = mover.path[mover.waypoint - 1];
  const to = mover.path[mover.waypoint];
  if (!from || !to) return 0;
  const along = Math.min(distance(from, unit.pos), distance(from, to));
  return Math.min(1, ((s[mover.waypoint - 1] ?? 0) + along) / total);
}

/** Living wave units of one team on one road. */
export function laneUnits(world: EntitySource, laneId: string, team: 'enemy' | 'friendly'): Entity[] {
  const tag = laneTag(laneId);
  return world.entities.filter((e) => e.alive && e.team === team && e.tags.includes(tag));
}

/** 0..1: how far the deepest living unit of `team` has pushed down the road (0 = none / at home). */
export function laneLead(world: EntitySource, laneId: string, team: 'enemy' | 'friendly'): number {
  let lead = 0;
  for (const unit of laneUnits(world, laneId, team)) lead = Math.max(lead, moverProgress(unit));
  return lead;
}

/**
 * 0..1: how safe the road is for us. 1 = no enemy on it (or only at their HQ), 0 = enemy armour
 * at our HQ. This is the lane meter on the HUD.
 */
export function laneControl(world: EntitySource, lane: LaneDefinition): number {
  return 1 - laneLead(world, lane.id, 'enemy');
}

/** A road is broken once its enemy forward depot has been destroyed. */
export function laneBroken(world: World, lane: LaneDefinition): boolean {
  const depot = world.findByRef(lane.depotRefId);
  return depot !== undefined && !depot.alive;
}
