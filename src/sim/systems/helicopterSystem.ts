import { ENTITY_STATS, type HeliStats } from '../../config';
import type { Entity, HeliState, Projectile } from '../entities';
import { angleDelta, angleOf, clamp, degToRad, distance, fromAngle, rotateToward, sub, type Vec2 } from '../math';
import type { World } from '../world';
import { leadPoint } from './airDefenseSystem';
import { SimSystem, type StepContext } from './simSystem';

/** Waypoint reached within this distance. */
const ARRIVE_DISTANCE = 60;
/** A route whose last point is this close to its first is flown as a loop. */
const LOOP_CLOSE_DISTANCE = 120;
/** Rockets leave the stub wings this far ahead of / beside the rotor hub. */
const LAUNCH_FORWARD = 36;
const LAUNCH_SIDE = 18;
/** Strafing slows to this fraction while the telegraph tracks (steadier aim, readable line). */
const AIMING_STRAFE = 0.5;
/** Player target id in `HeliState.targetId`. */
const PLAYER_TARGET = -1;

/**
 * Attack helicopters. Patrol a route (or loiter); when a Low/Medium player comes within range they
 * close to a stand-off, strafe sideways and fire telegraphed rocket salvos down their nose. A High
 * player is ignored, and friendlies in range get the salvos instead. The nose turns at a finite
 * rate, so a tight brake turn keeps you off it while you line up the gun.
 */
export class HelicopterSystem extends SimSystem {
  update({ world, dt }: StepContext): void {
    for (const e of world.entities) {
      if (!e.alive || e.hidden || !e.heli) continue;
      const stats = ENTITY_STATS[e.kind].heli;
      if (stats) updateHeli(world, e, e.heli, stats, dt);
    }
  }
}

function updateHeli(world: World, heli: Entity, state: HeliState, stats: HeliStats, dt: number): void {
  state.cooldown = Math.max(0, state.cooldown - dt);
  const target = chooseTarget(world, heli, state, stats);
  const targetId = target === 'player' ? PLAYER_TARGET : target ? target.id : null;
  if (targetId !== state.targetId) {
    if (state.targetId === null && targetId !== null) state.cooldown = Math.max(state.cooldown, stats.firstSalvoDelay);
    state.targetId = targetId;
    // A new target cancels the salvo in progress (rockets never fly somewhere the line didn't show).
    state.phase = 'idle';
  }

  const targetPos = target === 'player' ? world.player.pos : target ? target.pos : null;
  let noseAim: number;
  let desired: Vec2;
  if (targetPos) {
    if (target === 'player') heli.spotted = true;
    desired = engageVelocity(heli, state, stats, targetPos, dt);
    const aimAt = target === 'player' ? playerAimPoint(world, heli, state, stats) : targetPos;
    updateSalvo(world, heli, state, stats, target === 'player', aimAt, dt);
    noseAim = angleOf(sub(state.phase === 'idle' ? aimAt : state.aimPoint, heli.pos));
  } else {
    desired = patrolVelocity(heli, state, stats);
    noseAim = Math.hypot(state.vel.x, state.vel.y) > 5 ? angleOf(state.vel) : heli.heading;
  }

  heli.heading = rotateToward(heli.heading, noseAim, degToRad(stats.yawRateDeg) * dt);
  heli.turretHeading = heli.heading;

  // Inertia: velocity eases toward the desired velocity.
  const dvx = desired.x - state.vel.x;
  const dvy = desired.y - state.vel.y;
  const dv = Math.hypot(dvx, dvy);
  const maxDv = stats.accel * dt;
  if (dv > maxDv) {
    state.vel.x += (dvx / dv) * maxDv;
    state.vel.y += (dvy / dv) * maxDv;
  } else {
    state.vel.x = desired.x;
    state.vel.y = desired.y;
  }
  heli.pos.x += state.vel.x * dt;
  heli.pos.y += state.vel.y * dt;
}

/**
 * The player (Low/Medium, in range) comes first; otherwise the nearest friendly ground unit or
 * structure in range. A current target is kept out to the (longer) leash range.
 */
function chooseTarget(world: World, heli: Entity, state: HeliState, stats: HeliStats): 'player' | Entity | null {
  const p = world.player;
  const playerRange = state.targetId === PLAYER_TARGET ? stats.leashRange : stats.detectRange;
  if (p.alive && p.band !== 'high' && distance(heli.pos, p.pos) <= playerRange) return 'player';

  if (state.targetId !== null && state.targetId !== PLAYER_TARGET) {
    const current = world.findById(state.targetId);
    if (current && current.alive && !current.hidden && distance(heli.pos, current.pos) <= stats.leashRange) return current;
  }
  let best: Entity | null = null;
  let bestDist = stats.detectRange;
  for (const other of world.entities) {
    if (!other.alive || other.hidden || other.team !== 'friendly') continue;
    const otherStats = ENTITY_STATS[other.kind];
    if (!otherStats.groundTarget || otherStats.invulnerable) continue;
    const d = distance(heli.pos, other.pos);
    if (d <= bestDist) {
      best = other;
      bestDist = d;
    }
  }
  return best;
}

/** Hold the stand-off distance (radially) while strafing sideways around the target. */
function engageVelocity(heli: Entity, state: HeliState, stats: HeliStats, target: Vec2, dt: number): Vec2 {
  state.orbitFlipIn -= dt;
  if (state.orbitFlipIn <= 0) {
    state.orbit = -state.orbit;
    state.orbitFlipIn = stats.strafeFlip;
  }
  const to = sub(target, heli.pos);
  const d = Math.max(1, Math.hypot(to.x, to.y));
  const rx = to.x / d;
  const ry = to.y / d;
  const radial = clamp((d - stats.standoff) * 1.2, -stats.maxSpeed * 0.7, stats.maxSpeed);
  // Steadies while it aims, and hovers (no strafing) once the line locks: your moment to hit back.
  const locked = state.phase === 'firing' || (state.phase === 'aiming' && state.phaseTime <= stats.lockTime);
  const strafe = stats.strafeSpeed * state.orbit * (state.phase === 'idle' ? 1 : locked ? 0 : AIMING_STRAFE);
  return clampLength({ x: rx * radial - ry * strafe, y: ry * radial + rx * strafe }, stats.maxSpeed);
}

/** Fly the route (looped if closed, else once), then circle the loiter point. */
function patrolVelocity(heli: Entity, state: HeliState, stats: HeliStats): Vec2 {
  const path = state.path;
  if (path && path.length > 0) {
    let wp = path[state.waypoint];
    if (wp && distance(heli.pos, wp) <= ARRIVE_DISTANCE) {
      state.waypoint += 1;
      if (state.waypoint >= path.length) {
        const first = path[0];
        const last = path[path.length - 1];
        if (first && last && path.length > 2 && distance(first, last) <= LOOP_CLOSE_DISTANCE) {
          state.waypoint = 0;
        } else {
          state.loiter = last ? { ...last } : { ...heli.pos };
          state.path = null;
        }
      }
      wp = state.path ? state.path[state.waypoint] : undefined;
    }
    if (wp) return fromAngle(angleOf(sub(wp, heli.pos)), stats.cruiseSpeed);
  }
  // Loiter: circle the point, pulled back onto the circle if pushed off it.
  const to = sub(state.loiter, heli.pos);
  const d = Math.max(1, Math.hypot(to.x, to.y));
  const rx = to.x / d;
  const ry = to.y / d;
  const radial = clamp((d - stats.loiterRadius) * 0.8, -stats.cruiseSpeed, stats.cruiseSpeed);
  const around = stats.cruiseSpeed * 0.75;
  return clampLength({ x: rx * radial - ry * around, y: ry * radial + rx * around }, stats.cruiseSpeed);
}

/**
 * Where the salvo should go to meet the aircraft if it holds its course, counting the telegraph
 * still to run, with only part of the full lead: changing speed or heading after the line locks
 * always dodges it.
 */
function playerAimPoint(world: World, heli: Entity, state: HeliState, stats: HeliStats): Vec2 {
  const v = world.playerVelocity();
  const k = stats.leadFactor;
  const untilFire = state.phase === 'aiming' ? Math.max(0, state.phaseTime) : stats.aimTime;
  const p = world.player.pos;
  const atLaunch = { x: p.x + v.x * untilFire * k, y: p.y + v.y * untilFire * k };
  return leadPoint(heli.pos, atLaunch, { x: v.x * k, y: v.y * k }, stats.rocketSpeed);
}

/** idle → aiming (telegraph: tracks, then holds) → firing (rockets ripple down the held line) → idle. */
function updateSalvo(
  world: World,
  heli: Entity,
  state: HeliState,
  stats: HeliStats,
  atPlayer: boolean,
  aimAt: Vec2,
  dt: number,
): void {
  switch (state.phase) {
    case 'idle': {
      if (state.cooldown > 0 || state.targetId === null) return;
      const off = Math.abs(angleDelta(heli.heading, angleOf(sub(aimAt, heli.pos))));
      const inRange = distance(heli.pos, aimAt) <= stats.rocketRange * 0.95;
      if (off > degToRad(stats.fireConeDeg) || !inRange) return;
      state.phase = 'aiming';
      state.phaseTime = stats.aimTime;
      state.cooldown = stats.salvoInterval;
      state.aimPoint = { ...aimAt };
      world.emit({ type: 'heliAiming', entityId: heli.id, pos: { ...heli.pos }, atPlayer });
      return;
    }
    case 'aiming':
      state.phaseTime -= dt;
      // Track until the lock, then the line (and the aim point) hold still.
      if (state.phaseTime > stats.lockTime) state.aimPoint = { ...aimAt };
      if (state.phaseTime <= 0) {
        // Out-turned: its nose can't come round onto the held line, so the salvo never flies.
        const off = Math.abs(angleDelta(heli.heading, angleOf(sub(state.aimPoint, heli.pos))));
        if (off > degToRad(stats.fireConeDeg)) {
          state.phase = 'idle';
          return;
        }
        state.phase = 'firing';
        state.rocketsLeft = stats.rockets;
        state.phaseTime = 0;
      }
      return;
    case 'firing':
      state.phaseTime -= dt;
      while (state.phaseTime <= 0 && state.rocketsLeft > 0) {
        fireRocket(world, heli, state, stats, atPlayer);
        state.phaseTime += stats.rippleInterval;
      }
      if (state.rocketsLeft <= 0) state.phase = 'idle';
      return;
  }
}

/**
 * One rocket down the held aim line, fanned by a fixed offset (centre, left, right…). Rockets aimed
 * at the aircraft fly out to their full range and burst on proximity; rockets aimed at the ground
 * burst at the aim point.
 */
function fireRocket(world: World, heli: Entity, state: HeliState, stats: HeliStats, atPlayer: boolean): void {
  const index = stats.rockets - state.rocketsLeft;
  state.rocketsLeft -= 1;
  const fan = index === 0 ? 0 : (index % 2 === 1 ? -1 : 1) * Math.ceil(index / 2);
  const side = index % 2 === 0 ? LAUNCH_SIDE : -LAUNCH_SIDE;
  const f = fromAngle(heli.heading);
  const origin = { x: heli.pos.x + f.x * LAUNCH_FORWARD - f.y * side, y: heli.pos.y + f.y * LAUNCH_FORWARD + f.x * side };
  const heading = angleOf(sub(state.aimPoint, origin)) + degToRad(stats.spreadDeg) * fan;
  const groundDistance = Math.min(stats.rocketRange, distance(origin, state.aimPoint));
  const flight = atPlayer ? stats.rocketRange : groundDistance;
  const rocket: Projectile = {
    id: world.nextId(),
    kind: 'heliRocket',
    team: 'enemy',
    pos: origin,
    vel: fromAngle(heading, stats.rocketSpeed),
    heading,
    alt: state.height,
    age: 0,
    life: flight / stats.rocketSpeed,
    targetId: null,
    lostLock: false,
    // Ground salvos burst where they were aimed; air-to-air rockets (null) burst on proximity.
    aimPoint: atPlayer ? null : { x: origin.x + Math.cos(heading) * flight, y: origin.y + Math.sin(heading) * flight },
    damage: stats.rocketDamage,
    splashRadius: atPlayer ? stats.hitRadius : stats.groundSplash,
    sourceId: heli.id,
    startAlt: state.height,
    startDistance: flight,
  };
  world.projectiles.push(rocket);
  if (index === 0) world.emit({ type: 'heliRocketsFired', entityId: heli.id, pos: { ...origin }, heading: heli.heading });
}

function clampLength(v: Vec2, max: number): Vec2 {
  const len = Math.hypot(v.x, v.y);
  return len > max ? { x: (v.x / len) * max, y: (v.y / len) * max } : v;
}
