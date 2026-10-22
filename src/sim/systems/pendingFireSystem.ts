import { GUN, SECONDARIES, STRAFE } from '../../config';
import { applySplash, canDamage, damageEntity, entityAt } from '../combat';
import type { Entity } from '../entities';
import { distance } from '../math';
import type { World } from '../world';
import { SimSystem, type StepContext } from './simSystem';

/**
 * Lands GAU-8 rounds after their travel time (direct hit plus the beaten zone), scores strafing
 * passes, and sets off scheduled secondary explosions.
 */
export class PendingFireSystem extends SimSystem {
  update({ world }: StepContext): void {
    const strafe = world.strafe;
    if (strafe.kills > 0 && world.time - strafe.lastRoundAt > STRAFE.window) endStrafe(world);

    if (world.pendingRounds.length > 0) {
      const landing = world.pendingRounds.filter((r) => r.landsAt <= world.time);
      if (landing.length > 0) {
        world.pendingRounds = world.pendingRounds.filter((r) => r.landsAt > world.time);
        strafe.lastRoundAt = world.time;
        const kills: Entity[] = [];
        for (const round of landing) {
          // Prefer something the gun can hurt; rounds pinging off hardened structures still spark.
          const target =
            entityAt(world, round.pos, GUN.hitSlop, (e) => canDamage(e, 'gun')) ??
            entityAt(world, round.pos, GUN.hitSlop, (e) => e.armor === 'hardened');
          const dealt = target ? gunHit(world, target, round.damage, kills) : 0;
          // Beaten zone: the burst also chews up soft targets right next to the impact.
          for (const entity of world.entities) {
            if (entity === target || !entity.alive || entity.hidden || entity.armor !== 'soft' || !canDamage(entity, 'gun')) continue;
            if (distance(entity.pos, round.pos) <= entity.radius + GUN.beatenZone) {
              gunHit(world, entity, round.damage * GUN.beatenZoneShare, kills);
            }
          }
          world.emit({
            type: 'gunImpact',
            pos: round.pos,
            hit: dealt > 0,
            armored: target !== null && target.armor !== 'soft',
          });
        }
        for (const kill of kills) {
          strafe.kills += 1;
          strafe.lastKillPos = { ...kill.pos };
          if (strafe.kills >= 2) world.emit({ type: 'strafeKill', count: strafe.kills, pos: { ...kill.pos } });
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

/** Damage from the gun; enemy kills it makes are collected for the strafing pass. */
function gunHit(world: World, entity: Entity, damage: number, kills: Entity[]): number {
  const dealt = damageEntity(world, entity, damage, 'gun');
  if (dealt > 0 && !entity.alive && entity.team === 'enemy') kills.push(entity);
  return dealt;
}

/** The pass is over: pay the STRAFE ×N bonus if it killed enough. */
function endStrafe(world: World): void {
  const strafe = world.strafe;
  if (strafe.kills >= STRAFE.minKills && strafe.lastKillPos) {
    const bonus = Math.round(strafe.kills * STRAFE.bonusPerKill * world.difficulty.scoreMultiplier);
    world.score += bonus;
    world.stats.bonusPoints += bonus;
    world.emit({ type: 'scoreAwarded', points: bonus, reason: `STRAFE ×${strafe.kills}`, pos: strafe.lastKillPos });
  }
  strafe.kills = 0;
  strafe.lastKillPos = null;
}
