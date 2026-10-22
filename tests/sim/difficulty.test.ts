import { describe, expect, it } from 'vitest';
import { ENTITY_STATS } from '../../src/config';
import { damageEntity } from '../../src/sim/combat';
import { DIFFICULTIES } from '../../src/sim/difficulty';
import { DEFAULT_LOADOUT } from '../../src/sim/loadout';
import { Simulation } from '../../src/sim/simulation';
import { damagePlayer, endMission } from '../../src/sim/systems';
import { makeLevel } from './helpers';

function sim(id: keyof typeof DIFFICULTIES): Simulation {
  return new Simulation(makeLevel({ entities: [{ kind: 'tank', pos: { x: 2000, y: 400 } }] }), undefined, undefined, DEFAULT_LOADOUT, DIFFICULTIES[id]);
}

describe('difficulty', () => {
  it('defaults to regular', () => {
    const s = new Simulation(makeLevel());
    expect(s.world.difficulty.id).toBe('regular');
    expect(s.world.aaFireRate).toBe(1);
  });

  it('scales damage taken', () => {
    for (const id of ['recruit', 'regular', 'ace'] as const) {
      const s = sim(id);
      damagePlayer(s.world, 20, 'aa', s.world.player.pos);
      expect(s.world.player.shield).toBeCloseTo(DEFAULT_LOADOUT.maxShield - 20 * DIFFICULTIES[id].damageTaken);
    }
  });

  it('scales kill points and records the difficulty in the results', () => {
    const s = sim('ace');
    const tank = s.world.entities.find((e) => e.kind === 'tank')!;
    damageEntity(s.world, tank, 999, 'bomb');
    expect(s.world.stats.killPoints).toBe(Math.round(ENTITY_STATS.tank.score * DIFFICULTIES.ace.scoreMultiplier));
    endMission(s.world, 'victory');
    expect(s.world.results?.difficulty).toBe('ace');
  });

  it('scales enemy fire rate', () => {
    const s = sim('ace');
    expect(s.world.aaFireRate).toBe(DIFFICULTIES.ace.enemyFireRate);
  });
});
