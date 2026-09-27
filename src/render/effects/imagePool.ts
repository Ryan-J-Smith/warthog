import type Phaser from 'phaser';

/** Reusable Images at a fixed depth and blend mode (never re-sorted after creation). */
export class ImagePool {
  private readonly free: Phaser.GameObjects.Image[] = [];
  private readonly all: Phaser.GameObjects.Image[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth: number,
    private readonly blend: Phaser.BlendModes,
  ) {}

  acquire(texture: string): Phaser.GameObjects.Image {
    let img = this.free.pop();
    if (!img) {
      img = this.scene.add.image(0, 0, texture).setDepth(this.depth).setBlendMode(this.blend);
      this.all.push(img);
    } else if (img.texture.key !== texture) {
      img.setTexture(texture);
    }
    img.clearTint();
    img.setAlpha(1).setRotation(0).setScale(1).setOrigin(0.5).setVisible(true);
    return img;
  }

  release(img: Phaser.GameObjects.Image): void {
    img.setVisible(false);
    this.free.push(img);
  }

  destroy(): void {
    for (const img of this.all) img.destroy();
    this.all.length = 0;
    this.free.length = 0;
  }
}
