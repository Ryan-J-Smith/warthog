import { describe, expect, it } from 'vitest';
import { PLAYER } from '../../src/config';
import { DEFAULT_LOADOUT } from '../../src/sim/loadout';
import { Simulation } from '../../src/sim/simulation';
import { damagePlayer } from '../../src/sim/systems';
import { input, makeLevel, run } from './helpers';

describe('player lives and rearm', () => {
  it('respawns at base after dying, losing a life', () => {
    const sim = new Simulation(makeLevel());
    damagePlayer(sim.world, 999, 'aa', sim.world.player.pos);
    expect(sim.world.player.alive).toBe(false);
    expect(sim.world.player.lives).toBe(PLAYER.lives - 1);
    const events = run(sim, PLAYER.respawnDelay + 0.1);
    expect(events.some((e) => e.type === 'playerRespawned')).toBe(true);
    expect(sim.world.player.alive).toBe(true);
    expect(sim.world.player.invulnerable).toBeGreaterThan(0);
  });

  it('game over after the last life', () => {
    const sim = new Simulation(makeLevel());
    for (let i = 0; i < PLAYER.lives; i++) {
      sim.world.player.invulnerable = 0;
      damagePlayer(sim.world, 999, 'aa', sim.world.player.pos);
      run(sim, PLAYER.respawnDelay + 0.1);
    }
    expect(sim.world.ended).toBe(true);
    expect(sim.world.results?.outcome).toBe('defeat');
  });

  it('rearms when holding Low over the home base', () => {
    const sim = new Simulation(makeLevel({ player: { spawn: { x: 500, y: 1500 }, headingDeg: 0 } }));
    sim.world.player.ammo.bombs = 0;
    sim.world.player.hp = 40;
    // Circle tightly over the base.
    const events = run(sim, PLAYER.rearmTime + 0.5, { turn: 1 });
    expect(events.some((e) => e.type === 'rearmCompleted')).toBe(true);
    expect(sim.world.player.ammo.bombs).toBe(DEFAULT_LOADOUT.ammo.bombs);
    expect(sim.world.player.hp).toBe(sim.world.player.maxHp);
  });

  it('flying away cancels a rearm in progress', () => {
    const sim = new Simulation(makeLevel({ player: { spawn: { x: 500, y: 1500 }, headingDeg: 0 } }));
    sim.world.player.ammo.bombs = 0;
    const events = run(sim, 2.5);
    expect(events.some((e) => e.type === 'rearmStarted')).toBe(true);
    expect(events.some((e) => e.type === 'rearmCancelled')).toBe(true);
    void input;
  });
});
