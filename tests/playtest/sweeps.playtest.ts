/**
 * Parameter sweeps in the threat lab: AA lethality and gun lethality under candidate tunings.
 * Candidate values are applied with the prototype-only `withTuning` helper and restored after.
 */
import { describe, expect, it } from 'vitest';
import { ENTITY_STATS, FLARES, GUN } from '../../src/config';
import type { SimSystem } from '../../src/sim/systems';
import type { AltitudeBand, WeaponId } from '../../src/sim/types';
import { ACE, AVERAGE, HUMAN_KEYBOARD, ROOKIE, attackRuns, fastDiveSystems, firstTime, labFlight, mean, rampedTurnSystems, piloted, set, table, withTuning, type Intent, type Override, type SkillProfile } from './harness';

const SEEDS = Array.from({ length: 24 }, (_, i) => i + 1);

function shilka() {
  const aa = ENTITY_STATS.aaGun.aa;
  if (!aa) throw new Error('aaGun has no AA stats');
  return aa;
}

const AA_VARIANTS: Array<{ name: string; overrides: Override[] }> = [
  { name: 'current (3 dmg, spread 18/42, pause 1.0)', overrides: [] },
  { name: 'A: 2 dmg, spread 28/48, pause 1.3', overrides: [set(shilka(), { roundDamage: 2, spreadLow: 28, spreadMedium: 48, burstPause: 1.3 })] },
  { name: 'B: 2 dmg, spread 24/46, pause 1.2', overrides: [set(shilka(), { roundDamage: 2, spreadLow: 24, spreadMedium: 46, burstPause: 1.2 })] },
  { name: 'C: 3 dmg, spread 30/50, pause 1.3', overrides: [set(shilka(), { roundDamage: 3, spreadLow: 30, spreadMedium: 50, burstPause: 1.3 })] },
  { name: 'D: 2 dmg, spread 30/50, pause 1.2, burst 10', overrides: [set(shilka(), { roundDamage: 2, spreadLow: 30, spreadMedium: 50, burstPause: 1.2, roundsPerBurst: 10 })] },
  { name: 'E: 2 dmg, spread 32/52, pause 1.4, burst 10', overrides: [set(shilka(), { roundDamage: 2, spreadLow: 32, spreadMedium: 52, burstPause: 1.4, roundsPerBurst: 10 })] },
];

const GUN_VARIANTS: Array<{ name: string; overrides: Override[] }> = [
  { name: 'current (dip 1.0, slop 4)', overrides: [] },
  { name: 'dip 0.7, slop 4', overrides: [set(GUN, { dipRate: 0.7 })] },
  { name: 'dip 0.7, slop 7', overrides: [set(GUN, { dipRate: 0.7, hitSlop: 7 })] },
  { name: 'dip 0.85, slop 7', overrides: [set(GUN, { dipRate: 0.85, hitSlop: 7 })] },
];

function pass(band: AltitudeBand, offset: number, weave: boolean, seed: number): { damage: number; dead: boolean } {
  const skill: SkillProfile = { ...ACE, aimWobble: 0, jinks: weave };
  const intent = (): Intent => ({ steerTo: { x: 6000, y: 3000 - offset }, band, weapon: 'gun', fire: 'hold', committed: !weave, avoidSam: false });
  const speed = band === 'low' ? 150 : 230;
  return labFlight([{ kind: 'aaGun', pos: { x: 3000, y: 3000 } }], { x: 2200, y: 3000 - offset }, 0, 1600 / speed, seed, piloted(skill, intent, seed), band);
}

/**
 * Repeated attack runs on a tank parked 250 u in front of an AA gun (or alone), starting
 * 700 u out. Stops 1.5 s after the kill (egress damage included, the rest of the flight not).
 */
function tankNearAa(band: AltitudeBand, weapon: WeaponId, skill: SkillProfile, seed: number, withAa = true) {
  let killedAt = NaN;
  const out = labFlight(
    [...(withAa ? [{ kind: 'aaGun' as const, pos: { x: 3250, y: 3000 } }] : []), { refId: 'tank', kind: 'tank', pos: { x: 3000, y: 3000 } }],
    { x: 2300, y: 3000 },
    0,
    20,
    seed,
    piloted(skill, attackRuns('tank', band, weapon), seed),
    band,
    (sim) => {
      if (Number.isNaN(killedAt) && sim.world.findByRef('tank')?.alive === false) killedAt = sim.world.time;
      return sim.world.time > killedAt + 1.5;
    },
  );
  const firstShot = firstTime(out, (e) => e.type === 'gunStarted' || e.type === 'rocketLaunched' || e.type === 'missileLaunched');
  const rounds = 1150 - out.sim.world.player.ammo.gun;
  return { damage: out.damage, dead: out.dead, killedAt, firstShot, rounds };
}

const pctOf = (xs: boolean[]): string => `${Math.round((100 * xs.filter(Boolean).length) / xs.length)}%`;

describe('sweeps', () => {
  it('AA lethality by variant', () => {
    const rows: string[][] = [];
    for (const v of AA_VARIANTS) {
      withTuning(v.overrides, () => {
        const lowStraight = SEEDS.map((s) => pass('low', 0, false, s));
        const lowWeave = SEEDS.map((s) => pass('low', 200, true, s));
        const medStraight = SEEDS.map((s) => pass('medium', 0, false, s));
        const runAce = SEEDS.map((s) => tankNearAa('low', 'gun', ACE, s));
        const runAvg = SEEDS.map((s) => tankNearAa('low', 'gun', AVERAGE, s));
        rows.push([
          v.name,
          `${mean(lowStraight.map((r) => r.damage)).toFixed(0)} (${pctOf(lowStraight.map((r) => r.dead))})`,
          `${mean(lowWeave.map((r) => r.damage)).toFixed(0)} (${pctOf(lowWeave.map((r) => r.dead))})`,
          `${mean(medStraight.map((r) => r.damage)).toFixed(0)} (${pctOf(medStraight.map((r) => r.dead))})`,
          `${pctOf(runAce.map((r) => Number.isFinite(r.killedAt)))} / ${mean(runAce.map((r) => r.damage)).toFixed(0)} dmg / ${pctOf(runAce.map((r) => r.dead))} dead`,
          `${pctOf(runAvg.map((r) => Number.isFinite(r.killedAt)))} / ${mean(runAvg.map((r) => r.damage)).toFixed(0)} dmg / ${pctOf(runAvg.map((r) => r.dead))} dead`,
        ]);
      });
    }
    console.log('\n### AA variants (24 seeds; gun unchanged). Cells: avg damage (killed %)\n');
    console.log(
      table(['AA variant', 'Low straight pass over gun', 'Low weave pass @200', 'Medium straight pass', 'gun run on tank by AA (ace): tank killed / dmg / dead', '… (average)'], rows),
    );
    expect(rows.length).toBe(AA_VARIANTS.length);
  });

  it('gun lethality by variant (lone tank, no AA)', () => {
    const rows: string[][] = [];
    for (const v of GUN_VARIANTS) {
      withTuning(v.overrides, () => {
        for (const skill of [ACE, AVERAGE, ROOKIE]) {
          for (const band of ['low', 'medium'] as const) {
            const runs = SEEDS.map((s) => tankNearAa(band, 'gun', skill, s, false));
            const kills = runs.filter((r) => Number.isFinite(r.killedAt));
            rows.push([
              v.name,
              skill.name,
              band,
              pctOf(runs.map((r) => Number.isFinite(r.killedAt))),
              kills.length ? mean(kills.map((r) => r.killedAt - r.firstShot)).toFixed(1) : '—',
              kills.length ? mean(kills.map((r) => r.rounds)).toFixed(0) : '—',
            ]);
          }
        }
      });
    }
    console.log('\n### Gun variants: one tank, starting 700 u out (first pass reaches it at ~3.4 s Low / ~2.0 s Medium)\n');
    console.log(table(['gun variant', 'skill', 'band', 'killed in 20 s', 'first shot → kill (s)', 'rounds per kill'], rows));
    expect(rows.length).toBeGreaterThan(0);
  });

  it('combined: AA variant A + gun dip 0.7 slop 7, tank next to AA', () => {
    const rows: string[][] = [];
    const combos: Array<{ name: string; overrides: Override[] }> = [
      { name: 'current', overrides: [] },
      { name: 'AA-A + gun(0.7, 7)', overrides: [...(AA_VARIANTS[1]?.overrides ?? []), ...(GUN_VARIANTS[2]?.overrides ?? [])] },
      { name: 'AA-D + gun(0.7, 7)', overrides: [...(AA_VARIANTS[4]?.overrides ?? []), ...(GUN_VARIANTS[2]?.overrides ?? [])] },
    ];
    for (const c of combos) {
      withTuning(c.overrides, () => {
        for (const skill of [ACE, AVERAGE, ROOKIE]) {
          for (const [band, weapon] of [['low', 'gun'], ['low', 'rockets'], ['medium', 'rockets'], ['medium', 'maverick']] as const) {
            const runs = SEEDS.map((s) => tankNearAa(band, weapon, skill, s));
            const kills = runs.filter((r) => Number.isFinite(r.killedAt));
            rows.push([
              c.name,
              skill.name,
              `${weapon} @${band}`,
              pctOf(runs.map((r) => Number.isFinite(r.killedAt))),
              kills.length ? mean(kills.map((r) => r.killedAt - r.firstShot)).toFixed(1) : '—',
              mean(runs.map((r) => r.damage)).toFixed(0),
              pctOf(runs.map((r) => r.dead)),
            ]);
          }
        }
      });
    }
    console.log('\n### Tank parked 250 u in front of an AA gun, 20 s to kill it\n');
    console.log(table(['tuning', 'skill', 'attack', 'tank killed', 'first shot → kill (s)', 'avg dmg taken', 'player killed'], rows));
    expect(rows.length).toBeGreaterThan(0);
  });

  it('SAM: flare strength vs dive rate', () => {
    const variants: Array<{ name: string; overrides: Override[]; systems?: () => SimSystem[] }> = [
      { name: 'current (flares 75%, dive 1.0 band/s)', overrides: [] },
      { name: 'flares 50%', overrides: [set(FLARES, { decoyChance: 0.5 })] },
      { name: 'dive 2.0 band/s', overrides: [], systems: () => fastDiveSystems(2.0) },
      { name: 'flares 50% + dive 2.0', overrides: [set(FLARES, { decoyChance: 0.5 })], systems: () => fastDiveSystems(2.0) },
      { name: 'flares 60% + dive 1.6', overrides: [set(FLARES, { decoyChance: 0.6 })], systems: () => fastDiveSystems(1.6) },
    ];
    const responses: Array<{ label: string; skill: SkillProfile }> = [
      { label: 'none', skill: { ...ACE, samResponse: 'none', jinks: false, aimWobble: 0 } },
      { label: 'flares (avg)', skill: { ...AVERAGE, samResponse: 'flare', aimWobble: 0 } },
      { label: 'dive (avg 0.5 s)', skill: { ...AVERAGE, samResponse: 'dive', aimWobble: 0 } },
      { label: 'dive (slow 1.0 s)', skill: { ...AVERAGE, samResponse: 'dive', reaction: 1.0, aimWobble: 0 } },
      { label: 'flares+dive (avg)', skill: { ...AVERAGE, samResponse: 'flareAndDive', aimWobble: 0 } },
      { label: 'dive on lock tone (avg)', skill: { ...AVERAGE, samResponse: 'dive', diveOnLock: true, aimWobble: 0 } },
    ];
    const rows: string[][] = [];
    for (const v of variants) {
      withTuning(v.overrides, () => {
        for (const band of ['medium', 'high'] as const) {
          const cells = responses.map((r) => {
            const results = SEEDS.map((seed) => {
              const intent = (): Intent => ({ steerTo: { x: 6000, y: 2400 }, band, weapon: 'gun', fire: 'hold', committed: false, avoidSam: false });
              return labFlight(
                [{ kind: 'samSite', pos: { x: 3000, y: 3000 } }],
                { x: 1700, y: 2400 },
                0,
                14,
                seed,
                piloted(r.skill, intent, seed),
                band,
                undefined,
                v.systems?.(),
              );
            });
            const hits = mean(results.map((o) => o.events.filter((e) => e.type === 'samDetonated' && e.hitPlayer).length));
            const launched = mean(results.map((o) => o.events.filter((e) => e.type === 'samLaunched').length));
            return `${hits.toFixed(2)}/${launched.toFixed(1)}`;
          });
          rows.push([v.name, band, ...cells]);
        }
      });
    }
    console.log('\n### SAM variants: hits/missiles per ring crossing (closest approach 600 u, 24 seeds)\n');
    console.log(table(['variant', 'band', ...responses.map((r) => r.label)], rows));
    expect(rows.length).toBe(variants.length * 2);
  });

  it('keyboard aiming: digital turn vs a turn ramp (lone tank, gun at Low, dip 0.7 slop 7)', () => {
    const rows: string[][] = [];
    const flights: Array<{ name: string; systems: () => SimSystem[] | undefined }> = [
      { name: 'current (instant full-rate turn)', systems: () => undefined },
      { name: 'ramp 0.15 s', systems: () => rampedTurnSystems(0.15) },
      { name: 'ramp 0.25 s', systems: () => rampedTurnSystems(0.25) },
    ];
    withTuning([set(GUN, { dipRate: 0.7, hitSlop: 7 })], () => {
      for (const f of flights) {
        for (const skill of [ACE, AVERAGE]) {
          for (const band of ['low', 'medium'] as const) {
            const runs = SEEDS.map((seed) => {
              let killedAt = NaN;
              const out = labFlight(
                [{ refId: 'tank', kind: 'tank', pos: { x: 3000, y: 3060 } }],
                { x: 2300, y: 3000 },
                0,
                20,
                seed,
                piloted({ ...skill, aimWobble: 0 }, attackRuns('tank', band, 'gun'), seed, { keyboard: HUMAN_KEYBOARD }),
                band,
                (sim) => {
                  if (Number.isNaN(killedAt) && sim.world.findByRef('tank')?.alive === false) killedAt = sim.world.time;
                  return sim.world.time > killedAt + 0.5;
                },
                f.systems(),
              );
              const first = firstTime(out, (e) => e.type === 'gunStarted');
              return { killed: Number.isFinite(killedAt), t: killedAt - first, rounds: 1150 - out.sim.world.player.ammo.gun };
            });
            const kills = runs.filter((r) => r.killed);
            rows.push([
              f.name,
              skill.name,
              band,
              pctOf(runs.map((r) => r.killed)),
              kills.length ? mean(kills.map((r) => r.t)).toFixed(1) : '—',
              kills.length ? mean(kills.map((r) => r.rounds)).toFixed(0) : '—',
            ]);
          }
        }
      }
    });
    console.log('\n### Keyboard steering (70 ms minimum tap, 3° deadband), tank offset 60 u from the approach line\n');
    console.log(table(['flight model', 'skill', 'band', 'killed in 20 s', 'first shot → kill (s)', 'rounds per kill'], rows));
    expect(rows.length).toBe(flights.length * 4);
  });

  it('honest gun reticle: light only when rounds will hit', () => {
    const rows: string[][] = [];
    withTuning([set(GUN, { dipRate: 0.7, hitSlop: 7 })], () => {
      for (const honest of [false, true]) {
        for (const skill of [ACE, AVERAGE, ROOKIE]) {
          for (const band of ['low', 'medium'] as const) {
            const runs = SEEDS.map((seed) => {
              let killedAt = NaN;
              const out = labFlight(
                [{ refId: 'tank', kind: 'tank', pos: { x: 3000, y: 3000 } }],
                { x: 2300, y: 3000 },
                0,
                20,
                seed,
                piloted(skill, attackRuns('tank', band, 'gun'), seed, { honestGunReticle: honest }),
                band,
                (sim) => {
                  if (Number.isNaN(killedAt) && sim.world.findByRef('tank')?.alive === false) killedAt = sim.world.time;
                  return sim.world.time > killedAt + 0.5;
                },
              );
              const first = firstTime(out, (e) => e.type === 'gunStarted');
              return { killed: Number.isFinite(killedAt), t: killedAt - first, rounds: 1150 - out.sim.world.player.ammo.gun };
            });
            const kills = runs.filter((r) => r.killed);
            rows.push([
              honest ? 'honest (radius + slop)' : 'current (radius + spread)',
              skill.name,
              band,
              pctOf(runs.map((r) => r.killed)),
              kills.length ? mean(kills.map((r) => r.t)).toFixed(1) : '—',
              kills.length ? mean(kills.map((r) => r.rounds)).toFixed(0) : '—',
            ]);
          }
        }
      }
    });
    console.log('\n### Gun reticle rule (fire only while lit), lone tank, dip 0.7 slop 7\n');
    console.log(table(['reticle lights when…', 'skill', 'band', 'killed in 20 s', 'first shot → kill (s)', 'rounds per kill'], rows));
    expect(rows.length).toBe(12);
  });
});
