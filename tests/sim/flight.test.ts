import { describe, expect, it } from 'vitest';
import { BAND_PROFILES } from '../../src/config';
import { Simulation } from '../../src/sim/simulation';
import { input, makeLevel, run } from './helpers';

describe('flight', () => {
  it('climbs one band per second and changes effective band at the threshold', () => {
    const sim = new Simulation(makeLevel());
    sim.step(input({ climb: true }));
    const events = run(sim, 1.1);
    expect(sim.world.player.targetBand).toBe('medium');
    expect(sim.world.player.alt).toBeCloseTo(1, 5);
    expect(sim.world.player.band).toBe('medium');
    expect(events.some((e) => e.type === 'bandChanged' && e.to === 'medium')).toBe(true);
  });

  it('dives faster than it climbs', () => {
    const sim = new Simulation(makeLevel());
    sim.step(input({ climb: true }));
    sim.step(input({ climb: true }));
    run(sim, 2.5);
    expect(sim.world.player.alt).toBeCloseTo(2, 5);
    sim.step(input({ dive: true }));
    sim.step(input({ dive: true }));
    run(sim, 1.3);
    // 2 bands at 1.6 bands/s ≈ 1.25 s, versus 2 s to climb the same distance.
    expect(sim.world.player.alt).toBeCloseTo(0, 5);
  });

  it('flies faster at High than at Low', () => {
    const sim = new Simulation(makeLevel());
    sim.step(input({ climb: true }));
    sim.step(input({ climb: true }));
    run(sim, 6);
    expect(sim.world.player.band).toBe('high');
    expect(sim.world.player.speed).toBeGreaterThan(BAND_PROFILES.medium.speed);
  });

  it('gains a temporary speed bonus when diving', () => {
    const sim = new Simulation(makeLevel());
    sim.step(input({ climb: true }));
    run(sim, 5);
    sim.step(input({ dive: true }));
    run(sim, 0.5);
    expect(sim.world.player.energy).toBeGreaterThan(1);
  });

  it('cannot climb above High or dive below Low', () => {
    const sim = new Simulation(makeLevel());
    sim.step(input({ dive: true }));
    expect(sim.world.player.targetBand).toBe('low');
    for (let i = 0; i < 5; i++) sim.step(input({ climb: true }));
    expect(sim.world.player.targetBand).toBe('high');
  });

  it('steers back inside the map boundary', () => {
    const sim = new Simulation(makeLevel({ player: { spawn: { x: 3900, y: 1000 }, headingDeg: 0 } }));
    run(sim, 10);
    const p = sim.world.player;
    expect(p.pos.x).toBeLessThanOrEqual(4000);
    // Turned around and heading back toward the centre.
    expect(Math.cos(p.heading)).toBeLessThan(0);
  });
});
