import { describe, expect, it } from 'vitest';
import { threeRoads } from '../../src/content/levels';
import { killEntity } from '../../src/sim/combat';
import type { LaneWarDefinition, LevelDefinition } from '../../src/sim/level';
import { distance } from '../../src/sim/math';
import { Simulation } from '../../src/sim/simulation';
import { ENEMY_WAVE_TAG, laneControl, laneUnits, offsetPath } from '../../src/sim/systems';
import type { EntityKind } from '../../src/sim/types';
import { makeLevel, run } from './helpers';

/**
 * One north→south road between two HQs. Trucks don't shoot, so unit counts are exact; tests that
 * need fighting swap in tanks.
 */
function laneLevel(war: Partial<LaneWarDefinition> = {}, enemyUnits: EntityKind[] = ['truck'], friendlyUnits: EntityKind[] = []): LevelDefinition {
  return makeLevel({
    paths: {
      road: [
        { x: 2000, y: 300 },
        { x: 2000, y: 1000 },
        { x: 2000, y: 1700 },
      ],
      road2: [
        { x: 3200, y: 300 },
        { x: 3200, y: 1700 },
      ],
    },
    entities: [
      { refId: 'enemyHq', kind: 'enemyHq', pos: { x: 2000, y: 120 } },
      { refId: 'friendlyHq', kind: 'friendlyHq', pos: { x: 2000, y: 1880 } },
      { refId: 'depot', kind: 'ammoDump', pos: { x: 2600, y: 400 } },
      { refId: 'depot2', kind: 'ammoDump', pos: { x: 3600, y: 400 } },
    ],
    objectives: [
      { id: 'hq', kind: 'destroy', title: 'Destroy the enemy HQ', primary: true, targetRefIds: ['enemyHq'] },
      { id: 'home', kind: 'defend', title: 'Hold our HQ', primary: true, targetRefId: 'friendlyHq', attackerTags: [ENEMY_WAVE_TAG], until: 'hq' },
      { id: 'depot', kind: 'destroy', title: 'Destroy the depot', primary: false, targetRefIds: ['depot'] },
    ],
    laneWar: {
      enemyHqRefId: 'enemyHq',
      friendlyHqRefId: 'friendlyHq',
      lanes: [{ id: 'main', name: 'Main road', pathId: 'road', offset: 0, depotRefId: 'depot', depotBonus: [], brokenBonus: [], objectiveId: 'depot' }],
      waves: [
        { team: 'enemy', firstAt: 1, interval: 10, speed: 40, spacing: 70, units: enemyUnits, escalation: [], laneCap: 20 },
        ...(friendlyUnits.length > 0
          ? [{ team: 'friendly' as const, firstAt: 1, interval: 10, speed: 40, spacing: 70, units: friendlyUnits, escalation: [], laneCap: 20 }]
          : []),
      ],
      ...war,
    },
  });
}

function enemies(sim: Simulation, laneId = 'main'): number {
  return laneUnits(sim.world, laneId, 'enemy').length;
}

describe('lane war waves', () => {
  it('spawns a wave per road on its interval and escalates on schedule', () => {
    const level = laneLevel();
    const war = level.laneWar;
    if (!war?.waves[0]) throw new Error('bad fixture');
    war.waves[0].escalation = [{ at: 15, add: ['truck', 'truck'] }];
    const sim = new Simulation(level);
    run(sim, 0.9);
    expect(enemies(sim)).toBe(0);
    run(sim, 0.2);
    expect(enemies(sim)).toBe(1);
    run(sim, 9.9); // t ≈ 11
    expect(enemies(sim)).toBe(2);
    run(sim, 10); // t ≈ 21: escalated wave of 3
    expect(enemies(sim)).toBe(5);
  });

  it('staggers roads by their offset', () => {
    const level = laneLevel({
      lanes: [
        { id: 'main', name: 'Main road', pathId: 'road', offset: 0, depotRefId: 'depot', depotBonus: [], brokenBonus: [] },
        { id: 'side', name: 'Side road', pathId: 'road2', offset: 4, depotRefId: 'depot2', depotBonus: [], brokenBonus: [] },
      ],
    });
    const sim = new Simulation(level);
    run(sim, 2);
    expect([enemies(sim, 'main'), enemies(sim, 'side')]).toEqual([1, 0]);
    run(sim, 4);
    expect([enemies(sim, 'main'), enemies(sim, 'side')]).toEqual([1, 1]);
  });

  it('a standing depot reinforces enemy waves; blowing it reinforces ours instead', () => {
    const level = laneLevel(
      { lanes: [{ id: 'main', name: 'Main road', pathId: 'road', offset: 0, depotRefId: 'depot', depotBonus: ['truck'], brokenBonus: ['friendlyTank'] }] },
      ['truck'],
      ['friendlyInfantry'],
    );
    const sim = new Simulation(level);
    run(sim, 1.1);
    expect(enemies(sim)).toBe(2);
    expect(laneUnits(sim.world, 'main', 'friendly').map((e) => e.kind)).toEqual(['friendlyInfantry']);

    const depot = sim.world.findByRef('depot');
    if (!depot) throw new Error('no depot');
    killEntity(sim.world, depot, true);
    const events = run(sim, 10);
    expect(enemies(sim)).toBe(3);
    expect(laneUnits(sim.world, 'main', 'friendly').map((e) => e.kind).sort()).toEqual(['friendlyInfantry', 'friendlyInfantry', 'friendlyTank']);
    expect(events.some((e) => e.type === 'radio' && e.text.includes('Main road depot'))).toBe(true);
  });

  it('never lets a road hold more than its cap of living units', () => {
    const level = laneLevel();
    const wave = level.laneWar?.waves[0];
    if (!wave) throw new Error('bad fixture');
    wave.units = ['truck', 'truck', 'truck'];
    wave.laneCap = 7;
    const sim = new Simulation(level);
    run(sim, 60);
    expect(enemies(sim)).toBe(7);
  });

  it('deploys each wave three abreast on parallel roads', () => {
    const level = laneLevel({}, ['truck', 'truck', 'truck']);
    const sim = new Simulation(level);
    run(sim, 1.1);
    const xs = laneUnits(sim.world, 'main', 'enemy').map((e) => Math.round(e.pos.x)).sort((a, b) => a - b);
    expect(xs).toEqual([1944, 2000, 2056]);
    const right = offsetPath([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], 10);
    // Moving east then south, "right" is south then west: the corner is mitred out to (90, 10).
    expect(right.map((p) => [Math.round(p.x), Math.round(p.y)])).toEqual([[0, 10], [90, 10], [90, 100]]);
  });

  it('opposing waves meet, stop and fight', () => {
    const sim = new Simulation(laneLevel({}, ['tank'], ['friendlyTank']));
    const events = run(sim, 25);
    const enemy = laneUnits(sim.world, 'main', 'enemy')[0];
    const friend = laneUnits(sim.world, 'main', 'friendly')[0];
    expect(enemy && friend).toBeTruthy();
    if (!enemy || !friend) return;
    expect(enemy.attacker?.targetId).toBe(friend.id);
    expect(events.some((e) => e.type === 'groundFire' && e.shooterKind === 'tank')).toBe(true);
    expect(events.some((e) => e.type === 'groundFire' && e.shooterKind === 'friendlyTank')).toBe(true);
    // Engaged movers hold position: they met short of the middle of the road, not at either end.
    const held = { ...enemy.pos };
    run(sim, 1);
    expect(distance(held, enemy.pos)).toBeLessThan(1);
  });

  it('shows the front on the road objective: the meter falls as the enemy pushes down it', () => {
    const sim = new Simulation(laneLevel());
    run(sim, 2);
    const state = sim.world.objectives.find((o) => o.id === 'depot');
    const lane = sim.world.level.laneWar?.lanes[0];
    if (!state || !lane) throw new Error('bad fixture');
    const early = state.meter ?? 0;
    run(sim, 20);
    expect(state.meter).toBeCloseTo(laneControl(sim.world, lane), 5);
    expect(state.meter ?? 1).toBeLessThan(early);
    expect(state.detail).toMatch(/^Road \d+% · \d+ hostiles?$/);
  });

  it('commits reserves to the road where the enemy is losing worst, and says so', () => {
    const level = laneLevel(
      {
        lanes: [
          { id: 'main', name: 'Main road', pathId: 'road', offset: 0, depotRefId: 'depot', depotBonus: [], brokenBonus: [] },
          { id: 'side', name: 'Side road', pathId: 'road2', offset: 0, depotRefId: 'depot2', depotBonus: [], brokenBonus: [] },
        ],
        surge: { every: 2, units: ['tank'] },
      },
      ['truck'],
    );
    const friendly = { team: 'friendly' as const, firstAt: 1, interval: 10, speed: 40, spacing: 70, units: ['friendlyInfantry' as const], escalation: [], laneCap: 20 };
    level.laneWar?.waves.push(friendly);
    const sim = new Simulation(level);
    run(sim, 2);
    // Our side road push is deeper than on the main road.
    for (const e of laneUnits(sim.world, 'side', 'friendly')) e.pos.y -= 600;
    for (const e of laneUnits(sim.world, 'side', 'friendly')) if (e.mover) e.mover.waypoint = 1;
    const events = run(sim, 10);
    expect(laneUnits(sim.world, 'side', 'enemy').some((e) => e.kind === 'tank')).toBe(true);
    expect(laneUnits(sim.world, 'main', 'enemy').some((e) => e.kind === 'tank')).toBe(false);
    expect(events.some((e) => e.type === 'radio' && e.text.includes('reserves committed to the Side road'))).toBe(true);
  });
});

describe('lane war win and loss', () => {
  it('losing our HQ ends the mission in defeat', () => {
    const sim = new Simulation(laneLevel());
    run(sim, 1);
    const hq = sim.world.findByRef('friendlyHq');
    if (!hq) throw new Error('no hq');
    killEntity(sim.world, hq, false);
    const events = run(sim, 0.1);
    expect(sim.world.ended).toBe(true);
    expect(sim.world.results?.outcome).toBe('defeat');
    expect(sim.world.objectives.find((o) => o.id === 'home')?.status).toBe('failed');
    expect(events.some((e) => e.type === 'missionEnded' && e.outcome === 'defeat')).toBe(true);
  });

  it('enemy armor at our HQ shells it down', () => {
    const level = laneLevel({}, ['tank', 'tank', 'tank']);
    const sim = new Simulation(level);
    run(sim, 60);
    const hq = sim.world.findByRef('friendlyHq');
    expect(hq && hq.hp < hq.maxHp).toBe(true);
  });

  it('destroying their HQ completes both primaries, routs the enemy, stops the waves and calls RTB', () => {
    const sim = new Simulation(laneLevel({}, ['tank']));
    run(sim, 1.5);
    const hq = sim.world.findByRef('enemyHq');
    if (!hq) throw new Error('no hq');
    killEntity(sim.world, hq, true);
    run(sim, 0.1);
    expect(sim.world.objectives.find((o) => o.id === 'hq')?.status).toBe('completed');
    expect(sim.world.objectives.find((o) => o.id === 'home')?.status).toBe('completed');
    expect(sim.world.rtb).toBe(true);
    const routed = laneUnits(sim.world, 'main', 'enemy');
    expect(routed.length).toBe(1);
    expect(routed.every((e) => e.attacker === null && !e.tags.includes(ENEMY_WAVE_TAG))).toBe(true);
    run(sim, 30);
    expect(enemies(sim)).toBe(1);

    // Land at home base: victory.
    const p = sim.world.player;
    p.pos = { ...sim.world.homeBasePos() };
    run(sim, 0.1);
    expect(sim.world.results?.outcome).toBe('victory');
  });
});

describe('Three Roads level', () => {
  it('is registered with three roads, an HQ each side and a depot per road', () => {
    const war = threeRoads.laneWar;
    expect(war?.lanes.map((l) => l.id)).toEqual(['west', 'center', 'east']);
    for (const lane of war?.lanes ?? []) {
      expect(threeRoads.paths[lane.pathId]?.length).toBeGreaterThan(2);
      expect(threeRoads.entities.some((e) => e.refId === lane.depotRefId && e.kind === 'ammoDump')).toBe(true);
    }
    expect(threeRoads.entities.find((e) => e.refId === 'enemyHq')?.kind).toBe('enemyHq');
    expect(threeRoads.entities.find((e) => e.refId === 'friendlyHq')?.kind).toBe('friendlyHq');
  });

  it('runs four minutes headless with no input, with waves on every road and a bounded world', () => {
    const sim = new Simulation(threeRoads);
    expect(() => run(sim, 240)).not.toThrow();
    for (const lane of ['west', 'center', 'east']) {
      expect(laneUnits(sim.world, lane, 'enemy').length).toBeGreaterThan(0);
      expect(laneUnits(sim.world, lane, 'enemy').length).toBeLessThanOrEqual(16);
      expect(laneUnits(sim.world, lane, 'friendly').length).toBeLessThanOrEqual(10);
    }
    // Wrecks are pruned, so a long mission doesn't accumulate every unit ever spawned.
    expect(sim.world.entities.length).toBeLessThan(160);
  });
});
