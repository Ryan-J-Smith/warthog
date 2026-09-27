/**
 * A/B: the current River Crossing vs the proposed tuning package (docs/ai_docs/fun.md),
 * plus ablations that remove one piece of the package at a time.
 */
import { describe, expect, it } from 'vitest';
import { riverCrossing } from '../../src/content/levels';
import type { LevelDefinition } from '../../src/sim/level';
import type { SimSystem } from '../../src/sim/systems';
import {
  ACE,
  AVERAGE,
  BALANCED,
  PLAN_FACTORIES,
  PROPOSED_CONFIG,
  PROPOSED_DIVE_RATE,
  PROPOSED_SAM,
  ROOKIE,
  STYLES,
  compareTable,
  detailTable,
  fastDiveSystems,
  gradeFor,
  outcomeTable,
  proposedLevel,
  scoreTable,
  runMission,
  withTuning,
  type FlightStyle,
  type Override,
  type RunRecord,
  type SkillProfile,
} from './harness';

const SEEDS = [1011, 1, 2, 3, 4, 5];
const PLANS = ['suppress-first', 'bravo-first', 'bridge-first', 'sam-first', 'dump-first', 'bridge-late', 'greedy', 'column-hunt', 'completionist-v2'];

interface Condition {
  name: string;
  overrides: readonly Override[];
  level: LevelDefinition;
  systems?: () => SimSystem[];
}

const BASELINE: Condition = { name: 'baseline', overrides: [], level: riverCrossing };
const PROPOSAL: Condition = {
  name: 'proposal',
  overrides: [...PROPOSED_CONFIG, ...PROPOSED_SAM],
  level: proposedLevel(riverCrossing),
  systems: () => fastDiveSystems(PROPOSED_DIVE_RATE),
};

function run(condition: Condition, plans: readonly string[], skills: readonly SkillProfile[], styles: readonly FlightStyle[] = [BALANCED]): RunRecord[] {
  return withTuning(condition.overrides, () => {
    const runs: RunRecord[] = [];
    for (const skill of skills) {
      for (const plan of plans) {
        const factory = PLAN_FACTORIES[plan];
        if (!factory) throw new Error(plan);
        for (const style of styles) {
          for (const seed of SEEDS) {
            runs.push(
              runMission({
                level: condition.level,
                seed,
                bot: factory(skill, style, seed),
                skill: skill.name,
                ...(condition.systems ? { systems: condition.systems } : {}),
              }),
            );
          }
        }
      }
    }
    return runs;
  });
}

describe('proposal A/B', () => {
  it('plans × skill: baseline vs proposal', () => {
    const skills = [ACE, AVERAGE, ROOKIE];
    const base = run(BASELINE, PLANS, skills);
    const prop = run(PROPOSAL, PLANS, skills);
    console.log('\n### Baseline vs proposal (balanced style, 6 seeds). grades* = proposed thresholds\n');
    console.log(compareTable(base, prop, (t) => gradeFor(t)));
    console.log('\n### Proposal detail\n');
    console.log(outcomeTable(prop));
    console.log('');
    console.log(scoreTable(prop));
    console.log('');
    console.log(detailTable(prop));
    expect(prop.length).toBe(base.length);
  });

  it('flight styles under the proposal', () => {
    const runs = run(PROPOSAL, ['bravo-first', 'suppress-first', 'column-hunt'], [ACE, AVERAGE], STYLES);
    console.log('\n### Proposal: flight styles\n');
    console.log(outcomeTable(runs));
    console.log('');
    console.log(detailTable(runs));
    expect(runs.length).toBeGreaterThan(0);
  });

  it('ablations: remove one piece of the package', () => {
    const [aa, gun, bombs, rtb] = PROPOSED_CONFIG;
    const pieces: Array<{ name: string; condition: Condition }> = [
      { name: 'full proposal', condition: PROPOSAL },
      { name: 'minus AA change', condition: { ...PROPOSAL, name: 'no AA', overrides: [gun, bombs, rtb, ...PROPOSED_SAM].filter((o): o is Override => o !== undefined) } },
      { name: 'minus gun change', condition: { ...PROPOSAL, name: 'no gun', overrides: [aa, bombs, rtb, ...PROPOSED_SAM].filter((o): o is Override => o !== undefined) } },
      { name: 'minus level data', condition: { ...PROPOSAL, name: 'no level', level: riverCrossing } },
    ];
    const lines: string[] = [];
    for (const piece of pieces) {
      const runs = run(piece.condition, ['bravo-first', 'suppress-first', 'column-hunt', 'greedy'], [AVERAGE]);
      lines.push(`\n#### ${piece.name}\n`, outcomeTable(runs));
    }
    console.log('\n### Ablations (average skill, balanced)\n');
    console.log(lines.join('\n'));
    expect(lines.length).toBeGreaterThan(0);
  });

  it('death as a rearm: never-repair (kamikaze) vs repair-at-35', () => {
    const kamikaze: SkillProfile = { ...ACE, name: 'ace-kamikaze', repairAtHp: 0 };
    const plans = ['bravo-first', 'suppress-first', 'column-hunt', 'completionist-v2'];
    const base = [...run(BASELINE, plans, [ACE]), ...run(BASELINE, plans, [kamikaze])];
    const prop = [...run(PROPOSAL, plans, [ACE]), ...run(PROPOSAL, plans, [kamikaze])];
    console.log('\n### Kamikaze (never repair; dying refills ammo at base) vs repairing, baseline | proposal\n');
    console.log(compareTable(base, prop, (t) => gradeFor(t)));
    expect(base.length).toBe(prop.length);
  });

  it('RTB clock: can you still do an optional after the primaries?', () => {
    const [aa, gun, bombs] = PROPOSED_CONFIG;
    const shortGrace: Condition = {
      ...PROPOSAL,
      name: 'proposal, 25 s grace',
      overrides: [aa, gun, bombs, ...PROPOSED_SAM].filter((o): o is Override => o !== undefined),
    };
    const base = run(shortGrace, ['primaries-then-dump'], [ACE, AVERAGE]);
    const prop = run(PROPOSAL, ['primaries-then-dump'], [ACE, AVERAGE]);
    console.log('\n### Primaries first, then the dump: proposal with RTB grace 25 s (left) vs 90 s (right)\n');
    console.log(compareTable(base, prop, (t) => gradeFor(t)));
    expect(base.length).toBe(prop.length);
  });

  it('pincer wave 2 (level-data spice) on top of the proposal', () => {
    const pincer: Condition = { ...PROPOSAL, name: 'proposal + pincer', level: proposedLevel(riverCrossing, { pincer: true }) };
    const plans = ['suppress-first', 'bravo-first', 'column-hunt', 'completionist-v2', 'greedy'];
    const skills = [ACE, AVERAGE, ROOKIE];
    const prop = run(PROPOSAL, plans, skills);
    const spicy = run(pincer, plans, skills);
    console.log('\n### Proposal (left) vs proposal + pincer wave 2 (right)\n');
    console.log(compareTable(prop, spicy, (t) => gradeFor(t)));
    expect(prop.length).toBe(spicy.length);
  });
});
