import { ENTITY_STATS } from '../../config';
import type { Entity, Projectile } from '../entities';
import { angleOf, degToRad, distance, fromAngle, rotateToward, sub, type Vec2 } from '../math';
import type { World } from '../world';
import { damagePlayer } from './playerDamage';
import { SimSystem, type StepContext } from './simSystem';

const TURRET_TURN_RATE = degToRad(180);

/** AA lasers (telegraph → slewing beam) and SAM sites (radar lock → launch). */
export class AirDefenseSystem extends SimSystem {
  update({ world, dt }: StepContext): void {
    let radarLocks = 0;
    for (const e of world.entities) {
      if (!e.alive || e.hidden) continue;
      if (e.aa) this.updateAa(world, e, dt);
      if (e.sam) {
        this.updateSam(world, e, dt);
        if (e.sam.locking) radarLocks += 1;
      }
    }
    world.player.radarLocks = radarLocks;
  }

  private updateAa(world: World, gun: Entity, dt: number): void {
    const aa = gun.aa;
    const stats = ENTITY_STATS[gun.kind].aa;
    if (!aa || !stats) return;
    const p = world.player;
    const toPlayer = angleOf(sub(p.pos, gun.pos));
    const inRange = distance(gun.pos, p.pos) <= aa.range;
    const canEngage = p.alive && p.band !== 'high' && inRange;
    aa.phaseTime -= dt;
    aa.beamOnTarget = false;

    switch (aa.phase) {
      case 'idle':
        aa.beamAngle = rotateToward(aa.beamAngle, toPlayer, TURRET_TURN_RATE * dt);
        if (canEngage) {
          aa.phase = 'aiming';
          aa.phaseTime = stats.aimTime;
          gun.spotted = true;
          world.emit({ type: 'aaAiming', entityId: gun.id, pos: { ...gun.pos } });
        }
        break;
      case 'aiming':
        if (!canEngage) {
          aa.phase = 'idle';
          break;
        }
        // Track the aircraft, then hold the line for the last `lockTime` s: that's the dodge window.
        if (aa.phaseTime > stats.lockTime) aa.beamAngle = rotateToward(aa.beamAngle, toPlayer, degToRad(stats.aimTrackDeg) * dt);
        if (aa.phaseTime <= 0) {
          aa.phase = 'firing';
          aa.phaseTime = stats.beamTime;
          world.emit({ type: 'aaBeamStarted', entityId: gun.id, pos: { ...gun.pos } });
        }
        break;
      case 'firing': {
        const lowBand = p.band === 'low';
        aa.beamAngle = rotateToward(aa.beamAngle, toPlayer, degToRad(lowBand ? stats.slewDegLow : stats.slewDegMedium) * dt);
        if (canEngage && beamHits(gun.pos, aa.beamAngle, aa.range, p.pos, stats.hitHalfWidth)) {
          aa.beamOnTarget = true;
          damagePlayer(world, (lowBand ? stats.dpsLow : stats.dpsMedium) * dt, 'beam', p.pos);
        }
        if (aa.phaseTime <= 0 || !p.alive || p.band === 'high') {
          aa.phase = 'cooldown';
          aa.phaseTime = stats.cooldown / world.aaFireRate;
          world.emit({ type: 'aaBeamStopped', entityId: gun.id });
        }
        break;
      }
      case 'cooldown':
        aa.beamAngle = rotateToward(aa.beamAngle, toPlayer, TURRET_TURN_RATE * 0.5 * dt);
        if (aa.phaseTime <= 0) aa.phase = 'idle';
        break;
    }
    aa.engaging = aa.phase === 'aiming' || aa.phase === 'firing';
    gun.turretHeading = aa.beamAngle;
    if (!gun.mover) gun.heading = gun.turretHeading;
  }

  private updateSam(world: World, site: Entity, dt: number): void {
    const sam = site.sam;
    const stats = ENTITY_STATS[site.kind].sam;
    if (!sam || !stats) return;
    const p = world.player;
    sam.reload = Math.max(0, sam.reload - dt);
    const canTrack = p.alive && p.band !== 'low' && distance(site.pos, p.pos) <= sam.range;

    if (!canTrack) {
      if (sam.locking) {
        sam.locking = false;
        sam.lock = 0;
        world.emit({ type: 'samLockBroken', siteId: site.id });
      }
      return;
    }

    site.spotted = true;
    sam.launcherHeading = rotateToward(sam.launcherHeading, angleOf(sub(p.pos, site.pos)), degToRad(90) * dt);
    if (!sam.locking) {
      sam.locking = true;
      world.emit({ type: 'samLockStarted', siteId: site.id, pos: { ...site.pos } });
    }
    sam.lock = Math.min(1, sam.lock + dt / stats.lockTime);

    if (sam.lock >= 1 && sam.reload <= 0 && sam.missilesInFlight < stats.maxInFlight) {
      const heading = angleOf(sub(p.pos, site.pos));
      const missile = enemyProjectile(world, 'samMissile', site, heading, stats.missileStartSpeed, {
        life: stats.life,
        damage: stats.damage,
        startDistance: distance(site.pos, p.pos),
        targetId: -1,
      });
      world.projectiles.push(missile);
      sam.missilesInFlight += 1;
      sam.reload = stats.reload;
      sam.lock = 0.5;
      world.emit({ type: 'samLaunched', siteId: site.id, missileId: missile.id, pos: { ...site.pos } });
    }
  }
}

/** Is `target` within `halfWidth` of the beam from `from` along `angle`, up to `range` (+ slack)? */
export function beamHits(from: Vec2, angle: number, range: number, target: Vec2, halfWidth: number): boolean {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const along = dx * Math.cos(angle) + dy * Math.sin(angle);
  if (along < 0 || along > range + halfWidth) return false;
  const across = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
  return across <= halfWidth;
}

/** Where to aim so a projectile at `speed` meets a target moving at `velocity`. */
export function leadPoint(from: Vec2, target: Vec2, velocity: Vec2, speed: number): Vec2 {
  let t = distance(from, target) / speed;
  let predicted = target;
  for (let i = 0; i < 3; i++) {
    predicted = { x: target.x + velocity.x * t, y: target.y + velocity.y * t };
    t = distance(from, predicted) / speed;
  }
  return predicted;
}

interface EnemyProjectileOptions {
  life: number;
  damage: number;
  startDistance: number;
  targetId: number | null;
}

function enemyProjectile(
  world: World,
  kind: 'aaRound' | 'samMissile',
  source: Entity,
  heading: number,
  speed: number,
  options: EnemyProjectileOptions,
): Projectile {
  return {
    id: world.nextId(),
    kind,
    team: 'enemy',
    pos: { ...source.pos },
    vel: fromAngle(heading, speed),
    heading,
    alt: 0,
    age: 0,
    life: options.life,
    targetId: options.targetId,
    lostLock: false,
    aimPoint: null,
    damage: options.damage,
    splashRadius: 0,
    sourceId: source.id,
    startAlt: 0,
    startDistance: options.startDistance,
  };
}
