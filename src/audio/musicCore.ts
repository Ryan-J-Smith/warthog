import type { AudioKey } from '../assets';
import type { MissionOutcome } from '../sim/types';
import type { AudioSettings } from './audioSettings';
import { missionMusicKey } from './missionMusic';
import { MIX } from './mixTable';
import { MusicControl } from './musicControl';
import type { SoundBackend, SoundVoice } from './soundBackend';

/** Overall music level relative to sound effects (at 100% music volume). */
export const MUSIC_VOLUME = 0.6;

const DUCK_ATTACK_MS = 90;
const DUCK_RELEASE_MS = 700;

interface Track {
  key: AudioKey;
  voice: SoundVoice;
  /** Fade gain 0..1. */
  gain: number;
  target: number;
  /** Gain change per millisecond while fading. */
  speed: number;
  /** Stop and release the voice once it has faded to silence. */
  stopAtZero: boolean;
  startedAtMs: number;
}

/**
 * Engine-independent music logic: crossfades, stings, ducking. Level and mute follow the player's
 * `AudioSettings` (music channel). `MusicManager` shares one instance per game.
 */
export class MusicCore extends MusicControl {
  private tracks: Track[] = [];
  private current: Track | null = null;
  private nowMs = 0;
  private duckLevel = 1;
  private duckTarget = 1;
  private duckUntilMs = 0;
  private readonly unsubscribe: () => void;
  private readonly unsubscribeSettings: () => void;

  constructor(
    private readonly backend: SoundBackend,
    private readonly settings: AudioSettings,
  ) {
    super();
    this.unsubscribe = backend.onTick((dt) => this.tick(dt));
    this.unsubscribeSettings = settings.subscribe(() => this.apply());
  }

  playTitle(): void {
    this.playTrack('musicTitle', true, 1800, 1200);
  }

  /** Crossfade to the in-mission track for `levelId` (`musicMission` when the level has none of its own). */
  playMission(levelId?: string): void {
    this.playTrack(missionMusicKey(levelId), true, 1200, 1500);
  }

  playSting(outcome: MissionOutcome): void {
    const key: AudioKey = outcome === 'victory' ? 'stingVictory' : 'stingDefeat';
    // Idempotent: the director and a results scene may both ask for it.
    if (this.current?.key === key && this.nowMs - this.current.startedAtMs < 3000) return;
    this.playTrack(key, false, 0, 500, true);
  }

  /** Fade all music out. */
  stop(fadeMs = 900): void {
    for (const t of this.tracks) this.fadeTo(t, 0, fadeMs, true);
    this.current = null;
  }

  duck(level: number, holdMs: number): void {
    this.duckTarget = Math.min(this.duckTarget, Math.max(0, Math.min(1, level)));
    this.duckUntilMs = Math.max(this.duckUntilMs, this.nowMs + holdMs);
  }

  /** Key of the track currently in charge (null when stopped). */
  currentKey(): AudioKey | null {
    return this.current?.key ?? null;
  }

  destroy(): void {
    this.unsubscribe();
    this.unsubscribeSettings();
    for (const t of this.tracks) t.voice.destroy();
    this.tracks = [];
    this.current = null;
  }

  /** Advance fades and ducking. Driven by the backend tick; public for tests. */
  tick(dtMs: number): void {
    this.nowMs += dtMs;
    for (const t of this.tracks) {
      if (t.gain !== t.target) {
        const step = t.speed * dtMs;
        t.gain = t.gain < t.target ? Math.min(t.target, t.gain + step) : Math.max(t.target, t.gain - step);
      }
    }
    const finished = this.tracks.filter((t) => (t.stopAtZero && t.gain <= 0) || (t !== this.current && !t.voice.playing));
    for (const t of finished) {
      t.voice.stop();
      t.voice.destroy();
    }
    this.tracks = this.tracks.filter((t) => !finished.includes(t));
    if (this.nowMs >= this.duckUntilMs) this.duckTarget = 1;
    const tau = this.duckTarget < this.duckLevel ? DUCK_ATTACK_MS : DUCK_RELEASE_MS;
    this.duckLevel += (this.duckTarget - this.duckLevel) * (1 - Math.exp(-dtMs / tau));
    this.apply();
  }

  private playTrack(key: AudioKey, loop: boolean, fadeInMs: number, fadeOutMs: number, restart = false): void {
    if (!restart && this.current?.key === key && this.current.voice.playing) return;
    for (const t of this.tracks) this.fadeTo(t, 0, fadeOutMs, true);
    const voice = this.backend.create(key, { volume: 0, loop });
    const track: Track = {
      key,
      voice,
      gain: fadeInMs > 0 ? 0 : 1,
      target: 1,
      speed: fadeInMs > 0 ? 1 / fadeInMs : 1,
      stopAtZero: false,
      startedAtMs: this.nowMs,
    };
    this.tracks.push(track);
    this.current = track;
    this.apply();
    voice.play();
  }

  private fadeTo(t: Track, target: number, ms: number, stopAtZero: boolean): void {
    t.target = target;
    t.speed = ms > 0 ? Math.abs(t.gain - target) / ms || 1 : 1;
    t.stopAtZero = stopAtZero;
    if (ms <= 0) t.gain = target;
  }

  private apply(): void {
    const master = MUSIC_VOLUME * this.settings.gain('music') * this.duckLevel;
    for (const t of this.tracks) t.voice.setVolume(master * MIX[t.key].volume * t.gain);
  }
}
