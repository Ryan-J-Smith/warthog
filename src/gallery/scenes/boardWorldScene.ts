import Phaser from 'phaser';
import { riverCrossing } from '../../content/levels';
import { DEPTH, aircraftHeight, heightScale, shadowAlpha, shadowOffset, unitDisplayScale } from '../../render/layers';
import { SPRITE_SCALE } from '../../render/sprites';
import { TerrainRenderer } from '../../render/terrain';
import { degToRad } from '../../sim/math';
import { BOARD_CENTRE, STAGED_PLANES, STAGED_UNITS, addUnit } from './boardStaging';

export interface BoardPanelConfig {
  /** Camera zoom (1.0 = Low, 0.45 = High). */
  zoom: number;
  /** Player altitude drawn in this panel (0 = Low, 2 = High): sets plane scale + shadow offset. */
  alt: number;
  /** Screen-space viewport of the panel on the 1920 × 1080 board. */
  viewport: { x: number; y: number; w: number; h: number };
}

/**
 * One live terrain panel of the style board: the real `TerrainRenderer` at a fixed zoom, with the
 * staged units drawn the way the game draws them (ground halo, turret pivots, zoomed-out unit
 * scale-up) and both player variants flying overhead with their shadows.
 * H toggles the ground halos.
 */
export class BoardWorldScene extends Phaser.Scene {
  private readonly halos: Phaser.GameObjects.Image[] = [];

  constructor(
    key: string,
    private readonly cfg: BoardPanelConfig,
  ) {
    super(key);
  }

  create(): void {
    const { zoom, viewport } = this.cfg;
    const cam = this.cameras.main;
    cam.setViewport(viewport.x, viewport.y, viewport.w, viewport.h);
    cam.setZoom(zoom);
    cam.centerOn(BOARD_CENTRE.x, BOARD_CENTRE.y);

    new TerrainRenderer(this, riverCrossing).build();

    const unitScale = unitDisplayScale(zoom);
    for (const u of STAGED_UNITS) {
      const { halo } = addUnit(this, u, { unitScale });
      if (halo) this.halos.push(halo);
    }
    this.addPlanes();

    this.input.keyboard?.on('keydown-H', () => {
      for (const h of this.halos) h.setVisible(!h.visible);
    });
  }

  private addPlanes(): void {
    const height = aircraftHeight(this.cfg.alt);
    const off = shadowOffset(height);
    const scale = heightScale(height) * SPRITE_SCALE;
    const px = 1 / this.cfg.zoom;
    for (const p of STAGED_PLANES) {
      const rot = degToRad(p.heading);
      this.add
        .image(p.x + off.x, p.y + off.y, p.key)
        .setTintFill(0x000000)
        .setAlpha(shadowAlpha(height))
        .setScale(SPRITE_SCALE)
        .setRotation(rot)
        .setDepth(DEPTH.airShadows);
      this.add.image(p.x, p.y, p.key).setScale(scale).setRotation(rot).setDepth(DEPTH.air);
      // Constant-size label above each variant.
      this.add
        .text(p.x, p.y - 96 * Math.max(1, heightScale(height)), p.label, {
          fontFamily: 'system-ui, sans-serif',
          fontStyle: 'bold',
          fontSize: '20px',
          color: '#ffffff',
          backgroundColor: 'rgba(20, 24, 40, 0.78)',
          padding: { x: 8, y: 3 },
        })
        .setOrigin(0.5, 1)
        .setScale(px)
        .setDepth(DEPTH.worldUi);
    }
  }
}
