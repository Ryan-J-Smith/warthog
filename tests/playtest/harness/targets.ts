import type { Entity } from '../../../src/sim/entities';
import type { LevelDefinition } from '../../../src/sim/level';
import { distance, type Vec2 } from '../../../src/sim/math';
import type { EntityKind } from '../../../src/sim/types';
import type { WorldView } from '../../../src/sim/world';

/** Picks the entities a task should attack, re-evaluated every frame. */
export type Selector = (view: WorldView) => Entity[];

/** Living, visible enemies. Bots never see hidden caches until they are revealed. */
export function hostiles(view: WorldView): Entity[] {
  return view.entities.filter((e) => e.alive && !e.hidden && e.team === 'enemy');
}

/** Inside the playable area (wave 2 spawns off-map and drives in). */
export function onMap(view: WorldView, e: Entity, margin = 160): boolean {
  return e.pos.x > margin && e.pos.y > margin && e.pos.x < view.width - margin && e.pos.y < view.height - margin;
}

export function byTag(tag: string): Selector {
  return (view) => hostiles(view).filter((e) => e.tags.includes(tag) && onMap(view, e));
}

export function byRef(...refIds: string[]): Selector {
  return (view) => hostiles(view).filter((e) => e.refId !== null && refIds.includes(e.refId));
}

export function byKindNear(kinds: readonly EntityKind[], center: Vec2, radius: number): Selector {
  return (view) => hostiles(view).filter((e) => kinds.includes(e.kind) && distance(e.pos, center) <= radius);
}

export function union(...selectors: Selector[]): Selector {
  return (view) => {
    const seen = new Set<number>();
    const out: Entity[] = [];
    for (const select of selectors) {
      for (const e of select(view)) {
        if (seen.has(e.id)) continue;
        seen.add(e.id);
        out.push(e);
      }
    }
    return out;
  };
}

/** Named places on the River Crossing map, looked up from level data. */
export interface KeyPoints {
  base: Vec2;
  outpost: Vec2;
  bridge: Vec2;
  sam: Vec2;
  dump: Vec2;
  /** Where wave 2 comes onto the map (east road). */
  eastRoad: Vec2;
  /** North bank of the bridge, where a halted column bunches up. */
  northBank: Vec2;
  caches: Vec2[];
}

export function keyPoints(level: LevelDefinition): KeyPoints {
  const at = (refId: string): Vec2 => {
    const spawn = level.entities.find((e) => e.refId === refId);
    if (!spawn) throw new Error(`keyPoints: no entity ${refId}`);
    return { ...spawn.pos };
  };
  return {
    base: at(level.homeBaseRefId),
    outpost: at('outpost'),
    bridge: at('bridge'),
    sam: at('samTango'),
    dump: at('ammoDump'),
    eastRoad: { x: 6400, y: 3700 },
    northBank: { x: 3000, y: 2420 },
    caches: level.entities.filter((e) => e.kind === 'cache').map((e) => ({ ...e.pos })),
  };
}
