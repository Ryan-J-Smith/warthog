import { PLAYER } from '../../config';
import { distance } from '../math';
import { WEAPON_ORDER } from '../types';
import { fullAmmo, type World } from '../world';
import { SimSystem, type StepContext } from './simSystem';

/** Hold Low over the home base to rearm and repair. Leaving early cancels. */
export class RearmSystem extends SimSystem {
  /** Set after a completed rearm until the player leaves the zone, so it doesn't loop. */
  private satisfied = false;

  update({ world, dt }: StepContext): void {
    const p = world.player;
    const inZone = p.alive && p.band === 'low' && world.rearmPoints().some((at) => distance(p.pos, at) <= PLAYER.rearmRadius);

    if (!inZone) {
      this.satisfied = false;
      if (p.rearm > 0) {
        p.rearm = 0;
        world.emit({ type: 'rearmCancelled' });
      }
      return;
    }
    if (this.satisfied || !needsService(world)) return;

    if (p.rearm === 0) world.emit({ type: 'rearmStarted' });
    p.rearm = Math.min(1, p.rearm + dt / PLAYER.rearmTime);
    if (p.rearm >= 1) {
      p.ammo = fullAmmo(world.loadout);
      p.flares = world.loadout.flares;
      p.hp = p.maxHp;
      p.shield = p.maxShield;
      p.boost = p.maxBoost;
      p.rearm = 0;
      this.satisfied = true;
      world.emit({ type: 'rearmCompleted' });
    }
  }
}

function needsService(world: World): boolean {
  const p = world.player;
  if (p.hp < p.maxHp || p.flares < world.loadout.flares) return true;
  return WEAPON_ORDER.some((w) => p.ammo[w] < world.loadout.ammo[w]);
}
