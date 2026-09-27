/** A mix the player controls: the music, or everything else (weapons, explosions, warnings, menus). */
export type AudioChannel = 'music' | 'sfx';

export const AUDIO_CHANNELS: readonly AudioChannel[] = ['music', 'sfx'];

/** Volume moves in steps of this size (0..1). */
export const VOLUME_STEP = 0.1;

/**
 * Contract for the player's sound settings: a volume and a mute per channel. The audio track
 * implements it (persisted); scenes hand it to the sound menus.
 */
export abstract class AudioSettingsPort {
  /** 0..1, a multiple of `VOLUME_STEP`. */
  abstract volume(channel: AudioChannel): number;
  abstract muted(channel: AudioChannel): boolean;
  /** Clamped to 0..1 and snapped to `VOLUME_STEP`. */
  abstract setVolume(channel: AudioChannel, volume: number): void;
  abstract setMuted(channel: AudioChannel, muted: boolean): void;
  /** The M key: mute everything if anything is audible, otherwise unmute everything. */
  abstract toggleAll(): void;
  /** Call `listener` after every change. Returns an unsubscribe function. */
  abstract subscribe(listener: () => void): () => void;
}
