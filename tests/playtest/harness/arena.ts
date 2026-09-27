import type { EntitySpawn, LevelDefinition } from '../../../src/sim/level';
import type { Vec2 } from '../../../src/sim/math';

/**
 * An empty 6000 × 6000 test range with a home base in the south-west corner.
 * Used for isolated threat and weapon experiments.
 */
export function arenaLevel(options: { player?: { spawn: Vec2; headingDeg: number }; entities?: EntitySpawn[] } = {}): LevelDefinition {
  return {
    id: 'arena',
    name: 'Arena',
    tagline: '',
    width: 6000,
    height: 6000,
    seed: 7,
    parTime: 300,
    terrain: { biome: 'steppe', rivers: [], roads: [], forests: [], hills: [], fields: [], villages: [] },
    player: options.player ?? { spawn: { x: 3000, y: 3000 }, headingDeg: 0 },
    homeBaseRefId: 'home',
    paths: {},
    entities: [{ refId: 'home', kind: 'homeBase', pos: { x: 300, y: 5700 } }, ...(options.entities ?? [])],
    groups: [],
    objectives: [],
    radio: [],
  };
}

/** River Crossing with every enemy removed: for pure transit timing. */
export function withoutEnemies(level: LevelDefinition): LevelDefinition {
  return {
    ...level,
    entities: level.entities.filter((e) => e.kind === 'homeBase' || e.kind === 'outpost' || e.kind.startsWith('friendly')),
    groups: [],
    objectives: [],
    radio: [],
  };
}
