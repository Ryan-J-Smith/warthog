import { BAND_PROFILES, FLARES, PLAYER } from '../../config';
import { fullAmmo } from '../world';
import { SimSystem, type StepContext } from './simSystem';

/** Respawn timer, respawning at the home base, and post-respawn invulnerability. */
export class PlayerLifeSystem extends SimSystem {
  update({ world, dt }: StepContext): void {
    const p = world.player;
    if (p.alive) {
      p.invulnerable = Math.max(0, p.invulnerable - dt);
      return;
    }
    p.respawnIn = Math.max(0, p.respawnIn - dt);
    if (p.respawnIn > 0 || p.lives <= 0) return;

    const base = world.homeBasePos();
    p.pos = { x: base.x, y: base.y - PLAYER.respawnOffset };
    p.heading = -Math.PI / 2;
    p.alt = 0;
    p.targetBand = 'low';
    p.band = 'low';
    p.speed = BAND_PROFILES.low.speed;
    p.energy = 1;
    p.hp = p.maxHp;
    p.ammo = fullAmmo();
    p.flares = FLARES.count;
    p.alive = true;
    p.invulnerable = PLAYER.invulnerableAfterRespawn;
    world.emit({ type: 'playerRespawned', pos: { ...p.pos } });
  }
}
