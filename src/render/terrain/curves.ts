import type { Vec2 } from '../../sim/math';

/** A densely sampled polyline with per-point unit normals and cumulative arc length. */
export interface DenseCurve {
  xs: Float32Array;
  ys: Float32Array;
  /** Unit normal (pointing to the right of travel in screen space: +y is south). */
  nx: Float32Array;
  ny: Float32Array;
  /** Arc length from the start. */
  s: Float32Array;
  length: number;
  /** Axis-aligned bounds. */
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Sample a Catmull-Rom spline through `points` roughly every `step` world units.
 * The curve passes through every control point.
 */
export function sampleSpline(points: readonly Vec2[], step: number): DenseCurve {
  const xs: number[] = [];
  const ys: number[] = [];
  const n = points.length;
  const at = (i: number): Vec2 => points[Math.max(0, Math.min(n - 1, i))] ?? { x: 0, y: 0 };
  for (let i = 0; i < n - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const count = Math.max(2, Math.ceil(segLen / step));
    for (let k = 0; k < count; k++) {
      const t = k / count;
      const t2 = t * t;
      const t3 = t2 * t;
      xs.push(
        0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      );
      ys.push(
        0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      );
    }
  }
  const last = at(n - 1);
  xs.push(last.x);
  ys.push(last.y);
  return buildCurve(xs, ys);
}

function buildCurve(xsIn: number[], ysIn: number[]): DenseCurve {
  const count = xsIn.length;
  const xs = Float32Array.from(xsIn);
  const ys = Float32Array.from(ysIn);
  const nx = new Float32Array(count);
  const ny = new Float32Array(count);
  const s = new Float32Array(count);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < count; i++) {
    const x = xs[i] ?? 0;
    const y = ys[i] ?? 0;
    const prevX = xs[Math.max(0, i - 1)] ?? x;
    const prevY = ys[Math.max(0, i - 1)] ?? y;
    const nextX = xs[Math.min(count - 1, i + 1)] ?? x;
    const nextY = ys[Math.min(count - 1, i + 1)] ?? y;
    const tx = nextX - prevX;
    const ty = nextY - prevY;
    const len = Math.hypot(tx, ty) || 1;
    nx[i] = -ty / len;
    ny[i] = tx / len;
    s[i] = i === 0 ? 0 : (s[i - 1] ?? 0) + Math.hypot(x - prevX, y - prevY);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { xs, ys, nx, ny, s, length: s[count - 1] ?? 0, minX, minY, maxX, maxY };
}
