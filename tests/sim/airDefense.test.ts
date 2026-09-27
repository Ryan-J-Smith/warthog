import { describe, expect, it } from 'vitest';
import { Simulation } from '../../src/sim/simulation';
import { input, makeLevel, run } from './helpers';

describe('air defence', () => {
  it('SAM locks and launches when the player is at Medium in range', () => {
    const level = makeLevel({ entities: [{ refId: 'sam', kind: 'samSite', pos: { x: 1700, y: 1000 } }] });
    const sim = new Simulation(level);
    sim.step(input({ climb: true }));
    const events = run(sim, 2.6);
    expect(events.some((e) => e.type === 'samLockStarted')).toBe(true);
    expect(events.some((e) => e.type === 'samLaunched')).toBe(true);
  });

  it('SAM ignores a player at Low', () => {
    const level = makeLevel({ entities: [{ refId: 'sam', kind: 'samSite', pos: { x: 1400, y: 1000 } }] });
    const sim = new Simulation(level);
    const events = run(sim, 3);
    expect(events.some((e) => e.type === 'samLockStarted')).toBe(false);
  });

  it('diving to Low breaks a SAM missile lock', () => {
    const level = makeLevel({
      player: { spawn: { x: 400, y: 1000 }, headingDeg: 180 },
      entities: [{ refId: 'sam', kind: 'samSite', pos: { x: 1300, y: 1000 } }],
    });
    const sim = new Simulation(level);
    sim.step(input({ climb: true }));
    let launched = false;
    for (let i = 0; i < 600 && !launched; i++) {
      sim.step(input());
      launched = sim.drainEvents().some((e) => e.type === 'samLaunched');
    }
    expect(launched).toBe(true);
    sim.step(input({ dive: true }));
    const events = run(sim, 1.2);
    expect(events.some((e) => e.type === 'samLostLock')).toBe(true);
    expect(sim.world.player.missilesTracking).toBe(0);
  });

  it('AA guns engage Low but not High', () => {
    const level = makeLevel({ entities: [{ kind: 'aaGun', pos: { x: 1300, y: 1000 } }] });
    const low = new Simulation(level);
    expect(run(low, 1).some((e) => e.type === 'aaBurst')).toBe(true);

    const high = new Simulation(makeLevel({
      player: { spawn: { x: 400, y: 1000 }, headingDeg: 0 },
      entities: [{ kind: 'aaGun', pos: { x: 1800, y: 1000 } }],
    }));
    high.step(input({ climb: true }));
    high.step(input({ climb: true }));
    run(high, 2.1);
    expect(high.world.player.band).toBe('high');
    expect(run(high, 2).some((e) => e.type === 'aaBurst')).toBe(false);
  });

  it('flares always decoy a tracking SAM', () => {
    const level = makeLevel({
      player: { spawn: { x: 400, y: 1000 }, headingDeg: 180 },
      entities: [{ refId: 'sam', kind: 'samSite', pos: { x: 1300, y: 1000 } }],
    });
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const sim = new Simulation(level, seed);
      sim.step(input({ climb: true }));
      let launched = false;
      for (let i = 0; i < 600 && !launched; i++) {
        sim.step(input());
        launched = sim.drainEvents().some((e) => e.type === 'samLaunched');
      }
      expect(launched).toBe(true);
      sim.step(input({ flare: true }));
      expect(sim.drainEvents().some((e) => e.type === 'samDecoyed')).toBe(true);
      expect(sim.world.player.missilesTracking).toBe(0);
    }
  });
});
