import { ARMOR_MULTIPLIER, ENTITY_STATS, SCORING, SECONDARIES } from '../../config';
import type { Entity } from '../entities';
import { distance, type Vec2 } from '../math';
import type { World } from '../world';
import { registerKill } from './rewards';

/** What dealt the damage: drives armor multipliers, scoring and friendly-fire accounting. */
export type DamageSource = 'gun' | 'rocket' | 'maverick' | 'bomb' | 'ground' | 'secondary';

/** Player-launched sources score points and can cause friendly fire. */
function isPlayerSource(source: DamageSource): boolean {
  return source === 'gun' || source === 'rocket' || source === 'maverick' || source === 'bomb';
}

/** Airborne targets (helicopters) are only hit by the GAU-8 and rocket blasts. */
function hitsAirborne(source: DamageSource): boolean {
  return source === 'gun' || source === 'rocket';
}

/**
 * Apply damage to an entity, handling armor, death, scoring and friendly fire.
 * Returns the damage actually dealt after armor.
 */
export function damageEntity(world: World, entity: Entity, rawDamage: number, source: DamageSource): number {
  if (!entity.alive || entity.hidden) return 0;
  const stats = ENTITY_STATS[entity.kind];
  if (stats.invulnerable) return 0;
  if (stats.airborne && !hitsAirborne(source)) return 0;
  const amount = rawDamage * ARMOR_MULTIPLIER[source][entity.armor];
  if (amount <= 0) return 0;

  const dealt = Math.min(entity.hp, amount);
  entity.hp -= amount;
  const byPlayer = isPlayerSource(source);
  if (byPlayer && entity.team === 'friendly') {
    const penalty = Math.round(dealt * SCORING.friendlyDamagePenalty);
    world.stats.friendlyFirePenalty += penalty;
    world.score -= penalty;
  }
  world.emit({ type: 'entityDamaged', entityId: entity.id, kind: entity.kind, pos: entity.pos, amount: dealt });

  if (entity.hp <= 0) killEntity(world, entity, byPlayer);
  return dealt;
}

/** Destroy an entity outright (also used for units falling off a destroyed bridge). */
export function killEntity(world: World, entity: Entity, byPlayer: boolean): void {
  if (!entity.alive) return;
  const stats = ENTITY_STATS[entity.kind];
  entity.alive = false;
  entity.hp = 0;
  entity.diedAt = world.time;
  if (entity.mover) entity.mover.halted = true;
  world.emit({
    type: 'entityDestroyed',
    entityId: entity.id,
    kind: entity.kind,
    team: entity.team,
    pos: entity.pos,
    size: stats.explosion,
  });

  if (byPlayer) {
    if (entity.team === 'enemy' && stats.score > 0) {
      const points = Math.round(stats.score * registerKill(world, entity));
      world.stats.kills += 1;
      world.stats.killsByKind[entity.kind] = (world.stats.killsByKind[entity.kind] ?? 0) + 1;
      world.stats.killPoints += points;
      world.score += points;
      world.emit({ type: 'scoreAwarded', points, reason: entity.kind, pos: entity.pos });
    } else if (entity.team === 'friendly') {
      world.stats.friendlyFirePenalty += SCORING.friendlyKillPenalty;
      world.score -= SCORING.friendlyKillPenalty;
      world.emit({ type: 'scoreAwarded', points: -SCORING.friendlyKillPenalty, reason: 'friendly fire', pos: entity.pos });
    }
  }

  if (entity.kind === 'ammoDump') scheduleCookOff(world, entity.pos);
}

/** Damage every entity whose body overlaps the blast. Returns the number of entities hit. */
export function applySplash(world: World, center: Vec2, radius: number, damage: number, source: DamageSource): number {
  let hits = 0;
  // Snapshot: kills during the loop may schedule more work but never add entities.
  for (const entity of world.entities) {
    if (!entity.alive || entity.hidden) continue;
    if (distance(entity.pos, center) <= radius + entity.radius * 0.6) {
      if (damageEntity(world, entity, damage, source) > 0) hits += 1;
    }
  }
  return hits;
}

/** Can `source` actually hurt this entity? */
export function canDamage(entity: Entity, source: DamageSource): boolean {
  const stats = ENTITY_STATS[entity.kind];
  if (stats.airborne && !hitsAirborne(source)) return false;
  return !stats.invulnerable && ARMOR_MULTIPLIER[source][entity.armor] > 0;
}

/**
 * The entity (if any) that a point impact at `pos` hits, preferring the closest body.
 * An optional filter restricts candidates (e.g. to entities the weapon can damage).
 */
export function entityAt(world: World, pos: Vec2, slop: number, filter?: (entity: Entity) => boolean): Entity | null {
  let best: Entity | null = null;
  let bestDist = Infinity;
  for (const entity of world.entities) {
    if (!entity.alive || entity.hidden) continue;
    if (filter && !filter(entity)) continue;
    const d = distance(entity.pos, pos);
    if (d <= entity.radius + slop && d < bestDist) {
      best = entity;
      bestDist = d;
    }
  }
  return best;
}

function scheduleCookOff(world: World, pos: Vec2): void {
  for (let i = 0; i < SECONDARIES.count; i++) {
    const offset = world.rng.inDisc(SECONDARIES.scatter);
    world.pendingSecondaries.push({
      at: world.time + 0.25 + (SECONDARIES.duration * i) / SECONDARIES.count + world.rng.range(0, 0.2),
      pos: { x: pos.x + offset.x, y: pos.y + offset.y },
    });
  }
}
