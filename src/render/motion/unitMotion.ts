import type { Vec2 } from '../../sim/math';
import type { MotionSpec } from './motionSpecs';

/** How a ground unit's sprites are drawn this frame (offsets in world units). */
export interface MotionPose {
  /** Index into the spec's `frames` for the base sprite. */
  frame: number;
  /** Base (hull / body) offset: a walker's recoil kick (tank hulls stay put). */
  baseX: number;
  baseY: number;
  /** Top (turret) offset: the gun's recoil kick. */
  topX: number;
  topY: number;
}

/** Smoothing rate for the measured speed (1/s): stops read as stops within ~0.2 s. */
const SPEED_SMOOTHING = 10;
/** A jump bigger than this in one frame is a respawn / teleport, not movement. */
const MAX_FRAME_STEP = 40;
/** A walker that stops finishes its step onto a planted pose at this many cycles / s. */
const SETTLE_RATE = 1.2;
/** Below this smoothed speed (world units / s) a walker counts as stopped. */
const SETTLE_BELOW_SPEED = 3;

/** Firing: seconds to recover, and how far the kick goes back along the line of fire. */
const RECOIL_TIME = 0.32;
const RECOIL_TURRET = 4.5;
/** Walkers (no turret) kick their whole body back a little. */
const RECOIL_WALKER = 1.8;

/**
 * Render-side movement cycle for one ground unit: measures how far the unit actually moved each
 * frame (the sim is not consulted, so halted, blocked or engaged units simply read as stopped) and
 * advances a distance-paced cycle of discrete sprite frames (walk steps / tread frames), plus a
 * recoil kick along the line of fire when the unit fires. No procedural bob, sway or scaling.
 */
export class UnitMotion {
  private last: Vec2 | null = null;
  /** Smoothed ground speed, world units / s. */
  private speed = 0;
  /** Position in the frame cycle, 0..1 (one full pass through `frames`). */
  private phase: number;
  /** Recoil remaining, 1 (just fired) → 0. */
  private kick = 0;
  private kickAngle = 0;

  /** `seed` staggers the cycle so a column of units does not march in lockstep. */
  constructor(
    private readonly spec: MotionSpec,
    seed: number,
  ) {
    // A walker spawns on a planted pose (frame 0 or the mirror step); treads anywhere.
    this.phase = spec.style === 'walk' ? (seed % 2) * 0.5 : (seed * 0.618) % 1;
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
   * Advance by `dt` seconds with the unit now at `pos`. `displayScale` is the unit's on-screen
   * enlargement: bigger sprites take longer strides and kick further.
   */
  update(pos: Vec2, dt: number, displayScale: number): MotionPose {
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

    // Recoil: sharp kick, eased return (kick² has zero slope as it lands).
    const recoil = this.kick * this.kick * displayScale;
    const kx = recoil > 0 ? -Math.cos(this.kickAngle) * recoil : 0;
    const ky = recoil > 0 ? -Math.sin(this.kickAngle) * recoil : 0;
    const walker = spec.style === 'walk';
    const n = spec.frames.length;
    return {
      frame: Math.round(this.phase * n) % n,
      baseX: walker ? kx * RECOIL_WALKER : 0,
      baseY: walker ? ky * RECOIL_WALKER : 0,
      topX: walker ? 0 : kx * RECOIL_TURRET,
      topY: walker ? 0 : ky * RECOIL_TURRET,
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
