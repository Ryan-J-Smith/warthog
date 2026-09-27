/**
 * Time budgets for River Crossing: transit times between key places at each band, the
 * level's own clocks (column crossing, Bravo falling, wave 2 arrival), and the slack between.
 */
import { describe, expect, it } from 'vitest';
import { riverCrossing } from '../../src/content/levels';
import { SIM_STEP, Simulation } from '../../src/sim/simulation';
import { distance, type Vec2 } from '../../src/sim/math';
import { killEntity } from '../../src/sim/combat';
import type { AltitudeBand } from '../../src/sim/types';
import { ACE, HEAVY_WAVE_TWO, IdleBot, Pilot, clock, keyPoints, proposedLevel, table, withoutEnemies, type Intent } from './harness';

/** Seconds to fly from `from` to within 60 u of `to` at `band`, starting Low heading at it. */
function ferry(from: Vec2, to: Vec2, band: AltitudeBand): number {
  const level = withoutEnemies(riverCrossing);
  const heading = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
  const sim = new Simulation({ ...level, player: { spawn: from, headingDeg: heading } }, 1);
  const pilot = new Pilot({ ...ACE, aimWobble: 0 }, 0);
  const intent = (): Intent => {
    const d = distance(sim.world.player.pos, to);
    // Start descending to Low for the last stretch only when the destination needs it.
    return { steerTo: to, band: d < 150 ? 'low' : band, weapon: 'gun', fire: 'hold', committed: true, avoidSam: false };
  };
  for (let i = 0; i < 60 * 120; i++) {
    sim.step(pilot.control(sim.view, intent(), SIM_STEP));
    sim.drainEvents();
    if (distance(sim.world.player.pos, to) <= 60) return sim.world.time;
  }
  return NaN;
}

describe('River Crossing time budgets', () => {
  it('transit times between key places, by band (climb from Low included)', () => {
    const k = keyPoints(riverCrossing);
    const legs: Array<[string, Vec2, Vec2]> = [
      ['base → Bravo', k.base, k.outpost],
      ['base → bridge', k.base, k.bridge],
      ['bridge → Bravo', k.bridge, k.outpost],
      ['base → SAM', k.base, k.sam],
      ['base → dump', k.base, k.dump],
      ['dump → Bravo', k.dump, k.outpost],
      ['dump → SAM', k.dump, k.sam],
      ['SAM → bridge', k.sam, k.bridge],
      ['Bravo → east road (wave 2)', k.outpost, k.eastRoad],
    ];
    const rows = legs.map(([label, a, b]) => [
      label,
      distance(a, b).toFixed(0),
      ferry(a, b, 'low').toFixed(1),
      ferry(a, b, 'medium').toFixed(1),
      ferry(a, b, 'high').toFixed(1),
    ]);
    console.log('\n### Transit times (s), enemy-free map\n');
    console.log(table(['leg', 'dist (u)', 'Low', 'Medium', 'High'], rows));
    expect(rows.length).toBe(legs.length);
  });

  for (const [label, level] of [['current', riverCrossing], ['proposal', proposedLevel(riverCrossing)]] as const) it(`the level clock with no player (${label})`, () => {
    const sim = new Simulation(level, 1011);
    const bot = new IdleBot();
    const marks: string[][] = [];
    let waveTwoEngaged: number | null = null;
    let columnAtBridge: number | null = null;
    for (let i = 0; i < 60 * 400 && !sim.world.ended; i++) {
      sim.step(bot.decide());
      for (const e of sim.drainEvents()) {
        if (e.type === 'objectiveUpdated') marks.push([clock(sim.world.time), `${e.objectiveId} ${e.status}`]);
        if (e.type === 'radio') marks.push([clock(sim.world.time), `radio: ${e.text.slice(0, 60)}…`]);
        if (e.type === 'groundFire' && waveTwoEngaged === null) {
          const shooter = sim.world.entities.find((u) => u.alive && u.tags.includes('waveB') && distance(u.pos, e.from) < 1);
          if (shooter) waveTwoEngaged = sim.world.time;
        }
      }
      const lead = sim.world.entities.find((u) => u.alive && u.tags.includes('column') && u.pos.y > 2420);
      if (lead && columnAtBridge === null) columnAtBridge = sim.world.time;
    }
    marks.push([clock(columnAtBridge), 'column lead reaches the north bank (bridge approach)']);
    marks.push([clock(waveTwoEngaged), 'wave 2 opens fire on Bravo']);
    marks.sort((a, b) => (a[0] ?? '').localeCompare(b[0] ?? '', undefined, { numeric: true }));
    console.log(`\n### Level clock, hands off (seed 1011, ${label})\n`);
    console.log(table(['time', 'event'], marks));
    expect(marks.length).toBeGreaterThan(0);
  });

  it('wave 2 timing when wave 1 is cleared at 0:30 (the normal case)', () => {
    const rows: string[][] = [];
    for (const [label, level] of [
      ['current', riverCrossing],
      ['wave 2 at 150 s', proposedLevel(riverCrossing, { waveTwoAt: 150 })],
      ['heavy wave 2', proposedLevel(riverCrossing, { waveTwoUnits: HEAVY_WAVE_TWO })],
      ['pincer wave 2', proposedLevel(riverCrossing, { pincer: true })],
    ] as const) {
      const sim = new Simulation(level, 1011);
      let onMap: number | null = null;
      let firing: number | null = null;
      let bank: number | null = null;
      let falls: number | null = null;
      let hpAt: number | null = null;
      for (let i = 0; i < 60 * 420; i++) {
        if (hpAt === null && sim.world.time >= 260) hpAt = (sim.world.findByRef('outpost')?.hp ?? 0) / 1400;
        if (falls === null && sim.world.findByRef('outpost')?.alive === false) falls = sim.world.time;
        if (Math.abs(sim.world.time - 30) < 1e-6 || (sim.world.time > 30 && sim.world.time < 30 + 1 / 60)) {
          for (const e of sim.world.withTag('waveA')) killEntity(sim.world, e, false);
        }
        sim.step({ turn: 0.3, fire: false, climb: false, dive: false, flare: false, select: null });
        for (const e of sim.drainEvents()) {
          if (e.type === 'groundFire' && firing === null && sim.world.entities.some((u) => u.alive && u.tags.includes('waveB') && distance(u.pos, e.from) < 1)) firing = sim.world.time;
        }
        if (onMap === null && sim.world.withTag('waveB').some((u) => u.alive && u.pos.x < 7040)) onMap = sim.world.time;
        if (bank === null && sim.world.withTag('column').some((u) => u.alive && u.pos.y > 2420)) bank = sim.world.time;
      }
      rows.push([label, clock(onMap), clock(firing), clock(bank), `${Math.round(100 * (hpAt ?? 0))}%`, clock(falls)]);
    }
    console.log('\n### Wave 2 vs the column, wave 1 removed at 0:30\n');
    console.log(table(['level', 'wave 2 on map', 'wave 2 opens fire on Bravo', 'column at north bank', 'Bravo HP at 4:20 (unhelped vs wave 2)', 'Bravo falls'], rows));
    expect(rows.length).toBe(4);
  });
});
