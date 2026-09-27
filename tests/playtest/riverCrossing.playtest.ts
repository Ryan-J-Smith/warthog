/**
 * River Crossing strategy matrix: every plan × flight style × skill × seed.
 * Prints markdown tables for docs/ai_docs/fun.md.
 */
import { describe, expect, it } from 'vitest';
import { riverCrossing } from '../../src/content/levels';
import {
  ACE,
  AVERAGE,
  BALANCED,
  IdleBot,
  PLAN_FACTORIES,
  ROOKIE,
  STYLES,
  detailTable,
  outcomeTable,
  runMission,
  scoreTable,
  type RunRecord,
  type SkillProfile,
} from './harness';

export const SEEDS = [1011, 1, 2, 3, 4, 5];

function runPlan(plan: string, skill: SkillProfile, style = BALANCED): RunRecord[] {
  const factory = PLAN_FACTORIES[plan];
  if (!factory) throw new Error(`no plan ${plan}`);
  return SEEDS.map((seed) =>
    runMission({ level: riverCrossing, seed, bot: factory(skill, style, seed), skill: skill.name }),
  );
}

function print(title: string, runs: RunRecord[]): void {
  console.log(`\n### ${title}\n`);
  console.log(outcomeTable(runs));
  console.log('');
  console.log(detailTable(runs));
  console.log('');
  console.log(scoreTable(runs));
}

describe('River Crossing baseline', () => {
  it('idle: the level plays itself', () => {
    const runs = SEEDS.map((seed) => runMission({ level: riverCrossing, seed, bot: new IdleBot(), skill: '-' }));
    print('Idle (no player input)', runs);
    expect(runs.every((r) => r.objectives.outpost?.status === 'failed')).toBe(true);
  });

  it('plan order, balanced style', () => {
    const runs: RunRecord[] = [];
    for (const skill of [ACE, AVERAGE, ROOKIE]) {
      for (const plan of Object.keys(PLAN_FACTORIES)) runs.push(...runPlan(plan, skill));
    }
    print('Plans × skill (balanced style: transit Medium, gun at Low, bombs from Medium)', runs);
    expect(runs.length).toBeGreaterThan(0);
  });

  it('flight style, bravo-first and suppress-first plans', () => {
    const runs: RunRecord[] = [];
    for (const skill of [ACE, AVERAGE]) {
      for (const plan of ['bravo-first', 'suppress-first']) {
        for (const style of STYLES) runs.push(...runPlan(plan, skill, style));
      }
    }
    print('Flight styles × skill', runs);
    expect(runs.length).toBeGreaterThan(0);
  });
});
