import { describe, expect, it } from 'vitest';
import { VoiceLimiter } from '../../src/audio';

interface V {
  id: number;
  alive: boolean;
}

describe('VoiceLimiter', () => {
  const make = (globalMax = 32) => new VoiceLimiter<V>((v) => v.alive, globalMax);

  it('drops new voices at the per-key cap', () => {
    const lim = make();
    for (let i = 0; i < 2; i++) {
      expect(lim.request('k', { max: 2, policy: 'drop' }).allow).toBe(true);
      lim.register('k', { id: i, alive: true });
    }
    expect(lim.request('k', { max: 2, policy: 'drop' })).toEqual({ allow: false, evict: null });
  });

  it('steals the oldest voice under the steal policy', () => {
    const lim = make();
    const first = { id: 1, alive: true };
    lim.register('k', first);
    lim.register('k', { id: 2, alive: true });
    const req = lim.request('k', { max: 2, policy: 'steal' });
    expect(req.allow).toBe(true);
    expect(req.evict).toBe(first);
  });

  it('frees slots when voices finish', () => {
    const lim = make();
    const v = { id: 1, alive: true };
    lim.register('k', v);
    expect(lim.request('k', { max: 1, policy: 'drop' }).allow).toBe(false);
    v.alive = false;
    expect(lim.request('k', { max: 1, policy: 'drop' }).allow).toBe(true);
    expect(lim.count('k')).toBe(0);
  });

  it('enforces the global cap across keys', () => {
    const lim = make(3);
    lim.register('a', { id: 1, alive: true });
    lim.register('b', { id: 2, alive: true });
    lim.register('c', { id: 3, alive: true });
    expect(lim.request('d', { max: 4, policy: 'drop' }).allow).toBe(false);
  });
});
