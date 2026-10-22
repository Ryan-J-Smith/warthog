import type { LaneDefinition, LaneWarDefinition, WaveDefinition } from '../level';
import { angleOf, clone, normalize, sub, type Vec2 } from '../math';
import { createEntity } from '../spawning';
import type { EntityKind } from '../types';
import type { World } from '../world';
import { ENEMY_WAVE_TAG, FRIENDLY_WAVE_TAG, WAVE_TAG, laneBroken, laneLead, laneTag, laneUnits } from './laneFront';
import { SimSystem, type StepContext } from './simSystem';

/** Dead wave units are dropped from the world this long after dying (keeps long missions cheap). */
const WRECK_PRUNE_AFTER = 30;
const PRUNE_INTERVAL = 5;
/** Lateral offsets of a wave's files from the road centre line (wider than the convoy gap's cone). */
const FILE_OFFSETS = [0, -56, 56] as const;

/**
 * Lane war spawning: every wave definition spawns one wave per road on its interval, growing with
 * its escalation schedule, the road's depot rule and enemy reserve surges, never past the
 * per-road cap. Stops when either HQ falls.
 */
export class WaveSystem extends SimSystem {
  /** Waves already spawned, keyed by `${waveIndex}:${laneId}`. */
  private readonly spawned = new Map<string, number>();
  /** The road picked for the current surge cycle (picked once, when the cycle's first road spawns). */
  private surgePick: { cycle: number; laneId: string | undefined } | null = null;
  private nextPrune = PRUNE_INTERVAL;

  update({ world }: StepContext): void {
    const war = world.level.laneWar;
    if (!war) return;
    if (world.time >= this.nextPrune) {
      this.nextPrune = world.time + PRUNE_INTERVAL;
      pruneWrecks(world);
    }
    if (!hqAlive(world, war.enemyHqRefId) || !hqAlive(world, war.friendlyHqRefId)) return;

    war.waves.forEach((wave, waveIndex) => {
      for (const lane of war.lanes) {
        const key = `${waveIndex}:${lane.id}`;
        const count = this.spawned.get(key) ?? 0;
        if (world.time < wave.firstAt + lane.offset + count * wave.interval) continue;
        const cycle = count + 1;
        this.spawned.set(key, cycle);
        let surge: readonly EntityKind[] = [];
        if (wave.team === 'enemy' && war.surge && cycle % war.surge.every === 0) {
          if (this.surgePick?.cycle !== cycle) this.surgePick = { cycle, laneId: surgeLane(world, war)?.id };
          if (this.surgePick.laneId === lane.id) surge = war.surge.units;
        }
        spawnWave(world, wave, lane, surge);
      }
    });
  }
}

/** The units one regular wave brings to one road right now (before surges and the cap). */
export function waveUnits(world: World, wave: WaveDefinition, lane: LaneDefinition): EntityKind[] {
  const units = [...wave.units];
  for (const step of wave.escalation) if (world.time >= step.at) units.push(...step.add);
  const broken = laneBroken(world, lane);
  if (wave.team === 'enemy' && !broken) units.push(...lane.depotBonus);
  if (wave.team === 'friendly' && broken) units.push(...lane.brokenBonus);
  return units;
}

/** Where the enemy commits reserves: the road with the deepest friendly push (first road on a tie). */
export function surgeLane(world: World, war: LaneWarDefinition): LaneDefinition | undefined {
  let best: LaneDefinition | undefined;
  let bestLead = -1;
  for (const lane of war.lanes) {
    const lead = laneLead(world, lane.id, 'friendly');
    if (lead > bestLead) {
      best = lane;
      bestLead = lead;
    }
  }
  return best;
}

function spawnWave(world: World, wave: WaveDefinition, lane: LaneDefinition, surge: readonly EntityKind[]): void {
  const lanePath = world.level.paths[lane.pathId];
  if (!lanePath || lanePath.length < 2) throw new Error(`Lane ${lane.id}: missing path ${lane.pathId}`);
  const path = wave.team === 'enemy' ? lanePath : [...lanePath].reverse();
  const room = Math.max(0, wave.laneCap - laneUnits(world, lane.id, wave.team).length);
  const regular = waveUnits(world, wave, lane);
  const kinds = [...regular, ...surge].slice(0, room);
  if (kinds.length === 0) return;

  const teamTag = wave.team === 'enemy' ? ENEMY_WAVE_TAG : FRIENDLY_WAVE_TAG;
  kinds.forEach((kind, i) => {
    // Ranks of `FILES` abreast on parallel offset paths, so a whole rank engages at once
    // (single file, only the head vehicle is ever in range). Ranks start "upstream" of the
    // road's first waypoint and drive out of the HQ gate.
    const filePath = offsetPath(path, FILE_OFFSETS[i % FILE_OFFSETS.length] ?? 0);
    const rank = Math.floor(i / FILE_OFFSETS.length);
    const [p0, p1] = filePath as [Vec2, Vec2, ...Vec2[]];
    const dir = normalize(sub(p1, p0));
    const pos = { x: p0.x - dir.x * wave.spacing * rank, y: p0.y - dir.y * wave.spacing * rank };
    world.entities.push(
      createEntity(world, kind, pos, {
        headingRad: angleOf(dir),
        tags: [WAVE_TAG, teamTag, laneTag(lane.id)],
        path: filePath,
        speed: wave.speed,
      }),
    );
  });
  if (kinds.length > regular.length) {
    world.emit({
      type: 'radio',
      speaker: 'OVERLORD',
      tone: 'urgent',
      text: `Enemy reserves committed to the ${lane.name}! They are hitting back where we're winning.`,
    });
  }
}

function hqAlive(world: World, refId: string): boolean {
  return world.findByRef(refId)?.alive ?? false;
}

function pruneWrecks(world: World): void {
  const cutoff = world.time - WRECK_PRUNE_AFTER;
  world.entities = world.entities.filter((e) => e.alive || e.diedAt === null || e.diedAt > cutoff || !e.tags.includes(WAVE_TAG));
}

/** `path` shifted sideways by `offset` (positive = right of the direction of travel), mitred at corners. */
export function offsetPath(path: readonly Vec2[], offset: number): Vec2[] {
  if (offset === 0) return path.map(clone);
  return path.map((p, i) => {
    const prev = path[i - 1];
    const next = path[i + 1];
    const dIn = prev ? normalize(sub(p, prev)) : null;
    const dOut = next ? normalize(sub(next, p)) : null;
    const d = normalize({ x: (dIn?.x ?? 0) + (dOut?.x ?? 0), y: (dIn?.y ?? 0) + (dOut?.y ?? 0) });
    // Right-hand normal in screen space (+y south): (−dy, dx).
    const n = { x: -d.y, y: d.x };
    // Mitre: keep the files parallel through the corner (capped for sharp turns).
    const cos = dIn && dOut ? Math.max(0.5, dIn.x * d.x + dIn.y * d.y) : 1;
    return { x: p.x + (n.x * offset) / cos, y: p.y + (n.y * offset) / cos };
  });
}
