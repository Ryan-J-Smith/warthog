import { describe, expect, it } from 'vitest';
import { STRAFE } from '../../src/config';
import type { SimEvent } from '../../src/sim/events';
import type { EntitySpawn } from '../../src/sim/level';
import { Simulation } from '../../src/sim/simulation';
import { makeLevel, run } from './helpers';

/** Infantry strung along the aircraft's track (it spawns at (1000, 1000) heading east, at Low). */
function strafeSim(units: EntitySpawn[]): Simulation {
  return new Simulation(makeLevel({ entities: units }));
}

const strafeBonus = (events: SimEvent[]) =>
  events.filter((e) => e.type === 'scoreAwarded' && e.reason.startsWith('STRAFE'));

describe('strafing passes', () => {
  it('one held pass through a soft group kills several and pays STRAFE ×N', () => {
    const column = [1300, 1360, 1420, 1480].map((x, i): EntitySpawn => ({ refId: `inf${i}`, kind: 'infantry', pos: { x, y: 1000 + (i % 2 ? 14 : -14) } }));
    const sim = strafeSim(column);
    const events = [...run(sim, 2.5, { fire: true }), ...run(sim, STRAFE.window + 0.3)];
    const dead = column.filter((u) => sim.world.findByRef(u.refId ?? '')?.alive === false).length;
    expect(dead).toBeGreaterThanOrEqual(STRAFE.minKills);
    expect(events.some((e) => e.type === 'strafeKill' && e.count >= 2)).toBe(true);
    const bonus = strafeBonus(events);
    expect(bonus).toHaveLength(1);
    expect(bonus[0]).toMatchObject({ reason: `STRAFE ×${dead}`, points: dead * STRAFE.bonusPerKill });
  });

  it('a lone kill is not a strafe', () => {
    const sim = strafeSim([{ refId: 'inf', kind: 'infantry', pos: { x: 1300, y: 1000 } }]);
    const events = [...run(sim, 2.5, { fire: true }), ...run(sim, STRAFE.window + 0.3)];
    expect(sim.world.findByRef('inf')?.alive).toBe(false);
    expect(events.some((e) => e.type === 'strafeKill')).toBe(false);
    expect(strafeBonus(events)).toHaveLength(0);
  });
});
