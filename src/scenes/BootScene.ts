import Phaser from 'phaser';
import { REGISTRY, probeSprites } from '../assets';
import { loadFonts } from '../ui/fonts';
import { SCENES } from './sceneKeys';

/** First scene: works out which asset files exist and loads the UI fonts, then hands over to the preloader. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  create(): void {
    void Promise.all([probeSprites(), loadFonts()]).then(([available]) => {
      this.registry.set(REGISTRY.availableSprites, available);
      this.scene.start(SCENES.preload);
    });
  }
}
