import { describe, expect, it } from 'vitest';
import { MemorySettingsStore, MUSIC_MUTE_KEY, MusicCore } from '../../src/audio';
import { FakeBackend } from './fakes';

function setup(store = new MemorySettingsStore()) {
  const backend = new FakeBackend();
  const music = new MusicCore(backend, store);
  const advance = (ms: number) => {
    for (let t = 0; t < ms; t += 16) backend.tick(16);
  };
  return { backend, music, store, advance };
}

describe('MusicCore', () => {
  it('fades the title theme in', () => {
    const { backend, music, advance } = setup();
    music.playTitle();
    const title = backend.loop('musicTitle')!;
    expect(title.volume).toBe(0);
    advance(3000);
    expect(title.volume).toBeGreaterThan(0.3);
  });

  it('crossfades from title to mission and releases the old track', () => {
    const { backend, music, advance } = setup();
    music.playTitle();
    advance(3000);
    const title = backend.loop('musicTitle')!;
    music.playMission();
    advance(3000);
    expect(title.destroyed).toBe(true);
    expect(backend.loop('musicMission')!.volume).toBeGreaterThan(0.3);
  });

  it('ignores a repeat request for the track already playing', () => {
    const { backend, music } = setup();
    music.playTitle();
    music.playTitle();
    expect(backend.created.filter((v) => v.key === 'musicTitle')).toHaveLength(1);
  });

  it('plays each sting once even if asked twice', () => {
    const { backend, music } = setup();
    music.playMission();
    music.playSting('defeat');
    music.playSting('defeat');
    expect(backend.created.filter((v) => v.key === 'stingDefeat')).toHaveLength(1);
  });

  it('mutes, persists the choice, and restores it next time', () => {
    const { backend, music, store, advance } = setup();
    music.playTitle();
    advance(3000);
    expect(music.toggleMute()).toBe(true);
    expect(backend.loop('musicTitle')!.volume).toBe(0);
    expect(store.get(MUSIC_MUTE_KEY)).toBe('1');
    expect(setup(store).music.isMuted()).toBe(true);
  });

  it('ducks under radio calls and recovers afterwards', () => {
    const { backend, music, advance } = setup();
    music.playMission();
    advance(3000);
    const mission = backend.loop('musicMission')!;
    const full = mission.volume;
    music.duck(0.4, 1000);
    advance(500);
    expect(mission.volume).toBeLessThan(full * 0.6);
    advance(4000);
    expect(mission.volume).toBeCloseTo(full, 2);
  });

  it('stop() fades everything out', () => {
    const { backend, music, advance } = setup();
    music.playTitle();
    advance(3000);
    music.stop();
    advance(2000);
    expect(backend.created.every((v) => v.destroyed)).toBe(true);
  });
});
