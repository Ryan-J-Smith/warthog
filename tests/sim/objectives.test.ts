import { describe, expect, it } from 'vitest';
import { riverCrossing } from '../../src/content/levels';
import type { LevelDefinition } from '../../src/sim/level';
import { Simulation } from '../../src/sim/simulation';
import { killEntity } from '../../src/sim/combat';
import { makeLevel, run } from './helpers';

/** A column drives west→east over a bridge at x=1000. Waypoint 1 = near bank, 3 = far bank. */
function columnLevel(): LevelDefinition {
  return makeLevel({
    player: { spawn: { x: 2000, y: 1800 }, headingDeg: 180 },
    paths: {
      road: [
        { x: 400, y: 500 },
        { x: 900, y: 500 },
        { x: 1000, y: 500 },
        { x: 1100, y: 500 },
        { x: 1800, y: 500 },
      ],
      divert: [{ x: 1800, y: 900 }],
    },
    entities: [
      { refId: 'bridge', kind: 'bridge', pos: { x: 1000, y: 500 } },
      { refId: 'outpost', kind: 'outpost', pos: { x: 2400, y: 900 } },
    ],
    groups: [
      {
        id: 'col',
        trigger: { kind: 'start' },
        pathId: 'road',
        spacing: 40,
        speed: 200,
        tags: ['column'],
        units: [{ kind: 'truck' }, { kind: 'truck' }, { kind: 'truck' }],
      },
    ],
    objectives: [
      {
        id: 'stop',
        kind: 'stopColumn',
        title: 'Stop it',
        primary: true,
        columnTag: 'column',
        bridgeRefId: 'bridge',
        haltWaypoint: 1,
        crossedWaypoint: 3,
        divertPathId: 'divert',
        divertTags: ['assault'],
      },
      {
        id: 'intact',
        kind: 'defend',
        title: 'Take the bridge intact',
        primary: false,
        targetRefId: 'bridge',
        attackerTags: ['column'],
        failsWith: 'stop',
      },
    ],
  });
}

const status = (sim: Simulation, id: string) => sim.world.objectives.find((o) => o.id === id)?.status;

describe('objectives', () => {
  it('dropping the bridge completes stopColumn and halts the column on the near bank', () => {
    const sim = new Simulation(columnLevel());
    run(sim, 0.5);
    const bridge = sim.world.findByRef('bridge');
    if (!bridge) throw new Error('no bridge');
    killEntity(sim.world, bridge, true);
    run(sim, 6);
    const stop = sim.world.objectives.find((o) => o.id === 'stop');
    expect(stop?.status).toBe('completed');
    const trucks = sim.world.withTag('column').filter((t) => t.alive);
    expect(trucks.length).toBeGreaterThan(0);
    for (const t of trucks) expect(t.pos.x).toBeLessThan(950);
  });

  it('holds a column that spawns after the bridge was already dropped', () => {
    const level = columnLevel();
    const delayed = { ...level, groups: level.groups.map((g) => ({ ...g, trigger: { kind: 'time' as const, at: 1 } })) };
    const sim = new Simulation(delayed);
    const bridge = sim.world.findByRef('bridge');
    if (!bridge) throw new Error('no bridge');
    killEntity(sim.world, bridge, true);
    run(sim, 8);
    const trucks = sim.world.withTag('column');
    expect(trucks.length).toBe(3);
    for (const t of trucks) {
      expect(t.alive).toBe(true);
      expect(t.pos.x).toBeLessThan(950);
      expect(t.tags).not.toContain('diverted');
    }
  });

  it('a unit reaching the far bank fails stopColumn and is diverted as an attacker', () => {
    const sim = new Simulation(columnLevel());
    const events = run(sim, 6);
    const stop = sim.world.objectives.find((o) => o.id === 'stop');
    expect(stop?.status).toBe('failed');
    expect(events.some((e) => e.type === 'objectiveUpdated' && e.status === 'failed')).toBe(true);
    const diverted = sim.world.withTag('assault');
    expect(diverted.length).toBeGreaterThan(0);
  });

  it('destroying every column unit also completes stopColumn', () => {
    const sim = new Simulation(columnLevel());
    run(sim, 0.2);
    for (const unit of sim.world.withTag('column')) killEntity(sim.world, unit, true);
    run(sim, 0.1);
    expect(sim.world.objectives.find((o) => o.id === 'stop')?.status).toBe('completed');
  });
});

describe('bridge drop', () => {
  it('drops vehicles on the span into the river for a bonus', () => {
    const sim = new Simulation(columnLevel());
    run(sim, 2.75); // lead truck (200 u/s) is on the span between x=900 and x=1100
    const bridge = sim.world.findByRef('bridge');
    if (!bridge) throw new Error('no bridge');
    killEntity(sim.world, bridge, true);
    const events = run(sim, 0.1);
    const bonus = events.find((e) => e.type === 'scoreAwarded' && e.reason.startsWith('BRIDGE DROP'));
    expect(bonus).toBeDefined();
    expect(events.some((e) => e.type === 'radio' && e.text.includes('into the river'))).toBe(true);
  });
});

describe('take the bridge intact', () => {
  it('fails when the bridge is dropped', () => {
    const sim = new Simulation(columnLevel());
    run(sim, 0.2);
    const bridge = sim.world.findByRef('bridge');
    if (!bridge) throw new Error('no bridge');
    killEntity(sim.world, bridge, true);
    run(sim, 0.1);
    expect(status(sim, 'stop')).toBe('completed');
    expect(status(sim, 'intact')).toBe('failed');
  });

  it('fails with the column objective when the column crosses', () => {
    const sim = new Simulation(columnLevel());
    run(sim, 6);
    expect(status(sim, 'stop')).toBe('failed');
    expect(status(sim, 'intact')).toBe('failed');
  });

  it('completes alongside stopColumn when the whole column is destroyed', () => {
    const sim = new Simulation(columnLevel());
    run(sim, 0.2);
    for (const unit of sim.world.withTag('column')) killEntity(sim.world, unit, true);
    run(sim, 0.1);
    expect(status(sim, 'stop')).toBe('completed');
    expect(status(sim, 'intact')).toBe('completed');
  });
});

describe('River Crossing', () => {
  it('runs a full hands-off mission to a conclusion without errors', () => {
    const sim = new Simulation(riverCrossing);
    const seen = new Set<string>();
    for (let i = 0; i < 60 * 60 * 9 && !sim.world.ended; i++) {
      sim.step({ turn: 0.3, fire: false, boost: false, brake: false, climb: false, dive: false, flare: false, select: null, ready: false });
      for (const e of sim.drainEvents()) seen.add(e.type);
    }
    expect(sim.world.ended).toBe(true);
    expect(sim.world.results).not.toBeNull();
    expect(seen.has('radio')).toBe(true);
    // Left alone, the column crosses and Bravo falls.
    const column = sim.world.objectives.find((o) => o.id === 'column');
    const outpost = sim.world.objectives.find((o) => o.id === 'outpost');
    expect(column?.status).toBe('failed');
    expect(outpost?.status).toBe('failed');
  });

  it('the column reaches the bridge around the 3 minute mark', () => {
    const sim = new Simulation(riverCrossing);
    let crossedAt: number | null = null;
    for (let i = 0; i < 60 * 60 * 6 && crossedAt === null; i++) {
      sim.step({ turn: 0.3, fire: false, boost: false, brake: false, climb: false, dive: false, flare: false, select: null, ready: false });
      for (const e of sim.drainEvents()) {
        if (e.type === 'objectiveUpdated' && e.objectiveId === 'column') crossedAt = sim.world.time;
      }
    }
    expect(crossedAt).not.toBeNull();
    expect(crossedAt!).toBeGreaterThan(150);
    expect(crossedAt!).toBeLessThan(220);
  });

  it('Outpost Bravo holds for roughly two to three minutes without help', () => {
    const sim = new Simulation(riverCrossing);
    let fellAt: number | null = null;
    for (let i = 0; i < 60 * 60 * 6 && fellAt === null; i++) {
      sim.step({ turn: 0.3, fire: false, boost: false, brake: false, climb: false, dive: false, flare: false, select: null, ready: false });
      for (const e of sim.drainEvents()) {
        if (e.type === 'objectiveUpdated' && e.objectiveId === 'outpost' && e.status === 'failed') fellAt = sim.world.time;
      }
    }
    expect(fellAt).not.toBeNull();
    expect(fellAt!).toBeGreaterThan(120);
    expect(fellAt!).toBeLessThan(240);
  });
});
