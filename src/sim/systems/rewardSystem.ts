import { PICKUPS, ZONES } from '../../config';
import { dropPickups, endCombo } from '../combat';
import type { Pickup } from '../entities';
import { distance } from '../math';
import { WEAPON_ORDER } from '../types';
import type { World } from '../world';
import { SimSystem, type StepContext } from './simSystem';

/** Resolve the level's defence zones to their member air-defence units (call once after spawning). */
export function initZones(world: World): void {
  world.zones = (world.level.zones ?? []).map((def) => ({
    id: def.id,
    name: def.name,
    center: { ...def.center },
    radius: def.radius,
    memberIds: world.entities
      .filter((e) => e.team === 'enemy' && (e.aa !== null || e.sam !== null) && distance(e.pos, def.center) <= def.radius)
      .map((e) => e.id),
    cleared: false,
  }));
}

/** Kill-chain timeout, pickup collection/expiry, and defence-zone payouts. */
export class RewardSystem extends SimSystem {
  update({ world }: StepContext): void {
    if (world.combo.chain > 0 && world.time > world.combo.expiresAt) endCombo(world, 'timeout');
    this.updatePickups(world);
    this.updateZones(world);
  }

  private updatePickups(world: World): void {
    if (world.pickups.length === 0) return;
    const p = world.player;
    const canCollect = p.alive && p.band !== 'high';
    world.pickups = world.pickups.filter((pickup) => {
      if (canCollect && distance(pickup.pos, p.pos) <= PICKUPS.collectRadius) {
        applyPickup(world, pickup);
        world.emit({ type: 'pickupCollected', pickupId: pickup.id, kind: pickup.kind, pos: { ...pickup.pos } });
        return false;
      }
      if (world.time >= pickup.expiresAt) {
        world.emit({ type: 'pickupExpired', pickupId: pickup.id });
        return false;
      }
      return true;
    });
  }

  private updateZones(world: World): void {
    for (const zone of world.zones) {
      if (zone.cleared || zone.memberIds.length === 0) continue;
      const anyAlive = zone.memberIds.some((id) => world.findById(id)?.alive === true);
      if (anyAlive) continue;
      zone.cleared = true;
      world.score += ZONES.bonus;
      world.stats.bonusPoints += ZONES.bonus;
      world.emit({ type: 'zoneCleared', zoneId: zone.id, name: zone.name, pos: { ...zone.center }, bonus: ZONES.bonus });
      world.emit({ type: 'scoreAwarded', points: ZONES.bonus, reason: `${zone.name.toUpperCase()} CLEARED`, pos: { ...zone.center } });
      world.emit({
        type: 'radio',
        speaker: 'OVERLORD',
        tone: 'good',
        text: `${zone.name} is silent! Supply drop inbound on the site — go get it.`,
      });
      dropPickups(world, zone.center, ZONES.supplyDrop);
    }
  }
}

function applyPickup(world: World, pickup: Pickup): void {
  const p = world.player;
  const max = world.loadout.ammo;
  switch (pickup.kind) {
    case 'ammo':
      for (const w of WEAPON_ORDER) {
        p.ammo[w] = Math.min(max[w], p.ammo[w] + Math.max(1, Math.round(max[w] * PICKUPS.ammoShare)));
      }
      p.flares = Math.min(world.loadout.flares, p.flares + 1);
      break;
    case 'repair':
      p.hp = Math.min(p.maxHp, p.hp + PICKUPS.repairHull);
      break;
    case 'boost':
      p.boost = p.maxBoost;
      p.boostFree = Math.max(p.boostFree, PICKUPS.boostSeconds);
      break;
    case 'overdrive':
      p.overdrive = Math.max(p.overdrive, PICKUPS.overdriveSeconds);
      break;
  }
}
