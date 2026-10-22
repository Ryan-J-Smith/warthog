import { describe, expect, it } from 'vitest';
import { DEFAULT_LOADOUT } from '../../src/sim/loadout';
import {
  LOADOUT_STATS,
  UPGRADE_TRACKS,
  buildLoadout,
  catalogCost,
  checkPurchase,
  maxLevel,
  nextCost,
  nextLevelEffect,
  type UpgradeLevels,
} from '../../src/meta/upgrades';

const MAXED: UpgradeLevels = Object.fromEntries(UPGRADE_TRACKS.map((t) => [t.id, maxLevel(t)]));

describe('upgrade catalog', () => {
  it('has six tracks of three levels with rising costs', () => {
    expect(UPGRADE_TRACKS).toHaveLength(6);
    for (const track of UPGRADE_TRACKS) {
      expect(track.costs).toHaveLength(3);
      for (let i = 1; i < track.costs.length; i++) expect(track.costs[i]).toBeGreaterThan(track.costs[i - 1] ?? 0);
    }
  });

  it('every track changes every stat it lists, at every level', () => {
    for (const track of UPGRADE_TRACKS) {
      for (let level = 0; level < maxLevel(track); level++) {
        const now = buildLoadout({ [track.id]: level });
        const next = buildLoadout({ [track.id]: level + 1 });
        for (const id of track.stats) {
          const stat = LOADOUT_STATS.find((s) => s.id === id);
          expect(stat).toBeDefined();
          if (stat) expect(stat.value(next)).toBeGreaterThan(stat.value(now));
        }
      }
    }
  });
});

describe('buildLoadout', () => {
  it('no upgrades is the stock aircraft, and a fresh copy each time', () => {
    const a = buildLoadout({});
    expect(a).toEqual(DEFAULT_LOADOUT);
    a.ammo.gun = 1;
    expect(buildLoadout({}).ammo.gun).toBe(DEFAULT_LOADOUT.ammo.gun);
    expect(DEFAULT_LOADOUT.ammo.gun).not.toBe(1);
  });

  it('applies each track to its own fields', () => {
    const l = buildLoadout({ armor: 1, shield: 2, airframe: 3, gun: 1 });
    expect(l.maxHull).toBe(DEFAULT_LOADOUT.maxHull + 20);
    expect(l.maxShield).toBe(DEFAULT_LOADOUT.maxShield + 30);
    expect(l.shieldRegenRate).toBe(DEFAULT_LOADOUT.shieldRegenRate + 10);
    expect(l.turnRateMultiplier).toBeCloseTo(1.3, 10);
    expect(l.gunDamageMultiplier).toBeCloseTo(1.15, 10);
    expect(l.boostCapacity).toBe(DEFAULT_LOADOUT.boostCapacity);
    expect(l.ammo).toEqual(DEFAULT_LOADOUT.ammo);
  });

  it('magazines raise every weapon and the flares', () => {
    const l = buildLoadout({ magazines: 2 });
    for (const weapon of Object.keys(DEFAULT_LOADOUT.ammo) as Array<keyof typeof DEFAULT_LOADOUT.ammo>) {
      expect(l.ammo[weapon]).toBeGreaterThan(DEFAULT_LOADOUT.ammo[weapon]);
    }
    expect(l.flares).toBeGreaterThan(DEFAULT_LOADOUT.flares);
  });

  it('clamps out-of-range levels', () => {
    expect(buildLoadout({ armor: 99 })).toEqual(buildLoadout({ armor: 3 }));
    expect(buildLoadout({ armor: -2 })).toEqual(buildLoadout({}));
    expect(buildLoadout({ armor: Number.NaN })).toEqual(buildLoadout({}));
  });

  it('a fully upgraded aircraft stays within sane bounds (no stat beyond +80 %)', () => {
    const max = buildLoadout(MAXED);
    const stock = buildLoadout({});
    for (const stat of LOADOUT_STATS) {
      expect(stat.value(max) / stat.value(stock)).toBeLessThanOrEqual(1.8);
    }
  });
});

describe('nextLevelEffect', () => {
  it('describes the next level as from → to', () => {
    expect(nextLevelEffect({}, 'armor')).toEqual([{ label: 'HULL', from: '100', to: '120' }]);
    expect(nextLevelEffect({ armor: 1 }, 'armor')).toEqual([{ label: 'HULL', from: '120', to: '140' }]);
  });

  it('is empty when the track is maxed', () => {
    expect(nextLevelEffect({ armor: 3 }, 'armor')).toEqual([]);
    expect(nextCost({ armor: 3 }, 'armor')).toBeNull();
  });
});

describe('checkPurchase', () => {
  it('allows an affordable next level', () => {
    expect(checkPurchase({}, 5000, 'armor')).toEqual({ ok: true, cost: 1100, level: 1 });
    expect(checkPurchase({ armor: 1 }, 1600, 'armor')).toEqual({ ok: true, cost: 1600, level: 2 });
  });

  it("can't overspend", () => {
    expect(checkPurchase({}, 1099, 'armor')).toEqual({ ok: false, reason: 'credits', cost: 1100, short: 1 });
  });

  it("can't buy past the max level", () => {
    expect(checkPurchase({ armor: 3 }, 1_000_000, 'armor')).toEqual({ ok: false, reason: 'maxed' });
  });

  it('the whole catalog costs roughly 25–35k credits', () => {
    expect(catalogCost()).toBeGreaterThanOrEqual(25000);
    expect(catalogCost()).toBeLessThanOrEqual(35000);
  });
});
