import type { Trigger } from '../level';
import type { World } from '../world';

/** Level-data trigger evaluation. All triggers are state-based, so they are safe to poll. */
export function isTriggerMet(world: World, trigger: Trigger): boolean {
  switch (trigger.kind) {
    case 'start':
      return true;
    case 'time':
      return world.time >= trigger.at;
    case 'objectiveResolved': {
      const objective = world.objectives.find((o) => o.id === trigger.objectiveId);
      if (!objective || objective.status === 'active') return false;
      return trigger.status === undefined || objective.status === trigger.status;
    }
    case 'entityDestroyed': {
      const entity = world.findByRef(trigger.refId);
      return entity !== undefined && !entity.alive;
    }
    case 'entitySpotted': {
      const entity = world.findByRef(trigger.refId);
      return entity !== undefined && entity.spotted;
    }
    case 'artilleryFiring': {
      return (world.findByRef(trigger.refId)?.mlrs?.barrages ?? 0) > 0;
    }
    case 'allPrimariesResolved':
      return allPrimariesResolved(world);
  }
}

export function allPrimariesResolved(world: World): boolean {
  const primaries = world.objectives.filter((o) => o.primary);
  return primaries.length > 0 && primaries.every((o) => o.status !== 'active');
}
