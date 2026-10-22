import type { WeaponId } from '../types';

/**
 * Everything about the aircraft that upgrades can change. The meta layer (hangar/upgrades)
 * builds one of these; the simulation reads it when the player spawns, respawns and rearms.
 */
export interface PlayerLoadout {
  /** Hull points (damage persists until rearm). */
  maxHull: number;
  /** Regenerating shield that absorbs damage before the hull. */
  maxShield: number;
  /** Seconds without taking damage before the shield starts to regenerate. */
  shieldRegenDelay: number;
  /** Shield points regenerated per second. */
  shieldRegenRate: number;
  /** Seconds of afterburner on a full meter. */
  boostCapacity: number;
  /** Meter regenerated per second (in seconds of boost) when not boosting. */
  boostRegen: number;
  /** Multiplies every band's max turn rate. */
  turnRateMultiplier: number;
  /** Multiplies the GAU-8 damage per round. */
  gunDamageMultiplier: number;
  /** Starting / maximum ammo per weapon (rockets in salvos). */
  ammo: Record<WeaponId, number>;
  flares: number;
}

/** The stock aircraft (no upgrades). */
export const DEFAULT_LOADOUT: Readonly<PlayerLoadout> = {
  maxHull: 100,
  maxShield: 60,
  shieldRegenDelay: 2.0,
  shieldRegenRate: 30,
  boostCapacity: 3.0,
  boostRegen: 0.45,
  turnRateMultiplier: 1,
  gunDamageMultiplier: 1,
  ammo: { gun: 1350, rockets: 10, maverick: 4, bombs: 8 },
  flares: 6,
};
