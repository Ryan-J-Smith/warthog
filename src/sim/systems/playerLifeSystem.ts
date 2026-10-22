import { BAND_PROFILES, PLAYER } from '../../config';
import { fullAmmo } from '../world';
import { SimSystem, type StepContext } from './simSystem';

/** Respawn timer, respawning at the home base, and post-respawn invulnerability. */
export class PlayerLifeSystem extends SimSystem {
  update({ world, dt }: StepContext): void {
    const p = world.player;
    if (p.alive) {
      p.invulnerable = Math.max(0, p.invulnerable - dt);
      this.regenShield(world, dt);
      p.boostFree = Math.max(0, p.boostFree - dt);
      p.overdrive = Math.max(0, p.overdrive - dt);
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
    p.shield = p.maxShield;
    p.shieldRegenIn = 0;
    p.boost = p.maxBoost;
    p.turnRate = 0;
    p.ammo = fullAmmo(world.loadout);
    p.flares = world.loadout.flares;
    p.alive = true;
    p.invulnerable = PLAYER.invulnerableAfterRespawn;
    world.emit({ type: 'playerRespawned', pos: { ...p.pos } });
  }

  /** The shield recharges after `shieldRegenDelay` seconds without damage. */
  private regenShield(world: StepContext['world'], dt: number): void {
    const p = world.player;
    if (p.shield >= p.maxShield) return;
    if (p.shieldRegenIn > 0) {
      p.shieldRegenIn = Math.max(0, p.shieldRegenIn - dt);
      if (p.shieldRegenIn === 0) world.emit({ type: 'shieldRegenStarted' });
      return;
    }
    p.shield = Math.min(p.maxShield, p.shield + world.loadout.shieldRegenRate * dt);
    if (p.shield >= p.maxShield) world.emit({ type: 'shieldFull' });
  }
}
