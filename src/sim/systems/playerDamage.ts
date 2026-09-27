import { PLAYER } from '../../config';
import type { Vec2 } from '../math';
import type { World } from '../world';

/** Damage the player (ignored while dead or invulnerable). Handles death. */
export function damagePlayer(world: World, amount: number, source: 'aa' | 'sam' | 'splash', at: Vec2): void {
  const p = world.player;
  if (!p.alive || p.invulnerable > 0 || amount <= 0) return;
  p.hp = Math.max(0, p.hp - amount);
  world.emit({ type: 'playerHit', pos: { ...at }, damage: amount, source });
  if (p.hp <= 0) destroyPlayer(world);
}

export function destroyPlayer(world: World): void {
  const p = world.player;
  if (!p.alive) return;
  if (p.firing) world.emit({ type: 'gunStopped' });
  p.alive = false;
  p.firing = false;
  p.lives -= 1;
  p.respawnIn = PLAYER.respawnDelay;
  p.rearm = 0;
  p.lockTargetId = null;
  p.lockProgress = 0;
  world.emit({ type: 'playerDestroyed', pos: { ...p.pos } });
}
