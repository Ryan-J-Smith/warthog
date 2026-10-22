import type { LevelDefinition } from '../../sim/level';
import { riverCrossing } from './riverCrossing';
import { threeRoads } from './threeRoads';

export { riverCrossing, threeRoads };

/** Every playable level, in order. */
export const LEVELS: readonly LevelDefinition[] = [riverCrossing, threeRoads];

export function getLevel(id: string): LevelDefinition {
  const level = LEVELS.find((l) => l.id === id);
  if (!level) throw new Error(`Unknown level: ${id}`);
  return level;
}
