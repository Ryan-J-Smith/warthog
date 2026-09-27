import Phaser from 'phaser';
import { loadAllSprites } from '../../render/sprites';
import { loadFonts } from '../../ui/fonts';

/** Loads every sprite and the game's fonts (the HUD uses them), then starts the requested view. */
export class GalleryPreloadScene extends Phaser.Scene {
  constructor(private readonly nextScene: string) {
    super('GalleryPreload');
  }

  preload(): void {
    const { width, height } = this.scale;
    const label = this.add
      .text(width / 2, height / 2, 'Loading sprites…', { fontFamily: 'monospace', fontSize: '28px', color: '#c8d0a0' })
      .setOrigin(0.5);
    this.load.on('progress', (p: number) => label.setText(`Loading sprites… ${Math.round(p * 100)}%`));
    this.load.on('loaderror', (file: Phaser.Loader.File) => console.error(`Failed to load ${file.key}`));
    loadAllSprites(this);
  }

  create(): void {
    void loadFonts()
      .catch((err: unknown) => console.warn('[gallery] fonts failed to load', err))
      .then(() => this.scene.start(this.nextScene));
  }
}
