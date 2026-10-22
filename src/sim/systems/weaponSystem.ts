import {
  ARMOR_MULTIPLIER,
  BOMBS,
  ENTITY_STATS,
  FLARES,
  GUN,
  MAVERICK,
  PICKUPS,
  PLAYER,
  ROCKETS,
  WEAPON_BANDS,
} from '../../config';
import type { Entity, Projectile } from '../entities';
import {
  angleDelta,
  angleOf,
  clamp,
  degToRad,
  distance,
  fromAngle,
  lerp,
  sub,
  type Vec2,
} from '../math';
import { ALTITUDE_BANDS, type ProjectileKind, type WeaponId } from '../types';
import type { World } from '../world';
import { SimSystem, type StepContext } from './simSystem';

type BlockReason = 'noAmmo' | 'tooLow' | 'tooHigh';

/** Lock-score multiplier for AA guns and SAM sites (lower = preferred). */
const MAVERICK_EMITTER_PREFERENCE = 0.5;

const BLOCK_TEXT: Record<WeaponId, Record<BlockReason, string>> = {
  gun: { noAmmo: 'NO AMMO', tooLow: 'TOO LOW', tooHigh: 'OUT OF RANGE' },
  rockets: { noAmmo: 'NO ROCKETS', tooLow: 'TOO LOW', tooHigh: 'OUT OF RANGE' },
  maverick: { noAmmo: 'NO MISSILES', tooLow: 'CLIMB TO MEDIUM', tooHigh: 'DESCEND TO MEDIUM' },
  bombs: { noAmmo: 'NO BOMBS', tooLow: 'TOO LOW', tooHigh: 'TOO HIGH' },
};

/** Which armor table each weapon uses. */
const DAMAGE_TYPE: Record<WeaponId, 'gun' | 'rocket' | 'maverick' | 'bomb'> = {
  gun: 'gun',
  rockets: 'rocket',
  maverick: 'maverick',
  bombs: 'bomb',
};

/** Player weapons: selection, firing, Maverick lock, flares, and the reticle. */
export class WeaponSystem extends SimSystem {
  private wasFiring = false;
  private gunAccumulator = 0;
  private cooldowns: Record<WeaponId, number> = { gun: 0, rockets: 0, maverick: 0, bombs: 0 };
  private flareCooldown = 0;

  update({ world, dt, input }: StepContext): void {
    const p = world.player;

    if (input.select && input.select !== p.selectedWeapon) {
      p.selectedWeapon = input.select;
      p.lockTargetId = null;
      p.lockProgress = 0;
      world.emit({ type: 'weaponSelected', weapon: input.select });
    }

    for (const w of Object.keys(this.cooldowns) as WeaponId[]) {
      this.cooldowns[w] = Math.max(0, this.cooldowns[w] - dt);
    }
    this.flareCooldown = Math.max(0, this.flareCooldown - dt);

    if (!p.firing) p.gunDip = Math.max(0, p.gunDip - GUN.dipRecovery * dt);

    const firePressed = input.fire && !this.wasFiring;
    this.wasFiring = input.fire;

    if (!p.alive) {
      this.setGunFiring(world, false);
      this.updateReticle(world);
      return;
    }

    if (input.flare) this.deployFlares(world);

    const weapon = p.selectedWeapon;
    const blocked = blockReason(world, weapon);

    if (weapon === 'maverick' && blocked === null) this.updateLock(world, dt);
    else {
      p.lockTargetId = null;
      p.lockProgress = 0;
    }

    if (firePressed && blocked !== null) {
      world.emit({ type: 'weaponUnavailable', weapon, reason: blocked });
    }

    switch (weapon) {
      case 'gun':
        this.updateGun(world, dt, input.fire && blocked === null);
        break;
      case 'rockets':
        this.setGunFiring(world, false);
        if (input.fire && blocked === null && this.cooldowns.rockets <= 0) this.fireRockets(world);
        break;
      case 'bombs':
        this.setGunFiring(world, false);
        if (input.fire && blocked === null && this.cooldowns.bombs <= 0) this.dropBomb(world);
        break;
      case 'maverick':
        this.setGunFiring(world, false);
        if (input.fire && blocked === null) {
          if (p.lockProgress >= 1 && p.lockTargetId !== null) {
            if (this.cooldowns.maverick <= 0) this.fireMaverick(world);
          } else if (firePressed) {
            world.emit({ type: 'weaponUnavailable', weapon, reason: 'noTarget' });
          }
        }
        break;
    }

    this.updateReticle(world);
  }

  // --- Gun -----------------------------------------------------------------

  private updateGun(world: World, dt: number, triggerDown: boolean): void {
    const p = world.player;
    const firing = triggerDown && p.ammo.gun > 0;
    this.setGunFiring(world, firing);
    if (!firing) {
      this.gunAccumulator = 0;
      return;
    }
    p.gunDip = Math.min(GUN.maxDip, p.gunDip + GUN.dipRate * dt);
    const t = clamp(p.alt, 0, 1);
    const pipper = gunPipper(world);
    const spread = lerp(GUN.spreadLow, GUN.spreadMedium, t);
    const overdrive = p.overdrive > 0;
    const damage =
      lerp(GUN.damageLow, GUN.damageMedium, t) * world.loadout.gunDamageMultiplier * (overdrive ? PICKUPS.overdriveDamage : 1);

    this.gunAccumulator += GUN.roundsPerSecond * (overdrive ? PICKUPS.overdriveFireRate : 1) * dt;
    while (this.gunAccumulator >= 1 && p.ammo.gun > 0) {
      this.gunAccumulator -= 1;
      p.ammo.gun -= 1;
      const off = world.rng.inDisc(spread);
      world.pendingRounds.push({
        landsAt: world.time + GUN.travelTime,
        pos: { x: pipper.x + off.x, y: pipper.y + off.y },
        damage,
      });
    }
    world.emit({ type: 'gunFiring', muzzle: muzzle(world), target: pipper, heading: p.heading });
    if (p.ammo.gun <= 0) this.setGunFiring(world, false);
  }

  private setGunFiring(world: World, firing: boolean): void {
    const p = world.player;
    if (firing === p.firing) return;
    p.firing = firing;
    world.emit({ type: firing ? 'gunStarted' : 'gunStopped' });
  }

  // --- Rockets -------------------------------------------------------------

  private fireRockets(world: World): void {
    const p = world.player;
    p.ammo.rockets -= 1;
    this.cooldowns.rockets = ROCKETS.cooldown;
    const range = rocketRange(world);
    const n = ROCKETS.perSalvo;
    for (let i = 0; i < n; i++) {
      const spread = degToRad(ROCKETS.spreadDeg) * (i - (n - 1) / 2);
      const side = (i % 2 === 0 ? 1 : -1) * 22;
      const origin = offsetFrom(p.pos, p.heading, PLAYER.hardpointOffset, side);
      const aim = offsetFrom(p.pos, p.heading + spread, range, 0);
      const dist = distance(origin, aim);
      const heading = angleOf(sub(aim, origin));
      world.projectiles.push(
        makeProjectile(world, 'rocket', origin, heading, ROCKETS.speed, {
          life: dist / ROCKETS.speed,
          aimPoint: aim,
          damage: ROCKETS.damage,
          splashRadius: ROCKETS.splash,
          startDistance: dist,
        }),
      );
    }
    world.emit({ type: 'rocketLaunched', pos: { ...p.pos }, heading: p.heading });
  }

  // --- Maverick ------------------------------------------------------------

  private updateLock(world: World, dt: number): void {
    const p = world.player;
    const target = findLockTarget(world);
    if (!target) {
      p.lockTargetId = null;
      p.lockProgress = 0;
      return;
    }
    if (target.id !== p.lockTargetId) {
      p.lockTargetId = target.id;
      p.lockProgress = 0;
      return;
    }
    const before = p.lockProgress;
    p.lockProgress = Math.min(1, p.lockProgress + dt / MAVERICK.lockTime);
    if (before < 1 && p.lockProgress >= 1) world.emit({ type: 'lockAcquired', targetId: target.id });
  }

  private fireMaverick(world: World): void {
    const p = world.player;
    const target = p.lockTargetId !== null ? world.findById(p.lockTargetId) : undefined;
    if (!target) return;
    p.ammo.maverick -= 1;
    this.cooldowns.maverick = MAVERICK.cooldown;
    const origin = offsetFrom(p.pos, p.heading, PLAYER.hardpointOffset, 0);
    world.projectiles.push(
      makeProjectile(world, 'maverick', origin, p.heading, MAVERICK.speed, {
        life: MAVERICK.life,
        targetId: target.id,
        aimPoint: { ...target.pos },
        damage: MAVERICK.damage,
        splashRadius: MAVERICK.splash,
        startDistance: Math.max(1, distance(origin, target.pos)),
      }),
    );
    p.lockTargetId = null;
    p.lockProgress = 0;
    world.emit({ type: 'missileLaunched', pos: origin, heading: p.heading });
  }

  // --- Bombs ---------------------------------------------------------------

  private dropBomb(world: World): void {
    const p = world.player;
    p.ammo.bombs -= 1;
    this.cooldowns.bombs = BOMBS.cooldown;
    const fall = bombFallTime(world);
    const aim = bombImpact(world);
    const origin = { ...p.pos };
    const dist = distance(origin, aim);
    world.projectiles.push(
      makeProjectile(world, 'bomb', origin, angleOf(sub(aim, origin)), dist / fall, {
        life: fall,
        aimPoint: aim,
        damage: BOMBS.damage,
        splashRadius: BOMBS.splash,
        startDistance: dist,
      }),
    );
    world.emit({ type: 'bombReleased', pos: origin });
  }

  // --- Flares --------------------------------------------------------------

  private deployFlares(world: World): void {
    const p = world.player;
    if (p.flares <= 0 || this.flareCooldown > 0) return;
    p.flares -= 1;
    this.flareCooldown = FLARES.cooldown;
    const velocity = world.playerVelocity();
    for (const side of [-1, 1]) {
      const dir = fromAngle(p.heading + side * 2.3, 110);
      const flare = makeProjectile(world, 'flare', p.pos, p.heading + side * 2.3, 0, { life: FLARES.life });
      flare.vel = { x: velocity.x * 0.35 + dir.x, y: velocity.y * 0.35 + dir.y };
      world.projectiles.push(flare);
    }
    // Decoy every SAM currently tracking the player.
    for (const missile of world.projectiles) {
      if (missile.kind !== 'samMissile' || missile.targetId !== -1 || missile.lostLock) continue;
      missile.targetId = null;
      missile.lostLock = true;
      missile.aimPoint = { ...p.pos };
      world.emit({ type: 'samDecoyed', missileId: missile.id, pos: { ...missile.pos } });
    }
    world.emit({ type: 'flareDeployed', pos: { ...p.pos } });
  }

  // --- Reticle -------------------------------------------------------------

  private updateReticle(world: World): void {
    const p = world.player;
    const weapon = p.selectedWeapon;
    const blocked = p.alive ? blockReason(world, weapon) : null;
    const bandBlocked = blocked === 'tooLow' || blocked === 'tooHigh';
    let impact: Vec2 | null = null;
    let onTarget = false;

    if (p.alive && !bandBlocked) {
      switch (weapon) {
        case 'gun':
          impact = gunPipper(world);
          onTarget = hostileNear(world, impact, lerp(GUN.spreadLow, GUN.spreadMedium, clamp(p.alt, 0, 1)), 'gun');
          break;
        case 'rockets':
          impact = offsetFrom(p.pos, p.heading, rocketRange(world), 0);
          onTarget = hostileNear(world, impact, ROCKETS.splash, 'rockets');
          break;
        case 'bombs':
          impact = bombImpact(world);
          onTarget = hostileNear(world, impact, BOMBS.splash * 0.6, 'bombs');
          break;
        case 'maverick': {
          const target = p.lockTargetId !== null ? world.findById(p.lockTargetId) : undefined;
          impact = target ? { ...target.pos } : null;
          onTarget = p.lockProgress >= 1;
          break;
        }
      }
    }

    world.reticle = {
      weapon,
      impact,
      ready: p.alive && blocked === null,
      onTarget,
      blockedReason: blocked ? BLOCK_TEXT[weapon][blocked] : null,
    };
  }
}

// --- Helpers (pure) ----------------------------------------------------------

export function blockReason(world: World, weapon: WeaponId): BlockReason | null {
  const p = world.player;
  if (p.ammo[weapon] <= 0) return 'noAmmo';
  const allowed = WEAPON_BANDS[weapon];
  if (allowed.includes(p.band)) return null;
  const bandIndex = ALTITUDE_BANDS.indexOf(p.band);
  const minAllowed = Math.min(...allowed.map((b) => ALTITUDE_BANDS.indexOf(b)));
  return bandIndex < minAllowed ? 'tooLow' : 'tooHigh';
}

export function gunPipper(world: World): Vec2 {
  const p = world.player;
  const dist = lerp(GUN.pipperLow, GUN.pipperMedium, clamp(p.alt, 0, 1)) * (1 - p.gunDip);
  return offsetFrom(p.pos, p.heading, dist, 0);
}

export function rocketRange(world: World): number {
  return lerp(ROCKETS.rangeLow, ROCKETS.rangeMedium, clamp(world.player.alt, 0, 1));
}

export function bombFallTime(world: World): number {
  return BOMBS.fallTimePerHeight * world.playerHeight();
}

/** Continuously computed impact point (CCIP) for a bomb released now. */
export function bombImpact(world: World): Vec2 {
  const t = bombFallTime(world);
  const v = world.playerVelocity();
  return { x: world.player.pos.x + v.x * t, y: world.player.pos.y + v.y * t };
}

function muzzle(world: World): Vec2 {
  const p = world.player;
  return offsetFrom(p.pos, p.heading, PLAYER.muzzleOffset, 0);
}

/** Point `forward` units along `heading` and `side` units to the right of it. */
function offsetFrom(pos: Vec2, heading: number, forward: number, side: number): Vec2 {
  const f = fromAngle(heading);
  return { x: pos.x + f.x * forward - f.y * side, y: pos.y + f.y * forward + f.x * side };
}

/** Is there a hostile entity this weapon can damage within `radius` of `point`? */
function hostileNear(world: World, point: Vec2, radius: number, weapon: WeaponId): boolean {
  const table = ARMOR_MULTIPLIER[DAMAGE_TYPE[weapon]];
  return world.entities.some(
    (e) =>
      e.alive &&
      !e.hidden &&
      e.team === 'enemy' &&
      table[e.armor] > 0 &&
      distance(e.pos, point) <= radius + e.radius,
  );
}

function findLockTarget(world: World): Entity | null {
  const p = world.player;
  const cone = degToRad(MAVERICK.lockConeDeg);
  let best: Entity | null = null;
  let bestScore = Infinity;
  for (const e of world.entities) {
    if (!e.alive || e.hidden || e.team !== 'enemy' || !ENTITY_STATS[e.kind].lockable) continue;
    const d = distance(p.pos, e.pos);
    if (d > MAVERICK.lockRange) continue;
    const off = Math.abs(angleDelta(p.heading, angleOf(sub(e.pos, p.pos))));
    if (off > cone) continue;
    // Keep the current target unless something is clearly better (lock stability), and let the
    // seeker favour radar/AA emitters so "Maverick the AA gun" does what the player means.
    const emitter = e.aa !== null || e.sam !== null ? MAVERICK_EMITTER_PREFERENCE : 1;
    const score = d * (1 + off * 2) * (e.id === p.lockTargetId ? 0.7 : 1) * emitter;
    if (score < bestScore) {
      best = e;
      bestScore = score;
    }
  }
  return best;
}

interface ProjectileOptions {
  life: number;
  aimPoint?: Vec2;
  targetId?: number;
  damage?: number;
  splashRadius?: number;
  startDistance?: number;
}

function makeProjectile(
  world: World,
  kind: ProjectileKind,
  pos: Vec2,
  heading: number,
  speed: number,
  options: ProjectileOptions,
): Projectile {
  const height = world.playerHeight();
  return {
    id: world.nextId(),
    kind,
    team: 'friendly',
    pos: { ...pos },
    vel: fromAngle(heading, speed),
    heading,
    alt: height,
    age: 0,
    life: options.life,
    targetId: options.targetId ?? null,
    lostLock: false,
    aimPoint: options.aimPoint ? { ...options.aimPoint } : null,
    damage: options.damage ?? 0,
    splashRadius: options.splashRadius ?? 0,
    sourceId: null,
    startAlt: height,
    startDistance: options.startDistance ?? 0,
  };
}
