import { GUN, SECONDARIES } from '../../config';
import { applySplash, canDamage, damageEntity, entityAt } from '../combat';
import { SimSystem, type StepContext } from './simSystem';

/** Lands GAU-8 rounds after their travel time and sets off scheduled secondary explosions. */
export class PendingFireSystem extends SimSystem {
  update({ world }: StepContext): void {
    if (world.pendingRounds.length > 0) {
      const landing = world.pendingRounds.filter((r) => r.landsAt <= world.time);
      if (landing.length > 0) {
        world.pendingRounds = world.pendingRounds.filter((r) => r.landsAt > world.time);
        for (const round of landing) {
          // Prefer something the gun can hurt; rounds pinging off hardened structures still spark.
          const target =
            entityAt(world, round.pos, GUN.hitSlop, (e) => canDamage(e, 'gun')) ??
            entityAt(world, round.pos, GUN.hitSlop, (e) => e.armor === 'hardened');
          const dealt = target ? damageEntity(world, target, round.damage, 'gun') : 0;
          world.emit({
            type: 'gunImpact',
            pos: round.pos,
            hit: dealt > 0,
            armored: target !== null && target.armor !== 'soft',
          });
        }
      }
    }

    if (world.pendingSecondaries.length > 0) {
      const due = world.pendingSecondaries.filter((s) => s.at <= world.time);
      if (due.length > 0) {
        world.pendingSecondaries = world.pendingSecondaries.filter((s) => s.at > world.time);
        for (const blast of due) {
          world.emit({ type: 'secondaryExplosion', pos: blast.pos, size: 'large' });
          applySplash(world, blast.pos, SECONDARIES.splash, SECONDARIES.damage, 'secondary');
        }
      }
    }
  }
}
