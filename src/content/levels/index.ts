import type { LevelDefinition } from '../../sim/level';
import { ironSleet } from './ironSleet';
import { riverCrossing } from './riverCrossing';
import { threeRoads } from './threeRoads';

export { ironSleet, riverCrossing, threeRoads };

/** Every playable level, in order. */
export const LEVELS: readonly LevelDefinition[] = [riverCrossing, threeRoads, ironSleet];

export function getLevel(id: string): LevelDefinition {
  const level = LEVELS.find((l) => l.id === id);
  if (!level) throw new Error(`Unknown level: ${id}`);
  return level;
}
