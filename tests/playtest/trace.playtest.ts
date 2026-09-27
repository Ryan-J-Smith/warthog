/**
 * Timeline trace of single bot runs (debugging aid): what the bot was doing, kills,
 * objectives, rearms and deaths, second by second. Edit CASES to trace other plans.
 */
import { describe, expect, it } from 'vitest';
import { riverCrossing } from '../../src/content/levels';
import type { LevelDefinition } from '../../src/sim/level';
import { SIM_STEP, Simulation } from '../../src/sim/simulation';
import type { SimEvent } from '../../src/sim/events';
import type { SimSystem } from '../../src/sim/systems';
import {
  ACE,
  BALANCED,
  PLAN_FACTORIES,
  PROPOSED_CONFIG,
  PROPOSED_SAM,
  clock,
  fastDiveSystems,
  proposedLevel,
  withTuning,
  type Bot,
  type Override,
} from './harness';

function trace(bot: Bot, level: LevelDefinition, seed: number, systems?: SimSystem[]): string[] {
  const sim = new Simulation(level, seed, systems);
  let events: SimEvent[] = [];
  let last = '';
  const log: string[] = [];
  while (!sim.world.ended && sim.world.time < 600) {
    sim.step(bot.decide(sim.view, events, SIM_STEP));
    events = sim.drainEvents();
    const p = sim.world.player;
    const at = clock(sim.world.time);
    if (bot.activity !== last) {
      log.push(`${at} → ${bot.activity}  (hp ${p.hp}, mav ${p.ammo.maverick}, bombs ${p.ammo.bombs}, gun ${p.ammo.gun})`);
      last = bot.activity;
    }
    for (const e of events) {
      if (e.type === 'objectiveUpdated') log.push(`${at}   ★ ${e.objectiveId} ${e.status}`);
      if (e.type === 'playerDestroyed') log.push(`${at}   ✖ player destroyed`);
      if (e.type === 'rearmCompleted') log.push(`${at}   ⟳ rearmed`);
      if (e.type === 'samLaunched') log.push(`${at}   SAM launch`);
      if (e.type === 'entityDestroyed' && e.team === 'enemy') log.push(`${at}   x ${e.kind}`);
      if (e.type === 'missionEnded') log.push(`${at}   END ${e.outcome}`);
    }
  }
  log.push(`score ${sim.world.results?.total} grade ${sim.world.results?.grade}`);
  return log;
}

const CASES: Array<{ plan: string; proposal: boolean; skill: typeof ACE }> = [
  { plan: 'bravo-first', proposal: false, skill: ACE },
  { plan: 'completionist-v2', proposal: true, skill: ACE },
];

describe('timeline traces', () => {
  for (const c of CASES) {
    it(`${c.plan} (${c.skill.name}, ${c.proposal ? 'proposal' : 'baseline'})`, () => {
      const factory = PLAN_FACTORIES[c.plan];
      if (!factory) throw new Error(c.plan);
      const overrides: readonly Override[] = c.proposal ? [...PROPOSED_CONFIG, ...PROPOSED_SAM] : [];
      const log = withTuning(overrides, () =>
        trace(factory(c.skill, BALANCED, 1), c.proposal ? proposedLevel(riverCrossing) : riverCrossing, 1011, c.proposal ? fastDiveSystems(1.6) : undefined),
      );
      console.log(`\n--- ${c.plan} ---\n${log.join('\n')}`);
      expect(log.length).toBeGreaterThan(0);
    });
  }
});
