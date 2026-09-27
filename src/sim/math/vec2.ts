/** Plain 2D vector. World units; +x east, +y south (screen space). */
export interface Vec2 {
  x: number;
  y: number;
}

export function vec(x: number, y: number): Vec2 {
  return { x, y };
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(a: Vec2, s: number): Vec2 {
  return { x: a.x * s, y: a.y * s };
}

export function length(a: Vec2): number {
  return Math.hypot(a.x, a.y);
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function distanceSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function normalize(a: Vec2): Vec2 {
  const len = Math.hypot(a.x, a.y);
  return len > 1e-9 ? { x: a.x / len, y: a.y / len } : { x: 0, y: 0 };
}

/** Unit vector for a heading in radians (0 = east, +π/2 = south). */
export function fromAngle(radians: number, len = 1): Vec2 {
  return { x: Math.cos(radians) * len, y: Math.sin(radians) * len };
}

export function angleOf(a: Vec2): number {
  return Math.atan2(a.y, a.x);
}

export function lerpVec(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function clone(a: Vec2): Vec2 {
  return { x: a.x, y: a.y };
}
