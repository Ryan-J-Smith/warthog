import { describe, expect, it } from 'vitest';
import { DEFAULT_SPATIAL, spatialize } from '../../src/audio';

const at = (x: number, y: number) => ({ x, y });

describe('spatialize', () => {
  it('is full volume and centred next to the listener', () => {
    const s = spatialize(at(0, 0), 0, at(0, 100));
    expect(s.gain).toBe(1);
    expect(s.pan).toBe(0);
  });

  it('falls off with distance and goes silent past the far limit', () => {
    const near = spatialize(at(0, 0), 0, at(600, 0)).gain;
    const mid = spatialize(at(0, 0), 0, at(1200, 0)).gain;
    const far = spatialize(at(0, 0), 0, at(DEFAULT_SPATIAL.farUnits + 1, 0)).gain;
    expect(near).toBeLessThan(1);
    expect(mid).toBeLessThan(near);
    expect(far).toBe(0);
  });

  it('hears ground sounds more faintly from altitude', () => {
    const low = spatialize(at(0, 0), 0, at(300, 0)).gain;
    const high = spatialize(at(0, 0), 2, at(300, 0)).gain;
    expect(high).toBeLessThan(low);
  });

  it('pans by relative x, capped, and widens with altitude', () => {
    const right = spatialize(at(0, 0), 0, at(400, 0));
    const left = spatialize(at(0, 0), 0, at(-400, 0));
    expect(right.pan).toBeGreaterThan(0);
    expect(left.pan).toBeCloseTo(-right.pan);
    expect(spatialize(at(0, 0), 0, at(5000, 0)).pan).toBeCloseTo(DEFAULT_SPATIAL.maxPan);
    expect(spatialize(at(0, 0), 2, at(400, 0)).pan).toBeLessThan(right.pan);
  });
});
