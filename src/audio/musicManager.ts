import type Phaser from 'phaser';
import type { MissionOutcome } from '../sim/types';
import { MusicControl } from './musicControl';
import { MusicCore } from './musicCore';
import { PhaserSoundBackend } from './phaserSoundBackend';
import { audioSettingsFor } from './sharedAudioSettings';

/** One music core per game, shared by every MusicManager (and so every scene). */
const cores = new WeakMap<Phaser.Game, MusicCore>();

/**
 * Music for the whole game: title/briefing theme, mission theme, victory/defeat stings,
 * crossfades and ducking. Volume and mute come from the shared `AudioSettings`.
 *
 * Construct one in any scene: all instances share the same underlying state, so calling
 * `playTitle()` from the briefing while the title theme is already playing is a no-op, and
 * `playMission()` from the game scene crossfades.
 */
export class MusicManager extends MusicControl {
  private readonly core: MusicCore;

  constructor(scene: Phaser.Scene) {
    super();
    let core = cores.get(scene.game);
    if (!core) {
      core = new MusicCore(new PhaserSoundBackend(scene), audioSettingsFor(scene.game));
      cores.set(scene.game, core);
    }
    this.core = core;
  }

  playTitle(): void {
    this.core.playTitle();
  }

  playMission(): void {
    this.core.playMission();
  }

  playSting(outcome: MissionOutcome): void {
    this.core.playSting(outcome);
  }

  stop(): void {
    this.core.stop();
  }

  duck(level: number, holdMs: number): void {
    this.core.duck(level, holdMs);
  }
}
