import { describe, expect, it } from 'vitest';
import { holdTheLine } from '../../src/content/levels';
import { killEntity } from '../../src/sim/combat';
import { STRUCTURES, structureCost } from '../../src/sim/defense';
import { Simulation } from '../../src/sim/simulation';
import { createEntity } from '../../src/sim/spawning';
import { DEFENSE_GARRISON_TAG, DEFENSE_SORTIE_TAG, DEFENSE_WAVE_TAG, destroyPlayer } from '../../src/sim/systems';
import type { WeaponId } from '../../src/sim/types';
import { input, run } from './helpers';

function sim(): Simulation {
  return new Simulation(holdTheLine);
}

function defense(s: Simulation) {
  const d = s.world.defense;
  if (!d) throw new Error('no defence state');
  return d;
}

/** Park the aircraft over a pad (or the airstrip) and press a number key. */
function press(s: Simulation, at: { x: number; y: number }, key: WeaponId): void {
  s.world.player.pos = { ...at };
  run(s, 1 / 60, { select: key });
}

function padPos(s: Simulation, id: string) {
  const pad = defense(s).pads.find((p) => p.id === id);
  if (!pad) throw new Error(`no pad ${id}`);
  return pad.pos;
}

function waveUnits(s: Simulation) {
  return s.world.entities.filter((e) => e.alive && e.tags.includes(DEFENSE_WAVE_TAG));
}

function clearWave(s: Simulation): void {
  for (const e of waveUnits(s)) killEntity(s.world, e, false);
  run(s, 0.1);
}

describe('base defence', () => {
  it('starts in a build phase with no clock: nothing attacks until you launch', () => {
    const s = sim();
    run(s, 60);
    expect(defense(s).phase).toBe('build');
    expect(defense(s).gold).toBe(holdTheLine.defense?.startGold);
    expect(waveUnits(s)).toHaveLength(0);
  });

  it('builds on the pad under the aircraft, upgrades with 1, and refuses what you cannot afford', () => {
    const s = sim();
    const start = defense(s).gold;
    press(s, padPos(s, 'w1'), 'gun');
    const pad = defense(s).pads.find((p) => p.id === 'w1');
    expect(pad?.structure).toBe('barracks');
    expect(defense(s).gold).toBe(start - (STRUCTURES.barracks.costs[0] ?? 0));
    press(s, padPos(s, 'w1'), 'gun');
    expect(pad?.level).toBe(2);
    // 200 - 60 - 90 = 50 left: a tank depot (110) is out of reach.
    press(s, padPos(s, 'n1'), 'rockets');
    expect(defense(s).pads.find((p) => p.id === 'n1')?.structure).toBeNull();
    expect(defense(s).notice?.good).toBe(false);
  });

  it('a bunker digs in a garrison straight away', () => {
    const s = sim();
    press(s, padPos(s, 'e2'), 'maverick');
    const garrison = s.world.entities.filter((e) => e.alive && e.tags.includes(DEFENSE_GARRISON_TAG));
    expect(garrison).toHaveLength(STRUCTURES.bunker.count[0] ?? -1);
  });

  it('the armory over the airstrip upgrades the gun', () => {
    const s = sim();
    press(s, s.world.homeBasePos(), 'gun');
    expect(s.world.loadout.gunDamageMultiplier).toBeCloseTo(1.5);
    expect(defense(s).armory.gun).toBe(1);
  });

  it('R launches the previewed wave down its roads, and sorties march out', () => {
    const s = sim();
    press(s, padPos(s, 'n1'), 'gun');
    run(s, 1 / 60, { ready: true });
    expect(defense(s).phase).toBe('wave');
    const first = holdTheLine.defense?.waves[0];
    const expected = first?.lanes.reduce((n, l) => n + l.units.length, 0);
    expect(waveUnits(s)).toHaveLength(expected ?? -1);
    expect(s.world.entities.filter((e) => e.alive && e.tags.includes(DEFENSE_SORTIE_TAG))).toHaveLength(STRUCTURES.barracks.count[0] ?? -1);
    // Building is closed while a wave is on.
    press(s, padPos(s, 'w1'), 'gun');
    expect(defense(s).pads.find((p) => p.id === 'w1')?.structure).toBeNull();
  });

  it('clearing a wave pays the bonus, recalls sorties and reopens building for the next', () => {
    const s = sim();
    press(s, padPos(s, 'n1'), 'gun');
    run(s, 1 / 60, { ready: true });
    const gold = defense(s).gold;
    clearWave(s);
    expect(defense(s).phase).toBe('build');
    expect(defense(s).wave).toBe(1);
    expect(defense(s).gold).toBe(gold + (holdTheLine.defense?.waveBonus ?? 0));
    expect(s.world.entities.filter((e) => e.alive && e.tags.includes(DEFENSE_SORTIE_TAG))).toHaveLength(0);
  });

  it('player kills pay gold', () => {
    const s = sim();
    run(s, 1 / 60, { ready: true });
    const gold = defense(s).gold;
    const [unit] = waveUnits(s);
    if (!unit) throw new Error('no wave');
    killEntity(s.world, unit, true);
    run(s, 1 / 60);
    expect(defense(s).gold).toBeGreaterThan(gold);
  });

  it('being shot down costs time, not a life', () => {
    const s = sim();
    const lives = s.world.player.lives;
    destroyPlayer(s.world);
    expect(s.world.player.lives).toBe(lives);
    expect(s.world.player.respawnIn).toBe(holdTheLine.defense?.respawnDelay);
    run(s, (holdTheLine.defense?.respawnDelay ?? 0) + 0.5);
    expect(s.world.player.alive).toBe(true);
  });

  it('clearing the last wave wins; losing the base loses', () => {
    const won = sim();
    for (let i = 0; i < (holdTheLine.defense?.waves.length ?? 0); i++) {
      if (defense(won).offer) run(won, 1 / 60, { select: 'gun' });
      run(won, 1 / 60, { ready: true });
      clearWave(won);
    }
    expect(won.world.results?.outcome).toBe('victory');
    expect(won.world.objectives.find((o) => o.id === 'base')?.status).toBe('completed');

    const lost = sim();
    const base = lost.world.findByRef('base');
    if (!base) throw new Error('no base');
    killEntity(lost.world, base, false);
    run(lost, 0.1);
    expect(lost.world.results?.outcome).toBe('defeat');
  });

  it('with no defences and no pilot, the base falls before the last wave', () => {
    const s = sim();
    for (let t = 0; t < 1800 && !s.world.ended; t += 1) {
      if (defense(s).offer) run(s, 1 / 60, { select: 'gun' });
      run(s, 1, { ready: defense(s).phase === 'build' });
    }
    expect(s.world.results?.outcome).toBe('defeat');
  }, 60_000);
});

describe('base defence: flak', () => {
  it('a flak battery shoots down a gunship in range, and only gunships', () => {
    const s = sim();
    press(s, padPos(s, 'n2'), 'bombs');
    expect(defense(s).pads.find((p) => p.id === 'n2')?.structure).toBe('flak');
    run(s, 1 / 60, { ready: true });
    // Park a gunship over the battery (its route loiters there).
    const heli = createEntity(s.world, 'helicopter', { ...padPos(s, 'n2') }, { tags: [DEFENSE_WAVE_TAG], path: [{ ...padPos(s, 'n2') }] });
    s.world.entities.push(heli);
    let fired = 0;
    for (let i = 0; i < 60 * 15 && heli.alive; i++) {
      s.step(input());
      fired += s.drainEvents().filter((e) => e.type === 'flakFired').length;
    }
    expect(fired).toBeGreaterThan(0);
    expect(heli.alive).toBe(false);
  });
});

describe('base defence: controls', () => {
  it('a build key does not change the selected weapon', () => {
    const s = sim();
    run(s, 0.1);
    expect(s.world.player.selectedWeapon).toBe('gun');
    press(s, padPos(s, 'n2'), 'maverick');
    expect(defense(s).pads.find((p) => p.id === 'n2')?.structure).toBe('bunker');
    expect(s.world.player.selectedWeapon).toBe('gun');
  });
});

describe('base defence: draft cards', () => {
  function afterFirstWave(): Simulation {
    const s = sim();
    run(s, 1 / 60, { ready: true });
    clearWave(s);
    return s;
  }

  it('offers three different cards after a wave, and R waits until one is taken', () => {
    const s = afterFirstWave();
    const offer = defense(s).offer;
    expect(offer).toHaveLength(3);
    expect(new Set(offer).size).toBe(3);
    run(s, 1 / 60, { ready: true });
    expect(defense(s).phase).toBe('build');
    expect(defense(s).notice?.good).toBe(false);
  });

  it('a number key takes the card, applies it and closes the draft (over a pad too)', () => {
    const s = afterFirstWave();
    const offer = defense(s).offer ?? [];
    const gold = defense(s).gold;
    // Over a pad: the draft still takes the key, nothing gets built.
    s.world.player.pos = { ...padPos(s, 'w1') };
    run(s, 1 / 60, { select: 'rockets' });
    expect(defense(s).perks).toEqual([offer[1]]);
    expect(defense(s).offer).toBeNull();
    expect(defense(s).pads.find((p) => p.id === 'w1')?.structure).toBeNull();
    if (offer[1] === 'supplyDrop') expect(defense(s).gold).toBe(gold + 150);
    run(s, 1 / 60, { ready: true });
    expect(defense(s).phase).toBe('wave');
  });

  it('perks change the rules: requisitions cut costs, war bonds raise kill gold, hot spare shortens respawn', () => {
    const s = sim();
    const d = defense(s);
    d.offer = ['discount', 'warBonds', 'quickTurnaround'];
    run(s, 1 / 60, { select: 'gun' });
    expect(structureCost(d, 'barracks', 0)).toBe(Math.round((STRUCTURES.barracks.costs[0] ?? 0) * 0.75));
    d.offer = ['discount', 'warBonds', 'quickTurnaround'];
    run(s, 1 / 60, { select: 'rockets' });
    expect(d.mods.goldMultiplier).toBeCloseTo(1.5);
    d.offer = ['discount', 'warBonds', 'quickTurnaround'];
    run(s, 1 / 60, { select: 'maverick' });
    destroyPlayer(s.world);
    expect(s.world.player.respawnIn).toBe(3);
  });

  it('non-repeatable cards are never offered twice', () => {
    const s = sim();
    const d = defense(s);
    d.offer = ['warBonds', 'supplyDrop', 'veterans'];
    run(s, 1 / 60, { select: 'gun' });
    for (let i = 0; i < (holdTheLine.defense?.waves.length ?? 0) - 1; i++) {
      run(s, 1 / 60, { ready: true });
      clearWave(s);
      expect(d.offer ?? []).not.toContain('warBonds');
      run(s, 1 / 60, { select: 'gun' });
    }
  });
});

describe('base defence: run variety', () => {
  const roads = (seed: number): string => {
    const s = new Simulation(holdTheLine, seed);
    run(s, 1 / 60);
    return defense(s).waves.map((w) => w.lanes.map((l) => `${l.laneId}:${l.units.length}`).join(',')).join(' | ');
  };

  it('deals the roads from the seed: same seed same run, other seeds differ, unit counts kept', () => {
    expect(roads(7)).toBe(roads(7));
    const seen = new Set([1, 2, 3, 4, 5].map(roads));
    expect(seen.size).toBeGreaterThan(1);
    const s = new Simulation(holdTheLine, 3);
    run(s, 1 / 60);
    defense(s).waves.forEach((w, i) => {
      const count = (lanes: readonly { units: readonly unknown[] }[]) => lanes.reduce((n, l) => n + l.units.length, 0);
      expect(count(w.lanes)).toBe(count(holdTheLine.defense?.waves[i]?.lanes ?? []));
    });
  });
});
