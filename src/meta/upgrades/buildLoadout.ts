import { DEFAULT_LOADOUT, type PlayerLoadout } from '../../sim/loadout';
import { getLoadoutStat } from './loadoutStats';
import { UPGRADE_TRACKS, getUpgradeTrack, levelOf, maxLevel, type UpgradeId, type UpgradeLevels } from './upgradeCatalog';

/** A deep copy of the stock aircraft (callers may mutate it). */
export function stockLoadout(): PlayerLoadout {
  return { ...DEFAULT_LOADOUT, ammo: { ...DEFAULT_LOADOUT.ammo } };
}

/** The aircraft with the given upgrade levels installed (levels are clamped to each track's range). */
export function buildLoadout(levels: UpgradeLevels): PlayerLoadout {
  const out = stockLoadout();
  for (const track of UPGRADE_TRACKS) {
    const level = levelOf(levels, track.id);
    if (level > 0) track.apply(out, level);
  }
  return out;
}

/** One "HULL 100 → 120" line of an upgrade's next-level effect. */
export interface StatChange {
  label: string;
  from: string;
  to: string;
}

/**
 * What buying the next level of `id` changes, stat by stat; empty when the track is maxed.
 * Formatted for the hangar ("HULL 100 → 120").
 */
export function nextLevelEffect(levels: UpgradeLevels, id: UpgradeId): StatChange[] {
  const track = getUpgradeTrack(id);
  const level = levelOf(levels, id);
  if (level >= maxLevel(track)) return [];
  const now = buildLoadout(levels);
  const next = buildLoadout({ ...levels, [id]: level + 1 });
  return track.stats.map((statId) => {
    const stat = getLoadoutStat(statId);
    return { label: stat.label, from: stat.format(stat.value(now)), to: stat.format(stat.value(next)) };
  });
}
