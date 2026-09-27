import Phaser from 'phaser';
import { SPRITE_RESOLUTION } from '../../assets';
import type { WorldView } from '../../sim/world';
import { DEPTH, aircraftHeight, heightScale, shadowAlpha, shadowOffset } from '../layers';

const INV_RES = 1 / SPRITE_RESOLUTION;

/** The player's A-10 and its ground shadow, with altitude scaling and a banking squash. */
export class PlayerRenderer {
  private readonly plane: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Image;

  constructor(private readonly scene: Phaser.Scene) {
    this.shadow = scene.add.image(0, 0, 'a10').setTintFill(0x000000).setDepth(DEPTH.airShadows);
    this.plane = scene.add.image(0, 0, 'a10').setDepth(DEPTH.air);
  }

  sync(view: WorldView): void {
    const p = view.player;
    this.plane.setVisible(p.alive);
    this.shadow.setVisible(p.alive);
    if (!p.alive) return;

    const height = aircraftHeight(p.alt);
    const scale = heightScale(height) * INV_RES;
    // Banking: squash the wings as the aircraft rolls into a turn.
    const bank = 1 - Math.abs(p.turnInput) * 0.2;
    this.plane.setPosition(p.pos.x, p.pos.y).setRotation(p.heading).setScale(scale, scale * bank);

    const off = shadowOffset(height);
    this.shadow
      .setPosition(p.pos.x + off.x, p.pos.y + off.y)
      .setRotation(p.heading)
      .setScale(INV_RES, INV_RES * bank)
      .setAlpha(shadowAlpha(height));

    const blink = p.invulnerable > 0 && Math.floor(this.scene.time.now / 90) % 2 === 0;
    this.plane.setAlpha(blink ? 0.35 : 1);
  }

  destroy(): void {
    this.plane.destroy();
    this.shadow.destroy();
  }
}
