import Phaser from 'phaser';
import { SPRITE_RESOLUTION, type SpriteKey } from '../../assets';
import type { LevelDefinition } from '../../sim/level';
import { Rng, clamp } from '../../sim/math';
import type { WorldView } from '../../sim/world';
import { DEPTH, shadowOffset } from '../layers';

const CLOUD_KEYS: readonly SpriteKey[] = ['cloud1', 'cloud2', 'cloud3', 'cloud4'];
const INV_RES = 1 / SPRITE_RESOLUTION;
/** Cloud height above ground (band units) — between Medium and High. */
const CLOUD_HEIGHT = 1.6;
/** Parallax factor: clouds are closer to the camera than the ground. */
const PARALLAX = 0.3;
const WIND = { x: 9, y: 2 };

interface Cloud {
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
}

/**
 * Drifting clouds between Medium and High. Cloud shadows always dapple the ground; the clouds
 * themselves fade in as the player climbs above them, with parallax so they read as 2.5D.
 */
export class CloudLayer {
  private readonly clouds: Cloud[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly level: LevelDefinition,
    count = 28,
  ) {
    const rng = new Rng(level.seed ^ 0x51f15e);
    for (let i = 0; i < count; i++) {
      const key = rng.pick(CLOUD_KEYS);
      const scale = rng.range(0.9, 1.8);
      const x = rng.range(0, level.width);
      const y = rng.range(0, level.height);
      const shadow = scene.add
        .image(x, y, key)
        .setTintFill(0x000000)
        .setAlpha(0.1)
        .setScale(INV_RES * scale)
        .setDepth(DEPTH.decals + 1);
      const sprite = scene.add.image(x, y, key).setScale(INV_RES * scale).setDepth(DEPTH.clouds);
      this.clouds.push({ x, y, sprite, shadow });
    }
  }

  update(dtMs: number, view: WorldView): void {
    const cam = this.scene.cameras.main;
    const cx = cam.midPoint.x;
    const cy = cam.midPoint.y;
    const dt = dtMs / 1000;
    const alpha = clamp((view.player.alt - 0.9) / 0.9, 0, 1) * 0.62;
    const off = shadowOffset(CLOUD_HEIGHT);
    const w = this.level.width;
    const h = this.level.height;

    for (const c of this.clouds) {
      c.x += WIND.x * dt;
      c.y += WIND.y * dt;
      if (c.x > w + 400) c.x -= w + 800;
      if (c.y > h + 400) c.y -= h + 800;
      c.shadow.setPosition(c.x + off.x, c.y + off.y);
      c.sprite
        .setPosition(cx + (c.x - cx) * (1 + PARALLAX), cy + (c.y - cy) * (1 + PARALLAX))
        .setAlpha(alpha)
        .setVisible(alpha > 0.01);
    }
  }

  destroy(): void {
    for (const c of this.clouds) {
      c.sprite.destroy();
      c.shadow.destroy();
    }
    this.clouds.length = 0;
  }
}
