/**
 * Iron Sleet (score attack) balance: how many vehicles get away and what bots score.
 * Run with: npx vitest run --config tests/playtest/vitest.config.ts tests/playtest/ironSleet.playtest.ts
 */
import { describe, expect, it } from 'vitest';
import { ironSleet } from '../../src/content/levels';
import type { Entity } from '../../src/sim/entities';
import type { Vec2 } from '../../src/sim/math';
import { moverProgress } from '../../src/sim/systems';
import type { WorldView } from '../../src/sim/world';
import { ACE, AVERAGE, BALANCED, DirectFireTask, IdleBot, PlanBot, clock, onMap, runMission, table, type RunRecord, type Task } from './harness';

const SEEDS = [3031, 1, 2];

function convoy(view: WorldView): Entity[] {
  return view.entities.filter((e) => e.alive && e.tags.includes('convoy') && onMap(view, e));
}

/** Kills whatever convoy vehicle is nearest. */
class NearestHunterBot extends PlanBot {
  readonly name: string = 'nearest';
  protected buildPlan(): Task[] {
    return [];
  }
  protected override refill(): Task | null {
    return new DirectFireTask('convoy', convoy, { weapons: ['gun', 'rockets', 'maverick'] });
  }
  protected loiterPoint(view: WorldView): Vec2 {
    return { x: view.width / 2, y: view.height * 0.55 };
  }
}

/** Always goes after the convoy closest to escaping. */
class TriageBot extends NearestHunterBot {
  override readonly name: string = 'triage';
  protected override refill(): Task | null {
    return new DirectFireTask(
      'lead convoy',
      (view) => {
        const units = convoy(view);
        const lead = units.reduce<Entity | null>((best, e) => (!best || moverProgress(e) > moverProgress(best) ? e : best), null);
        return lead ? units.filter((e) => Math.hypot(e.pos.x - lead.pos.x, e.pos.y - lead.pos.y) < 600) : [];
      },
      { weapons: ['gun', 'rockets', 'maverick'] },
    );
  }
}

function rows(runs: Array<{ label: string; run: RunRecord }>): string[][] {
  return runs.map(({ label, run }) => [
    label,
    String(run.seed),
    run.outcome,
    clock(run.endTime),
    String(run.deaths),
    String(Object.values(run.kills).reduce((a, b) => a + b, 0)),
    String(run.results?.feats?.bestChain ?? 0),
    String(run.score),
    run.grade,
  ]);
}

describe('Iron Sleet balance', () => {
  it('idle: the line breaks within four minutes', () => {
    const run = runMission({ level: ironSleet, seed: 3031, bot: new IdleBot(), maxTime: 320 });
    console.log(`\n### Idle — ${run.outcome} at ${clock(run.endTime)}`);
    expect(run.outcome).toBe('defeat');
    expect(run.endTime).toBeLessThan(240);
  });

  it('bots: an ace holds the line; an average pilot sometimes breaks', () => {
    const runs: Array<{ label: string; run: RunRecord }> = [];
    for (const skill of [ACE, AVERAGE]) {
      for (const seed of SEEDS) {
        for (const make of [() => new NearestHunterBot(skill, BALANCED, seed), () => new TriageBot(skill, BALANCED, seed)]) {
          const bot = make();
          runs.push({ label: `${bot.name}/${skill.name}`, run: runMission({ level: ironSleet, seed, bot, skill: skill.name, maxTime: 320 }) });
        }
      }
    }
    console.log('\n### Bots\n');
    console.log(table(['bot', 'seed', 'outcome', 'end', 'deaths', 'kills', 'chain', 'score', 'grade'], rows(runs)));
    expect(runs.filter((r) => r.label.endsWith('/ace')).every((r) => r.run.outcome === 'victory')).toBe(true);
  });
});
