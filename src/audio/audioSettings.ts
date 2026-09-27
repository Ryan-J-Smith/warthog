import { AUDIO_CHANNELS, AudioSettingsPort, VOLUME_STEP, type AudioChannel } from '../ui/sound';
import type { SettingsStore } from './settingsStore';

/** Storage key for the music mute (kept from the original music-only mute, so it carries over). */
export const MUSIC_MUTE_KEY = 'warthog.musicMuted';

const STORAGE_KEYS: Record<AudioChannel, { volume: string; muted: string }> = {
  music: { volume: 'warthog.musicVolume', muted: MUSIC_MUTE_KEY },
  sfx: { volume: 'warthog.sfxVolume', muted: 'warthog.sfxMuted' },
};

interface ChannelState {
  volume: number;
  muted: boolean;
}

/**
 * The player's sound settings (volume + mute for music and for sound effects), persisted in a
 * `SettingsStore`. Music and the sound backends read `gain()`; menus edit it through the port.
 */
export class AudioSettings extends AudioSettingsPort {
  private readonly state: Record<AudioChannel, ChannelState>;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly store: SettingsStore) {
    super();
    this.state = { music: this.load('music'), sfx: this.load('sfx') };
  }

  volume(channel: AudioChannel): number {
    return this.state[channel].volume;
  }

  muted(channel: AudioChannel): boolean {
    return this.state[channel].muted;
  }

  /** Mixer gain for a channel: 0 when muted; volume squared so each step sounds about as big as the last. */
  gain(channel: AudioChannel): number {
    const s = this.state[channel];
    return s.muted ? 0 : s.volume * s.volume;
  }

  setVolume(channel: AudioChannel, volume: number): void {
    const v = snap(volume);
    if (v === this.state[channel].volume) return;
    this.state[channel].volume = v;
    this.store.set(STORAGE_KEYS[channel].volume, String(v));
    this.notify();
  }

  setMuted(channel: AudioChannel, muted: boolean): void {
    if (!this.writeMuted(channel, muted)) return;
    this.notify();
  }

  toggleAll(): void {
    const anyAudible = AUDIO_CHANNELS.some((c) => !this.state[c].muted);
    let changed = false;
    for (const c of AUDIO_CHANNELS) changed = this.writeMuted(c, anyAudible) || changed;
    if (changed) this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private writeMuted(channel: AudioChannel, muted: boolean): boolean {
    if (this.state[channel].muted === muted) return false;
    this.state[channel].muted = muted;
    this.store.set(STORAGE_KEYS[channel].muted, muted ? '1' : '0');
    return true;
  }

  private load(channel: AudioChannel): ChannelState {
    const keys = STORAGE_KEYS[channel];
    const stored = Number.parseFloat(this.store.get(keys.volume) ?? '');
    return { volume: Number.isFinite(stored) ? snap(stored) : 1, muted: this.store.get(keys.muted) === '1' };
  }

  private notify(): void {
    for (const listener of [...this.listeners]) listener();
  }
}

/** Clamp to 0..1 and snap to the volume step (avoiding float drift like 0.30000000000000004). */
function snap(volume: number): number {
  const steps = Math.round(1 / VOLUME_STEP);
  return Math.round(Math.min(1, Math.max(0, volume)) * steps) / steps;
}
