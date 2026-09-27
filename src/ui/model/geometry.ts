import type { Vec2 } from '../../sim/math';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Project a world point to screen pixels given the camera's visible world rectangle. */
export function worldToScreen(point: Vec2, worldView: Rect, screenWidth: number, screenHeight: number): Vec2 {
  return {
    x: ((point.x - worldView.x) / worldView.width) * screenWidth,
    y: ((point.y - worldView.y) / worldView.height) * screenHeight,
  };
}

export interface EdgeArrowPlacement {
  /** True when the point is on screen (inside the margin): no arrow needed. */
  onScreen: boolean;
  x: number;
  y: number;
  /** Direction from the screen centre to the point, radians (0 = east). */
  angle: number;
}

/**
 * Where to draw an off-screen indicator for a screen-space point: on an ellipse (radii `rx`,
 * `ry`) centred on `center` (default: the screen centre), along the ray toward the point.
 */
export function edgeArrow(
  point: Vec2,
  screenWidth: number,
  screenHeight: number,
  margin: number,
  rx: number,
  ry: number,
  center: Vec2 = { x: screenWidth / 2, y: screenHeight / 2 },
): EdgeArrowPlacement {
  const cx = center.x;
  const cy = center.y;
  const angle = Math.atan2(point.y - cy, point.x - cx);
  const onScreen = point.x >= margin && point.x <= screenWidth - margin && point.y >= margin && point.y <= screenHeight - margin;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const r = (rx * ry) / Math.sqrt((ry * cos) ** 2 + (rx * sin) ** 2);
  return { onScreen, x: cx + cos * r, y: cy + sin * r, angle };
}

export type Compass = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

const COMPASS: readonly Compass[] = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'];

/** 8-way compass direction from `from` to `to` on a north-up map (y grows southward). */
export function compassDirection(from: Vec2, to: Vec2): Compass {
  const angle = Math.atan2(-(to.y - from.y), to.x - from.x);
  const octant = Math.round(angle / (Math.PI / 4));
  return COMPASS[(octant + 8) % 8] ?? 'N';
}

const COMPASS_WORDS: Record<Compass, string> = {
  N: 'north',
  NE: 'north-east',
  E: 'east',
  SE: 'south-east',
  S: 'south',
  SW: 'south-west',
  W: 'west',
  NW: 'north-west',
};

export function compassWord(direction: Compass): string {
  return COMPASS_WORDS[direction];
}

/**
 * Push points apart until no two are closer than `minDistance` (simple pairwise relaxation).
 * Mutates and returns `points`. Coincident points are separated vertically.
 */
export function declutter<T extends Vec2>(points: T[], minDistance: number, iterations = 6): T[] {
  for (let k = 0; k < iterations; k++) {
    let moved = false;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i];
        const b = points[j];
        if (!a || !b) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= minDistance) continue;
        if (d < 1e-6) {
          dx = 0;
          dy = 1;
          d = 1;
        }
        const push = (minDistance - Math.min(d, minDistance)) / 2 + 0.01;
        a.x -= (dx / d) * push;
        a.y -= (dy / d) * push;
        b.x += (dx / d) * push;
        b.y += (dy / d) * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return points;
}
