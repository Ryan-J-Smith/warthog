import { ENTITY_STATS } from '../../config';
import type { Entity, Projectile } from '../entities';
import { angleOf, degToRad, distance, fromAngle, rotateToward, sub, type Vec2 } from '../math';
import type { World } from '../world';
import { SimSystem, type StepContext } from './simSystem';

const TURRET_TURN_RATE = degToRad(180);

/** AA guns (burst fire with lead) and SAM sites (radar lock → launch). */
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
    aa.cooldown -= dt;
    const inRange = distance(gun.pos, p.pos) <= aa.range;
    const canEngage = p.alive && p.band !== 'high' && inRange;
    aa.engaging = canEngage;
    if (!canEngage) {
      aa.burstRemaining = 0;
      return;
    }
    gun.spotted = true;
    gun.turretHeading = rotateToward(gun.turretHeading, angleOf(sub(p.pos, gun.pos)), TURRET_TURN_RATE * dt);
    if (!gun.mover) gun.heading = gun.turretHeading;
    if (aa.cooldown > 0) return;

    if (aa.burstRemaining <= 0) {
      aa.burstRemaining = Math.max(1, Math.round(stats.roundsPerBurst * (world.aaFireRate < 1 ? 0.6 : 1)));
      world.emit({ type: 'aaBurst', entityId: gun.id, pos: { ...gun.pos } });
    }

    const lead = leadPoint(gun.pos, p.pos, world.playerVelocity(), stats.roundSpeed);
    const spread = p.band === 'low' ? stats.spreadLow : stats.spreadMedium;
    const off = world.rng.inDisc(spread);
    const aim = { x: lead.x + off.x, y: lead.y + off.y };
    const dist = distance(gun.pos, aim);
    const heading = angleOf(sub(aim, gun.pos));
    world.projectiles.push(
      enemyProjectile(world, 'aaRound', gun, heading, stats.roundSpeed, {
        life: (dist / stats.roundSpeed) * 1.35,
        damage: stats.roundDamage,
        startDistance: dist,
        targetId: -1,
      }),
    );

    aa.burstRemaining -= 1;
    aa.cooldown =
      aa.burstRemaining > 0
        ? stats.roundInterval
        : (stats.burstPause / world.aaFireRate) * world.rng.range(0.85, 1.15);
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
