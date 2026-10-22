import { BAND_ALTITUDE, BOOST, BRAKE, CLIMB_RATE, DIVE_RATE, ENERGY, PLAYER, TURN_EASE, bandOf, bandProfileAt } from '../../config';
import { approach, clamp, degToRad, rotateToward } from '../math';
import { ALTITUDE_BANDS, type AltitudeBand } from '../types';
import { SimSystem, type StepContext } from './simSystem';

/** Player flight: altitude bands, energy, boost and air brake, eased turning, map boundary. */
export class FlightSystem extends SimSystem {
  update({ world, dt, input }: StepContext): void {
    const p = world.player;
    if (!p.alive) {
      this.setBoosting(world, false);
      this.setBraking(world, false);
      return;
    }

    // Band selection (edge-triggered).
    if (input.climb) this.stepBand(world, +1);
    if (input.dive) this.stepBand(world, -1);

    // Altitude moves toward the target band; energy reacts to the direction of travel.
    const targetAlt = BAND_ALTITUDE[p.targetBand];
    const climbing = targetAlt > p.alt + 1e-6;
    const diving = targetAlt < p.alt - 1e-6;
    p.alt = approach(p.alt, targetAlt, (diving ? DIVE_RATE : CLIMB_RATE) * dt);
    if (climbing) p.energy = approach(p.energy, 1 - ENERGY.climbPenalty, dt);
    else if (diving) p.energy = approach(p.energy, 1 + ENERGY.diveBonus, 1.5 * dt);
    else p.energy = approach(p.energy, 1, ENERGY.recoveryPerSecond * dt);

    const band = bandOf(p.alt);
    if (band !== p.band) {
      world.emit({ type: 'bandChanged', from: p.band, to: band });
      p.band = band;
    }

    // Brake wins over boost when both are held.
    this.setBraking(world, input.brake);
    this.updateBoost(world, dt, input.boost && !input.brake);

    // Speed and turning from the interpolated profile.
    const profile = bandProfileAt(p.alt);
    let speedTarget = profile.speed * p.energy;
    let turnMultiplier = world.loadout.turnRateMultiplier;
    let accel: number = PLAYER.acceleration;
    if (p.boosting) {
      speedTarget *= BOOST.speedMultiplier;
      turnMultiplier *= BOOST.turnMultiplier;
      accel = BOOST.acceleration;
    } else if (p.braking) {
      speedTarget = profile.speed * BRAKE.speedFactor;
      turnMultiplier *= BRAKE.turnMultiplier;
      accel = BRAKE.deceleration;
    } else if (p.speed > speedTarget + 1) {
      // Coming off the afterburner: bleed the extra speed off quickly but not instantly.
      accel = BOOST.acceleration * 0.5;
    }
    p.speed = approach(p.speed, speedTarget, accel * dt);

    // Eased turning: angular velocity ramps toward the stick instead of snapping to full rate.
    const maxRate = degToRad(profile.turnRateDeg) * turnMultiplier;
    const turn = clamp(input.turn, -1, 1);
    const wanted = turn * maxRate;
    const easing = Math.abs(wanted) > Math.abs(p.turnRate) && Math.sign(wanted) !== -Math.sign(p.turnRate) ? TURN_EASE.rampIn : TURN_EASE.rampOut;
    p.turnRate = approach(p.turnRate, wanted, (maxRate / easing) * dt);
    // Never exceed the current max (e.g. after releasing the brake mid-turn).
    p.turnRate = clamp(p.turnRate, -maxRate, maxRate);
    p.turnInput = maxRate > 0 ? clamp(p.turnRate / degToRad(profile.turnRateDeg), -1.4, 1.4) / 1.4 : 0;

    const m = PLAYER.boundaryMargin;
    const outside = p.pos.x < m || p.pos.y < m || p.pos.x > world.width - m || p.pos.y > world.height - m;
    if (outside) {
      // Steer back toward the map centre, overriding the stick.
      const toCentre = Math.atan2(world.height / 2 - p.pos.y, world.width / 2 - p.pos.x);
      p.heading = rotateToward(p.heading, toCentre, maxRate * dt);
      p.turnRate = 0;
    } else {
      p.heading += p.turnRate * dt;
    }

    p.pos.x = clamp(p.pos.x + Math.cos(p.heading) * p.speed * dt, 0, world.width);
    p.pos.y = clamp(p.pos.y + Math.sin(p.heading) * p.speed * dt, 0, world.height);
  }

  private updateBoost(world: StepContext['world'], dt: number, wanted: boolean): void {
    const p = world.player;
    const free = p.boostFree > 0;
    const can = wanted && (free || p.boost > 0);
    if (can) {
      if (!free) {
        p.boost = Math.max(0, p.boost - dt);
        if (p.boost === 0) world.emit({ type: 'boostEmpty' });
      }
      this.regenIn = BOOST.regenDelay;
    } else {
      this.regenIn = Math.max(0, this.regenIn - dt);
      if (this.regenIn === 0) p.boost = Math.min(p.maxBoost, p.boost + world.loadout.boostRegen * dt);
    }
    this.setBoosting(world, can && (free || p.boost > 0));
  }

  private regenIn = 0;

  private setBoosting(world: StepContext['world'], on: boolean): void {
    const p = world.player;
    if (p.boosting === on) return;
    p.boosting = on;
    world.emit({ type: on ? 'boostStarted' : 'boostStopped' });
  }

  private setBraking(world: StepContext['world'], on: boolean): void {
    const p = world.player;
    if (p.braking === on) return;
    p.braking = on;
    world.emit({ type: on ? 'brakeStarted' : 'brakeStopped' });
  }

  private stepBand(world: StepContext['world'], direction: 1 | -1): void {
    const p = world.player;
    const index = ALTITUDE_BANDS.indexOf(p.targetBand) + direction;
    const next: AltitudeBand | undefined = ALTITUDE_BANDS[index];
    if (next === undefined || next === p.targetBand) return;
    p.targetBand = next;
    world.emit({ type: 'targetBandChanged', to: next });
  }
}
