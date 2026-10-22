/**
 * Threat lab: AA guns and SAM sites in isolation on an empty range.
 * Answers "is AA dodgeable?", "what does a band cost you?", "is the SAM fair?".
 */
import { describe, expect, it } from 'vitest';
import { Simulation } from '../../src/sim/simulation';
import type { AltitudeBand, WeaponId } from '../../src/sim/types';
import { distance } from '../../src/sim/math';
import { ACE, AVERAGE, ROOKIE, arenaLevel, labFlight, mean, piloted, table, type Intent, type SkillProfile } from './harness';

const SEEDS = Array.from({ length: 24 }, (_, i) => i + 1);

const fly = labFlight;
const pilotControl = piloted;

const straight = (band: AltitudeBand, weapon: WeaponId = 'gun'): Intent => ({
  steerTo: null,
  band,
  weapon,
  fire: 'hold',
  committed: true,
  avoidSam: false,
});

describe('threat lab: AA guns', () => {
  it('damage from one AA gun during a straight pass, by band and miss distance', () => {
    const rows: string[][] = [];
    for (const band of ['low', 'medium'] as const) {
      for (const offset of [0, 200, 350]) {
        for (const jink of [false, true]) {
          const results = SEEDS.map((seed) => {
            const skill: SkillProfile = { ...ACE, aimWobble: 0, jinks: jink };
            const intent = (): Intent => ({ ...straight(band), steerTo: { x: 6000, y: 3000 - offset }, committed: !jink });
            return fly([{ kind: 'aaGun', pos: { x: 3000, y: 3000 } }], { x: 2200, y: 3000 - offset }, 0, 1600 / [150, 230][band === 'low' ? 0 : 1]!, seed, pilotControl(skill, intent, seed), band);
          });
          rows.push([
            band,
            String(offset),
            jink ? 'weave' : 'straight',
            mean(results.map((r) => r.damage)).toFixed(0),
            `${Math.round(100 * mean(results.map((r) => (r.dead ? 1 : 0))))}%`,
          ]);
        }
      }
    }
    console.log('\n### AA: one straight 1600 u pass past a single AA gun (24 seeds)\n');
    console.log(table(['band', 'miss dist', 'flying', 'avg dmg', 'killed'], rows));
    expect(rows.length).toBeGreaterThan(0);
  });

  it('attacking a tank parked 250 u from an AA gun: damage and time to kill', () => {
    const rows: string[][] = [];
    const cases: Array<{ label: string; band: AltitudeBand; weapon: WeaponId; skill: SkillProfile }> = [
      { label: 'gun @Low', band: 'low', weapon: 'gun', skill: ACE },
      { label: 'gun @Low (average)', band: 'low', weapon: 'gun', skill: AVERAGE },
      { label: 'rockets @Low', band: 'low', weapon: 'rockets', skill: ACE },
      { label: 'gun @Medium', band: 'medium', weapon: 'gun', skill: ACE },
      { label: 'rockets @Medium', band: 'medium', weapon: 'rockets', skill: ACE },
      { label: 'Maverick @Medium', band: 'medium', weapon: 'maverick', skill: ACE },
    ];
    for (const c of cases) {
      const results = SEEDS.map((seed) => {
        let extending = false;
        const intent = (sim: Simulation): Intent => {
          const tank = sim.world.findByRef('tank');
          const p = sim.world.player;
          if (!tank?.alive) return { ...straight(c.band, c.weapon), committed: false };
          const d = distance(p.pos, tank.pos);
          const reach = c.weapon === 'gun' ? (c.band === 'low' ? 170 : 280) : c.weapon === 'rockets' ? (c.band === 'low' ? 260 : 380) : 420;
          if (!extending && d < reach * 0.55) extending = true;
          if (extending && d > reach + 300) extending = false;
          return { steerTo: extending ? null : tank.pos, band: c.band, weapon: c.weapon, fire: 'onTarget', committed: !extending, avoidSam: false };
        };
        const out = fly(
          [
            { kind: 'aaGun', pos: { x: 3250, y: 3000 } },
            { refId: 'tank', kind: 'tank', pos: { x: 3000, y: 3000 } },
          ],
          { x: 2300, y: 3000 },
          0,
          20,
          seed,
          pilotControl(c.skill, intent, seed),
          c.band,
        );
        const killedAt = out.events.findIndex((e) => e.type === 'entityDestroyed' && e.kind === 'tank');
        const tank = out.sim.world.findByRef('tank');
        return { dmg: out.damage, dead: out.dead, kill: tank?.alive === false ? out.sim.world.time : NaN, _k: killedAt };
      });
      const kills = results.filter((r) => Number.isFinite(r.kill));
      rows.push([
        c.label,
        `${Math.round((100 * kills.length) / results.length)}%`,
        kills.length ? mean(kills.map((r) => r.kill)).toFixed(1) : '—',
        mean(results.map((r) => r.dmg)).toFixed(0),
        `${Math.round(100 * mean(results.map((r) => (r.dead ? 1 : 0))))}%`,
      ]);
    }
    console.log('\n### AA: killing one tank 250 u in front of an AA gun, starting 700 u out (24 seeds, 20 s cap)\n');
    console.log(table(['attack', 'tank killed', 'avg time (s)', 'avg dmg taken', 'player killed'], rows));
    expect(rows.length).toBe(cases.length);
  });

  it('killing the AA gun itself head-on', () => {
    const rows: string[][] = [];
    const cases: Array<{ label: string; band: AltitudeBand; weapon: WeaponId }> = [
      { label: 'gun @Low', band: 'low', weapon: 'gun' },
      { label: 'rockets @Low', band: 'low', weapon: 'rockets' },
      { label: 'rockets @Medium', band: 'medium', weapon: 'rockets' },
      { label: 'Maverick @Medium', band: 'medium', weapon: 'maverick' },
    ];
    for (const c of cases) {
      const results = SEEDS.map((seed) => {
        const intent = (sim: Simulation): Intent => {
          const gun = sim.world.findByRef('aa');
          return { steerTo: gun?.alive ? gun.pos : null, band: c.band, weapon: c.weapon, fire: 'onTarget', committed: true, avoidSam: false };
        };
        const out = fly([{ refId: 'aa', kind: 'aaGun', pos: { x: 3000, y: 3000 } }], { x: 2150, y: 3000 }, 0, 12, seed, pilotControl(ACE, intent, seed), c.band);
        const gun = out.sim.world.findByRef('aa');
        return { dmg: out.damage, dead: out.dead, killed: gun?.alive === false, t: out.sim.world.time };
      });
      rows.push([
        c.label,
        `${Math.round(100 * mean(results.map((r) => (r.killed ? 1 : 0))))}%`,
        mean(results.map((r) => r.dmg)).toFixed(0),
        `${Math.round(100 * mean(results.map((r) => (r.dead ? 1 : 0))))}%`,
      ]);
    }
    console.log('\n### AA: head-on attack on an AA gun from 850 u (24 seeds)\n');
    console.log(table(['attack', 'AA killed', 'avg dmg taken', 'player killed'], rows));
    expect(rows.length).toBe(cases.length);
  });
});

describe('threat lab: SAM site', () => {
  it('SAM engagement: hit rate by band, response and reaction time', () => {
    const rows: string[][] = [];
    const responses: Array<{ label: string; skill: SkillProfile }> = [
      { label: 'no reaction', skill: { ...ACE, samResponse: 'none', jinks: false, aimWobble: 0 } },
      { label: 'flares (rookie 0.9 s)', skill: { ...ROOKIE, samResponse: 'flare', aimWobble: 0 } },
      { label: 'flares (avg 0.5 s)', skill: { ...AVERAGE, samResponse: 'flare', aimWobble: 0 } },
      { label: 'dive (avg 0.5 s)', skill: { ...AVERAGE, samResponse: 'dive', aimWobble: 0 } },
      { label: 'dive (slow 1.2 s)', skill: { ...AVERAGE, samResponse: 'dive', reaction: 1.2, aimWobble: 0 } },
      { label: 'flares+dive (avg)', skill: { ...AVERAGE, samResponse: 'flareAndDive', aimWobble: 0 } },
    ];
    for (const band of ['medium', 'high'] as const) {
      for (const r of responses) {
        const results = SEEDS.map((seed) => {
          // Fly a chord through the ring, 600 u from the site at closest approach.
          const intent = (): Intent => ({ steerTo: { x: 6000, y: 2400 }, band, weapon: 'gun', fire: 'hold', committed: false, avoidSam: false });
          const out = fly([{ kind: 'samSite', pos: { x: 3000, y: 3000 } }], { x: 1700, y: 2400 }, 0, 14, seed, pilotControl(r.skill, intent, seed), band);
          const launched = out.events.filter((e) => e.type === 'samLaunched').length;
          const hits = out.events.filter((e) => e.type === 'samDetonated' && e.hitPlayer).length;
          return { launched, hits, dmg: out.damage, dead: out.dead };
        });
        rows.push([
          band,
          r.label,
          mean(results.map((x) => x.launched)).toFixed(1),
          mean(results.map((x) => x.hits)).toFixed(2),
          mean(results.map((x) => x.dmg)).toFixed(0),
          `${Math.round(100 * mean(results.map((x) => (x.dead ? 1 : 0))))}%`,
        ]);
      }
    }
    console.log('\n### SAM: crossing the ring (closest approach 600 u), 24 seeds\n');
    console.log(table(['band', 'response', 'missiles', 'hits', 'avg dmg', 'killed'], rows));
    expect(rows.length).toBeGreaterThan(0);
  });

  it('SAM missile time-of-flight vs distance (player flying straight away at High)', () => {
    const rows: string[][] = [];
    for (const dist of [400, 700, 1000]) {
      const times: Record<string, number> = {};
      const sim2 = new Simulation(arenaLevel({ player: { spawn: { x: 3000 + dist - 720, y: 3000 }, headingDeg: 0 }, entities: [{ kind: 'samSite', pos: { x: 3000, y: 3000 } }] }), 1);
      const p = sim2.world.player;
      p.alt = 2;
      p.targetBand = 'high';
      p.band = 'high';
      p.speed = 360;
      for (let i = 0; i < 12 * 60; i++) {
        sim2.step({ turn: 0, fire: false, boost: false, brake: false, climb: false, dive: false, flare: false, select: null });
        for (const e of sim2.drainEvents()) {
          if (!(e.type in times)) times[e.type] = sim2.world.time;
        }
      }
      rows.push([
        String(dist),
        (times.samLockStarted ?? NaN).toFixed(2),
        (times.samLaunched ?? NaN).toFixed(2),
        times.playerHit !== undefined && times.samLaunched !== undefined ? (times.playerHit - times.samLaunched).toFixed(2) : 'miss',
      ]);
    }
    console.log('\n### SAM: lock → launch → impact timeline, player running straight away at High\n');
    console.log(table(['launch distance (approx)', 'lock start (s)', 'launch (s)', 'launch→impact (s)'], rows));
    expect(rows.length).toBe(3);
  });
});
