export const TAU = Math.PI * 2;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}

/** Wrap an angle to (-π, π]. */
export function wrapAngle(radians: number): number {
  let a = radians % TAU;
  if (a <= -Math.PI) a += TAU;
  if (a > Math.PI) a -= TAU;
  return a;
}

/** Signed shortest difference `to - from`, in (-π, π]. */
export function angleDelta(from: number, to: number): number {
  return wrapAngle(to - from);
}

/** Rotate `from` toward `to` by at most `maxStep` radians. */
export function rotateToward(from: number, to: number, maxStep: number): number {
  const d = angleDelta(from, to);
  if (Math.abs(d) <= maxStep) return wrapAngle(to);
  return wrapAngle(from + Math.sign(d) * maxStep);
}

/** Move `value` toward `target` by at most `maxStep`. */
export function approach(value: number, target: number, maxStep: number): number {
  if (value < target) return Math.min(value + maxStep, target);
  return Math.max(value - maxStep, target);
}
