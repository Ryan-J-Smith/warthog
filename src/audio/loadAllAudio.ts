import type Phaser from 'phaser';
import { AUDIO_KEYS, AUDIO_URLS, type AudioKey } from '../assets';
import { MIX } from './mixTable';
import { audioSettingsFor } from './sharedAudioSettings';

/**
 * Queue every sound in the audio manifest on the scene's loader (call from a preload()).
 * Phaser picks the first URL whose format the browser can play (Ogg first; WAV/MP3/M4A fallbacks).
 */
export function loadAllAudio(scene: Phaser.Scene): void {
  for (const key of AUDIO_KEYS) {
    if (!scene.cache.audio.exists(key)) scene.load.audio(key, AUDIO_URLS[key]);
  }
}

/** Play a menu/UI sound at its mixed volume, scaled by the player's SFX setting (Title, Briefing, Results, Pause). */
export function playUiSound(scene: Phaser.Scene, key: AudioKey): void {
  // Game-level objects, so a port created by one scene keeps working after that scene stops.
  const { cache, sound } = scene.game;
  const gain = audioSettingsFor(scene.game).gain('sfx');
  if (!cache.audio.exists(key) || sound.locked || gain <= 0) return;
  sound.play(key, { volume: MIX[key].volume * gain });
}
