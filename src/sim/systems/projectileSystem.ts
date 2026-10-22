import { AIRCRAFT_BASE_HEIGHT, ENTITY_STATS, MAVERICK } from '../../config';
import { applySplash, damageEntity } from '../combat';
import type { Projectile } from '../entities';
import { angleDelta, angleOf, approach, clamp, degToRad, distance, fromAngle, rotateToward, sub } from '../math';
import type { World } from '../world';
import { damagePlayer } from './playerDamage';
import { SimSystem, type StepContext } from './simSystem';

const AA_ROUND_HIT_RADIUS = 22;

/** Moves every projectile and resolves detonations and hits. */
export class ProjectileSystem extends SimSystem {
  update({ world, dt }: StepContext): void {
    const finished = new Set<number>();
    for (const proj of world.projectiles) {
      proj.age += dt;
      let done = false;
      switch (proj.kind) {
        case 'rocket':
          done = this.updateBallistic(world, proj, dt, 'rocket');
          break;
        case 'bomb':
          done = this.updateBallistic(world, proj, dt, 'bomb');
          break;
        case 'maverick':
          done = this.updateMaverick(world, proj, dt);
          break;
        case 'samMissile':
          done = this.updateSam(world, proj, dt);
          break;
        case 'aaRound':
          done = this.updateAaRound(world, proj, dt);
          break;
        case 'heliRocket':
          done = this.updateHeliRocket(world, proj, dt);
          break;
        case 'flare':
        case 'tankShell':
          proj.pos.x += proj.vel.x * dt;
          proj.pos.y += proj.vel.y * dt;
          proj.vel.x *= 0.985;
          proj.vel.y *= 0.985;
          proj.alt = Math.max(0, proj.alt - 0.35 * dt);
          done = proj.age >= proj.life;
          break;
      }
      if (done) finished.add(proj.id);
    }

    if (finished.size > 0) {
      for (const proj of world.projectiles) {
        if (finished.has(proj.id) && proj.kind === 'samMissile') releaseMissileSlot(world, proj);
      }
      world.projectiles = world.projectiles.filter((p) => !finished.has(p.id));
    }
    world.player.missilesTracking = world.projectiles.filter(
      (p) => p.kind === 'samMissile' && p.targetId === -1 && !p.lostLock,
    ).length;
  }

  /** Rockets and bombs: straight line to the aim point, detonate on arrival. */
  private updateBallistic(world: World, proj: Projectile, dt: number, weapon: 'rocket' | 'bomb'): boolean {
    proj.pos.x += proj.vel.x * dt;
    proj.pos.y += proj.vel.y * dt;
    const t = clamp(proj.age / proj.life, 0, 1);
    proj.alt = weapon === 'bomb' ? proj.startAlt * (1 - t * t) : proj.startAlt * (1 - t);
    if (proj.age < proj.life) return false;
    const at = proj.aimPoint ?? proj.pos;
    applySplash(world, at, proj.splashRadius, proj.damage, weapon);
    world.emit({ type: 'ordnanceImpact', weapon, pos: { ...at }, radius: proj.splashRadius });
    return true;
  }

  private updateMaverick(world: World, proj: Projectile, dt: number): boolean {
    const target = proj.targetId !== null ? world.findById(proj.targetId) : undefined;
    if (target && target.alive) proj.aimPoint = { ...target.pos };
    const aim = proj.aimPoint ?? proj.pos;
    proj.heading = rotateToward(proj.heading, angleOf(sub(aim, proj.pos)), degToRad(MAVERICK.turnRateDeg) * dt);
    proj.vel = fromAngle(proj.heading, MAVERICK.speed);
    proj.pos.x += proj.vel.x * dt;
    proj.pos.y += proj.vel.y * dt;
    const dist = distance(proj.pos, aim);
    proj.alt = proj.startAlt * clamp(dist / proj.startDistance, 0, 1);
    if (dist > MAVERICK.fuse && proj.age < proj.life) return false;

    if (target && target.alive && distance(proj.pos, target.pos) <= MAVERICK.fuse + target.radius) {
      damageEntity(world, target, proj.damage, 'maverick');
    }
    applySplash(world, proj.pos, proj.splashRadius, proj.damage * 0.3, 'maverick');
    world.emit({ type: 'ordnanceImpact', weapon: 'maverick', pos: { ...proj.pos }, radius: proj.splashRadius });
    return true;
  }

  private updateSam(world: World, proj: Projectile, dt: number): boolean {
    const p = world.player;
    const stats = ENTITY_STATS.samSite.sam;
    if (!stats) return true;
    const site = proj.sourceId !== null ? world.findById(proj.sourceId) : undefined;

    const tracking = proj.targetId === -1 && !proj.lostLock;
    if (tracking && (!p.alive || p.band === 'low' || !site || !site.alive)) {
      proj.lostLock = true;
      proj.targetId = null;
      world.emit({ type: 'samLostLock', missileId: proj.id, pos: { ...proj.pos } });
    } else if (tracking && proj.age >= stats.gimbalArmTime) {
      // Out-turned: the aircraft left the seeker's field of view.
      const offBore = Math.abs(angleDelta(proj.heading, angleOf(sub(p.pos, proj.pos))));
      if (offBore > degToRad(stats.gimbalDeg)) {
        proj.lostLock = true;
        proj.targetId = null;
        world.score += stats.evadeBonus;
        world.stats.bonusPoints += stats.evadeBonus;
        world.stats.missilesDefeated += 1;
        world.emit({ type: 'samEvaded', missileId: proj.id, pos: { ...proj.pos }, bonus: stats.evadeBonus });
        world.emit({ type: 'scoreAwarded', points: stats.evadeBonus, reason: 'MISSILE DEFEATED', pos: { ...p.pos } });
      }
    }

    const maxSpeed = tracking && p.band === 'high' ? stats.missileMaxSpeedHigh : stats.missileMaxSpeed;
    const speed = Math.min(maxSpeed, Math.hypot(proj.vel.x, proj.vel.y) + stats.missileAccel * dt);
    const turnRate = degToRad(stats.turnRateDeg);
    const playerHeight = p.alt + AIRCRAFT_BASE_HEIGHT;

    if (proj.targetId === -1 && !proj.lostLock) {
      // Lead pursuit: aim at where the player will be in half the time-to-go.
      const tGo = distance(proj.pos, p.pos) / Math.max(speed, 1);
      const v = world.playerVelocity();
      const aim = { x: p.pos.x + v.x * tGo * stats.leadFactor, y: p.pos.y + v.y * tGo * stats.leadFactor };
      proj.heading = rotateToward(proj.heading, angleOf(sub(aim, proj.pos)), turnRate * dt);
      proj.alt = approach(proj.alt, playerHeight, stats.climbRate * dt);
    } else if (proj.aimPoint) {
      // Decoyed: chase the flare.
      proj.heading = rotateToward(proj.heading, angleOf(sub(proj.aimPoint, proj.pos)), turnRate * dt);
    }
    proj.vel = fromAngle(proj.heading, speed);
    proj.pos.x += proj.vel.x * dt;
    proj.pos.y += proj.vel.y * dt;

    if (proj.targetId === -1 && !proj.lostLock && distance(proj.pos, p.pos) <= stats.proximity) {
      world.emit({ type: 'samDetonated', missileId: proj.id, pos: { ...proj.pos }, hitPlayer: true });
      damagePlayer(world, proj.damage, 'sam', proj.pos);
      return true;
    }
    if (proj.aimPoint && proj.lostLock && distance(proj.pos, proj.aimPoint) <= 24) {
      world.emit({ type: 'samDetonated', missileId: proj.id, pos: { ...proj.pos }, hitPlayer: false });
      return true;
    }
    if (proj.age >= proj.life) {
      world.emit({ type: 'samDetonated', missileId: proj.id, pos: { ...proj.pos }, hitPlayer: false });
      return true;
    }
    return false;
  }

  /**
   * Helicopter rockets fly straight. Air-to-air ones (no aim point) burst within `splashRadius` of a
   * Low/Medium aircraft, else fall away at the end of their range; ground salvos burst at the aim
   * point and hurt friendlies only.
   */
  private updateHeliRocket(world: World, proj: Projectile, dt: number): boolean {
    const p = world.player;
    proj.pos.x += proj.vel.x * dt;
    proj.pos.y += proj.vel.y * dt;
    const t = clamp(proj.age / proj.life, 0, 1);
    if (proj.aimPoint === null) {
      // Holds height most of the way, then drops as the motor burns out.
      proj.alt = proj.startAlt * (1 - t * t * t);
      if (p.alive && p.band !== 'high' && distance(proj.pos, p.pos) <= proj.splashRadius) {
        world.emit({ type: 'heliRocketExploded', pos: { ...proj.pos }, hitPlayer: true, ground: false });
        damagePlayer(world, proj.damage, 'splash', proj.pos);
        return true;
      }
      if (proj.age < proj.life) return false;
      world.emit({ type: 'heliRocketExploded', pos: { ...proj.pos }, hitPlayer: false, ground: true });
      return true;
    }
    proj.alt = proj.startAlt * (1 - t);
    if (proj.age < proj.life) return false;
    const at = proj.aimPoint;
    for (const entity of world.entities) {
      if (!entity.alive || entity.hidden || entity.team !== 'friendly') continue;
      if (distance(entity.pos, at) <= proj.splashRadius + entity.radius * 0.6) damageEntity(world, entity, proj.damage, 'ground');
    }
    world.emit({ type: 'heliRocketExploded', pos: { ...at }, hitPlayer: false, ground: true });
    return true;
  }

  private updateAaRound(world: World, proj: Projectile, dt: number): boolean {
    const p = world.player;
    proj.pos.x += proj.vel.x * dt;
    proj.pos.y += proj.vel.y * dt;
    const speed = Math.hypot(proj.vel.x, proj.vel.y);
    const expected = proj.startDistance / Math.max(speed, 1);
    const frac = proj.age / Math.max(expected, 1e-3);
    proj.alt = (p.alt + AIRCRAFT_BASE_HEIGHT) * Math.min(1, frac);

    // Legacy AA tracer (AA guns now fire lasers); kept for any scripted tracer fire.
    if (frac >= 0.6 && p.alive && p.band !== 'high' && distance(proj.pos, p.pos) <= AA_ROUND_HIT_RADIUS) {
      damagePlayer(world, proj.damage, 'aa', proj.pos);
      return true;
    }
    return proj.age >= proj.life;
  }
}

function releaseMissileSlot(world: World, proj: Projectile): void {
  if (proj.sourceId === null) return;
  const site = world.findById(proj.sourceId);
  if (site?.sam) site.sam.missilesInFlight = Math.max(0, site.sam.missilesInFlight - 1);
}
