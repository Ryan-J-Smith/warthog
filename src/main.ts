import Phaser from 'phaser';
import {
  BootScene,
  BriefingScene,
  GameScene,
  HudScene,
  PauseScene,
  PreloadScene,
  ResultsScene,
  TitleScene,
} from './scenes';

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  width: 1920,
  height: 1080,
  backgroundColor: '#0d0f0a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    roundPixels: false,
  },
  scene: [BootScene, PreloadScene, TitleScene, BriefingScene, GameScene, HudScene, PauseScene, ResultsScene],
});

declare global {
  interface Window {
    /** Dev-only handle for automated testing and debugging. */
    __warthog?: Phaser.Game;
  }
}

if (import.meta.env.DEV) window.__warthog = game;
