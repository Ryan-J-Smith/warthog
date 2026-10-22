import type { EntityKind, PickupKind } from '../sim/types';

/** Kill chain: kills inside the window extend the chain; hull damage breaks it. */
export const COMBO = {
  /** Seconds after a kill for the next kill to extend the chain. */
  window: 4,
  /** Multiplier = 1 + step × (chain − 1), capped. */
  step: 0.25,
  maxMultiplier: 3,
} as const;

export const PICKUPS = {
  /** Collected when the aircraft passes within this distance at Low or Medium. */
  collectRadius: 90,
  lifetime: 20,
  /** Ammo pickup: share of each weapon's maximum restored (at least one round/salvo/missile/bomb). */
  ammoShare: 0.35,
  repairHull: 35,
  /** Boost pickup: seconds of meter-free afterburner. */
  boostSeconds: 6,
  /** Overdrive pickup: seconds of double-damage, faster-firing GAU-8. */
  overdriveSeconds: 8,
  overdriveDamage: 2,
  overdriveFireRate: 1.4,
  /** Every Nth kill in a chain also drops a power-up (alternating boost / overdrive). */
  chainDropEvery: 4,
  /** Fixed drops by kind (deterministic: no hidden RNG). */
  dropsByKind: {
    truck: ['ammo'],
    aaGun: ['repair'],
    mobileAa: ['repair'],
    samSite: ['repair', 'ammo'],
    cache: ['overdrive', 'ammo'],
    ammoDump: ['ammo', 'ammo'],
  } as Partial<Record<EntityKind, readonly PickupKind[]>>,
  /** Spacing between several pickups dropped by one kill. */
  dropSpread: 46,
} as const;

/** Clearing every air-defence unit inside a defence zone. */
export const ZONES = {
  bonus: 2000,
  /** Supply drop delivered at the zone centre. */
  supplyDrop: ['repair', 'ammo', 'overdrive'] as readonly PickupKind[],
} as const;
