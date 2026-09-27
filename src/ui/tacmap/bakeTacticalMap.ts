import type Phaser from 'phaser';
import type { LevelDefinition } from '../../sim/level';
import { drawTacticalMap } from './drawTacticalMap';
import type { TacMapStyle } from './tacMapStyle';

/**
 * Render a level's tactical map once into a canvas texture under `key` (reused if it already
 * exists, so scene restarts don't redraw it). Returns the texture key.
 */
export function bakeTacticalMap(
  scene: Phaser.Scene,
  key: string,
  level: LevelDefinition,
  width: number,
  height: number,
  style: TacMapStyle,
): string {
  if (scene.textures.exists(key)) return key;
  const texture = scene.textures.createCanvas(key, Math.round(width), Math.round(height));
  if (!texture) throw new Error(`Could not create canvas texture ${key}`);
  drawTacticalMap(texture.getContext(), level, texture.width, texture.height, style);
  texture.refresh();
  return key;
}
