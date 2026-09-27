import { describe, expect, it } from 'vitest';
import { AudioDirectorCore, GUN_IMPACT_INTERVAL_MS } from '../../src/audio';
import type { SimEvent } from '../../src/sim/events';
import { Simulation } from '../../src/sim/simulation';
import { makeLevel } from '../sim';
import { FakeBackend, FakeMusic } from './fakes';

function setup() {
  const backend = new FakeBackend();
  const music = new FakeMusic();
  const director = new AudioDirectorCore({ backend, music, random: () => 0.5 });
  const sim = new Simulation(makeLevel());
  const world = sim.view;
  const player = sim.world.player;
  director.update(16, world);
  return { backend, music, director, world, player };
}

const at = (dx: number, dy = 0, base = { x: 1000, y: 1000 }) => ({ x: base.x + dx, y: base.y + dy });

describe('AudioDirectorCore', () => {
  it('runs the GAU-8 loop between gunStarted and gunStopped, then plays the tail', () => {
    const { backend, director, world, player } = setup();
    player.firing = true;
    director.handleEvents([{ type: 'gunStarted' }]);
    director.update(16, world);
    expect(backend.loop('gunLoop')?.playing).toBe(true);

    player.firing = false;
    director.handleEvents([{ type: 'gunStopped' }]);
    expect(backend.loop('gunLoop')).toBeUndefined();
    expect(backend.played('gunTail')).toHaveLength(1);
  });

  it('aggregates a stream of gun impacts into one crackle per interval', () => {
    const { backend, director, world, player } = setup();
    const impact: SimEvent = { type: 'gunImpact', pos: at(170), hit: false, armored: false };
    director.handleEvents(Array.from({ length: 70 }, () => impact));
    expect(backend.played('gunImpacts')).toHaveLength(1);
    director.update(GUN_IMPACT_INTERVAL_MS / 2, world);
    director.handleEvents([impact, impact]);
    expect(backend.played('gunImpacts')).toHaveLength(1);
    director.update(GUN_IMPACT_INTERVAL_MS, world);
    expect(backend.played('gunImpacts')).toHaveLength(2);
    expect(player.alive).toBe(true);
  });

  it('attenuates and pans distant explosions, and skips ones out of earshot', () => {
    const { backend, director } = setup();
    director.handleEvents([{ type: 'entityDestroyed', entityId: 1, kind: 'tank', team: 'enemy', pos: at(50), size: 'medium' }]);
    director.handleEvents([{ type: 'secondaryExplosion', pos: at(1400), size: 'medium' }]);
    director.handleEvents([{ type: 'secondaryExplosion', pos: at(-9000), size: 'medium' }]);
    const [close, far] = backend.played('explosionMedium');
    expect(backend.played('explosionMedium')).toHaveLength(2);
    expect(far!.volume).toBeLessThan(close!.volume);
    expect(far!.pan).toBeGreaterThan(0);
  });

  it('caps concurrent voices per key', () => {
    const { backend, director } = setup();
    const blasts: SimEvent[] = Array.from({ length: 12 }, () => ({ type: 'secondaryExplosion', pos: at(0), size: 'small' }));
    director.handleEvents(blasts);
    const playing = backend.played('explosionSmall').filter((v) => v.playing);
    expect(playing.length).toBeLessThanOrEqual(5);
  });

  it('varies the pitch of repeated one-shots', () => {
    const backend = new FakeBackend();
    let r = 0;
    const director = new AudioDirectorCore({ backend, music: null, random: () => (r = (r + 0.37) % 1) });
    for (let i = 0; i < 3; i++) director.handleEvents([{ type: 'rocketLaunched', pos: at(0), heading: 0 }]);
    const rates = backend.played('rocketLaunch').map((v) => v.rate);
    expect(new Set(rates).size).toBe(3);
    for (const rate of rates) expect(Math.abs(rate - 1)).toBeLessThanOrEqual(0.05);
  });

  it('pitches the engine up with speed and silences it when the player dies', () => {
    const { backend, director, world, player } = setup();
    player.speed = 150;
    for (let i = 0; i < 120; i++) director.update(16, world);
    const slowRate = backend.loop('engineLoop')!.rate;
    player.speed = 360;
    for (let i = 0; i < 120; i++) director.update(16, world);
    expect(backend.loop('engineLoop')!.rate).toBeGreaterThan(slowRate);

    player.alive = false;
    for (let i = 0; i < 120; i++) director.update(16, world);
    expect(backend.loop('engineLoop')).toBeUndefined();
  });

  it('beeps the RWR faster as a SAM lock builds, and warbles while a missile tracks', () => {
    const { backend, director, world, player } = setup();
    player.radarLocks = 1;
    director.handleEvents([{ type: 'samLockStarted', siteId: 7, pos: at(900) }]);
    const beepTimes: number[] = [];
    for (let t = 0; t < 2500; t += 10) {
      const before = backend.played('rwrLock').length;
      director.update(10, world);
      if (backend.played('rwrLock').length > before) beepTimes.push(t);
      backend.finishOneShots(); // each beep is only 120 ms long
    }
    const gaps = beepTimes.slice(1).map((t, i) => t - beepTimes[i]!);
    expect(beepTimes.length).toBeGreaterThan(8);
    expect(gaps.at(-1)!).toBeLessThan(gaps[0]! / 2);

    player.missilesTracking = 1;
    director.update(16, world);
    expect(backend.loop('rwrLaunch')?.playing).toBe(true);
    player.missilesTracking = 0;
    director.update(16, world);
    expect(backend.loop('rwrLaunch')).toBeUndefined();
  });

  it('runs the rearm loop only while rearming', () => {
    const { backend, director, world, player } = setup();
    player.rearm = 0.4;
    director.update(16, world);
    expect(backend.loop('rearmLoop')?.playing).toBe(true);
    player.rearm = 0;
    director.handleEvents([{ type: 'rearmCompleted' }]);
    director.update(16, world);
    expect(backend.loop('rearmLoop')).toBeUndefined();
    expect(backend.played('rearmComplete')).toHaveLength(1);
  });

  it('squelches radio in and out and ducks the music meanwhile', () => {
    const { backend, music, director, world } = setup();
    director.handleEvents([{ type: 'radio', speaker: 'Bravo', text: 'Taking heavy fire!', tone: 'urgent' }]);
    expect(backend.played('radioIn')).toHaveLength(1);
    expect(music.ducks.length).toBeGreaterThan(0);
    for (let i = 0; i < 400; i++) director.update(16, world);
    expect(backend.played('radioOut')).toHaveLength(1);
  });

  it('plays no one-shots while the browser has audio locked', () => {
    const { backend, director } = setup();
    backend.isLocked = true;
    director.handleEvents([{ type: 'secondaryExplosion', pos: at(0), size: 'large' }]);
    expect(backend.oneShots).toHaveLength(0);
  });

  it('ends the mission with the sting and silences its loops', () => {
    const { backend, music, director, world, player } = setup();
    player.firing = true;
    director.handleEvents([{ type: 'gunStarted' }]);
    director.update(16, world);
    director.handleEvents([{ type: 'missionEnded', outcome: 'victory' }]);
    expect(music.stings).toEqual(['victory']);
    expect(backend.created.filter((v) => v.playing)).toHaveLength(0);
  });

  it('destroy() stops everything it started', () => {
    const { backend, director, world } = setup();
    director.handleEvents([{ type: 'secondaryExplosion', pos: at(0), size: 'huge' }]);
    director.update(16, world);
    director.destroy();
    expect(backend.created.every((v) => !v.playing)).toBe(true);
    expect(backend.oneShots.every((v) => !v.playing)).toBe(true);
  });
});
