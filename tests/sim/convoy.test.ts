import { describe, expect, it } from 'vitest';
import type { ConvoyStreamDefinition, LevelDefinition } from '../../src/sim/level';
import { Simulation } from '../../src/sim/simulation';
import { convoyUnits } from '../../src/sim/systems';
import { makeLevel, run } from './helpers';

const STREAM: ConvoyStreamDefinition = {
  id: 'road',
  pathId: 'road',
  firstAt: 0,
  interval: 10,
  speed: 200,
  spacing: 40,
  units: ['truck', 'truck'],
  escalation: [{ at: 15, add: ['tank'] }],
  tags: ['convoy'],
};

/** A short road far from the player so nothing gets shot; trucks reach its end in ~2 s. */
function convoyLevel(overrides: Partial<LevelDefinition> = {}): LevelDefinition {
  return makeLevel({
    paths: { road: [{ x: 3000, y: 200 }, { x: 3000, y: 600 }] },
    convoys: [STREAM],
    endOnResolve: true,
    objectives: [{ id: 'cut', kind: 'interdict', title: 'Cut the roads', primary: true, convoyTag: 'convoy', maxEscapes: 3, timeLimit: 60 }],
    ...overrides,
  });
}

describe('convoy streams', () => {
  it('escalation adds units from its start time onward', () => {
    expect(convoyUnits(STREAM, 0)).toEqual(['truck', 'truck']);
    expect(convoyUnits(STREAM, 15)).toEqual(['truck', 'truck', 'tank']);
  });

  it('spawns convoys on schedule and counts vehicles that reach the end as escaped', () => {
    const sim = new Simulation(convoyLevel());
    run(sim, 0.1);
    expect(sim.world.withTag('convoy').length).toBe(2);
    run(sim, 4);
    expect(sim.world.escapes).toBe(2);
    expect(sim.world.withTag('convoy').length).toBe(0);
    run(sim, 6.5);
    expect(sim.world.withTag('convoy').length).toBe(2);
  });

  it('interdict fails, and the mission ends at once, when too many get away', () => {
    const sim = new Simulation(convoyLevel());
    // Convoys at 0 and 10 s are 4 trucks: the fourth escape breaks the line (max 3).
    const events = run(sim, 15);
    expect(sim.world.objectives[0]?.status).toBe('failed');
    expect(sim.world.ended).toBe(true);
    expect(sim.world.results?.outcome).toBe('defeat');
    expect(events.some((e) => e.type === 'radio')).toBe(true);
  });

  it('interdict completes at the time limit and the mission ends in victory', () => {
    const sim = new Simulation(convoyLevel({ convoys: [{ ...STREAM, firstAt: 1000 }] }));
    run(sim, 30);
    const cut = sim.world.objectives[0]!;
    expect(cut.status).toBe('active');
    expect(cut.detail).toMatch(/^0:3[01] left · 0\/3 escaped$/);
    run(sim, 31);
    expect(cut.status).toBe('completed');
    expect(sim.world.results?.outcome).toBe('victory');
  });
});
