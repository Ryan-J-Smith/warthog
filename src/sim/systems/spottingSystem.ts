import { VIEW, bandProfileAt } from '../../config';
import { distance } from '../math';
import { SimSystem, type StepContext } from './simSystem';

/**
 * Marks entities the player has seen (inside the current view) as spotted, and reveals
 * hidden caches when overflown at Low. Higher altitude = wider view = more spotting.
 */
export class SpottingSystem extends SimSystem {
  update({ world }: StepContext): void {
    const p = world.player;
    if (!p.alive) return;
    const zoom = bandProfileAt(p.alt).zoom;
    const halfW = VIEW.width / 2 / zoom;
    const halfH = VIEW.height / 2 / zoom;

    for (const e of world.entities) {
      if (!e.alive) continue;
      if (e.hidden) {
        if (p.band === 'low' && distance(e.pos, p.pos) <= VIEW.revealRadius) {
          e.hidden = false;
          e.spotted = true;
          world.emit({ type: 'entityRevealed', entityId: e.id, kind: e.kind, pos: { ...e.pos } });
        }
        continue;
      }
      if (e.spotted) continue;
      if (Math.abs(e.pos.x - p.pos.x) <= halfW && Math.abs(e.pos.y - p.pos.y) <= halfH) {
        e.spotted = true;
        world.emit({ type: 'entitySpotted', entityId: e.id, kind: e.kind });
      }
    }
  }
}
