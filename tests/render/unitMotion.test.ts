import { describe, expect, it } from 'vitest';
import { MOTION_SPECS, UnitMotion } from '../../src/render/motion';
import type { MotionPose, MotionSpec } from '../../src/render/motion';

const DT = 1 / 60;

function specFor(kind: keyof typeof MOTION_SPECS): MotionSpec {
  return MOTION_SPECS[kind];
}

/** Drive east at `speed` for `seconds` (one sim step per render frame); returns every pose. */
function drive(motion: UnitMotion, start: { x: number; y: number }, speed: number, seconds: number): MotionPose[] {
  const poses: MotionPose[] = [];
  const pos = { ...start };
  for (let t = 0; t < seconds; t += DT) {
    pos.x += speed * DT;
    poses.push(motion.update(pos, 0, DT, 1));
  }
  start.x = pos.x;
  return poses;
}

function hold(motion: UnitMotion, pos: { x: number; y: number }, seconds: number): MotionPose[] {
  const poses: MotionPose[] = [];
  for (let t = 0; t < seconds; t += DT) poses.push(motion.update(pos, 0, DT, 1));
  return poses;
}

describe('UnitMotion', () => {
  it('stands still on its first frame when the unit never moves', () => {
    const motion = new UnitMotion(specFor('infantry'), 0);
    const poses = hold(motion, { x: 100, y: 100 }, 1);
    for (const pose of poses) {
      expect(pose.frame).toBe(0);
      expect(pose.baseX).toBe(0);
      expect(pose.baseY).toBe(0);
      expect(pose.baseScale).toBe(1);
    }
  });

  it('paces the walk cycle by distance: twice the speed, twice the steps', () => {
    const spec = specFor('infantry');
    const slow = new UnitMotion(spec, 0);
    const fast = new UnitMotion(spec, 0);
    const countChanges = (poses: MotionPose[]): number => poses.filter((p, i) => i > 0 && p.frame !== poses[i - 1]?.frame).length;
    const slowChanges = countChanges(drive(slow, { x: 0, y: 0 }, 20, 4));
    const fastChanges = countChanges(drive(fast, { x: 0, y: 0 }, 40, 4));
    // 4 s at 20 u/s = 80 u ≈ 1.7 cycles of 8 frames; at 40 u/s about twice as many.
    expect(slowChanges).toBeGreaterThanOrEqual(12);
    expect(fastChanges).toBeGreaterThanOrEqual(slowChanges * 2 - 2);
    expect(fastChanges).toBeLessThanOrEqual(slowChanges * 2 + 2);
  });

  it('plays every walk frame while moving and settles on a planted pose once stopped', () => {
    const spec = specFor('friendlyInfantry');
    const motion = new UnitMotion(spec, 1);
    const pos = { x: 0, y: 0 };
    const seen = new Set(drive(motion, pos, 30, 3).map((p) => p.frame));
    expect(seen.size).toBe(spec.frames.length);
    const settled = hold(motion, pos, 1.5).at(-1);
    // Frame 0 = left foot forward, frame 4 = its mirror; both are planted stances.
    expect([0, 4]).toContain(settled?.frame);
    expect(settled?.baseScale).toBeCloseTo(1, 5);
  });

  it('does not treat render frames without a sim step as stops', () => {
    const spec = specFor('infantry');
    const motion = new UnitMotion(spec, 0);
    const pos = { x: 0, y: 0 };
    let last = 0;
    let backwards = 0;
    // Sim at 30 Hz, render at 60 Hz: every other render frame sees no movement.
    for (let i = 0; i < 240; i++) {
      if (i % 2 === 0) pos.x += 30 / 30;
      const frame = motion.update(pos, 0, DT, 1).frame;
      // The 8-step cycle only ever advances (wrapping 7 → 0).
      if (frame !== last && frame !== (last + 1) % spec.frames.length) backwards++;
      last = frame;
    }
    expect(backwards).toBe(0);
  });

  it('scrolls tank treads through all three frames while driving', () => {
    const motion = new UnitMotion(specFor('tank'), 0);
    const seen = new Set(drive(motion, { x: 0, y: 0 }, 30, 1).map((p) => p.frame));
    expect(seen).toEqual(new Set([0, 1, 2]));
  });

  it('ignores a teleport (respawn) instead of spinning the cycle', () => {
    const motion = new UnitMotion(specFor('tank'), 0);
    motion.update({ x: 0, y: 0 }, 0, DT, 1);
    motion.update({ x: 5000, y: 0 }, 0, DT, 1);
    expect(motion.groundSpeed).toBe(0);
  });

  it('kicks the turret back along the line of fire, further than the hull, then recovers', () => {
    const motion = new UnitMotion(specFor('tank'), 0);
    const pos = { x: 0, y: 0 };
    hold(motion, pos, 0.1);
    motion.fire(0);
    const kicked = motion.update(pos, 0, DT, 1);
    expect(kicked.topX).toBeLessThan(-3);
    expect(kicked.baseX).toBeLessThan(0);
    expect(kicked.topX).toBeLessThan(kicked.baseX);
    expect(Math.abs(kicked.topY)).toBeLessThan(1e-6);
    const after = hold(motion, pos, 0.5).at(-1);
    expect(after?.topX).toBe(0);
    expect(after?.baseX).toBe(0);
  });

  it('rumbles wheeled vehicles only while they move', () => {
    const motion = new UnitMotion(specFor('truck'), 3);
    const pos = { x: 0, y: 0 };
    const moving = drive(motion, pos, 36, 1);
    expect(moving.some((p) => Math.abs(p.baseX) > 0.05 || Math.abs(p.baseY) > 0.05)).toBe(true);
    expect(moving.every((p) => p.frame === 0)).toBe(true);
    const stopped = hold(motion, pos, 1).at(-1);
    expect(Math.abs(stopped?.baseX ?? 1)).toBeLessThan(1e-3);
    expect(Math.abs(stopped?.baseY ?? 1)).toBeLessThan(1e-3);
  });
});

describe('MOTION_SPECS', () => {
  it('start every cycle on the unit’s own sprite', () => {
    expect(MOTION_SPECS.tank.frames[0]).toBe('tankHull');
    expect(MOTION_SPECS.friendlyTank.frames[0]).toBe('friendlyTankHull');
    expect(MOTION_SPECS.infantry.frames[0]).toBe('infantry');
    expect(MOTION_SPECS.friendlyInfantry.frames[0]).toBe('friendlyInfantry');
    expect(MOTION_SPECS.mobileAa.frames[0]).toBe('aaHull');
  });
});
