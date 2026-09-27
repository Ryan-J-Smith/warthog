import type Phaser from 'phaser';
import { COLOR } from '../theme';
import { UI_TEX, ensureUiTextures } from './uiTextures';

export interface BackdropOptions {
  /** Texture drawn full-screen under the overlays (e.g. a baked tactical map). */
  mapKey?: string;
  mapAlpha?: number;
  /** Faint grid spacing in px (0 = none). */
  grid?: number;
  scanlines?: number;
  vignette?: number;
}

/** Dark menu backdrop: optional map, faint grid, scanlines and a black vignette. Screen-sized. */
export function createBackdrop(scene: Phaser.Scene, options: BackdropOptions = {}): Phaser.GameObjects.Container {
  ensureUiTextures(scene);
  const { width, height } = scene.scale;
  const container = scene.add.container(0, 0);
  container.add(scene.add.rectangle(0, 0, width, height, 0x060b07, 1).setOrigin(0));
  if (options.mapKey) {
    const map = scene.add.image(width / 2, height / 2, options.mapKey).setAlpha(options.mapAlpha ?? 0.35);
    map.setScale(Math.max(width / map.width, height / map.height));
    container.add(map);
  }
  const grid = options.grid ?? 0;
  if (grid > 0) {
    const g = scene.add.graphics();
    g.lineStyle(1, COLOR.green, 0.06);
    for (let x = grid; x < width; x += grid) g.lineBetween(x, 0, x, height);
    for (let y = grid; y < height; y += grid) g.lineBetween(0, y, width, y);
    container.add(g);
  }
  container.add(scene.add.image(width / 2, height / 2, UI_TEX.vignette).setDisplaySize(width, height).setTint(0x000000).setAlpha(options.vignette ?? 0.85));
  container.add(scene.add.tileSprite(0, 0, width, height, UI_TEX.scanlines).setOrigin(0).setAlpha(options.scanlines ?? 0.35));
  return container;
}
