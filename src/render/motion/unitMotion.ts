import type { Vec2 } from '../../sim/math';
import type { MotionSpec } from './motionSpecs';

/** How a ground unit's sprites are displaced this frame (all offsets in world units). */
export interface MotionPose {
  /** Index into the spec's `frames` for the base sprite. */
  frame: number;
  /** Base (hull / body) offset, rotation delta and scale multiplier. */
  baseX: number;
  baseY: number;
  baseYaw: number;
  baseScale: number;
  /** Top (turret) offset: rides with the hull, plus the gun's recoil. */
  topX: number;
  topY: number;
}

/** Smoothing rate for the measured speed (1/s): stops read as stops within ~0.2 s. */
const SPEED_SMOOTHING = 10;
/** Speed at which bob / sway reach full amplitude, world units / s. */
const FULL_SPEED = 30;
/** A jump bigger than this in one frame is a respawn / teleport, not movement. */
const MAX_FRAME_STEP = 40;
/** A walker that stops finishes its step onto a planted pose at this many cycles / s. */
const SETTLE_RATE = 1.2;
/** Below this smoothed speed (world units / s) a walker counts as stopped. */
const SETTLE_BELOW_SPEED = 3;

/** Walkers: torso twist toward the forward foot (rad), weight shift over the stance foot, step bob. */
const WALK_YAW = 0.045;
const WALK_SWAY = 0.9;
const WALK_BOB = 0.035;
/** Vehicles: suspension rumble over rough ground (world units travelled per wobble). */
const RUMBLE_LENGTH = { tracks: 26, wheels: 11 } as const;
const RUMBLE_SURGE = { tracks: 0.45, wheels: 0.3 } as const;
const RUMBLE_SWAY = { tracks: 0.25, wheels: 0.35 } as const;
const RUMBLE_BOB = { tracks: 0.01, wheels: 0.012 } as const;

/** Firing: seconds to recover, turret pull-back and hull rock along the line of fire. */
const RECOIL_TIME = 0.32;
const RECOIL_TURRET = 4.5;
const RECOIL_HULL = 1.4;
/** Walkers (no turret) rock their whole body back a little. */
const RECOIL_WALKER = 1.8;

const TAU = Math.PI * 2;

/**
 * Render-side movement cycle for one ground unit: measures how far the unit actually moved each
 * frame (the sim is not consulted, so halted, blocked or engaged units simply read as stopped),
 * advances a distance-paced cycle (walk steps / tread frames) and adds speed-scaled bob, plus a
 * recoil kick when the unit fires.
 */
export class UnitMotion {
  private last: Vec2 | null = null;
  /** Smoothed ground speed, world units / s. */
  private speed = 0;
  /** Position in the frame cycle, 0..1 (one full pass through `frames`). */
  private phase: number;
  private rumble: number;
  /** Recoil remaining, 1 (just fired) → 0. */
  private kick = 0;
  private kickAngle = 0;

  /** `seed` staggers the cycle so a column of units does not march in lockstep. */
  constructor(
    private readonly spec: MotionSpec,
    seed: number,
  ) {
    // A walker spawns on a planted pose (frame 0 or the mirror step); vehicles anywhere.
    this.phase = spec.style === 'walk' ? (seed % 2) * 0.5 : (seed * 0.618) % 1;
    this.rumble = (seed * 0.382) % 1;
  }

  /** The unit just fired toward `angle` (radians). */
  fire(angle: number): void {
    this.kick = 1;
    this.kickAngle = angle;
  }

  /** Smoothed ground speed (world units / s). */
  get groundSpeed(): number {
    return this.speed;
  }

  /**
   * Advance by `dt` seconds with the unit now at `pos`, heading `heading`. `displayScale` is the
   * unit's on-screen enlargement: bigger sprites take longer strides and move their parts further.
   */
  update(pos: Vec2, heading: number, dt: number, displayScale: number): MotionPose {
    let moved = 0;
    if (this.last) {
      moved = Math.hypot(pos.x - this.last.x, pos.y - this.last.y);
      if (moved > MAX_FRAME_STEP) moved = 0;
      this.last.x = pos.x;
      this.last.y = pos.y;
    } else {
      this.last = { x: pos.x, y: pos.y };
    }
    if (dt > 0) {
      const k = 1 - Math.exp(-dt * SPEED_SMOOTHING);
      this.speed += (moved / dt - this.speed) * k;
    }
    if (this.speed < 0.5 && moved === 0) this.speed = 0;

    const spec = this.spec;
    this.phase = wrap(this.phase + moved / (spec.cycleLength * displayScale));
    // Settle on the smoothed speed, not on zero-move frames: a render frame with no sim step
    // in between is not a stop.
    if (spec.style === 'walk' && this.speed < SETTLE_BELOW_SPEED) this.settle(dt);
    this.kick = Math.max(0, this.kick - dt / RECOIL_TIME);

    const amp = Math.min(1, this.speed / FULL_SPEED);
    const cos = Math.cos(heading);
    const sin = Math.sin(heading);
    let surge = 0;
    let sway = 0;
    let yaw = 0;
    let scale = 1;
    if (spec.style === 'walk') {
      // Frame 0 (phase 0) has the left foot forward; phase 0.5 is the mirror step.
      const stride = Math.cos(this.phase * TAU);
      const lift = Math.sin(this.phase * TAU);
      yaw = -WALK_YAW * amp * stride;
      sway = -WALK_SWAY * amp * lift;
      scale = 1 + WALK_BOB * amp * lift * lift;
    } else {
      this.rumble = wrap(this.rumble + moved / RUMBLE_LENGTH[spec.style]);
      const a = this.rumble * TAU;
      surge = RUMBLE_SURGE[spec.style] * amp * Math.sin(a);
      sway = RUMBLE_SWAY[spec.style] * amp * Math.sin(a * 2.3 + 1);
      scale = 1 + RUMBLE_BOB[spec.style] * amp * Math.sin(a * 1.7);
    }

    // Recoil: sharp kick, eased return (kick² has zero slope as it lands).
    const recoil = this.kick * this.kick;
    const kx = -Math.cos(this.kickAngle) * recoil;
    const ky = -Math.sin(this.kickAngle) * recoil;
    const hullKick = spec.style === 'walk' ? RECOIL_WALKER : RECOIL_HULL;

    const baseX = (cos * surge - sin * sway + kx * hullKick) * displayScale;
    const baseY = (sin * surge + cos * sway + ky * hullKick) * displayScale;
    const n = spec.frames.length;
    return {
      frame: Math.round(this.phase * n) % n,
      baseX,
      baseY,
      baseYaw: yaw,
      baseScale: scale,
      topX: baseX + kx * RECOIL_TURRET * displayScale,
      topY: baseY + ky * RECOIL_TURRET * displayScale,
    };
  }

  /** A stopped walker finishes its step onto the nearest planted pose (phase 0 or 0.5). */
  private settle(dt: number): void {
    const target = Math.round(this.phase * 2) / 2;
    const step = SETTLE_RATE * dt;
    const diff = target - this.phase;
    this.phase = Math.abs(diff) <= step ? wrap(target) : this.phase + Math.sign(diff) * step;
  }
}

function wrap(phase: number): number {
  return phase - Math.floor(phase);
}
