import { describe, expect, it } from 'vitest';
import { ImpactAggregator } from '../../src/audio';

describe('ImpactAggregator', () => {
  it('collapses a frame of impacts into one burst at their centroid', () => {
    const agg = new ImpactAggregator(100);
    agg.add({ x: 0, y: 0 }, true, false);
    agg.add({ x: 10, y: 20 }, false, true);
    const burst = agg.flush(0);
    expect(burst).toEqual({ pos: { x: 5, y: 10 }, count: 2, hits: 1, armored: 1 });
    expect(agg.flush(1)).toBeNull();
  });

  it('releases at most one burst per interval', () => {
    const agg = new ImpactAggregator(100);
    let bursts = 0;
    // 65 rounds/s for one second, polled every 16 ms.
    for (let t = 0; t <= 1000; t += 16) {
      agg.add({ x: 0, y: 0 }, false, false);
      if (agg.flush(t)) bursts++;
    }
    expect(bursts).toBeGreaterThanOrEqual(9);
    expect(bursts).toBeLessThanOrEqual(11);
  });
});
