import { ENTITY_STATS } from '../../config';
import type { Entity } from '../entities';
import type { EntitySpawn, GroupSpawn } from '../level';
import { angleOf, clone, degToRad, normalize, sub, type Vec2 } from '../math';
import type { EntityKind } from '../types';
import type { World } from '../world';

interface CreateOptions {
  refId?: string | undefined;
  headingRad?: number;
  tags?: readonly string[] | undefined;
  path?: Vec2[] | null;
  speed?: number | undefined;
  hidden?: boolean | undefined;
}

/** Build a fully initialised entity from its kind's stats. Does not add it to the world. */
export function createEntity(world: World, kind: EntityKind, pos: Vec2, options: CreateOptions = {}): Entity {
  const stats = ENTITY_STATS[kind];
  const heading = options.headingRad ?? 0;
  const path = options.path ?? null;
  return {
    id: world.nextId(),
    refId: options.refId ?? null,
    kind,
    team: stats.team,
    armor: stats.armor,
    pos: clone(pos),
    heading,
    turretHeading: heading,
    hp: stats.hp,
    maxHp: stats.hp,
    alive: true,
    radius: stats.radius,
    spotted: false,
    hidden: options.hidden ?? false,
    tags: [...(options.tags ?? [])],
    diedAt: null,
    // Helicopters fly their route with their own brain instead of driving it.
    mover: path && !stats.heli
      ? { path, waypoint: 0, speed: options.speed ?? stats.speed, halted: false, stopAtWaypoint: null }
      : null,
    aa: stats.aa
      ? { range: stats.aa.range, phase: 'idle', phaseTime: 0, beamAngle: heading, beamOnTarget: false, engaging: false }
      : null,
    sam: stats.sam
      ? { range: stats.sam.range, lock: 0, locking: false, reload: 0, missilesInFlight: 0, launcherHeading: heading }
      : null,
    attacker: stats.attacker ? { targetId: null, range: stats.attacker.range, cooldown: world.rng.range(0, stats.attacker.cooldown) } : null,
    heli: stats.heli
      ? {
          path,
          waypoint: 0,
          loiter: clone(pos),
          vel: { x: Math.cos(heading) * stats.heli.cruiseSpeed, y: Math.sin(heading) * stats.heli.cruiseSpeed },
          targetId: null,
          phase: 'idle',
          phaseTime: 0,
          cooldown: 0,
          aimPoint: clone(pos),
          rocketsLeft: 0,
          orbit: 1,
          orbitFlipIn: stats.heli.strafeFlip,
          height: stats.heli.height,
        }
      : null,
    mlrs: stats.mlrs ? { targetId: null, cooldown: 0, strikes: [], barrages: 0 } : null,
  };
}

/** Spawn an entity placed in the level definition. */
export function spawnFromDefinition(world: World, spawn: EntitySpawn): Entity {
  const path = spawn.pathId ? world.level.paths[spawn.pathId] ?? null : null;
  const entity = createEntity(world, spawn.kind, spawn.pos, {
    refId: spawn.refId,
    headingRad: degToRad(spawn.headingDeg ?? 0),
    tags: spawn.tags,
    path: path ? path.map(clone) : null,
    speed: spawn.speed,
    hidden: spawn.hidden,
  });
  world.entities.push(entity);
  return entity;
}

/**
 * Spawn a group in single file behind the first waypoint of its path, facing along the path.
 * Units start "upstream" of the path start (off-map for edge entries) and drive in.
 */
export function spawnGroup(world: World, group: GroupSpawn): Entity[] {
  const path = world.level.paths[group.pathId];
  if (!path || path.length < 2) throw new Error(`Group ${group.id}: missing path ${group.pathId}`);
  const [p0, p1] = path as [Vec2, Vec2, ...Vec2[]];
  const dir = normalize(sub(p1, p0));
  const heading = angleOf(dir);
  const spawned = group.units.map((unit, i) => {
    const pos = { x: p0.x - dir.x * group.spacing * i, y: p0.y - dir.y * group.spacing * i };
    const entity = createEntity(world, unit.kind, pos, {
      refId: unit.refId,
      headingRad: heading,
      tags: [...group.tags, ...(unit.tags ?? [])],
      path: path.map(clone),
      speed: group.speed,
    });
    world.entities.push(entity);
    return entity;
  });
  world.spawnedGroups.add(group.id);
  return spawned;
}
