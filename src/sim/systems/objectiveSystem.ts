import { SCORING } from '../../config';
import { killEntity } from '../combat';
import type { Entity } from '../entities';
import type { DefendObjective, DestroyObjective, ObjectiveDefinition, StopColumnObjective } from '../level';
import { distance, type Vec2 } from '../math';
import type { ObjectiveStatus } from '../types';
import { FORWARD_REARM_TAG, type ObjectiveState, type World } from '../world';
import { SimSystem, type StepContext } from './simSystem';

const DIVERTED_TAG = 'diverted';
/** Units within this distance of the bridge centre are on the span when it falls. */
const BRIDGE_SPAN_HALF_LENGTH = 140;

/** Build the initial runtime objective list from the level. */
export function initObjectives(world: World): void {
  world.objectives = world.level.objectives.map((def) => ({
    id: def.id,
    kind: def.kind,
    title: def.title,
    primary: def.primary,
    status: 'active',
    detail: '',
    meter: null,
    marker: null,
  }));
}

/** Evaluates objectives, applies their world consequences, and awards objective points. */
export class ObjectiveSystem extends SimSystem {
  /** Bridges already processed (column halted / units on the span dropped). */
  private collapsedBridges = new Set<string>();
  /** Objectives that already gave the "catch them on the bridge" callout. */
  private calledOut = new Set<string>();

  update({ world }: StepContext): void {
    for (const def of world.level.objectives) {
      const state = world.objectives.find((o) => o.id === def.id);
      if (!state) continue;
      let status: ObjectiveStatus;
      switch (def.kind) {
        case 'stopColumn':
          status = this.stopColumn(world, def, state);
          break;
        case 'defend':
          status = defend(world, def, state);
          break;
        case 'destroy':
          status = destroy(world, def, state);
          break;
      }
      if (state.status === 'active' && status !== 'active') resolve(world, def, state, status);
    }
  }

  private stopColumn(world: World, def: StopColumnObjective, state: ObjectiveState): ObjectiveStatus {
    const bridge = world.findByRef(def.bridgeRefId);
    const column = world.withTag(def.columnTag);
    state.marker = bridge ? { ...bridge.pos } : null;

    // Consequences apply whatever the objective's status.
    if (bridge && !bridge.alive && !this.collapsedBridges.has(def.bridgeRefId)) {
      this.collapsedBridges.add(def.bridgeRefId);
      let dropped = 0;
      for (const unit of column) {
        const mover = unit.mover;
        if (!unit.alive || !mover || mover.waypoint <= def.haltWaypoint || mover.waypoint > def.crossedWaypoint) continue;
        if (distance(unit.pos, bridge.pos) <= BRIDGE_SPAN_HALF_LENGTH) {
          // On the span: into the river.
          killEntity(world, unit, true);
          dropped += 1;
        } else if (mover.waypoint === def.haltWaypoint + 1) {
          // Between the near-bank halt point and the span: stop at the water's edge.
          mover.halted = true;
        }
        // Units already past the span keep going (they made it across).
      }
      if (dropped > 0) {
        const bonus = dropped * SCORING.bridgeDropBonus;
        world.score += bonus;
        world.stats.bonusPoints += bonus;
        world.emit({ type: 'scoreAwarded', points: bonus, reason: `BRIDGE DROP ×${dropped}`, pos: { ...bridge.pos } });
        world.emit({
          type: 'radio',
          speaker: 'OVERLORD',
          tone: 'good',
          text: `Bridge down with ${dropped} vehicle${dropped === 1 ? '' : 's'} on it! Straight into the river!`,
        });
      }
    }
    // While the bridge is down, every column unit still on the near bank holds at the halt point —
    // including units that spawn after the bridge fell.
    if (bridge && !bridge.alive) {
      for (const unit of column) {
        const mover = unit.mover;
        if (unit.alive && mover && !unit.tags.includes(DIVERTED_TAG) && mover.waypoint <= def.haltWaypoint) {
          mover.stopAtWaypoint = def.haltWaypoint;
        }
      }
    }
    const crossed = column.filter((u) => u.alive && u.mover && u.mover.waypoint > def.crossedWaypoint);
    if (def.divertPathId) divert(world, def, crossed);

    const spawned = groupsWithTagSpawned(world, def.columnTag);
    if (state.status !== 'active') return state.status;

    if (bridge && !bridge.alive) {
      state.detail = 'Bridge down';
      return 'completed';
    }
    if (crossed.length > 0) {
      state.detail = 'Column crossed';
      return 'failed';
    }
    if (spawned && column.length > 0 && column.every((u) => !u.alive)) {
      state.detail = 'Column destroyed';
      return 'completed';
    }
    const eta = spawned ? columnEtaSeconds(def, column) : null;
    state.detail = spawned ? formatEta(eta, column) : 'Column inbound';
    if (eta !== null && eta <= SCORING.bridgeCalloutEta && bridge?.alive && !this.calledOut.has(def.id)) {
      this.calledOut.add(def.id);
      world.emit({
        type: 'radio',
        speaker: 'OVERLORD',
        tone: 'urgent',
        text: 'Lead vehicles are at the bridge! Drop it now and catch them on the span!',
      });
    }
    return 'active';
  }
}

function defend(world: World, def: DefendObjective, state: ObjectiveState): ObjectiveStatus {
  const target = world.findByRef(def.targetRefId);
  if (!target) return state.status;
  state.marker = { ...target.pos };
  state.meter = Math.max(0, target.hp / target.maxHp);
  const attackers = world.entities.filter((e) => e.alive && e.tags.some((t) => def.attackerTags.includes(t)));
  const pending = world.level.groups.some(
    (g) => !world.spawnedGroups.has(g.id) && g.tags.some((t) => def.attackerTags.includes(t)),
  );
  if (state.status !== 'active') return state.status;
  state.detail = `${Math.ceil(state.meter * 100)}% · ${attackers.length} hostile${attackers.length === 1 ? '' : 's'}`;
  if (!target.alive) {
    state.detail = target.kind === 'outpost' || target.kind === 'friendlyHq' ? 'Overrun' : 'Destroyed';
    return 'failed';
  }
  if (def.failsWith && world.objectives.find((o) => o.id === def.failsWith)?.status === 'failed') {
    state.detail = 'Lost';
    return 'failed';
  }
  if (def.until !== undefined) {
    if (world.objectives.find((o) => o.id === def.until)?.status !== 'completed') return 'active';
    state.detail = 'Held';
    return 'completed';
  }
  if (!pending && attackers.length === 0) {
    state.detail = def.effect === 'forwardRearm' ? 'Held · rearm pad open' : 'Attack broken';
    if (def.effect === 'forwardRearm' && !target.tags.includes(FORWARD_REARM_TAG)) {
      target.tags.push(FORWARD_REARM_TAG);
      world.emit({
        type: 'radio',
        speaker: 'BRAVO',
        tone: 'good',
        text: 'Bravo holds! Our pad is yours, Warthog: come in LOW over the outpost to rearm and patch up.',
      });
    }
    return 'completed';
  }
  return 'active';
}

function destroy(world: World, def: DestroyObjective, state: ObjectiveState): ObjectiveStatus {
  const targets = def.targetRefIds.map((id) => world.findByRef(id)).filter((e): e is Entity => e !== undefined);
  const alive = targets.filter((t) => t.alive);
  state.marker = alive[0] ? { ...alive[0].pos } : null;
  if (state.status !== 'active') return state.status;
  if (targets.length > 1) state.detail = `${targets.length - alive.length}/${targets.length}`;
  if (alive.length === 0) {
    state.detail = 'Destroyed';
    if (def.effect === 'aaFireRateHalved') world.aaFireRate = 0.5;
    return 'completed';
  }
  return 'active';
}

function resolve(world: World, def: ObjectiveDefinition, state: ObjectiveState, status: ObjectiveStatus): void {
  state.status = status;
  world.emit({ type: 'objectiveUpdated', objectiveId: def.id, status });
  if (status === 'completed') {
    const points = def.primary ? SCORING.primaryObjective : SCORING.optionalObjective;
    world.score += points;
    world.emit({ type: 'scoreAwarded', points, reason: def.title, pos: null });
  }
}

/** Re-route column units that made it across toward the divert path (and the defend objective). */
function divert(world: World, def: StopColumnObjective, crossed: Entity[]): void {
  const path = def.divertPathId ? world.level.paths[def.divertPathId] : undefined;
  if (!path) return;
  for (const unit of crossed) {
    if (!unit.mover || unit.tags.includes(DIVERTED_TAG)) continue;
    unit.tags.push(DIVERTED_TAG, ...(def.divertTags ?? []));
    unit.mover.path = path.map((p) => ({ ...p }));
    unit.mover.waypoint = 0;
    unit.mover.halted = false;
    unit.mover.stopAtWaypoint = null;
  }
}

function groupsWithTagSpawned(world: World, tag: string): boolean {
  const groups = world.level.groups.filter((g) => g.tags.includes(tag));
  return groups.length > 0 && groups.every((g) => world.spawnedGroups.has(g.id));
}

/** Seconds until the lead column unit reaches the bridge span, or null if none is driving. */
function columnEtaSeconds(def: StopColumnObjective, column: Entity[]): number | null {
  let best = Infinity;
  for (const unit of column) {
    const mover = unit.mover;
    if (!unit.alive || !mover || mover.halted) continue;
    best = Math.min(best, pathDistanceTo(unit.pos, mover.path, mover.waypoint, def.haltWaypoint + 1) / Math.max(mover.speed, 1));
  }
  return Number.isFinite(best) ? best : null;
}

/** "ETA 1:42", or "Column stalled" when every living unit has stopped. */
function formatEta(eta: number | null, column: Entity[]): string {
  if (eta === null) return column.some((u) => u.alive) ? 'Column stalled' : '';
  const s = Math.max(0, Math.round(eta));
  return `ETA ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function pathDistanceTo(pos: Vec2, path: Vec2[], fromWaypoint: number, toWaypoint: number): number {
  let total = 0;
  let cursor = pos;
  for (let i = fromWaypoint; i <= toWaypoint && i < path.length; i++) {
    const wp = path[i];
    if (!wp) break;
    total += distance(cursor, wp);
    cursor = wp;
  }
  return total;
}
