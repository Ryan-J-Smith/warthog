import { describe, expect, it } from 'vitest';
import { compassDirection, compassWord, declutter, edgeArrow, worldToScreen } from '../../src/ui/model';

describe('worldToScreen', () => {
  it('maps the camera world view onto the screen', () => {
    const view = { x: 1000, y: 500, width: 1920 * 2, height: 1080 * 2 };
    expect(worldToScreen({ x: 1000, y: 500 }, view, 1920, 1080)).toEqual({ x: 0, y: 0 });
    expect(worldToScreen({ x: 1000 + 1920, y: 500 + 1080 }, view, 1920, 1080)).toEqual({ x: 960, y: 540 });
  });
});

describe('edgeArrow', () => {
  it('flags points inside the margin as on screen', () => {
    expect(edgeArrow({ x: 900, y: 500 }, 1920, 1080, 40, 700, 360).onScreen).toBe(true);
    expect(edgeArrow({ x: 10, y: 500 }, 1920, 1080, 40, 700, 360).onScreen).toBe(false);
  });

  it('places the arrow on the ellipse toward the point', () => {
    const right = edgeArrow({ x: 5000, y: 540 }, 1920, 1080, 40, 700, 360);
    expect(right.x).toBeCloseTo(960 + 700);
    expect(right.y).toBeCloseTo(540);
    expect(right.angle).toBeCloseTo(0);

    const up = edgeArrow({ x: 960, y: -3000 }, 1920, 1080, 40, 700, 360);
    expect(up.x).toBeCloseTo(960);
    expect(up.y).toBeCloseTo(540 - 360);
    expect(up.angle).toBeCloseTo(-Math.PI / 2);

    const diag = edgeArrow({ x: 960 + 1000, y: 540 + 1000 }, 1920, 1080, 40, 700, 360);
    const nx = (diag.x - 960) / 700;
    const ny = (diag.y - 540) / 360;
    expect(nx * nx + ny * ny).toBeCloseTo(1);
  });

  it('can centre the ellipse off the screen centre', () => {
    const up = edgeArrow({ x: 960, y: -3000 }, 1920, 1080, 40, 640, 300, { x: 960, y: 580 });
    expect(up.y).toBeCloseTo(280);
    expect(up.angle).toBeCloseTo(-Math.PI / 2);
  });
});

describe('compassDirection', () => {
  it('uses a north-up map with y growing south', () => {
    const o = { x: 0, y: 0 };
    expect(compassDirection(o, { x: 0, y: -10 })).toBe('N');
    expect(compassDirection(o, { x: 10, y: -10 })).toBe('NE');
    expect(compassDirection(o, { x: 10, y: 0 })).toBe('E');
    expect(compassDirection(o, { x: 10, y: 10 })).toBe('SE');
    expect(compassDirection(o, { x: 0, y: 10 })).toBe('S');
    expect(compassDirection(o, { x: -10, y: 10 })).toBe('SW');
    expect(compassDirection(o, { x: -10, y: 0 })).toBe('W');
    expect(compassDirection(o, { x: -10, y: -10 })).toBe('NW');
    expect(compassWord('NE')).toBe('north-east');
  });
});

describe('declutter', () => {
  it('pushes overlapping points apart and leaves distant ones alone', () => {
    const pts = [
      { x: 100, y: 100 },
      { x: 110, y: 100 },
      { x: 500, y: 500 },
    ];
    declutter(pts, 60);
    const [a, b, c] = pts;
    expect(Math.hypot((b?.x ?? 0) - (a?.x ?? 0), (b?.y ?? 0) - (a?.y ?? 0))).toBeGreaterThanOrEqual(60);
    expect(c).toEqual({ x: 500, y: 500 });
  });

  it('separates coincident points', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ];
    declutter(pts, 40);
    expect(Math.abs((pts[1]?.y ?? 0) - (pts[0]?.y ?? 0))).toBeGreaterThanOrEqual(40);
  });
});
