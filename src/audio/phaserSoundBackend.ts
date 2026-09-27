import type Phaser from 'phaser';
import type { AudioKey } from '../assets';
import { SilentVoice, SoundBackend, SoundVoice, type SoundParams } from './soundBackend';

type PhaserSound = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.NoAudioSound;

class PhaserVoice extends SoundVoice {
  private destroyed = false;
  private started = false;

  constructor(
    private readonly sound: PhaserSound,
    private readonly oneShot: boolean,
  ) {
    super();
    if (oneShot) this.sound.once('complete', () => this.destroy());
  }

  play(): void {
    if (this.destroyed) return;
    this.started = true;
    this.sound.play();
  }

  stop(): void {
    if (this.destroyed) return;
    this.sound.stop();
    if (this.oneShot) this.destroy();
  }

  setVolume(volume: number): void {
    if (!this.destroyed) this.sound.setVolume(Math.max(0, volume));
  }

  setRate(rate: number): void {
    if (!this.destroyed) this.sound.setRate(Math.max(0.05, rate));
  }

  setPan(pan: number): void {
    if (!this.destroyed) this.sound.setPan(Math.max(-1, Math.min(1, pan)));
  }

  get playing(): boolean {
    return !this.destroyed && this.started && this.sound.isPlaying;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.sound.destroy();
  }
}

/**
 * SoundBackend on top of Phaser's game-wide sound manager. Uses game-level objects (not the scene's)
 * so voices survive the scene that created them.
 */
export class PhaserSoundBackend extends SoundBackend {
  private readonly game: Phaser.Game;
  private readonly warned = new Set<string>();

  constructor(scene: Phaser.Scene) {
    super();
    this.game = scene.game;
  }

  get locked(): boolean {
    return this.game.sound.locked;
  }

  play(key: AudioKey, params: SoundParams): SoundVoice | null {
    const sound = this.add(key, params);
    if (!sound) return null;
    const voice = new PhaserVoice(sound, true);
    voice.play();
    return voice;
  }

  create(key: AudioKey, params: SoundParams): SoundVoice {
    const sound = this.add(key, params);
    return sound ? new PhaserVoice(sound, false) : new SilentVoice();
  }

  onTick(cb: (dtMs: number) => void): () => void {
    const handler = (_time: number, delta: number): void => cb(delta);
    this.game.events.on('step', handler);
    return () => this.game.events.off('step', handler);
  }

  private add(key: AudioKey, params: SoundParams): PhaserSound | null {
    if (!this.game.cache.audio.exists(key)) {
      if (!this.warned.has(key)) {
        this.warned.add(key);
        console.warn(`[audio] "${key}" is not loaded; did the scene call loadAllAudio()?`);
      }
      return null;
    }
    return this.game.sound.add(key, {
      volume: Math.max(0, params.volume),
      rate: params.rate ?? 1,
      loop: params.loop ?? false,
      pan: params.pan ?? 0,
    });
  }
}
