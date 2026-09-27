import { spawnGroup } from '../spawning';
import { isTriggerMet } from '../triggers';
import { SimSystem, type StepContext } from './simSystem';

/** Spawns level groups when their triggers fire. */
export class SpawnSystem extends SimSystem {
  update({ world }: StepContext): void {
    for (const group of world.level.groups) {
      if (world.spawnedGroups.has(group.id)) continue;
      if (isTriggerMet(world, group.trigger)) spawnGroup(world, group);
    }
  }
}
