import type Phaser from 'phaser';
import { AudioSettings } from './audioSettings';
import { LocalSettingsStore } from './settingsStore';

const settingsByGame = new WeakMap<Phaser.Game, AudioSettings>();

/** The game's one `AudioSettings` (created on first use, persisted in localStorage). */
export function audioSettingsFor(game: Phaser.Game): AudioSettings {
  let settings = settingsByGame.get(game);
  if (!settings) {
    settings = new AudioSettings(new LocalSettingsStore());
    settingsByGame.set(game, settings);
  }
  return settings;
}
