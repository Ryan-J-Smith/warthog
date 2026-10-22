import { describe, expect, it } from 'vitest';
import { ENTITY_STATS, PICKUPS } from '../../src/config';
import { damageEntity } from '../../src/sim/combat';
import type { Entity, MlrsStrike } from '../../src/sim/entities';
import type { SimEvent } from '../../src/sim/events';
import type { EntitySpawn, LevelDefinition } from '../../src/sim/level';
import { distance, type Vec2 } from '../../src/sim/math';
import { Simulation } from '../../src/sim/simulation';
import { input, makeLevel, run } from './helpers';

const MLRS = ENTITY_STATS.mlrs.mlrs!;
/** Seconds from the rings appearing to the last one landing. */
const BARRAGE_TIME = MLRS.telegraphTime + (MLRS.pattern.length - 1) * MLRS.rippleInterval;

function mlrsSim(entities: EntitySpawn[], overrides: Partial<LevelDefinition> = {}): { sim: Simulation; mlrs: Entity } {
  const sim = new Simulation(makeLevel({ ...overrides, entities }));
  const mlrs = sim.world.findByRef('mlrs');
  if (!mlrs?.mlrs) throw new Error('no MLRS');
  return { sim, mlrs };
}

/** Skip the first-barrage delay: the next step starts a barrage on whatever it is targeting. */
function readyToFire(mlrs: Entity): void {
  mlrs.mlrs!.targetId = -1;
  mlrs.mlrs!.cooldown = 0;
}

function climbToHigh(sim: Simulation): void {
  sim.step(input({ climb: true }));
  sim.step(input({ climb: true }));
  run(sim, 2.2);
}

type Reaction = 'hold' | 'turn' | 'boost' | 'climb';

/**
 * One barrage at the aircraft: it flies east at its band, reacts `delay` s after the rings appear,
 * and we count the rings it is inside when they land.
 */
function barrage(react: Reaction, opts: { medium?: boolean; delay?: number; turn?: number; launcher?: Vec2 } = {}): { rings: number; hits: number } {
  const { sim, mlrs } = mlrsSim([{ refId: 'mlrs', kind: 'mlrs', pos: opts.launcher ?? { x: 1900, y: 1750 }, headingDeg: -90 }]);
  if (opts.medium) {
    sim.step(input({ climb: true }));
    run(sim, 1);
  }
  readyToFire(mlrs);
  const delay = opts.delay ?? 0.3;
  let shownAt: number | null = null;
  let rings = 0;
  let hits = 0;
  for (let i = 0; i < 60 * (BARRAGE_TIME + 0.6); i++) {
    const go = shownAt !== null && sim.world.time >= shownAt + delay;
    sim.step(
      input({
        turn: react === 'turn' && go ? opts.turn ?? 1 : 0,
        boost: react === 'boost' && go,
        climb: react === 'climb' && go && sim.world.player.band !== 'high',
      }),
    );
    for (const e of sim.drainEvents()) {
      if (e.type === 'mlrsTargeting' && shownAt === null) shownAt = sim.world.time;
      if (e.type === 'mlrsImpact') {
        rings += 1;
        if (e.hitPlayer) hits += 1;
      }
    }
  }
  return { rings, hits };
}

describe('MLRS rocket artillery', () => {
  it('shells a Low player in range, and the rings precede every impact by the full telegraph', () => {
    const { sim, mlrs } = mlrsSim([{ refId: 'mlrs', kind: 'mlrs', pos: { x: 1600, y: 1750 } }]);
    let shownAt: number | null = null;
    const impacts: number[] = [];
    for (let i = 0; i < 60 * 8; i++) {
      sim.step(input());
      for (const e of sim.drainEvents()) {
        if (e.type === 'mlrsTargeting' && shownAt === null) {
          expect(e.atPlayer).toBe(true);
          shownAt = sim.world.time;
        }
        if (e.type === 'mlrsImpact') impacts.push(sim.world.time);
      }
      if (shownAt === null) expect(sim.world.projectiles.some((p) => p.kind === 'mlrsRocket')).toBe(false);
    }
    expect(shownAt).not.toBeNull();
    // The first barrage waits for the first-barrage delay after it finds the aircraft.
    expect(shownAt!).toBeGreaterThanOrEqual(MLRS.firstBarrageDelay - 1e-6);
    expect(impacts.length).toBe(MLRS.pattern.length);
    expect(Math.min(...impacts) - shownAt!).toBeGreaterThanOrEqual(MLRS.telegraphTime - 1e-6);
    expect(mlrs.spotted).toBe(true);
  });

  it('lands every rocket exactly on its shown ring, with the drawn radius', () => {
    const { sim, mlrs } = mlrsSim([{ refId: 'mlrs', kind: 'mlrs', pos: { x: 1900, y: 1750 } }]);
    readyToFire(mlrs);
    sim.step(input());
    const live: MlrsStrike[] = mlrs.mlrs!.strikes.slice();
    const shown: MlrsStrike[] = live.map((s) => ({ ...s, pos: { ...s.pos } }));
    expect(shown).toHaveLength(MLRS.pattern.length);
    const impacts: Array<{ pos: Vec2; radius: number }> = [];
    // Each rocket's last sighting (it is removed the step it lands), and how far it flies per step.
    const lastSeen = new Map<number, { pos: Vec2; step: number; aim: Vec2 | null }>();
    for (let i = 0; i < 60 * 3; i++) {
      sim.step(input({ turn: i > 30 ? 1 : 0 }));
      for (const p of sim.world.projectiles) {
        if (p.kind === 'mlrsRocket') lastSeen.set(p.id, { pos: { ...p.pos }, step: Math.hypot(p.vel.x, p.vel.y) / 60, aim: p.aimPoint });
      }
      for (const e of sim.drainEvents()) if (e.type === 'mlrsImpact') impacts.push({ pos: e.pos, radius: e.radius });
      // The rings never move once shown (the aircraft turning away doesn't drag them).
      for (const s of mlrs.mlrs!.strikes) expect(shown.some((r) => distance(r.pos, s.pos) < 1e-9)).toBe(true);
    }
    expect(impacts).toHaveLength(shown.length);
    impacts.forEach((hit, i) => {
      const ring = shown[i]!;
      expect(distance(hit.pos, ring.pos)).toBeLessThan(1e-9);
      expect(hit.radius).toBe(MLRS.ringRadius);
      // The rocket's ground track ends on the ring.
      const rocket = lastSeen.get(live[i]!.rocketId ?? -1);
      expect(rocket).toBeDefined();
      expect(distance(rocket!.aim!, ring.pos)).toBeLessThan(1e-9);
      expect(distance(rocket!.pos, ring.pos)).toBeLessThanOrEqual(rocket!.step + 1);
    });
  });

  it('hits an aircraft that holds its course; turning, boosting or climbing out dodges', () => {
    const report: string[] = [];
    for (const medium of [false, true]) {
      const tally = (react: Reaction, runs: Array<{ delay?: number; turn?: number; launcher?: Vec2 }>): number => {
        let rings = 0;
        let hits = 0;
        let barragesHit = 0;
        for (const o of runs) {
          const r = barrage(react, { ...o, medium });
          rings += r.rings;
          hits += r.hits;
          if (r.hits > 0) barragesHit += 1;
        }
        expect(rings).toBe(runs.length * MLRS.pattern.length);
        report.push(`${medium ? 'medium' : 'low'} ${react}: ${barragesHit}/${runs.length} barrages hit, ${hits} rings`);
        return barragesHit / runs.length;
      };
      const launchers = [
        { x: 1900, y: 1750 },
        { x: 1000, y: 1800 },
        { x: 2100, y: 350 },
        { x: 400, y: 600 },
      ];
      expect(tally('hold', launchers.map((launcher) => ({ launcher })))).toBe(1);
      const reactions = launchers.flatMap((launcher) => [0.2, 0.6].map((delay) => ({ launcher, delay })));
      expect(tally('turn', reactions)).toBe(0);
      expect(tally('turn', reactions.map((r) => ({ ...r, turn: -1 })))).toBe(0);
      expect(tally('boost', reactions)).toBe(0);
      expect(tally('climb', reactions)).toBe(0);
    }
    console.log(report.join('\n'));
  });

  it('does no more than one ring of damage to an aircraft that holds course', () => {
    const r = barrage('hold');
    expect(r.hits).toBe(1);
  });

  it('cannot shell an aircraft inside its minimum range, or one at High: friendlies get it instead', () => {
    const { sim } = mlrsSim([
      { refId: 'mlrs', kind: 'mlrs', pos: { x: 1300, y: 1000 } },
      { refId: 'tank', kind: 'friendlyTank', pos: { x: 1300, y: 300 } },
    ]);
    climbToHigh(sim);
    expect(sim.world.player.band).toBe('high');
    const events = run(sim, 8);
    expect(events.some((e) => e.type === 'mlrsTargeting' && e.atPlayer)).toBe(false);
    expect(events.some((e) => e.type === 'mlrsTargeting' && !e.atPlayer)).toBe(true);
    const tank = sim.world.findByRef('tank')!;
    expect(tank.hp).toBeLessThan(tank.maxHp);
    expect(events.some((e) => e.type === 'shieldHit' || e.type === 'playerHit')).toBe(false);
  });

  it('shells the nearest friendly when the aircraft is out of range', () => {
    const { sim } = mlrsSim(
      [
        { refId: 'mlrs', kind: 'mlrs', pos: { x: 3500, y: 1000 } },
        { refId: 'outpost', kind: 'outpost', pos: { x: 3500, y: 1700 } },
        { refId: 'far', kind: 'friendlyTank', pos: { x: 3500, y: 100 } },
      ],
      { player: { spawn: { x: 400, y: 400 }, headingDeg: 180 } },
    );
    const events = run(sim, 4.5);
    const aim = events.find((e): e is Extract<SimEvent, { type: 'mlrsTargeting' }> => e.type === 'mlrsTargeting');
    expect(aim?.atPlayer).toBe(false);
    expect(distance(aim!.center, { x: 3500, y: 1700 })).toBeLessThan(1);
    const outpost = sim.world.findByRef('outpost')!;
    expect(outpost.hp).toBeLessThan(outpost.maxHp);
    expect(sim.world.findByRef('far')!.hp).toBe(ENTITY_STATS.friendlyTank.hp);
  });

  it('only fires once it has parked at the end of its route', () => {
    const { sim, mlrs } = mlrsSim([{ refId: 'mlrs', kind: 'mlrs', pos: { x: 1800, y: 1700 }, pathId: 'drive' }], {
      paths: { drive: [{ x: 1800, y: 1700 }, { x: 2100, y: 1700 }] },
    });
    let firedAt: number | null = null;
    let parkedAt: number | null = null;
    for (let i = 0; i < 60 * 20 && firedAt === null; i++) {
      sim.step(input({ turn: 1 }));
      if (parkedAt === null && mlrs.mover?.halted) parkedAt = sim.world.time;
      for (const e of sim.drainEvents()) if (e.type === 'mlrsTargeting') firedAt = sim.world.time;
    }
    expect(parkedAt).not.toBeNull();
    expect(firedAt).not.toBeNull();
    expect(firedAt!).toBeGreaterThanOrEqual(parkedAt! + MLRS.firstBarrageDelay - 1e-6);
  });

  it('keeps a steady cadence', () => {
    const { sim } = mlrsSim([{ refId: 'mlrs', kind: 'mlrs', pos: { x: 1600, y: 1750 } }]);
    const times: number[] = [];
    for (let i = 0; i < 60 * 30; i++) {
      sim.step(input({ turn: 0.4 }));
      for (const e of sim.drainEvents()) if (e.type === 'mlrsTargeting') times.push(sim.world.time);
    }
    expect(times.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < times.length; i++) expect(times[i]! - times[i - 1]!).toBeGreaterThanOrEqual(MLRS.barrageInterval - 1e-6);
  });

  it('pays out big and drops repair + ammo when the player kills it', () => {
    const { sim, mlrs } = mlrsSim([{ refId: 'mlrs', kind: 'mlrs', pos: { x: 2500, y: 1000 } }]);
    damageEntity(sim.world, mlrs, 999, 'gun');
    const events = sim.drainEvents();
    expect(mlrs.alive).toBe(false);
    expect(sim.world.score).toBe(ENTITY_STATS.mlrs.score);
    expect(ENTITY_STATS.mlrs.score).toBeGreaterThanOrEqual(800);
    expect(sim.world.stats.kills).toBe(1);
    const drops = events.filter((e) => e.type === 'pickupSpawned').map((e) => (e.type === 'pickupSpawned' ? e.kind : null));
    expect(drops).toEqual([...(PICKUPS.dropsByKind.mlrs ?? [])]);
    expect(drops).toEqual(expect.arrayContaining(['repair', 'ammo']));
  });

  it('a dead launcher fires no more, but rockets already in the air still land on their rings', () => {
    const { sim, mlrs } = mlrsSim([{ refId: 'mlrs', kind: 'mlrs', pos: { x: 1900, y: 1750 } }]);
    readyToFire(mlrs);
    sim.step(input());
    // Kill it once the first rockets are up.
    while (!mlrs.mlrs!.strikes.some((s) => s.launched)) sim.step(input());
    const inFlight = mlrs.mlrs!.strikes.filter((s) => s.launched).length;
    expect(inFlight).toBeLessThan(MLRS.pattern.length);
    damageEntity(sim.world, mlrs, 999, 'gun');
    sim.drainEvents();
    const events = run(sim, 3);
    expect(events.filter((e) => e.type === 'mlrsImpact')).toHaveLength(inFlight);
    expect(events.some((e) => e.type === 'mlrsTargeting' || e.type === 'mlrsLaunched')).toBe(false);
    expect(mlrs.mlrs!.strikes).toHaveLength(0);
  });

  it('fires an artilleryFiring radio cue on its first barrage', () => {
    const { sim } = mlrsSim([{ refId: 'mlrs', kind: 'mlrs', pos: { x: 1600, y: 1750 } }], {
      radio: [{ trigger: { kind: 'artilleryFiring', refId: 'mlrs' }, speaker: 'OVERLORD', tone: 'urgent', text: 'Rocket artillery!' }],
    });
    const before = run(sim, MLRS.firstBarrageDelay - 0.5);
    expect(before.some((e) => e.type === 'radio')).toBe(false);
    const after = run(sim, 1.5);
    expect(after.some((e) => e.type === 'radio' && e.text === 'Rocket artillery!')).toBe(true);
  });
});
