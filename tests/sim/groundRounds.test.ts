import { describe, expect, it } from 'vitest';
import { GROUND_ROUNDS, groundRoundFor } from '../../src/config';
import { damageEntity } from '../../src/sim/combat';
import type { Entity } from '../../src/sim/entities';
import type { SimEvent, SimEventOf } from '../../src/sim/events';
import { Simulation } from '../../src/sim/simulation';
import { input, makeLevel, run } from './helpers';

/** An enemy tank and a friendly tank parked in range of each other, far from the aircraft. */
function duelSim(seed = 42): Simulation {
  return new Simulation(
    makeLevel({
      seed,
      entities: [
        { refId: 'enemy', kind: 'tank', pos: { x: 3000, y: 400 } },
        { refId: 'friend', kind: 'friendlyTank', pos: { x: 3300, y: 400 } },
        { refId: 'bystander', kind: 'friendlyInfantry', pos: { x: 3300, y: 1400 } },
      ],
    }),
  );
}

function unit(sim: Simulation, refId: string): Entity {
  const e = sim.world.findByRef(refId);
  if (!e) throw new Error(`no ${refId}`);
  return e;
}

/** Step until the enemy tank fires; returns that event. */
function untilEnemyFires(sim: Simulation): SimEventOf<'groundFire'> {
  for (let i = 0; i < 60 * 30; i++) {
    sim.step(input());
    const shot = sim.drainEvents().find((e): e is SimEventOf<'groundFire'> => e.type === 'groundFire' && e.shooterKind === 'tank');
    if (shot) return shot;
  }
  throw new Error('the tank never fired');
}

function impacts(events: SimEvent[]): SimEventOf<'groundRoundImpact'>[] {
  return events.filter((e): e is SimEventOf<'groundRoundImpact'> => e.type === 'groundRoundImpact' && e.shooterKind === 'tank');
}

describe('ground rounds', () => {
  it('tanks fire slower shells than infantry', () => {
    expect(groundRoundFor('tank')).toBe('cannon');
    expect(groundRoundFor('friendlyInfantry')).toBe('smallArms');
    expect(GROUND_ROUNDS.cannon.speed).toBeLessThan(GROUND_ROUNDS.smallArms.speed);
  });

  it('deals damage when the round lands, not when it is fired', () => {
    const sim = duelSim();
    const friend = unit(sim, 'friend');
    const shot = untilEnemyFires(sim);
    expect(shot.round).toBe('cannon');
    expect(shot.flightTime).toBeCloseTo(Math.hypot(shot.to.x - shot.from.x, shot.to.y - shot.from.y) / GROUND_ROUNDS.cannon.speed);
    const before = friend.hp;

    // Still in flight just short of its flight time.
    const inFlight = run(sim, shot.flightTime - 2 / 60);
    expect(impacts(inFlight)).toHaveLength(0);
    expect(friend.hp).toBe(before);

    const landed = impacts(run(sim, 3 / 60));
    expect(landed).toHaveLength(1);
    expect(landed[0]).toMatchObject({ pos: shot.to, hit: true, armored: true });
    expect(friend.hp).toBeLessThan(before);
  });

  it('lands harmlessly at its aim point if the target dies in flight', () => {
    const sim = duelSim();
    const shot = untilEnemyFires(sim);
    const bystander = unit(sim, 'bystander');
    damageEntity(sim.world, unit(sim, 'friend'), 9999, 'bomb');
    sim.drainEvents();
    const events = run(sim, shot.flightTime + 0.1);
    expect(impacts(events)).toEqual([expect.objectContaining({ pos: shot.to, hit: false })]);
    // Only the enemy tank (shot by the friend's earlier round) can have been hurt.
    const enemyId = unit(sim, 'enemy').id;
    expect(events.some((e) => e.type === 'entityDamaged' && e.entityId !== enemyId)).toBe(false);
    expect(bystander.hp).toBe(bystander.maxHp);
  });

  it('hits whatever opposing unit is at the aim point when it lands', () => {
    const sim = duelSim();
    const shot = untilEnemyFires(sim);
    damageEntity(sim.world, unit(sim, 'friend'), 9999, 'bomb');
    const bystander = unit(sim, 'bystander');
    bystander.pos = { ...shot.to };
    const before = bystander.hp;
    const events = run(sim, shot.flightTime + 0.1);
    expect(impacts(events)).toEqual([expect.objectContaining({ hit: true, armored: false })]);
    expect(bystander.hp).toBeLessThan(before);
  });

  it('is deterministic for a given seed', () => {
    const trace = (sim: Simulation) =>
      run(sim, 20)
        .filter((e) => e.type === 'groundFire' || e.type === 'groundRoundImpact')
        .map((e) => JSON.stringify(e));
    expect(trace(duelSim(7))).toEqual(trace(duelSim(7)));
  });
});
