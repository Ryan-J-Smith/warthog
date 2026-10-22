import type Phaser from 'phaser';
import { SimEventListener, type SimEvent } from '../sim/events';
import type { WorldView } from '../sim/world';
import { AudioDirectorCore } from './audioDirectorCore';
import { MusicManager } from './musicManager';
import { PhaserSoundBackend } from './phaserSoundBackend';

/**
 * Game-scene audio: listens to simulation events and reads world state each frame.
 *
 * - GAU-8 loop on gunStarted/gunStopped, plus the release tail/echo
 * - engine loop pitched and levelled by player speed/energy, silent while dead
 * - RWR lock beeps (accelerating) while SAM radars lock; launch warble while missiles track
 * - rearm loop over home base, low-health warning, radio squelch, objective stings
 * - afterburner roar while boosting (ignition whump, flame-out sputter), air-brake whoosh
 * - AA laser: spatial charge whine while a gun aims, one spatial beam hum per firing gun
 * - shield crackle/down/regen/full; beam damage is rate-limited and quieter than other hits
 * - SAM-evaded whoosh, pickup sparkle/chime, kill-chain blips pitched up the chain, zone-cleared sting
 * - positional one-shots (distance attenuation + pan), per-key voice caps, ±pitch variation,
 *   gun impacts aggregated to one crackle per 100 ms, music ducking under radio and big blasts
 *
 * Call `update()` every frame and `handleEvents()` with the frame's events; `destroy()` on shutdown.
 */
export class AudioDirector extends SimEventListener {
  private readonly core: AudioDirectorCore;
  private readonly backend: PhaserSoundBackend;

  constructor(scene: Phaser.Scene) {
    super();
    // Everything the director plays is a sound effect: scaled by the player's SFX volume/mute.
    this.backend = new PhaserSoundBackend(scene, 'sfx');
    this.core = new AudioDirectorCore({
      backend: this.backend,
      music: new MusicManager(scene),
    });
  }

  handleEvents(events: readonly SimEvent[]): void {
    this.core.handleEvents(events);
  }

  update(dtMs: number, world: WorldView): void {
    this.core.update(dtMs, world);
  }

  destroy(): void {
    this.core.destroy();
    this.backend.dispose();
  }
}
