import type { PlayerLoadout } from '../../sim/loadout';
import type { LoadoutStatId } from './loadoutStats';

export type UpgradeId = 'armor' | 'shield' | 'afterburner' | 'airframe' | 'magazines' | 'gun';

/** Owned level per upgrade track (0 = stock). Missing tracks count as 0. */
export type UpgradeLevels = Partial<Record<UpgradeId, number>>;

export interface UpgradeTrack {
  id: UpgradeId;
  name: string;
  /** One line for the hangar row. */
  description: string;
  /** Credit cost of each level, in order; the length is the track's max level. */
  costs: readonly number[];
  /** Loadout stats this track changes (shown as "HULL 100 → 120" in the hangar). */
  stats: readonly LoadoutStatId[];
  /** Apply `level` (≥ 1) levels of this upgrade to a copy of the loadout (mutate `out`). */
  apply: (out: PlayerLoadout, level: number) => void;
}

/**
 * The hangar's upgrade tracks. Each level is a noticeable but not run-breaking bump (roughly
 * +10–25 % of stock per level). Costs rise per level; tuned with `missionCredits` so a good run
 * of River Crossing (~2,750 cr) buys about two first-level upgrades and the whole catalog
 * (~30,000 cr) takes roughly 8–10 runs.
 */
export const UPGRADE_TRACKS: readonly UpgradeTrack[] = [
  {
    id: 'armor',
    name: 'ARMOR',
    description: 'Titanium bathtub plating. More hull before you go down.',
    costs: [1100, 1600, 2300],
    stats: ['maxHull'],
    apply: (out, level) => {
      out.maxHull += 20 * level;
    },
  },
  {
    id: 'shield',
    name: 'SHIELD',
    description: 'Bigger, faster-recharging shield. Skilled flying stays on the shield.',
    costs: [1100, 1600, 2300],
    stats: ['maxShield', 'shieldRegenRate'],
    apply: (out, level) => {
      out.maxShield += 15 * level;
      out.shieldRegenRate += 5 * level;
    },
  },
  {
    id: 'afterburner',
    name: 'AFTERBURNER',
    description: 'Longer boost, quicker refill. Escape beams and SAMs more often.',
    costs: [1100, 1600, 2300],
    stats: ['boostCapacity', 'boostRegen'],
    apply: (out, level) => {
      out.boostCapacity += 0.6 * level;
      out.boostRegen += 0.07 * level;
    },
  },
  {
    id: 'airframe',
    name: 'AIRFRAME',
    description: 'Reinforced control surfaces. Tighter turns in every band.',
    costs: [1100, 1600, 2300],
    stats: ['turnRate'],
    apply: (out, level) => {
      out.turnRateMultiplier += 0.1 * level;
    },
  },
  {
    id: 'magazines',
    name: 'MAGAZINES',
    description: 'Extra stores on every pylon, more flares in the dispensers.',
    costs: [1000, 1500, 2100],
    stats: ['gunAmmo', 'rockets', 'maverick', 'bombs', 'flares'],
    apply: (out, level) => {
      out.ammo.gun += 270 * level;
      out.ammo.rockets += 2 * level;
      out.ammo.maverick += 1 * level;
      out.ammo.bombs += 2 * level;
      out.flares += 1 * level;
    },
  },
  {
    id: 'gun',
    name: 'GAU-8 OVERCHARGE',
    description: 'Hotter rounds for the Avenger. Every burst hits harder.',
    costs: [1200, 1800, 2500],
    stats: ['gunDamage'],
    apply: (out, level) => {
      out.gunDamageMultiplier += 0.15 * level;
    },
  },
];

export function getUpgradeTrack(id: UpgradeId): UpgradeTrack {
  const track = UPGRADE_TRACKS.find((t) => t.id === id);
  if (!track) throw new Error(`Unknown upgrade: ${id}`);
  return track;
}

export function isUpgradeId(value: string): value is UpgradeId {
  return UPGRADE_TRACKS.some((t) => t.id === value);
}

export function maxLevel(track: UpgradeTrack): number {
  return track.costs.length;
}

/** Owned level of a track, clamped to 0..max. */
export function levelOf(levels: UpgradeLevels, id: UpgradeId): number {
  const track = getUpgradeTrack(id);
  const raw = levels[id] ?? 0;
  return Number.isFinite(raw) ? Math.max(0, Math.min(maxLevel(track), Math.floor(raw))) : 0;
}

/** Cost of the next level, or null when the track is maxed. */
export function nextCost(levels: UpgradeLevels, id: UpgradeId): number | null {
  return getUpgradeTrack(id).costs[levelOf(levels, id)] ?? null;
}

/** Credits needed to buy everything from zero. */
export function catalogCost(): number {
  return UPGRADE_TRACKS.reduce((sum, t) => sum + t.costs.reduce((a, b) => a + b, 0), 0);
}
