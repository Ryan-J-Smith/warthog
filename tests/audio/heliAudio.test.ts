import { describe, expect, it } from 'vitest';
import { AudioDirectorCore, MIX } from '../../src/audio';
import type { Entity } from '../../src/sim/entities';
import { Simulation } from '../../src/sim/simulation';
import { makeLevel } from '../sim';
import { FakeBackend, FakeMusic } from './fakes';

/** Player at (1000, 1000); one helicopter close by and one far off. */
function setup() {
  const backend = new FakeBackend();
  const director = new AudioDirectorCore({ backend, music: new FakeMusic(), random: () => 0.5 });
  const sim = new Simulation(
    makeLevel({
      entities: [
        { refId: 'near', kind: 'helicopter', pos: { x: 1300, y: 1000 } },
        { refId: 'far', kind: 'helicopter', pos: { x: 3900, y: 1000 } },
      ],
    }),
  );
  const heli = (refId: string): Entity => {
    const e = sim.world.findByRef(refId);
    if (!e?.heli) throw new Error(`no helicopter ${refId}`);
    return e;
  };
  return { backend, director, sim, world: sim.view, near: heli('near'), far: heli('far') };
}

function rotors(backend: FakeBackend) {
  return backend.created.filter((v) => v.key === 'heliLoop' && v.playing);
}

describe('AudioDirectorCore — helicopters', () => {
  it('starts a spatial rotor loop once a helicopter is spotted and within earshot', () => {
    const { backend, director, world, near, far } = setup();
    director.update(16, world);
    expect(rotors(backend)).toHaveLength(0);

    near.spotted = true;
    far.spotted = true;
    director.update(16, world);
    const voices = rotors(backend);
    expect(voices).toHaveLength(1);
    expect(voices[0]!.volume).toBeGreaterThan(0);
    expect(voices[0]!.volume).toBeLessThanOrEqual(MIX.heliLoop.volume);
    expect(voices[0]!.pan).toBeGreaterThan(0);
  });

  it('gets louder as the helicopter closes in', () => {
    const { backend, director, world, near } = setup();
    near.spotted = true;
    near.pos.x = 2200;
    director.update(16, world);
    const before = rotors(backend)[0]!.volume;
    near.pos.x = 1100;
    director.update(16, world);
    expect(rotors(backend)[0]!.volume).toBeGreaterThan(before);
  });

  it('stops the loop when the helicopter is destroyed, the mission ends or the scene shuts down', () => {
    const killed = setup();
    killed.near.spotted = true;
    killed.director.update(16, killed.world);
    killed.near.alive = false;
    killed.director.handleEvents([
      { type: 'entityDestroyed', entityId: killed.near.id, kind: 'helicopter', team: 'enemy', pos: { ...killed.near.pos }, size: 'medium' },
    ]);
    expect(rotors(killed.backend)).toHaveLength(0);
    killed.director.update(16, killed.world);
    expect(rotors(killed.backend)).toHaveLength(0);

    const ended = setup();
    ended.near.spotted = true;
    ended.director.update(16, ended.world);
    ended.director.handleEvents([{ type: 'missionEnded', outcome: 'victory' }]);
    expect(rotors(ended.backend)).toHaveLength(0);

    const shutdown = setup();
    shutdown.near.spotted = true;
    shutdown.director.update(16, shutdown.world);
    shutdown.director.destroy();
    expect(rotors(shutdown.backend)).toHaveLength(0);
  });

  it('plays the rocket launch on a salvo and a burst where a rocket explodes', () => {
    const { backend, director, world, near } = setup();
    director.update(16, world);
    director.handleEvents([{ type: 'heliRocketsFired', entityId: near.id, pos: { ...near.pos }, heading: Math.PI }]);
    expect(backend.played('rocketLaunch')).toHaveLength(1);
    director.handleEvents([{ type: 'heliRocketExploded', pos: { x: 1050, y: 1000 }, hitPlayer: true, ground: false }]);
    expect(backend.played('explosionSmall')).toHaveLength(1);
  });
});
