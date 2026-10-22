import type { ConvoyStreamDefinition } from '../level';
import { angleOf, clone, normalize, sub } from '../math';
import { createEntity } from '../spawning';
import type { EntityKind } from '../types';
import type { World } from '../world';
import { SimSystem, type StepContext } from './simSystem';

/**
 * Convoy streams (score attack): spawns each road's convoys on schedule, growing with the
 * stream's escalation, and removes vehicles that reach the end of their road, counting them as
 * escaped (`world.escapes`).
 */
export class ConvoySystem extends SimSystem {
  /** Convoys sent so far per stream id. */
  private readonly sent = new Map<string, number>();

  update({ world }: StepContext): void {
    const streams = world.level.convoys;
    if (!streams || streams.length === 0) return;
    if (!world.ended) {
      for (const stream of streams) {
        const sent = this.sent.get(stream.id) ?? 0;
        if (world.time >= stream.firstAt + sent * stream.interval) {
          this.sent.set(stream.id, sent + 1);
          spawnConvoy(world, stream);
        }
      }
    }
    this.removeEscaped(world);
  }

  private removeEscaped(world: World): void {
    const tags = new Set((world.level.convoys ?? []).flatMap((s) => s.tags));
    let escaped = 0;
    world.entities = world.entities.filter((e) => {
      const mover = e.mover;
      const isConvoy = e.tags.some((t) => tags.has(t));
      if (!isConvoy || !e.alive || !mover || !mover.halted || mover.waypoint < mover.path.length) return true;
      escaped += 1;
      return false;
    });
    if (escaped > 0) world.escapes += escaped;
  }
}

/** The units of a stream's next convoy at the current time. */
export function convoyUnits(stream: ConvoyStreamDefinition, time: number): EntityKind[] {
  const units = [...stream.units];
  for (const step of stream.escalation) if (time >= step.at) units.push(...step.add);
  return units;
}

function spawnConvoy(world: World, stream: ConvoyStreamDefinition): void {
  const path = world.level.paths[stream.pathId];
  if (!path || path.length < 2) throw new Error(`Convoy ${stream.id}: missing path ${stream.pathId}`);
  const [p0, p1] = path as [{ x: number; y: number }, { x: number; y: number }];
  const dir = normalize(sub(p1, p0));
  const heading = angleOf(dir);
  convoyUnits(stream, world.time).forEach((kind, i) => {
    const pos = { x: p0.x - dir.x * stream.spacing * i, y: p0.y - dir.y * stream.spacing * i };
    world.entities.push(
      createEntity(world, kind, pos, { headingRad: heading, tags: stream.tags, path: path.map(clone), speed: stream.speed }),
    );
  });
}
