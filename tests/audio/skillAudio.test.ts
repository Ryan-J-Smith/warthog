import { describe, expect, it } from 'vitest';
import { AudioDirectorCore, MIX } from '../../src/audio';
import type { Entity } from '../../src/sim/entities';
import type { SimEvent } from '../../src/sim/events';
import { Simulation } from '../../src/sim/simulation';
import { makeLevel } from '../sim';
import { FakeBackend, FakeMusic } from './fakes';

/** Player spawns at (1000, 1000); two AA guns: one close, one far. */
function setup() {
  const backend = new FakeBackend();
  const music = new FakeMusic();
  const director = new AudioDirectorCore({ backend, music, random: () => 0.5 });
  const sim = new Simulation(
    makeLevel({
      entities: [
        { refId: 'aaNear', kind: 'aaGun', pos: { x: 1200, y: 1000 } },
        { refId: 'aaFar', kind: 'aaGun', pos: { x: 2400, y: 1000 } },
      ],
    }),
  );
  const world = sim.view;
  const player = sim.world.player;
  const gun = (refId: string): Entity => {
    const e = sim.world.entities.find((x) => x.refId === refId);
    if (!e?.aa) throw new Error(`no AA gun ${refId}`);
    return e;
  };
  director.update(16, world);
  return { backend, music, director, world, player, near: gun('aaNear'), far: gun('aaFar') };
}

type Setup = ReturnType<typeof setup>;

/** Put a gun in `phase` and send the matching event, as the air-defence system would. */
function aim(s: Setup, gun: Entity): void {
  gun.aa!.phase = 'aiming';
  s.director.handleEvents([{ type: 'aaAiming', entityId: gun.id, pos: { ...gun.pos } }]);
}
function fire(s: Setup, gun: Entity): void {
  gun.aa!.phase = 'firing';
  s.director.handleEvents([{ type: 'aaBeamStarted', entityId: gun.id, pos: { ...gun.pos } }]);
}
function beamVoices(s: Setup) {
  return s.backend.created.filter((v) => v.key === 'aaBeamLoop' && v.playing);
}

describe('AudioDirectorCore — boost and brake', () => {
  it('runs the afterburner loop from boostStarted, with the ignition whump, and fades it out on release', () => {
    const { backend, director, world, player } = setup();
    player.boosting = true;
    director.handleEvents([{ type: 'boostStarted' }]);
    expect(backend.loop('boostLoop')?.playing).toBe(true);
    expect(backend.played('boostStart')).toHaveLength(1);

    director.update(16, world);
    expect(backend.loop('boostLoop')?.playing).toBe(true);

    player.boosting = false;
    director.handleEvents([{ type: 'boostStopped' }]);
    director.update(16, world);
    const fading = backend.loop('boostLoop');
    expect(fading?.playing).toBe(true);
    expect(fading!.volume).toBeLessThan(MIX.boostLoop.volume);
    for (let i = 0; i < 60; i++) director.update(16, world);
    expect(backend.loop('boostLoop')).toBeUndefined();
  });

  it('sputters and stops the roar when the meter runs dry', () => {
    const { backend, director, world, player } = setup();
    player.boosting = true;
    director.handleEvents([{ type: 'boostStarted' }]);
    player.boosting = false;
    director.handleEvents([{ type: 'boostEmpty' }, { type: 'boostStopped' }]);
    expect(backend.played('boostEmpty')).toHaveLength(1);
    for (let i = 0; i < 60; i++) director.update(16, world);
    expect(backend.loop('boostLoop')).toBeUndefined();
  });

  it('cuts the afterburner at once when the player dies, the mission ends or the scene shuts down', () => {
    for (const end of ['death', 'mission', 'destroy'] as const) {
      const { backend, director, player } = setup();
      player.boosting = true;
      director.handleEvents([{ type: 'boostStarted' }]);
      if (end === 'death') director.handleEvents([{ type: 'playerDestroyed', pos: { x: 1000, y: 1000 } }]);
      if (end === 'mission') director.handleEvents([{ type: 'missionEnded', outcome: 'defeat' }]);
      if (end === 'destroy') director.destroy();
      expect(backend.loop('boostLoop')).toBeUndefined();
    }
  });

  it('stops a boost loop whose stop event was missed (safety net)', () => {
    const { backend, director, world, player } = setup();
    player.boosting = true;
    director.handleEvents([{ type: 'boostStarted' }]);
    player.boosting = false;
    for (let i = 0; i < 60; i++) director.update(16, world);
    expect(backend.loop('boostLoop')).toBeUndefined();
  });

  it('whooshes the air brake on deploy, ignoring rapid re-taps', () => {
    const { backend, director, world } = setup();
    director.handleEvents([{ type: 'brakeStarted' }]);
    director.update(50, world);
    director.handleEvents([{ type: 'brakeStopped' }, { type: 'brakeStarted' }]);
    expect(backend.played('airbrake')).toHaveLength(1);
    director.update(300, world);
    backend.finishOneShots();
    director.handleEvents([{ type: 'brakeStarted' }]);
    expect(backend.played('airbrake')).toHaveLength(2);
  });
});

describe('AudioDirectorCore — AA laser', () => {
  it('plays a spatial charge while a gun aims, then swaps it for a beam loop until the beam stops', () => {
    const s = setup();
    aim(s, s.near);
    const [charge] = s.backend.played('aaCharge');
    expect(charge?.playing).toBe(true);
    expect(charge!.pan).toBeGreaterThan(0);

    fire(s, s.near);
    expect(charge!.playing).toBe(false);
    s.director.update(16, s.world);
    const [beam] = beamVoices(s);
    expect(beam).toBeDefined();
    expect(beam!.volume).toBeGreaterThan(0);
    expect(beam!.pan).toBeGreaterThan(0);

    s.near.aa!.phase = 'cooldown';
    s.director.handleEvents([{ type: 'aaBeamStopped', entityId: s.near.id }]);
    expect(beamVoices(s)).toHaveLength(0);
  });

  it('runs one beam per gun, quieter for distant guns, sharing the level when several overlap', () => {
    const s = setup();
    fire(s, s.near);
    s.director.update(16, s.world);
    const alone = beamVoices(s)[0]!.volume;
    fire(s, s.far);
    s.director.update(16, s.world);
    const beams = beamVoices(s);
    expect(beams).toHaveLength(2);
    const [nearBeam, farBeam] = beams;
    expect(farBeam!.volume).toBeLessThan(nearBeam!.volume);
    expect(nearBeam!.volume).toBeLessThan(alone);
  });

  it('is a little louder while the beam is on the aircraft', () => {
    const s = setup();
    fire(s, s.near);
    s.director.update(16, s.world);
    const off = beamVoices(s)[0]!.volume;
    s.near.aa!.beamOnTarget = true;
    s.director.update(16, s.world);
    expect(beamVoices(s)[0]!.volume).toBeGreaterThan(off);
  });

  it('drops the charge when an aim is abandoned and the beam when the gun leaves the firing phase without an event', () => {
    const s = setup();
    aim(s, s.near);
    s.near.aa!.phase = 'idle';
    s.director.update(16, s.world);
    expect(s.backend.played('aaCharge')[0]!.playing).toBe(false);

    fire(s, s.near);
    s.near.aa!.phase = 'cooldown';
    s.director.update(16, s.world);
    expect(beamVoices(s)).toHaveLength(0);
  });

  it('silences a gun that is destroyed mid-beam', () => {
    const s = setup();
    fire(s, s.near);
    s.near.alive = false;
    s.director.handleEvents([
      { type: 'entityDestroyed', entityId: s.near.id, kind: 'aaGun', team: 'enemy', pos: { ...s.near.pos }, size: 'medium' },
    ]);
    expect(beamVoices(s)).toHaveLength(0);
  });

  it('stops every charge and beam when the player dies, the mission ends or the scene shuts down', () => {
    for (const end of ['death', 'mission', 'destroy'] as const) {
      const s = setup();
      aim(s, s.far);
      fire(s, s.near);
      if (end === 'death') s.director.handleEvents([{ type: 'playerDestroyed', pos: { x: 1000, y: 1000 } }]);
      if (end === 'mission') s.director.handleEvents([{ type: 'missionEnded', outcome: 'defeat' }]);
      if (end === 'destroy') s.director.destroy();
      expect(beamVoices(s)).toHaveLength(0);
      expect(s.backend.played('aaCharge').every((v) => !v.playing)).toBe(true);
    }
  });

  it('keeps the legacy AA burst harmless', () => {
    const s = setup();
    s.director.handleEvents([{ type: 'aaBurst', entityId: s.near.id, pos: { ...s.near.pos } }]);
    expect(s.backend.played('aaFire')).toHaveLength(1);
  });
});

describe('AudioDirectorCore — shield and beam damage', () => {
  it('rate-limits shield crackle and hull clanks while a beam burns, and keeps beam clanks quieter', () => {
    const { backend, director, world } = setup();
    const pos = { x: 1000, y: 1000 };
    for (let i = 0; i < 60; i++) {
      director.handleEvents([
        { type: 'shieldHit', pos, amount: 0.3, source: 'beam' },
        { type: 'playerHit', pos, damage: 0.3, source: 'beam' },
      ]);
      director.update(1000 / 60, world);
      backend.finishOneShots();
    }
    const crackles = backend.played('shieldHit').length;
    const clanks = backend.played('playerHit');
    expect(crackles).toBeGreaterThanOrEqual(4);
    expect(crackles).toBeLessThanOrEqual(8);
    expect(clanks.length).toBeGreaterThanOrEqual(3);
    expect(clanks.length).toBeLessThanOrEqual(6);

    director.update(500, world);
    director.handleEvents([{ type: 'playerHit', pos, damage: 0.3, source: 'aa' }]);
    const flak = backend.played('playerHit').at(-1)!;
    expect(clanks[0]!.volume).toBeLessThan(flak.volume);
  });

  it('plays the shield down / regen / full cues', () => {
    const { backend, director } = setup();
    director.handleEvents([{ type: 'shieldHit', pos: { x: 1000, y: 1000 }, amount: 10, source: 'sam' }]);
    director.handleEvents([{ type: 'shieldDown' }, { type: 'shieldRegenStarted' }, { type: 'shieldFull' }]);
    expect(backend.played('shieldHit')).toHaveLength(1);
    expect(backend.played('shieldDown')).toHaveLength(1);
    expect(backend.played('shieldRegen')).toHaveLength(1);
    expect(backend.played('shieldFull')).toHaveLength(1);
  });
});

describe('AudioDirectorCore — rewards', () => {
  it('pitches the kill-chain blip up with the chain, capped at an octave', () => {
    const { backend, director, world } = setup();
    for (let chain = 2; chain <= 12; chain++) {
      director.handleEvents([{ type: 'comboChanged', chain, multiplier: 1 }]);
      director.update(16, world);
      backend.finishOneShots();
    }
    const rates = backend.played('comboUp').map((v) => v.rate);
    expect(rates).toHaveLength(11);
    expect(rates[0]).toBeCloseTo(1);
    for (let i = 1; i < rates.length; i++) expect(rates[i]!).toBeGreaterThanOrEqual(rates[i - 1]!);
    expect(rates[1]!).toBeGreaterThan(rates[0]!);
    expect(rates.at(-1)!).toBeCloseTo(2);

    director.handleEvents([{ type: 'comboEnded', chain: 12, reason: 'timeout' }]);
    expect(backend.played('comboEnd')).toHaveLength(1);
  });

  it('sparkles pickups where they drop and chimes on collection', () => {
    const { backend, director } = setup();
    const events: SimEvent[] = [
      { type: 'pickupSpawned', pickupId: 1, kind: 'ammo', pos: { x: 1600, y: 1000 } },
      { type: 'pickupCollected', pickupId: 1, kind: 'ammo', pos: { x: 1000, y: 1000 } },
      { type: 'pickupExpired', pickupId: 2 },
    ];
    director.handleEvents(events);
    const [spawn] = backend.played('pickupSpawn');
    expect(spawn!.pan).toBeGreaterThan(0);
    expect(backend.played('pickupCollect')).toHaveLength(1);
  });

  it('marks a SAM evasion audibly even when the missile is far off, and stings a cleared zone over ducked music', () => {
    const { backend, music, director } = setup();
    director.handleEvents([{ type: 'samEvaded', missileId: 9, pos: { x: 2800, y: 1000 }, bonus: 250 }]);
    expect(backend.played('samEvaded')).toHaveLength(1);
    expect(backend.played('samEvaded')[0]!.volume).toBeGreaterThan(0.4);

    director.handleEvents([{ type: 'zoneCleared', zoneId: 'tango', name: 'SAM Tango', pos: { x: 2400, y: 1000 }, bonus: 1000 }]);
    expect(backend.played('zoneCleared')).toHaveLength(1);
    expect(music.ducks.length).toBeGreaterThan(0);
  });

  it('stings a STRAFE ×N pass like a SAM evasion, but not ordinary kill points', () => {
    const { backend, director } = setup();
    director.handleEvents([{ type: 'scoreAwarded', points: 300, reason: 'infantry', pos: { x: 1300, y: 1000 } }]);
    expect(backend.played('samEvaded')).toHaveLength(0);
    director.handleEvents([{ type: 'scoreAwarded', points: 250, reason: 'STRAFE ×5', pos: { x: 1300, y: 1000 } }]);
    expect(backend.played('samEvaded')).toHaveLength(1);
  });
});
