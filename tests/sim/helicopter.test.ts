import { describe, expect, it } from 'vitest';
import { ENTITY_STATS } from '../../src/config';
import { applySplash, canDamage, damageEntity } from '../../src/sim/combat';
import type { Entity } from '../../src/sim/entities';
import type { SimEvent } from '../../src/sim/events';
import type { EntitySpawn, LevelDefinition } from '../../src/sim/level';
import { angleDelta, angleOf, clamp, distance, sub } from '../../src/sim/math';
import { Simulation } from '../../src/sim/simulation';
import { HelicopterSystem, gunPipper } from '../../src/sim/systems';
import { input, makeLevel, run } from './helpers';

const HELI = ENTITY_STATS.helicopter.heli!;

function heliSim(entities: EntitySpawn[], overrides: Partial<LevelDefinition> = {}, seed?: number): { sim: Simulation; heli: Entity } {
  const sim = new Simulation(makeLevel({ ...overrides, entities }), seed);
  const heli = sim.world.findByRef('heli');
  if (!heli?.heli) throw new Error('no helicopter');
  return { sim, heli };
}

/** Point the helicopter's nose at the player and clear its salvo delay, so the next salvo comes at once. */
function readyToFire(sim: Simulation, heli: Entity): void {
  const p = sim.world.player.pos;
  heli.heading = Math.atan2(p.y - heli.pos.y, p.x - heli.pos.x);
  heli.heli!.targetId = -1;
  heli.heli!.cooldown = 0;
}

function rocketHits(events: readonly SimEvent[]): number {
  return events.filter((e) => e.type === 'heliRocketExploded' && e.hitPlayer).length;
}

function climbToHigh(sim: Simulation): void {
  sim.step(input({ climb: true }));
  sim.step(input({ climb: true }));
  run(sim, 2.2);
}

describe('attack helicopter', () => {
  it('engages a Low player in range with a telegraphed salvo', () => {
    const { sim } = heliSim([{ refId: 'heli', kind: 'helicopter', pos: { x: 1600, y: 1000 }, headingDeg: 180 }]);
    const events = run(sim, 4);
    const aim = events.findIndex((e) => e.type === 'heliAiming' && e.atPlayer);
    const fired = events.findIndex((e) => e.type === 'heliRocketsFired');
    expect(aim).toBeGreaterThanOrEqual(0);
    expect(fired).toBeGreaterThan(aim);
    expect(sim.world.findByRef('heli')?.spotted).toBe(true);
  });

  it('also engages a Medium player', () => {
    const { sim } = heliSim([{ refId: 'heli', kind: 'helicopter', pos: { x: 1700, y: 1000 }, headingDeg: 180 }]);
    sim.step(input({ climb: true }));
    const events = run(sim, 4);
    expect(sim.world.player.band).toBe('medium');
    expect(events.some((e) => e.type === 'heliAiming' && e.atPlayer)).toBe(true);
  });

  it('telegraphs for the full aim time before any rocket flies', () => {
    const { sim, heli } = heliSim([{ refId: 'heli', kind: 'helicopter', pos: { x: 1500, y: 1000 }, headingDeg: 180 }]);
    readyToFire(sim, heli);
    let aimedAt: number | null = null;
    let firedAt: number | null = null;
    for (let i = 0; i < 180 && firedAt === null; i++) {
      sim.step(input());
      for (const e of sim.drainEvents()) {
        if (e.type === 'heliAiming' && aimedAt === null) aimedAt = sim.world.time;
        if (e.type === 'heliRocketsFired') firedAt = sim.world.time;
      }
      if (aimedAt === null) expect(sim.world.projectiles.some((p) => p.kind === 'heliRocket')).toBe(false);
    }
    expect(aimedAt).not.toBeNull();
    expect(firedAt).not.toBeNull();
    expect(firedAt! - aimedAt!).toBeGreaterThanOrEqual(HELI.aimTime - 1e-6);
  });

  it('hits an aircraft that ignores the telegraph and flies straight at it', () => {
    const { sim, heli } = heliSim([{ refId: 'heli', kind: 'helicopter', pos: { x: 1450, y: 1000 }, headingDeg: 180 }]);
    readyToFire(sim, heli);
    const events = run(sim, 1.8);
    expect(events.some((e) => e.type === 'heliRocketsFired')).toBe(true);
    expect(rocketHits(events)).toBeGreaterThanOrEqual(2);
    expect(events.some((e) => (e.type === 'shieldHit' || e.type === 'playerHit') && e.source === 'splash')).toBe(true);
  });

  it('a crossing aircraft that holds course gets hit; boosting or turning once the line locks dodges', () => {
    // Player flies east; the helicopter is 420 u to the south, nose already near the player.
    const salvo = (react: 'none' | 'boost' | 'turn', seed: number): { fired: number; hits: number } => {
      const { sim, heli } = heliSim([{ refId: 'heli', kind: 'helicopter', pos: { x: 1000, y: 1420 } }], {}, seed);
      readyToFire(sim, heli);
      heli.heading += 0.3;
      let lockAt = Infinity;
      let fired = 0;
      let hits = 0;
      for (let i = 0; i < 60 * 2.5; i++) {
        const go = sim.world.time >= lockAt;
        sim.step(input({ boost: react === 'boost' && go, turn: react === 'turn' && go ? -1 : 0 }));
        for (const e of sim.drainEvents()) {
          if (e.type === 'heliAiming' && lockAt === Infinity) lockAt = sim.world.time + HELI.aimTime - HELI.lockTime;
          if (e.type === 'heliRocketsFired') fired += HELI.rockets;
          if (e.type === 'heliRocketExploded' && e.hitPlayer) hits += 1;
        }
      }
      return { fired, hits };
    };
    for (const react of ['none', 'boost', 'turn'] as const) {
      let fired = 0;
      let hits = 0;
      for (const seed of [1, 2, 3, 4]) {
        const r = salvo(react, seed);
        fired += r.fired;
        hits += r.hits;
      }
      expect(fired).toBeGreaterThanOrEqual(12);
      if (react === 'none') expect(hits / fired).toBeGreaterThanOrEqual(0.5);
      else expect(hits / fired).toBeLessThan(0.2);
    }
  });

  it('is immune to bombs, Maverick splash, secondaries and ground fire, but not the gun or rockets', () => {
    const { sim, heli } = heliSim([{ refId: 'heli', kind: 'helicopter', pos: { x: 2500, y: 1000 } }]);
    const w = sim.world;
    applySplash(w, heli.pos, 100, 500, 'bomb');
    applySplash(w, heli.pos, 100, 500, 'maverick');
    applySplash(w, heli.pos, 100, 500, 'secondary');
    damageEntity(w, heli, 500, 'ground');
    expect(heli.hp).toBe(heli.maxHp);
    expect(heli.alive).toBe(true);
    expect(canDamage(heli, 'bomb')).toBe(false);
    expect(canDamage(heli, 'gun')).toBe(true);
    expect(canDamage(heli, 'rocket')).toBe(true);
    applySplash(w, heli.pos, 40, 10, 'rocket');
    expect(heli.hp).toBe(heli.maxHp - 10);
  });

  it('is not a target for ground units or the Maverick seeker', () => {
    // No helicopter brain: it hovers next to the tank and inside the seeker cone.
    const sim = new Simulation(
      makeLevel({
        entities: [
          { refId: 'heli', kind: 'helicopter', pos: { x: 1500, y: 1000 } },
          { kind: 'friendlyTank', pos: { x: 1500, y: 1100 } },
        ],
      }),
      undefined,
      Simulation.defaultSystems().filter((s) => !(s instanceof HelicopterSystem)),
    );
    sim.step(input({ climb: true, select: 'maverick' }));
    run(sim, 2);
    const heli = sim.world.findByRef('heli')!;
    expect(heli.hp).toBe(heli.maxHp);
    expect(heli.mover).toBeNull();
    expect(sim.world.player.lockTargetId).toBeNull();
  });

  it('goes down to a Low gun run and drops a boost pickup', () => {
    const { sim, heli } = heliSim([{ refId: 'heli', kind: 'helicopter', pos: { x: 1500, y: 1000 }, headingDeg: 180 }]);
    // A simple pilot: nose on the helicopter, boost to close in, trigger down while the pipper is on it.
    const events: SimEvent[] = [];
    for (let i = 0; i < 60 * 8 && heli.alive; i++) {
      const p = sim.world.player;
      const off = angleDelta(p.heading, angleOf(sub(heli.pos, p.pos)));
      const onIt = distance(gunPipper(sim.world), heli.pos) < heli.radius + 25;
      sim.step(input({ turn: clamp(off * 4, -1, 1), fire: onIt, boost: distance(p.pos, heli.pos) > 300 }));
      events.push(...sim.drainEvents());
    }
    events.push(...run(sim, 0.1));
    expect(heli.alive).toBe(false);
    expect(events.some((e) => e.type === 'entityDestroyed' && e.kind === 'helicopter')).toBe(true);
    expect(events.some((e) => e.type === 'pickupSpawned' && e.kind === 'boost')).toBe(true);
    expect(sim.world.stats.kills).toBe(1);
    expect(sim.world.score).toBeGreaterThanOrEqual(ENTITY_STATS.helicopter.score);
  });

  it('ignores a High player and rockets friendlies instead', () => {
    const { sim } = heliSim([
      { refId: 'heli', kind: 'helicopter', pos: { x: 1300, y: 1000 }, headingDeg: 90 },
      { refId: 'tank', kind: 'friendlyTank', pos: { x: 1300, y: 1450 } },
    ]);
    climbToHigh(sim);
    expect(sim.world.player.band).toBe('high');
    const events = run(sim, 8);
    expect(events.some((e) => e.type === 'heliAiming' && e.atPlayer)).toBe(false);
    expect(events.some((e) => e.type === 'heliAiming' && !e.atPlayer)).toBe(true);
    expect(events.some((e) => e.type === 'heliRocketExploded' && e.ground)).toBe(true);
    const tank = sim.world.findByRef('tank')!;
    expect(tank.hp).toBeLessThan(tank.maxHp);
    expect(events.some((e) => e.type === 'shieldHit' || e.type === 'playerHit')).toBe(false);
  });

  it('patrols a closed route in a loop and flies an open route once, then loiters', () => {
    const square = [
      { x: 2000, y: 400 },
      { x: 2600, y: 400 },
      { x: 2600, y: 900 },
      { x: 2000, y: 900 },
      { x: 2000, y: 420 },
    ];
    const line = [
      { x: 3000, y: 1700 },
      { x: 3600, y: 1700 },
    ];
    const sim = new Simulation(
      makeLevel({
        player: { spawn: { x: 400, y: 400 }, headingDeg: 180 },
        paths: { square, line },
        entities: [
          { refId: 'loop', kind: 'helicopter', pos: { x: 2000, y: 400 }, pathId: 'square' },
          { refId: 'once', kind: 'helicopter', pos: { x: 3000, y: 1700 }, pathId: 'line' },
        ],
      }),
    );
    const loop = sim.world.findByRef('loop')!;
    const once = sim.world.findByRef('once')!;
    // Up high the helicopters ignore the player and keep to their routes.
    climbToHigh(sim);
    let wrapped = false;
    let lastWp = 0;
    for (let i = 0; i < 60 * 40; i++) {
      sim.step(input({ turn: i % 240 < 120 ? 1 : -1 }));
      sim.drainEvents();
      const wp = loop.heli!.waypoint;
      if (wp < lastWp) wrapped = true;
      lastWp = wp;
    }
    expect(wrapped).toBe(true);
    expect(loop.heli!.path).not.toBeNull();
    expect(once.heli!.path).toBeNull();
    expect(Math.hypot(once.pos.x - 3600, once.pos.y - 1700)).toBeLessThan(HELI.loiterRadius + 60);
  });

  it('group units of kind helicopter get the helicopter brain', () => {
    const sim = new Simulation(
      makeLevel({
        paths: { inbound: [{ x: 3900, y: 300 }, { x: 3000, y: 300 }] },
        groups: [
          {
            id: 'hinds',
            trigger: { kind: 'start' },
            pathId: 'inbound',
            spacing: 120,
            speed: 0,
            tags: ['hinds'],
            units: [{ kind: 'helicopter' }, { kind: 'helicopter' }],
          },
        ],
      }),
    );
    run(sim, 0.1);
    const helis = sim.world.withTag('hinds');
    expect(helis).toHaveLength(2);
    for (const h of helis) {
      expect(h.mover).toBeNull();
      expect(h.heli?.path).toHaveLength(2);
    }
  });
});
