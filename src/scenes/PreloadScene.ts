import Phaser from 'phaser';
import { REGISTRY, type SpriteKey } from '../assets';
import { loadAllAudio, registerUiSound } from '../audio';
import { ensurePlaceholderTextures } from '../render/placeholder';
import { loadSprite } from '../render/sprites';
import { SCENES, type GameSceneData } from './sceneKeys';

/** Loads every sprite (and later audio) with a progress bar, then shows the title. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENES.preload);
  }

  preload(): void {
    const { width, height } = this.scale;
    const barW = 640;
    const frame = this.add.rectangle(width / 2, height / 2, barW + 8, 28).setStrokeStyle(2, 0xc8d0a0);
    const bar = this.add.rectangle(width / 2 - barW / 2, height / 2, 0, 20, 0xc8d0a0).setOrigin(0, 0.5);
    this.add
      .text(width / 2, height / 2 - 60, 'WARTHOG', { fontFamily: 'monospace', fontSize: '48px', color: '#c8d0a0' })
      .setOrigin(0.5);
    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => bar.setSize(barW * value, 20));
    this.load.on(Phaser.Loader.Events.COMPLETE, () => {
      frame.destroy();
      bar.destroy();
    });

    const available = (this.registry.get(REGISTRY.availableSprites) as SpriteKey[] | undefined) ?? [];
    for (const key of available) loadSprite(this, key);
    loadAllAudio(this);
  }

  create(): void {
    registerUiSound(this);
    const missing = ensurePlaceholderTextures(this);
    if (missing.length > 0) console.info(`[warthog] placeholder textures for: ${missing.join(', ')}`);
    // Dev shortcut: ?play=<levelId> jumps straight into a mission.
    const play = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('play') : null;
    if (play) {
      const data: GameSceneData = { levelId: play };
      this.scene.start(SCENES.game, data);
      return;
    }
    this.scene.start(SCENES.title);
  }
}
