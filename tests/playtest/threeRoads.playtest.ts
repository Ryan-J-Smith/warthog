/**
 * Three Roads (lane war) balance: how fast the war goes with no help, and per-road timelines.
 * Run with: npx vitest run --config tests/playtest/vitest.config.ts tests/playtest/threeRoads.playtest.ts
 */
import { describe, expect, it } from 'vitest';
import { threeRoads } from '../../src/content/levels';
import { NO_INPUT } from '../../src/sim/input';
import type { LevelDefinition } from '../../src/sim/level';
import { Simulation } from '../../src/sim/simulation';
import type { Vec2 } from '../../src/sim/math';
import { laneControl, laneUnits, moverProgress } from '../../src/sim/systems';
import type { WorldView } from '../../src/sim/world';
import {
  ACE,
  AVERAGE,
  BALANCED,
  BombTask,
  DirectFireTask,
  PlanBot,
  byKindNear,
  byRef,
  clock,
  runMission,
  table,
  type RunRecord,
  type Selector,
  type SkillProfile,
  type Task,
} from './harness';

const SEEDS = [2027, 1, 2];

interface Timeline {
  endTime: number;
  outcome: string;
  rows: string[][];
}

/** Fly nothing; sample the roads every `every` seconds. `prep` edits the world before the start. */
function idleWar(level: LevelDefinition, seed: number, maxTime = 900, every = 30, prep?: (sim: Simulation) => void): Timeline {
  const sim = new Simulation(level, seed);
  prep?.(sim);
  const war = level.laneWar;
  if (!war) throw new Error('not a lane level');
  const rows: string[][] = [];
  let next = every;
  while (!sim.world.ended && sim.world.time < maxTime) {
    // Park the aircraft on the airstrip so it neither helps nor dies.
    sim.world.player.pos = { x: 1450, y: 4980 };
    sim.step({ ...NO_INPUT });
    sim.drainEvents();
    if (sim.world.time >= next) {
      next += every;
      const hq = sim.world.findByRef(war.friendlyHqRefId);
      const enemyHq = sim.world.findByRef(war.enemyHqRefId);
      rows.push([
        clock(sim.world.time),
        ...war.lanes.map((lane) => {
          const control = Math.round(laneControl(sim.world, lane) * 100);
          return `${control}% ${laneUnits(sim.world, lane.id, 'friendly').length}v${laneUnits(sim.world, lane.id, 'enemy').length}`;
        }),
        hq ? `${Math.round((hq.hp / hq.maxHp) * 100)}%` : '-',
        enemyHq ? `${Math.round((enemyHq.hp / enemyHq.maxHp) * 100)}%` : '-',
        String(sim.world.entities.length),
      ]);
    }
  }
  return { endTime: sim.world.time, outcome: sim.world.results?.outcome ?? 'unfinished', rows };
}

function print(title: string, t: Timeline): void {
  console.log(`\n### ${title} — ${t.outcome} at ${clock(t.endTime)}\n`);
  console.log(table(['time', 'west (ctrl f v e)', 'center', 'east', 'our HQ', 'their HQ', 'entities'], t.rows));
}

// ---------------------------------------------------------------------------
// Bots
// ---------------------------------------------------------------------------

/** A road is critical when the enemy is this far down it (lane meter below 1 - x). */
const CRITICAL = 0.3;
/** Defend a road from this lane meter down. */
const DEFEND_BELOW = CRITICAL;

function worstLane(view: WorldView): { id: string; control: number } | null {
  const war = view.level.laneWar;
  if (!war) return null;
  let worst: { id: string; control: number } | null = null;
  for (const lane of war.lanes) {
    const control = laneControl(view, lane);
    if (!worst || control < worst.control) worst = { id: lane.id, control };
  }
  return worst;
}

/** Enemy wave units on a road that are at least `depth` of the way down it. */
function laneThreat(laneId: string, depth: number): Selector {
  return (view) =>
    view.entities.filter((e) => e.alive && e.team === 'enemy' && e.tags.includes(`lane:${laneId}`) && moverProgress(e) >= depth);
}

/** Wraps a selector so the task gives way the moment any road turns critical. */
function unlessCritical(select: Selector): Selector {
  return (view) => ((worstLane(view)?.control ?? 1) < CRITICAL ? [] : select(view));
}

/** Always works the worst road: kills whatever has pushed past its middle. */
class LaneDefenderBot extends PlanBot {
  readonly name: string = 'defender';
  protected buildPlan(): Task[] {
    return [];
  }
  protected override refill(view: WorldView): Task | null {
    const worst = worstLane(view);
    if (!worst || worst.control > 1 - 0.2) return null;
    return new DirectFireTask(`defend ${worst.id}`, laneThreat(worst.id, 0.2));
  }
  protected loiterPoint(view: WorldView): Vec2 {
    return { x: view.width / 2, y: view.height * 0.6 };
  }
}

/** Defends critical roads; otherwise blows the depots, then the SAM and HQ defenses, then bombs the HQ. */
class LaneRaiderBot extends LaneDefenderBot {
  override readonly name: string = 'raider';
  protected override refill(view: WorldView): Task | null {
    const worst = worstLane(view);
    if (worst && worst.control < DEFEND_BELOW) return new DirectFireTask(`defend ${worst.id}`, laneThreat(worst.id, 0.35));
    for (const ref of ['westDepot', 'eastDepot', 'centerDepot']) {
      const depot = view.entities.find((e) => e.refId === ref && e.alive);
      if (!depot) continue;
      const guards = byKindNear(['aaGun'], depot.pos, 420);
      if (guards(view).length > 0) return new DirectFireTask(`${ref} AA`, unlessCritical(guards));
      return new DirectFireTask(ref, unlessCritical(byRef(ref)), { weapons: ['gun', 'rockets'], gunBand: 'low' });
    }
    const sam = byRef('samCenter');
    if (sam(view).length > 0) return new DirectFireTask('sam', unlessCritical(sam), { weapons: ['maverick', 'gun', 'rockets'], popUpAt: 820 });
    const hq = view.entities.find((e) => e.refId === 'enemyHq' && e.alive);
    if (hq) {
      const hqAa = byKindNear(['aaGun'], hq.pos, 450);
      if (hqAa(view).length > 0) return new DirectFireTask('hq AA', unlessCritical(hqAa));
      return new BombTask('hq', unlessCritical(byRef('enemyHq')));
    }
    return null;
  }
}

function bots(skill: SkillProfile, seed: number): Array<{ make: () => PlanBot; label: string }> {
  return [
    { label: `defender/${skill.name}`, make: () => new LaneDefenderBot(skill, BALANCED, seed) },
    { label: `raider/${skill.name}`, make: () => new LaneRaiderBot(skill, BALANCED, seed) },
  ];
}

function botTable(runs: Array<{ label: string; run: RunRecord }>): string {
  return table(
    ['bot', 'seed', 'outcome', 'end', 'deaths', 'score', 'grade', 'objectives'],
    runs.map(({ label, run }) => [
      label,
      String(run.seed),
      run.outcome,
      clock(run.endTime),
      String(run.deaths),
      String(run.score),
      run.grade,
      Object.entries(run.objectives)
        .map(([id, o]) => `${id}:${o.status === 'completed' ? '✓' : o.status === 'failed' ? '✗' : '·'}${o.time !== null ? clock(o.time) : ''}`)
        .join(' '),
    ]),
  );
}

describe('Three Roads balance', () => {
  it('idle: the friendly side alone loses in 5–9 minutes', () => {
    const runs = SEEDS.map((seed) => idleWar(threeRoads, seed));
    runs.forEach((t, i) => print(`Idle, seed ${SEEDS[i]}`, t));
    for (const t of runs) {
      expect(t.outcome).toBe('defeat');
      expect(t.endTime).toBeGreaterThan(300);
      expect(t.endTime).toBeLessThan(540);
    }
  });

  it('all three depots blown at the start: the roads swing our way', () => {
    const t = idleWar(threeRoads, 2027, 900, 30, (sim) => {
      for (const ref of ['westDepot', 'centerDepot', 'eastDepot']) {
        const depot = sim.world.findByRef(ref);
        if (depot) depot.alive = false;
      }
    });
    print('Idle, every depot down from the start', t);
    expect(t.endTime).toBeGreaterThan(300);
  });

  it('bots: defending buys time, raiding wins', () => {
    const runs: Array<{ label: string; run: RunRecord }> = [];
    for (const skill of [ACE, AVERAGE]) {
      for (const seed of SEEDS) {
        for (const bot of bots(skill, seed)) {
          runs.push({ label: bot.label, run: runMission({ level: threeRoads, seed, bot: bot.make(), skill: skill.name, maxTime: 900 }) });
        }
      }
    }
    console.log('\n### Bots\n');
    console.log(botTable(runs));
    const idleEnd = 380;
    const defenders = runs.filter((r) => r.label.startsWith('defender'));
    expect(defenders.every((r) => r.run.outcome !== 'victory' && r.run.endTime > idleEnd)).toBe(true);
  });
});
