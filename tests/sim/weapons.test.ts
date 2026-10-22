import { describe, expect, it } from 'vitest';
import { DEFAULT_LOADOUT } from '../../src/sim/loadout';
import { Simulation } from '../../src/sim/simulation';
import { gunPipper } from '../../src/sim/systems';
import { input, makeLevel, run } from './helpers';

describe('weapons', () => {
  it('refuses to drop bombs at Low', () => {
    const sim = new Simulation(makeLevel());
    sim.step(input({ select: 'bombs' }));
    const events = run(sim, 0.2, { fire: true });
    expect(events.some((e) => e.type === 'weaponUnavailable' && e.reason === 'tooLow')).toBe(true);
    expect(sim.world.player.ammo.bombs).toBe(DEFAULT_LOADOUT.ammo.bombs);
    expect(sim.world.reticle.blockedReason).toBe('TOO LOW');
  });

  it('gun is out of range at High', () => {
    const sim = new Simulation(makeLevel());
    sim.step(input({ climb: true }));
    sim.step(input({ climb: true }));
    run(sim, 3);
    // Climbing to High auto-selects bombs; pick the gun again by hand.
    sim.step(input({ select: 'gun' }));
    run(sim, 0.5, { fire: true });
    expect(sim.world.player.ammo.gun).toBe(DEFAULT_LOADOUT.ammo.gun);
    expect(sim.world.reticle.blockedReason).toBe('OUT OF RANGE');
  });

  it('a Low gun run shreds a tank under the pipper', () => {
    const sim = new Simulation(makeLevel());
    // Park a tank where the pipper will be in ~0.3 s.
    const pipper = gunPipper(sim.world);
    sim.world.entities.push({
      ...sim.world.entities[0]!,
      id: 999,
      refId: 'tank',
      kind: 'tank',
      team: 'enemy',
      armor: 'armored',
      pos: { x: pipper.x + 10, y: pipper.y },
      hp: 60,
      maxHp: 60,
      radius: 16,
      tags: [],
      mover: null,
      aa: null,
      sam: null,
      attacker: null,
    });
    const events = run(sim, 0.9, { fire: true });
    const tank = sim.world.findByRef('tank');
    expect(tank?.alive).toBe(false);
    expect(events.some((e) => e.type === 'entityDestroyed' && e.kind === 'tank')).toBe(true);
    expect(sim.world.score).toBeGreaterThan(0);
  });

  it('bombs at Medium land ahead and destroy a hardened bridge', () => {
    const level = makeLevel({
      entities: [{ refId: 'bridge', kind: 'bridge', pos: { x: 1600, y: 1000 } }],
    });
    const sim = new Simulation(level);
    sim.step(input({ climb: true, select: 'bombs' }));
    run(sim, 1.2);
    // Fly until the CCIP is on the bridge, then pickle two bombs.
    let dropped = 0;
    for (let i = 0; i < 600 && dropped < 2; i++) {
      const ccipX = sim.world.player.pos.x + sim.world.player.speed * 0.82 * 1.35;
      const fire = ccipX >= 1580;
      sim.step(input({ fire }));
      if (sim.drainEvents().some((e) => e.type === 'bombReleased')) dropped += 1;
    }
    run(sim, 2.5);
    expect(sim.world.findByRef('bridge')?.alive).toBe(false);
  });

  it('bombs land exactly on the CCIP reticle, even from High (no hidden scatter)', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const sim = new Simulation(makeLevel(), seed);
      sim.step(input({ climb: true, select: 'bombs' }));
      sim.step(input({ climb: true }));
      run(sim, 2.5);
      expect(sim.world.player.band).toBe('high');
      const ccip = { ...sim.world.reticle.impact! };
      const speed = sim.world.player.speed;
      sim.step(input({ fire: true }));
      const impact = run(sim, 3).find((e) => e.type === 'ordnanceImpact' && e.weapon === 'bomb');
      expect(impact?.type).toBe('ordnanceImpact');
      if (impact?.type !== 'ordnanceImpact') continue;
      // Within the one sim step the aircraft moves between reading the reticle and releasing.
      expect(Math.hypot(impact.pos.x - ccip.x, impact.pos.y - ccip.y)).toBeLessThanOrEqual(speed / 60 + 1);
    }
  });

  it('Maverick needs a lock at Medium and then kills the target', () => {
    const level = makeLevel({ entities: [{ refId: 't', kind: 'tank', pos: { x: 1650, y: 1000 } }] });
    const sim = new Simulation(level);
    sim.step(input({ climb: true, select: 'maverick' }));
    run(sim, 1.1);
    const events = run(sim, 3, { fire: true });
    expect(events.some((e) => e.type === 'lockAcquired')).toBe(true);
    expect(events.some((e) => e.type === 'missileLaunched')).toBe(true);
    expect(sim.world.findByRef('t')?.alive).toBe(false);
  });
});
