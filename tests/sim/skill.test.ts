import { describe, expect, it } from 'vitest';
import { BAND_PROFILES, COMBO, ENTITY_STATS, PICKUPS, ZONES } from '../../src/config';
import { damageEntity } from '../../src/sim/combat';
import { DEFAULT_LOADOUT } from '../../src/sim/loadout';
import { Simulation } from '../../src/sim/simulation';
import { beamHits, damagePlayer } from '../../src/sim/systems';
import { riverCrossing } from '../../src/content/levels';
import { input, makeLevel, run } from './helpers';

function flyingSim(): Simulation {
  return new Simulation(makeLevel({ width: 8000, height: 4000, player: { spawn: { x: 2000, y: 2000 }, headingDeg: 0 } }));
}

describe('boost and air brake', () => {
  it('boost raises speed and drains the meter, which refills after release', () => {
    const sim = flyingSim();
    run(sim, 1.5, { boost: true });
    const p = sim.world.player;
    expect(p.speed).toBeGreaterThan(BAND_PROFILES.low.speed * 1.4);
    expect(p.boost).toBeLessThan(DEFAULT_LOADOUT.boostCapacity - 1.2);
    const drained = p.boost;
    run(sim, 2);
    expect(p.boost).toBeGreaterThan(drained);
    expect(p.boosting).toBe(false);
  });

  it('boost stops when the meter is empty', () => {
    const sim = flyingSim();
    const events = run(sim, DEFAULT_LOADOUT.boostCapacity + 0.5, { boost: true });
    expect(events.some((e) => e.type === 'boostEmpty')).toBe(true);
    expect(sim.world.player.boosting).toBe(false);
  });

  it('an empty meter sputters once and refills while the key is still held; re-press to boost', () => {
    const sim = flyingSim();
    const events = run(sim, DEFAULT_LOADOUT.boostCapacity + 6, { boost: true });
    expect(events.filter((e) => e.type === 'boostEmpty').length).toBe(1);
    expect(sim.world.player.boost).toBeGreaterThan(1);
    expect(sim.world.player.boosting).toBe(false);
    run(sim, 0.1);
    run(sim, 0.1, { boost: true });
    expect(sim.world.player.boosting).toBe(true);
  });

  it('the air brake slows down and turns much tighter', () => {
    const plain = flyingSim();
    run(plain, 0.6, { turn: 1 });
    const braked = flyingSim();
    run(braked, 0.6, { turn: 1, brake: true });
    expect(braked.world.player.speed).toBeLessThan(plain.world.player.speed);
    expect(braked.world.player.heading).toBeGreaterThan(plain.world.player.heading * 1.4);
  });

  it('turning eases in instead of snapping to the full rate', () => {
    const sim = flyingSim();
    sim.step(input({ turn: 1 }));
    const max = (BAND_PROFILES.low.turnRateDeg * Math.PI) / 180;
    expect(sim.world.player.turnRate).toBeGreaterThan(0);
    expect(sim.world.player.turnRate).toBeLessThan(max * 0.5);
    run(sim, 0.3, { turn: 1 });
    expect(sim.world.player.turnRate).toBeCloseTo(max, 3);
  });
});

describe('shield', () => {
  it('absorbs damage before the hull and regenerates after the delay', () => {
    const sim = flyingSim();
    const p = sim.world.player;
    damagePlayer(sim.world, 20, 'beam', p.pos);
    expect(p.shield).toBe(DEFAULT_LOADOUT.maxShield - 20);
    expect(p.hp).toBe(DEFAULT_LOADOUT.maxHull);
    damagePlayer(sim.world, 60, 'sam', p.pos);
    expect(p.shield).toBe(0);
    expect(p.hp).toBe(DEFAULT_LOADOUT.maxHull - 20);
    const events = run(sim, DEFAULT_LOADOUT.shieldRegenDelay + DEFAULT_LOADOUT.maxShield / DEFAULT_LOADOUT.shieldRegenRate + 0.2);
    expect(events.some((e) => e.type === 'shieldRegenStarted')).toBe(true);
    expect(p.shield).toBe(DEFAULT_LOADOUT.maxShield);
    expect(p.hp).toBe(DEFAULT_LOADOUT.maxHull - 20);
  });
});

describe('AA laser', () => {
  it('telegraphs before the beam fires', () => {
    const sim = new Simulation(makeLevel({ entities: [{ kind: 'aaGun', pos: { x: 1300, y: 1000 } }] }));
    const events = run(sim, 0.5);
    expect(events.some((e) => e.type === 'aaAiming')).toBe(true);
    expect(events.some((e) => e.type === 'aaBeamStarted')).toBe(false);
  });

  it('a hovering target takes beam damage; crossing the beam fast escapes most of it', () => {
    const aa = ENTITY_STATS.aaGun.aa;
    if (!aa) throw new Error('no AA stats');
    // Flying straight at the gun keeps you in the beam.
    const along = new Simulation(makeLevel({ player: { spawn: { x: 1300, y: 1450 }, headingDeg: -90 }, entities: [{ kind: 'aaGun', pos: { x: 1300, y: 1000 } }] }));
    run(along, aa.aimTime + aa.beamTime * 0.6);
    const alongDamage = DEFAULT_LOADOUT.maxShield - along.world.player.shield;
    // Boosting across it (at the dodge window) escapes.
    const across = new Simulation(makeLevel({ player: { spawn: { x: 1100, y: 1350 }, headingDeg: 0 }, entities: [{ kind: 'aaGun', pos: { x: 1300, y: 1000 } }] }));
    run(across, aa.aimTime - aa.lockTime);
    run(across, aa.lockTime + aa.beamTime * 0.6, { boost: true });
    const acrossDamage = DEFAULT_LOADOUT.maxShield - across.world.player.shield;
    expect(alongDamage).toBeGreaterThan(15);
    expect(acrossDamage).toBeLessThan(alongDamage * 0.5);
  });

  it('beam geometry', () => {
    expect(beamHits({ x: 0, y: 0 }, 0, 500, { x: 300, y: 20 }, 34)).toBe(true);
    expect(beamHits({ x: 0, y: 0 }, 0, 500, { x: 300, y: 60 }, 34)).toBe(false);
    expect(beamHits({ x: 0, y: 0 }, 0, 500, { x: -100, y: 0 }, 34)).toBe(false);
  });
});

describe('SAM evasion', () => {
  function samRun(beamAndBoost: boolean): { evaded: boolean; hit: boolean } {
    const sim = new Simulation(
      makeLevel({ width: 8000, height: 3000, player: { spawn: { x: 1500, y: 1500 }, headingDeg: 0 }, entities: [{ kind: 'samSite', pos: { x: 2600, y: 700 } }] }),
      1,
    );
    sim.step(input({ climb: true }));
    let breaking = false;
    for (let i = 0; i < 60 * 14; i++) {
      const p = sim.world.player;
      const m = sim.world.projectiles.find((pr) => pr.kind === 'samMissile' && pr.targetId === -1 && !pr.lostLock);
      if (m && Math.hypot(m.pos.x - p.pos.x, m.pos.y - p.pos.y) < 300) breaking = true;
      let held = {};
      if (beamAndBoost && breaking && m) {
        // Put the missile on the wing (perpendicular) and light the afterburner.
        const toMissile = Math.atan2(m.pos.y - p.pos.y, m.pos.x - p.pos.x);
        const err = (a: number) => Math.atan2(Math.sin(a - p.heading), Math.cos(a - p.heading));
        const left = err(toMissile + Math.PI / 2);
        const right = err(toMissile - Math.PI / 2);
        const e = Math.abs(left) < Math.abs(right) ? left : right;
        held = { turn: Math.max(-1, Math.min(1, e * 4)), boost: true };
      }
      sim.step(input(held));
      for (const ev of sim.drainEvents()) {
        if (ev.type === 'samEvaded') return { evaded: true, hit: false };
        if (ev.type === 'samDetonated' && ev.hitPlayer) return { evaded: false, hit: true };
      }
    }
    return { evaded: false, hit: false };
  }

  it('a SAM hits a pilot who does nothing', () => {
    expect(samRun(false).hit).toBe(true);
  });

  it('putting the missile on the wing and boosting defeats it', () => {
    expect(samRun(true).evaded).toBe(true);
  });
});

describe('rewards', () => {
  it('kills inside the window chain and multiply points; hull damage breaks the chain', () => {
    const sim = new Simulation(makeLevel({ entities: [{ kind: 'tank', pos: { x: 2000, y: 400 } }, { kind: 'tank', pos: { x: 2200, y: 400 } }, { kind: 'tank', pos: { x: 2400, y: 400 } }] }));
    const tanks = sim.world.entities.filter((e) => e.kind === 'tank');
    damageEntity(sim.world, tanks[0]!, 999, 'bomb');
    damageEntity(sim.world, tanks[1]!, 999, 'bomb');
    const second = sim.drainEvents().filter((e) => e.type === 'scoreAwarded').map((e) => (e.type === 'scoreAwarded' ? e.points : 0));
    expect(second[1]).toBe(Math.round(ENTITY_STATS.tank.score * (1 + COMBO.step)));
    expect(sim.world.combo.chain).toBe(2);
    damagePlayer(sim.world, 200, 'sam', sim.world.player.pos);
    expect(sim.world.combo.chain).toBe(0);
  });

  it('a truck drops ammo that is collected by flying over it', () => {
    const sim = new Simulation(makeLevel({ player: { spawn: { x: 1000, y: 1000 }, headingDeg: 0 }, entities: [{ kind: 'truck', pos: { x: 1200, y: 1000 } }] }));
    sim.world.player.ammo.bombs = 0;
    const truck = sim.world.entities.find((e) => e.kind === 'truck')!;
    damageEntity(sim.world, truck, 999, 'gun');
    expect(sim.world.pickups.map((p) => p.kind)).toEqual(['ammo']);
    const events = run(sim, 1.6);
    expect(events.some((e) => e.type === 'pickupCollected')).toBe(true);
    expect(sim.world.player.ammo.bombs).toBeGreaterThan(0);
  });

  it('uncollected pickups expire', () => {
    const sim = new Simulation(makeLevel({ entities: [{ kind: 'truck', pos: { x: 3000, y: 300 } }] }));
    damageEntity(sim.world, sim.world.entities.find((e) => e.kind === 'truck')!, 999, 'gun');
    const events = run(sim, PICKUPS.lifetime + 0.2, { turn: 1 });
    expect(events.some((e) => e.type === 'pickupExpired')).toBe(true);
    expect(sim.world.pickups).toHaveLength(0);
  });

  it('clearing a defence zone pays a bonus and a supply drop', () => {
    const sim = new Simulation(
      makeLevel({
        player: { spawn: { x: 600, y: 1700 }, headingDeg: 180 },
        entities: [{ kind: 'aaGun', pos: { x: 3000, y: 500 } }, { kind: 'samSite', pos: { x: 3200, y: 500 } }],
        zones: [{ id: 'nest', name: 'The Nest', center: { x: 3100, y: 500 }, radius: 300 }],
      }),
    );
    for (const e of sim.world.entities.filter((x) => x.team === 'enemy')) damageEntity(sim.world, e, 999, 'bomb');
    const events = run(sim, 0.1);
    const cleared = events.find((e) => e.type === 'zoneCleared');
    expect(cleared).toBeDefined();
    expect(sim.world.stats.bonusPoints).toBe(ZONES.bonus);
    expect(sim.world.pickups.length).toBeGreaterThanOrEqual(ZONES.supplyDrop.length);
  });
});

describe('weapon follows altitude', () => {
  it('switches to a usable weapon when a band change blocks the selected one', () => {
    const sim = new Simulation(makeLevel({ width: 8000, height: 4000, player: { spawn: { x: 2000, y: 2000 }, headingDeg: 0 } }));
    sim.step(input({ select: 'gun' }));
    sim.step(input({ climb: true }));
    run(sim, 1.2);
    expect(sim.world.player.band).toBe('medium');
    expect(sim.world.player.selectedWeapon).toBe('gun'); // still usable at Medium: kept
    sim.step(input({ climb: true }));
    run(sim, 1.2);
    expect(sim.world.player.band).toBe('high');
    expect(sim.world.player.selectedWeapon).toBe('bombs');
    sim.step(input({ dive: true }));
    sim.step(input({ dive: true }));
    run(sim, 1.6);
    expect(sim.world.player.band).toBe('low');
    expect(sim.world.player.selectedWeapon).toBe('gun');
  });
});

describe('objective rewards', () => {
  it('holding a defended outpost opens a forward rearm pad there', () => {
    const sim = new Simulation(
      makeLevel({
        player: { spawn: { x: 3000, y: 1000 }, headingDeg: 0 },
        entities: [
          { refId: 'bravo', kind: 'outpost', pos: { x: 3000, y: 1000 } },
          { kind: 'tank', pos: { x: 3600, y: 1000 }, tags: ['assault'] },
        ],
        objectives: [{ id: 'hold', kind: 'defend', title: 'Hold Bravo', primary: true, targetRefId: 'bravo', attackerTags: ['assault'], effect: 'forwardRearm' }],
      }),
    );
    expect(sim.world.rearmPoints()).toHaveLength(1);
    damageEntity(sim.world, sim.world.entities.find((e) => e.kind === 'tank')!, 999, 'bomb');
    sim.world.player.ammo.bombs = 0;
    const events = run(sim, 0.2);
    expect(events.some((e) => e.type === 'radio' && e.speaker === 'BRAVO')).toBe(true);
    expect(sim.world.rearmPoints()).toHaveLength(2);
    // Circle low over the outpost: it rearms there.
    const rearmed = run(sim, 4, { brake: true, turn: 1 });
    expect(rearmed.some((e) => e.type === 'rearmCompleted')).toBe(true);
  });
});

describe('allies that matter', () => {
  it('taking the bridge intact sends friendly armour across to assault the SAM nest', () => {
    const sim = new Simulation(riverCrossing);
    run(sim, 60);
    for (const unit of sim.world.withTag('column')) damageEntity(sim.world, unit, 9999, 'bomb');
    const events = run(sim, 1);
    expect(events.some((e) => e.type === 'objectiveUpdated' && e.objectiveId === 'bridgeIntact' && e.status === 'completed')).toBe(true);
    expect(sim.world.withTag('counterattack').length).toBe(4);
    const later = run(sim, 90);
    expect(later.some((e) => e.type === 'groundFire' && e.shooterKind === 'friendlyTank')).toBe(true);
  });
});
