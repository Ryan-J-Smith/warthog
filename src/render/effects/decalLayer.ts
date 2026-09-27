import type Phaser from 'phaser';
import { SPRITES, SPRITE_RESOLUTION } from '../../assets';
import type { SpriteKey } from '../../assets';

interface Decal {
  image: Phaser.GameObjects.Image;
  age: number;
  targetAlpha: number;
  fadeIn: number;
}

/**
 * Persistent ground decals (craters, scorch marks) in a fixed-size ring buffer: when full, the
 * oldest decal is reused. Decals fade in quickly so they appear under the fireball, not before it.
 */
export class DecalLayer {
  private readonly decals: Decal[] = [];
  private next = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth: number,
    private readonly max: number,
  ) {}

  /** Place `key` centred at (x, y), `size` world units across, randomly rotated. */
  add(key: SpriteKey, x: number, y: number, size: number, alpha = 1, fadeIn = 0.25): void {
    let decal: Decal | undefined;
    if (this.decals.length < this.max) {
      const image = this.scene.add.image(x, y, key).setDepth(this.depth);
      decal = { image, age: 0, targetAlpha: alpha, fadeIn };
      this.decals.push(decal);
    } else {
      decal = this.decals[this.next];
      this.next = (this.next + 1) % this.max;
      if (!decal) return;
      decal.image.setTexture(key);
    }
    const native = SPRITES[key].w * SPRITE_RESOLUTION;
    decal.age = 0;
    decal.fadeIn = fadeIn;
    decal.targetAlpha = alpha;
    decal.image
      .setPosition(x, y)
      .setScale(size / native)
      .setRotation(Math.random() * Math.PI * 2)
      .setAlpha(fadeIn > 0 ? 0 : alpha)
      .setVisible(true);
  }

  update(dt: number): void {
    for (const d of this.decals) {
      if (d.age > d.fadeIn) continue;
      d.age += dt;
      d.image.setAlpha(d.fadeIn > 0 ? Math.min(1, d.age / d.fadeIn) * d.targetAlpha : d.targetAlpha);
    }
  }

  clear(): void {
    for (const d of this.decals) d.image.setVisible(false);
  }

  destroy(): void {
    for (const d of this.decals) d.image.destroy();
    this.decals.length = 0;
  }
}
