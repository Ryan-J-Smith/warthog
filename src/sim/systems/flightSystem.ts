import { BAND_ALTITUDE, CLIMB_RATE, DIVE_RATE, ENERGY, PLAYER, bandOf, bandProfileAt } from '../../config';
import { approach, clamp, degToRad, rotateToward } from '../math';
import { ALTITUDE_BANDS, type AltitudeBand } from '../types';
import { SimSystem, type StepContext } from './simSystem';

/** Player flight: altitude bands, energy, speed, turning, map boundary. */
export class FlightSystem extends SimSystem {
  update({ world, dt, input }: StepContext): void {
    const p = world.player;
    if (!p.alive) return;

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

    // Speed and turning from the interpolated profile.
    const profile = bandProfileAt(p.alt);
    p.speed = approach(p.speed, profile.speed * p.energy, PLAYER.acceleration * dt);
    const turnRate = degToRad(profile.turnRateDeg);
    const turn = clamp(input.turn, -1, 1);
    p.turnInput = approach(p.turnInput, turn, 4 * dt);

    const m = PLAYER.boundaryMargin;
    const outside = p.pos.x < m || p.pos.y < m || p.pos.x > world.width - m || p.pos.y > world.height - m;
    if (outside) {
      // Steer back toward the map centre, overriding the stick.
      const toCentre = Math.atan2(world.height / 2 - p.pos.y, world.width / 2 - p.pos.x);
      p.heading = rotateToward(p.heading, toCentre, turnRate * dt);
    } else {
      p.heading += turn * turnRate * dt;
    }

    p.pos.x = clamp(p.pos.x + Math.cos(p.heading) * p.speed * dt, 0, world.width);
    p.pos.y = clamp(p.pos.y + Math.sin(p.heading) * p.speed * dt, 0, world.height);
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
