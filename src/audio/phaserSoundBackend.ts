import type Phaser from 'phaser';
import type { AudioKey } from '../assets';
import type { AudioChannel } from '../ui/sound';
import { audioSettingsFor } from './sharedAudioSettings';
import { SilentVoice, SoundBackend, SoundVoice, type SoundParams } from './soundBackend';

type PhaserSound = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.NoAudioSound;

class PhaserVoice extends SoundVoice {
  private destroyed = false;
  private started = false;

  /**
   * @param volume the requested volume; what's applied is `volume × gain()` (the channel's setting)
   * @param onDestroy lets the backend forget the voice
   */
  constructor(
    private readonly sound: PhaserSound,
    private readonly oneShot: boolean,
    private volume: number,
    private readonly gain: () => number,
    private readonly onDestroy: (voice: PhaserVoice) => void,
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
    this.volume = volume;
    this.applyVolume();
  }

  /** Re-apply the requested volume (after the channel's setting changed). */
  applyVolume(): void {
    if (!this.destroyed) this.sound.setVolume(Math.max(0, this.volume) * this.gain());
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
    this.onDestroy(this);
  }
}

/**
 * SoundBackend on top of Phaser's game-wide sound manager. Uses game-level objects (not the scene's)
 * so voices survive the scene that created them.
 *
 * With a `channel`, every voice is scaled by that channel's volume/mute from the player's settings,
 * live (changing the setting re-applies to voices already playing). Without one (music, which
 * applies its own level), volumes pass through unchanged. Call `dispose()` when done.
 */
export class PhaserSoundBackend extends SoundBackend {
  private readonly game: Phaser.Game;
  private readonly warned = new Set<string>();
  private readonly voices = new Set<PhaserVoice>();
  private readonly gain: () => number;
  private readonly unsubscribe: () => void;

  constructor(scene: Phaser.Scene, channel: AudioChannel | null = null) {
    super();
    this.game = scene.game;
    if (channel) {
      const settings = audioSettingsFor(this.game);
      this.gain = () => settings.gain(channel);
      this.unsubscribe = settings.subscribe(() => {
        for (const v of this.voices) v.applyVolume();
      });
    } else {
      this.gain = () => 1;
      this.unsubscribe = () => {};
    }
  }

  /** Stop following the settings (voices already created keep playing). */
  dispose(): void {
    this.unsubscribe();
    this.voices.clear();
  }

  get locked(): boolean {
    return this.game.sound.locked;
  }

  play(key: AudioKey, params: SoundParams): SoundVoice | null {
    const sound = this.add(key, params);
    if (!sound) return null;
    const voice = this.track(new PhaserVoice(sound, true, params.volume, this.gain, (v) => this.voices.delete(v)));
    voice.play();
    return voice;
  }

  create(key: AudioKey, params: SoundParams): SoundVoice {
    const sound = this.add(key, params);
    return sound ? this.track(new PhaserVoice(sound, false, params.volume, this.gain, (v) => this.voices.delete(v))) : new SilentVoice();
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
      volume: Math.max(0, params.volume) * this.gain(),
      rate: params.rate ?? 1,
      loop: params.loop ?? false,
      pan: params.pan ?? 0,
    });
  }

  private track(voice: PhaserVoice): PhaserVoice {
    this.voices.add(voice);
    return voice;
  }
}
