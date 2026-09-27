import type { ControlInput } from '../../src/sim/input';
import { NO_INPUT } from '../../src/sim/input';
import type { EntitySpawn, LevelDefinition } from '../../src/sim/level';
import { Simulation } from '../../src/sim/simulation';

/** A small empty level; tests add entities/groups/objectives as needed. */
export function makeLevel(overrides: Partial<LevelDefinition> = {}): LevelDefinition {
  const home: EntitySpawn = { refId: 'home', kind: 'homeBase', pos: { x: 500, y: 1500 } };
  return {
    id: 'test',
    name: 'Test',
    tagline: '',
    width: 4000,
    height: 2000,
    seed: 42,
    parTime: 300,
    terrain: { biome: 'steppe', rivers: [], roads: [], forests: [], hills: [], fields: [], villages: [] },
    player: { spawn: { x: 1000, y: 1000 }, headingDeg: 0 },
    homeBaseRefId: 'home',
    paths: {},
    entities: [home],
    groups: [],
    objectives: [],
    radio: [],
    ...overrides,
    ...(overrides.entities ? { entities: [home, ...overrides.entities] } : {}),
  };
}

export function input(partial: Partial<ControlInput> = {}): ControlInput {
  return { ...NO_INPUT, ...partial };
}

/** Run `seconds` of simulation with the given held input; returns all events. */
export function run(sim: Simulation, seconds: number, held: Partial<ControlInput> = {}) {
  const events = [];
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) {
    sim.step(input(held));
    events.push(...sim.drainEvents());
  }
  return events;
}
