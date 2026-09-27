import type { AudioKey } from '../assets';

/** Playback parameters for a new voice. */
export interface SoundParams {
  /** Linear gain, 0..1. */
  volume: number;
  /** Playback rate (1 = normal; also shifts pitch). */
  rate?: number;
  /** Stereo pan, -1 (left) .. 1 (right). */
  pan?: number;
  loop?: boolean;
}

/** One playing (or stopped) sound instance. */
export abstract class SoundVoice {
  abstract play(): void;
  abstract stop(): void;
  abstract setVolume(volume: number): void;
  abstract setRate(rate: number): void;
  abstract setPan(pan: number): void;
  /** True while audible (started and not yet finished or stopped). */
  abstract get playing(): boolean;
  /** Release the underlying resources. Safe to call more than once. */
  abstract destroy(): void;
}

/**
 * Contract between the audio logic and the engine. The Phaser implementation lives in
 * `PhaserSoundBackend`; tests inject fakes.
 */
export abstract class SoundBackend {
  /** True while the browser blocks audio until the first user gesture. */
  abstract get locked(): boolean;
  /**
   * Start a fire-and-forget one-shot (it releases itself when finished).
   * Returns a handle for optional early stop, or null if the sound is unavailable.
   */
  abstract play(key: AudioKey, params: SoundParams): SoundVoice | null;
  /** Create a controllable voice without starting it (loops, music). Never null: missing sounds give a silent voice. */
  abstract create(key: AudioKey, params: SoundParams): SoundVoice;
  /** Call `cb` once per game step with the elapsed milliseconds. Returns an unsubscribe function. */
  abstract onTick(cb: (dtMs: number) => void): () => void;
}

/** A voice that does nothing (used when a sound failed to load). */
export class SilentVoice extends SoundVoice {
  play(): void {}
  stop(): void {}
  setVolume(): void {}
  setRate(): void {}
  setPan(): void {}
  get playing(): boolean {
    return false;
  }
  destroy(): void {}
}
