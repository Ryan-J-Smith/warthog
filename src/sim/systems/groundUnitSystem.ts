import { CONVOY_GAP, ENTITY_STATS } from '../../config';
import { damageEntity } from '../combat';
import type { Entity } from '../entities';
import { angleOf, degToRad, distance, rotateToward, sub } from '../math';
import type { World } from '../world';
import { SimSystem, type StepContext } from './simSystem';

const ARRIVE_DISTANCE = 6;
const TURRET_TURN_RATE = degToRad(90);

/** Ground units: path driving with convoy spacing, and shooting at opposing ground targets. */
export class GroundUnitSystem extends SimSystem {
  update({ world, dt }: StepContext): void {
    for (const unit of world.entities) {
      if (!unit.alive || unit.hidden) continue;
      if (unit.attacker) this.updateAttacker(world, unit, dt);
      if (unit.mover && !unit.mover.halted) {
        const engaged = unit.attacker !== null && unit.attacker.targetId !== null;
        if (!engaged) this.drive(world, unit, dt);
      }
    }
  }

  private updateAttacker(world: World, unit: Entity, dt: number): void {
    const attacker = unit.attacker;
    if (!attacker) return;
    const stats = ENTITY_STATS[unit.kind].attacker;
    if (!stats) return;
    attacker.cooldown -= dt;

    let target = attacker.targetId !== null ? world.findById(attacker.targetId) : undefined;
    if (!target || !target.alive || edgeDistance(unit, target) > attacker.range) {
      target = acquireTarget(world, unit, attacker.range);
    }
    attacker.targetId = target ? target.id : null;
    if (!target) return;

    const aim = angleOf(sub(target.pos, unit.pos));
    unit.turretHeading = rotateToward(unit.turretHeading, aim, TURRET_TURN_RATE * dt);
    if (!unit.mover) unit.heading = unit.turretHeading;

    if (attacker.cooldown <= 0) {
      attacker.cooldown = stats.cooldown * world.rng.range(0.8, 1.25);
      const miss = world.rng.inDisc(target.radius * 0.8);
      const to = { x: target.pos.x + miss.x, y: target.pos.y + miss.y };
      world.emit({ type: 'groundFire', shooterKind: unit.kind, from: { ...unit.pos }, to });
      damageEntity(world, target, stats.damage, 'ground');
    }
  }

  private drive(world: World, unit: Entity, dt: number): void {
    const mover = unit.mover;
    if (!mover) return;
    const waypoint = mover.path[mover.waypoint];
    if (!waypoint) {
      mover.halted = true;
      return;
    }
    const to = sub(waypoint, unit.pos);
    const dist = Math.hypot(to.x, to.y);
    if (dist <= ARRIVE_DISTANCE) {
      if (mover.stopAtWaypoint === mover.waypoint) {
        mover.halted = true;
        return;
      }
      mover.waypoint += 1;
      if (mover.waypoint >= mover.path.length) mover.halted = true;
      return;
    }
    const heading = angleOf(to);
    if (blockedAhead(world, unit, heading)) return;

    const turnRate = degToRad(ENTITY_STATS[unit.kind].turnRateDeg);
    const before = unit.heading;
    unit.heading = rotateToward(unit.heading, heading, turnRate * dt);
    // Turrets ride along with the hull when not engaging.
    unit.turretHeading += unit.heading - before;
    const step = Math.min(dist, mover.speed * dt);
    unit.pos.x += (to.x / dist) * step;
    unit.pos.y += (to.y / dist) * step;
  }
}

/** Distance between the edges of two bodies. */
function edgeDistance(a: Entity, b: Entity): number {
  return distance(a.pos, b.pos) - b.radius;
}

function acquireTarget(world: World, unit: Entity, range: number): Entity | undefined {
  let best: Entity | undefined;
  let bestDist = Infinity;
  for (const other of world.entities) {
    if (!other.alive || other.hidden || other.team === unit.team || other.team === 'neutral') continue;
    if (!ENTITY_STATS[other.kind].groundTarget) continue;
    const d = edgeDistance(unit, other);
    if (d <= range && d < bestDist) {
      best = other;
      bestDist = d;
    }
  }
  return best;
}

/** Wait if another living vehicle is just ahead (keeps convoys from stacking). */
function blockedAhead(world: World, unit: Entity, heading: number): boolean {
  const fx = Math.cos(heading);
  const fy = Math.sin(heading);
  for (const other of world.entities) {
    if (other === unit || !other.alive || !other.mover) continue;
    const dx = other.pos.x - unit.pos.x;
    const dy = other.pos.y - unit.pos.y;
    const d = Math.hypot(dx, dy);
    if (d > CONVOY_GAP || d < 1e-6) continue;
    if ((dx * fx + dy * fy) / d > 0.6) return true;
  }
  return false;
}
