import { COMBO, PICKUPS } from '../../config';
import type { Entity } from '../entities';
import type { Vec2 } from '../math';
import type { PickupKind } from '../types';
import type { World } from '../world';

/**
 * A player kill: extends the kill chain and returns the multiplier that applies to its points.
 * Also drops this kill's pickups.
 */
export function registerKill(world: World, entity: Entity): number {
  const combo = world.combo;
  const multiplier = combo.chain > 0 && world.time <= combo.expiresAt ? combo.multiplier : 1;
  combo.chain = combo.chain > 0 && world.time <= combo.expiresAt ? combo.chain + 1 : 1;
  combo.multiplier = Math.min(COMBO.maxMultiplier, 1 + COMBO.step * combo.chain);
  combo.expiresAt = world.time + COMBO.window;
  if (combo.chain > 1) world.emit({ type: 'comboChanged', chain: combo.chain, multiplier });

  const drops: PickupKind[] = [...(PICKUPS.dropsByKind[entity.kind] ?? [])];
  if (combo.chain % PICKUPS.chainDropEvery === 0) {
    drops.push((combo.chain / PICKUPS.chainDropEvery) % 2 === 1 ? 'boost' : 'overdrive');
  }
  dropPickups(world, entity.pos, drops);
  return multiplier;
}

/** End the chain (hull damage or timeout). */
export function endCombo(world: World, reason: 'timeout' | 'hit'): void {
  const combo = world.combo;
  if (combo.chain === 0) return;
  if (combo.chain > 1) world.emit({ type: 'comboEnded', chain: combo.chain, reason });
  combo.chain = 0;
  combo.multiplier = 1;
}

/** Place pickups in a small ring around `at` (deterministic layout). */
export function dropPickups(world: World, at: Vec2, kinds: readonly PickupKind[]): void {
  kinds.forEach((kind, i) => {
    const angle = (i / Math.max(1, kinds.length)) * Math.PI * 2 - Math.PI / 2;
    const r = kinds.length > 1 ? PICKUPS.dropSpread : 0;
    const pos = { x: at.x + Math.cos(angle) * r, y: at.y + Math.sin(angle) * r };
    const pickup = { id: world.nextId(), kind, pos, spawnedAt: world.time, expiresAt: world.time + PICKUPS.lifetime };
    world.pickups.push(pickup);
    world.emit({ type: 'pickupSpawned', pickupId: pickup.id, kind, pos: { ...pos } });
  });
}
