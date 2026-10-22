import { PLAYER } from '../../config';
import { endCombo } from '../combat';
import type { Vec2 } from '../math';
import type { PlayerDamageSource } from '../types';
import type { World } from '../world';

/**
 * Damage the player (ignored while dead or invulnerable). The shield absorbs first; whatever gets
 * through hits the hull, breaks the kill chain, and can kill.
 */
export function damagePlayer(world: World, amount: number, source: PlayerDamageSource, at: Vec2): void {
  const p = world.player;
  if (!p.alive || p.invulnerable > 0 || amount <= 0) return;
  amount *= world.difficulty.damageTaken;
  p.shieldRegenIn = world.loadout.shieldRegenDelay;

  const absorbed = Math.min(p.shield, amount);
  if (absorbed > 0) {
    p.shield -= absorbed;
    world.emit({ type: 'shieldHit', pos: { ...at }, amount: absorbed, source });
    if (p.shield <= 1e-6) {
      p.shield = 0;
      world.emit({ type: 'shieldDown' });
    }
  }
  const hull = amount - absorbed;
  if (hull <= 0) return;

  world.stats.hullDamage += Math.min(p.hp, hull);
  p.hp = Math.max(0, p.hp - hull);
  world.emit({ type: 'playerHit', pos: { ...at }, damage: hull, source });
  endCombo(world, 'hit');
  if (p.hp <= 0) destroyPlayer(world);
}

export function destroyPlayer(world: World): void {
  const p = world.player;
  if (!p.alive) return;
  if (p.firing) world.emit({ type: 'gunStopped' });
  p.alive = false;
  p.firing = false;
  // Base defence has no life limit: being shot down only takes you out of the fight for a while.
  const defense = world.level.defense;
  if (!defense) p.lives -= 1;
  world.stats.deaths += 1;
  p.respawnIn = world.defense?.respawnDelay ?? PLAYER.respawnDelay;
  p.rearm = 0;
  p.lockTargetId = null;
  p.lockProgress = 0;
  p.boostFree = 0;
  p.overdrive = 0;
  endCombo(world, 'hit');
  world.emit({ type: 'playerDestroyed', pos: { ...p.pos } });
}
