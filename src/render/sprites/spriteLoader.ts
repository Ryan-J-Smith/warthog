import type Phaser from 'phaser';
import { SPRITES, SPRITE_KEYS, SPRITE_RESOLUTION, spriteUrl } from '../../assets';
import type { SpriteKey } from '../../assets';

/**
 * Scale to apply to any image made from a sprite texture so it displays at its native world size.
 * SVGs are rasterised at `SPRITE_RESOLUTION`× for crispness.
 */
export const SPRITE_SCALE = 1 / SPRITE_RESOLUTION;

/**
 * Queue every SVG sprite on the scene's loader, rasterised at `SPRITE_RESOLUTION`×.
 * Call from a scene's `preload()`; texture keys are the `SpriteKey` names.
 */
export function loadAllSprites(scene: Phaser.Scene): void {
  for (const key of SPRITE_KEYS) {
    loadSprite(scene, key);
  }
}

/** Queue a single SVG sprite (no-op if the texture already exists). */
export function loadSprite(scene: Phaser.Scene, key: SpriteKey): void {
  if (scene.textures.exists(key)) return;
  const spec = SPRITES[key];
  scene.load.svg(key, spriteUrl(key), {
    width: spec.w * SPRITE_RESOLUTION,
    height: spec.h * SPRITE_RESOLUTION,
  });
}

/**
 * Add an image of a sprite at native world size. Origin defaults to the centre; pass a pivot in
 * sprite units (e.g. the tank turret's `{ x: 10, y: 6 }`) to rotate around it.
 */
export function addSpriteImage(
  scene: Phaser.Scene,
  x: number,
  y: number,
  key: SpriteKey,
  pivot?: { x: number; y: number },
): Phaser.GameObjects.Image {
  const image = scene.add.image(x, y, key).setScale(SPRITE_SCALE);
  if (pivot) {
    const spec = SPRITES[key];
    image.setOrigin(pivot.x / spec.w, pivot.y / spec.h);
  }
  return image;
}
