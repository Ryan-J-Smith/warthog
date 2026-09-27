import { describe, expect, it } from 'vitest';
import { AudioSettings, MUSIC_MUTE_KEY, MemorySettingsStore } from '../../src/audio';

describe('AudioSettings', () => {
  it('defaults to full volume, unmuted, on both channels', () => {
    const settings = new AudioSettings(new MemorySettingsStore());
    for (const channel of ['music', 'sfx'] as const) {
      expect(settings.volume(channel)).toBe(1);
      expect(settings.muted(channel)).toBe(false);
      expect(settings.gain(channel)).toBe(1);
    }
  });

  it('clamps and snaps volume to 10% steps', () => {
    const settings = new AudioSettings(new MemorySettingsStore());
    settings.setVolume('sfx', 0.1 + 0.2);
    expect(settings.volume('sfx')).toBe(0.3);
    settings.setVolume('sfx', 1.7);
    expect(settings.volume('sfx')).toBe(1);
    settings.setVolume('sfx', -0.2);
    expect(settings.volume('sfx')).toBe(0);
  });

  it('uses a squared gain curve, and zero gain while muted', () => {
    const settings = new AudioSettings(new MemorySettingsStore());
    settings.setVolume('music', 0.5);
    expect(settings.gain('music')).toBeCloseTo(0.25, 10);
    settings.setMuted('music', true);
    expect(settings.gain('music')).toBe(0);
    expect(settings.volume('music')).toBe(0.5);
  });

  it('persists every setting and restores it next time', () => {
    const store = new MemorySettingsStore();
    const first = new AudioSettings(store);
    first.setVolume('music', 0.4);
    first.setVolume('sfx', 0.7);
    first.setMuted('sfx', true);
    const next = new AudioSettings(store);
    expect(next.volume('music')).toBe(0.4);
    expect(next.volume('sfx')).toBe(0.7);
    expect(next.muted('sfx')).toBe(true);
    expect(next.muted('music')).toBe(false);
  });

  it('keeps an existing music-only mute from before sound settings existed', () => {
    const store = new MemorySettingsStore();
    store.set(MUSIC_MUTE_KEY, '1');
    const settings = new AudioSettings(store);
    expect(settings.muted('music')).toBe(true);
    expect(settings.muted('sfx')).toBe(false);
  });

  it('M (toggleAll) mutes everything if anything is audible, then unmutes everything', () => {
    const settings = new AudioSettings(new MemorySettingsStore());
    settings.setMuted('music', true);
    settings.toggleAll();
    expect(settings.muted('music')).toBe(true);
    expect(settings.muted('sfx')).toBe(true);
    settings.toggleAll();
    expect(settings.muted('music')).toBe(false);
    expect(settings.muted('sfx')).toBe(false);
  });

  it('notifies subscribers once per real change, and stops after unsubscribing', () => {
    const settings = new AudioSettings(new MemorySettingsStore());
    let calls = 0;
    const unsubscribe = settings.subscribe(() => (calls += 1));
    settings.setVolume('sfx', 0.5);
    settings.setVolume('sfx', 0.5);
    settings.toggleAll();
    expect(calls).toBe(2);
    unsubscribe();
    settings.setMuted('sfx', false);
    expect(calls).toBe(2);
  });
});
