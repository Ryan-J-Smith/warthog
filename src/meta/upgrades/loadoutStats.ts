import type { PlayerLoadout } from '../../sim/loadout';

export type LoadoutStatId =
  | 'maxHull'
  | 'maxShield'
  | 'shieldRegenRate'
  | 'boostCapacity'
  | 'boostRegen'
  | 'turnRate'
  | 'gunDamage'
  | 'gunAmmo'
  | 'rockets'
  | 'maverick'
  | 'bombs'
  | 'flares';

export interface LoadoutStat {
  id: LoadoutStatId;
  /** Short label for stat tables and effect lines ("HULL"). */
  label: string;
  value: (loadout: PlayerLoadout) => number;
  format: (value: number) => string;
}

const whole = (v: number): string => String(Math.round(v));
const seconds = (v: number): string => `${v.toFixed(1)}s`;
const percent = (v: number): string => `${Math.round(v * 100)}%`;

/** Every player-facing loadout stat, in the order the hangar's aircraft summary lists them. */
export const LOADOUT_STATS: readonly LoadoutStat[] = [
  { id: 'maxHull', label: 'HULL', value: (l) => l.maxHull, format: whole },
  { id: 'maxShield', label: 'SHIELD', value: (l) => l.maxShield, format: whole },
  { id: 'shieldRegenRate', label: 'SHIELD REGEN', value: (l) => l.shieldRegenRate, format: (v) => `${Math.round(v)}/s` },
  { id: 'boostCapacity', label: 'BOOST', value: (l) => l.boostCapacity, format: seconds },
  { id: 'boostRegen', label: 'BOOST REFILL', value: (l) => l.boostRegen, format: (v) => `${v.toFixed(2)}/s` },
  { id: 'turnRate', label: 'TURN RATE', value: (l) => l.turnRateMultiplier, format: percent },
  { id: 'gunDamage', label: 'GUN DAMAGE', value: (l) => l.gunDamageMultiplier, format: percent },
  { id: 'gunAmmo', label: 'GUN ROUNDS', value: (l) => l.ammo.gun, format: whole },
  { id: 'rockets', label: 'ROCKETS', value: (l) => l.ammo.rockets, format: whole },
  { id: 'maverick', label: 'MAVERICKS', value: (l) => l.ammo.maverick, format: whole },
  { id: 'bombs', label: 'BOMBS', value: (l) => l.ammo.bombs, format: whole },
  { id: 'flares', label: 'FLARES', value: (l) => l.flares, format: whole },
];

export function getLoadoutStat(id: LoadoutStatId): LoadoutStat {
  const stat = LOADOUT_STATS.find((s) => s.id === id);
  if (!stat) throw new Error(`Unknown loadout stat: ${id}`);
  return stat;
}
