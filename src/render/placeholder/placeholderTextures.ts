import Phaser from 'phaser';
import { SPRITES, SPRITE_KEYS, SPRITE_RESOLUTION, type SpriteKey } from '../../assets';

/** Colour for a placeholder by sprite family, so missing art is still readable. */
function colorFor(key: SpriteKey): number {
  if (key === 'a10') return 0x9aa3a8;
  if (key.startsWith('friendly') || key === 'outpost' || key === 'homeBase') return 0x4a7ab8;
  if (key.includes('Wreck') || key.includes('Destroyed')) return 0x2a2a2a;
  if (key.startsWith('particle') || key.startsWith('cloud') || key.startsWith('reticle') || key.startsWith('icon') || key === 'lockBracket' || key === 'offscreenArrow' || key === 'flare') return 0xffffff;
  if (key === 'crater' || key === 'scorch') return 0x201a14;
  return 0x8a5a3a;
}

/**
 * Generate a simple texture for every sprite key that failed to load, so the game runs while
 * art is still in progress. Returns the keys that were generated.
 */
export function ensurePlaceholderTextures(scene: Phaser.Scene): SpriteKey[] {
  const generated: SpriteKey[] = [];
  for (const key of SPRITE_KEYS) {
    if (scene.textures.exists(key)) continue;
    const spec = SPRITES[key];
    const w = Math.max(2, Math.round(spec.w * SPRITE_RESOLUTION));
    const h = Math.max(2, Math.round(spec.h * SPRITE_RESOLUTION));
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const color = colorFor(key);
    if (key.startsWith('cloud') || key.startsWith('particle')) {
      g.fillStyle(color, 0.6);
      g.fillEllipse(w / 2, h / 2, w, h);
    } else if (key.startsWith('reticle') || key === 'lockBracket') {
      g.lineStyle(4, color, 1);
      g.strokeCircle(w / 2, h / 2, Math.min(w, h) / 2 - 3);
    } else {
      g.fillStyle(color, 1);
      g.fillRect(0, 0, w, h);
      // Nose marker so facing is visible.
      g.fillStyle(0xffffff, 0.7);
      g.fillRect(w - Math.max(2, w * 0.15), h * 0.35, Math.max(2, w * 0.15), h * 0.3);
    }
    g.generateTexture(key, w, h);
    g.destroy();
    generated.push(key);
  }
  return generated;
}
