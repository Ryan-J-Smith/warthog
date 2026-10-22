import { ENTITY_STATS, type MlrsStats } from '../../config';
import { damageEntity } from '../combat';
import type { Entity, MlrsState, MlrsStrike, Projectile } from '../entities';
import { angleOf, clamp, distance, sub, type Vec2 } from '../math';
import type { World } from '../world';
import { damagePlayer } from './playerDamage';
import { SimSystem, type StepContext } from './simSystem';

/** Player target id in `MlrsState.targetId`. */
const PLAYER_TARGET = -1;
/** Rockets leave the launcher box this far ahead of the vehicle centre. */
const LAUNCH_FORWARD = 22;
/** Arc height scales with range between these fractions of `arcHeight` (short lobs stay low). */
const ARC_RANGE = 1200;
/** Float slack when comparing sim time to a scheduled time. */
const EPS = 1e-6;

/**
 * MLRS rocket artillery. Parked (or parked after driving its route), every `barrageInterval` s it
 * shows a fixed pattern of impact rings and ripples rockets onto them: rings land exactly where
 * they are drawn, at the time their countdown runs out. A Low/Medium aircraft in range is shelled
 * at a partial lead of its course (turn, boost or climb out of the rings); otherwise the nearest
 * friendly ground unit or structure. No hidden randomness: the pattern and lead are fixed.
 */
export class MlrsSystem extends SimSystem {
  update({ world, dt }: StepContext): void {
    for (const e of world.entities) {
      if (!e.mlrs) continue;
      const stats = ENTITY_STATS[e.kind].mlrs;
      if (!stats) continue;
      updateStrikes(world, e, e.mlrs, stats);
      if (e.alive && !e.hidden) updateLauncher(world, e, e.mlrs, stats, dt);
    }
  }
}

/** Launch rockets whose time has come and resolve the rings they land on. */
function updateStrikes(world: World, launcher: Entity, state: MlrsState, stats: MlrsStats): void {
  if (state.strikes.length === 0) return;
  // A dead launcher fires nothing more; rockets already in the air still land on their rings.
  if (!launcher.alive) state.strikes = state.strikes.filter((s) => s.launched);
  let firstLaunch = true;
  for (const s of state.strikes) if (s.launched) firstLaunch = false;
  for (const strike of state.strikes) {
    if (strike.launched || world.time < strike.launchAt - EPS) continue;
    launch(world, launcher, strike, stats);
    if (firstLaunch) {
      world.emit({ type: 'mlrsLaunched', entityId: launcher.id, pos: { ...launcher.pos }, heading: launcher.heading, atPlayer: strike.atPlayer });
      firstLaunch = false;
    }
  }
  state.strikes = state.strikes.filter((strike) => {
    if (!strike.launched || world.time < strike.impactAt - EPS) return true;
    impact(world, strike, stats);
    return false;
  });
}

function updateLauncher(world: World, launcher: Entity, state: MlrsState, stats: MlrsStats, dt: number): void {
  state.cooldown = Math.max(0, state.cooldown - dt);
  const target = chooseTarget(world, launcher, state, stats);
  const targetId = target === 'player' ? PLAYER_TARGET : target ? target.id : null;
  if (state.targetId === null && targetId !== null) state.cooldown = Math.max(state.cooldown, stats.firstBarrageDelay);
  state.targetId = targetId;

  // It only fires parked (outriggers down): a launcher on the move gets its delay back.
  const parked = !launcher.mover || launcher.mover.halted;
  if (!parked && targetId !== null) state.cooldown = Math.max(state.cooldown, stats.firstBarrageDelay);
  if (!parked || !target || state.cooldown > 0 || state.strikes.length > 0) return;
  startBarrage(world, launcher, state, stats, target);
}

/**
 * The aircraft (Low/Medium, between min and max range) comes first; otherwise the nearest friendly
 * ground unit or structure in range. A current friendly target is kept while it lives and is in range.
 */
function chooseTarget(world: World, launcher: Entity, state: MlrsState, stats: MlrsStats): 'player' | Entity | null {
  const p = world.player;
  const toPlayer = distance(launcher.pos, p.pos);
  if (p.alive && p.band !== 'high' && toPlayer <= stats.playerRange && toPlayer > stats.minRange) return 'player';

  if (state.targetId !== null && state.targetId !== PLAYER_TARGET) {
    const current = world.findById(state.targetId);
    if (current && current.alive && !current.hidden && distance(launcher.pos, current.pos) <= stats.groundRange) return current;
  }
  let best: Entity | null = null;
  let bestDist = stats.groundRange;
  for (const other of world.entities) {
    if (!other.alive || other.hidden || other.team !== 'friendly') continue;
    const otherStats = ENTITY_STATS[other.kind];
    if (!otherStats.groundTarget || otherStats.invulnerable) continue;
    const d = distance(launcher.pos, other.pos);
    if (d <= bestDist) {
      best = other;
      bestDist = d;
    }
  }
  return best;
}

/**
 * Put the barrage's rings on the ground. Against the aircraft the pattern is centred on a partial
 * lead of its course to the last impact and turned to its heading; against a friendly it is centred
 * on the target and turned along the line of fire.
 */
function startBarrage(world: World, launcher: Entity, state: MlrsState, stats: MlrsStats, target: 'player' | Entity): void {
  const atPlayer = target === 'player';
  const t0 = world.time;
  const n = stats.pattern.length;
  const lastImpact = stats.telegraphTime + (n - 1) * stats.rippleInterval;
  let center: Vec2;
  let heading: number;
  if (target === 'player') {
    const p = world.player;
    const v = world.playerVelocity();
    const lead = lastImpact * stats.leadFactor;
    center = { x: p.pos.x + v.x * lead, y: p.pos.y + v.y * lead };
    heading = p.heading;
  } else {
    center = { ...target.pos };
    heading = angleOf(sub(target.pos, launcher.pos));
  }
  const scale = atPlayer ? 1 : stats.groundPatternScale;
  state.strikes = barragePattern(center, heading, stats, scale).map((pos, i) => {
    const impactAt = t0 + stats.telegraphTime + i * stats.rippleInterval;
    return {
      pos,
      radius: stats.ringRadius,
      shownAt: t0,
      launchAt: Math.max(t0, impactAt - stats.flightTime),
      impactAt,
      launched: false,
      rocketId: null,
      atPlayer,
    };
  });
  state.cooldown = stats.barrageInterval / world.difficulty.enemyFireRate;
  state.barrages += 1;
  // A ripple launch gives its position away.
  if (!launcher.spotted) {
    launcher.spotted = true;
    world.emit({ type: 'entitySpotted', entityId: launcher.id, kind: launcher.kind });
  }
  world.emit({ type: 'mlrsTargeting', entityId: launcher.id, pos: { ...launcher.pos }, atPlayer, center: { ...center } });
}

/** The fixed ring pattern around `center`, turned to `heading` and scaled by `scale`, in impact order. */
export function barragePattern(center: Vec2, heading: number, stats: MlrsStats, scale = 1): Vec2[] {
  const fx = Math.cos(heading) * scale;
  const fy = Math.sin(heading) * scale;
  return stats.pattern.map((o) => ({
    x: center.x + fx * o.forward - fy * o.side,
    y: center.y + fy * o.forward + fx * o.side,
  }));
}

/** One rocket, launcher → ring. It is only the visual: the strike resolves the impact. */
function launch(world: World, launcher: Entity, strike: MlrsStrike, stats: MlrsStats): void {
  strike.launched = true;
  const origin = {
    x: launcher.pos.x + Math.cos(launcher.heading) * LAUNCH_FORWARD,
    y: launcher.pos.y + Math.sin(launcher.heading) * LAUNCH_FORWARD,
  };
  // Aged once in this same step by the projectile system: one extra step so it lands with the ring.
  const flight = Math.max(1 / 60, strike.impactAt - world.time + 1 / 60);
  const to = sub(strike.pos, origin);
  const range = Math.hypot(to.x, to.y);
  const rocket: Projectile = {
    id: world.nextId(),
    kind: 'mlrsRocket',
    team: 'enemy',
    pos: origin,
    vel: { x: to.x / flight, y: to.y / flight },
    heading: angleOf(to),
    alt: 0,
    age: 0,
    life: flight,
    targetId: null,
    lostLock: false,
    aimPoint: { ...strike.pos },
    damage: 0,
    splashRadius: strike.radius,
    sourceId: launcher.id,
    // Apex of the arc (band units).
    startAlt: stats.arcHeight * clamp(range / ARC_RANGE, 0.45, 1.25),
    startDistance: range,
  };
  world.projectiles.push(rocket);
  strike.rocketId = rocket.id;
}

/** A ring lands: the aircraft inside it (Low/Medium) and friendlies under it are hit. */
function impact(world: World, strike: MlrsStrike, stats: MlrsStats): void {
  const p = world.player;
  const hitPlayer = p.alive && p.band !== 'high' && distance(p.pos, strike.pos) <= strike.radius;
  world.emit({ type: 'mlrsImpact', pos: { ...strike.pos }, radius: strike.radius, hitPlayer });
  if (hitPlayer) damagePlayer(world, stats.playerDamage, 'splash', strike.pos);
  for (const entity of world.entities) {
    if (!entity.alive || entity.hidden || entity.team !== 'friendly') continue;
    if (distance(entity.pos, strike.pos) <= strike.radius + entity.radius * 0.6) damageEntity(world, entity, stats.groundDamage, 'ground');
  }
}
