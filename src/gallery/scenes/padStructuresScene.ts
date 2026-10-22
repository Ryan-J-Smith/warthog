import Phaser from 'phaser';
import { SPRITES, SPRITE_RESOLUTION } from '../../assets';
import type { SpriteKey } from '../../assets';
import { riverCrossing } from '../../content/levels';
import { TerrainModel, TerrainPainter } from '../../render/terrain';
import { withGalleryBiome } from './galleryBiome';

/** Build-pad circle radius used by Hold the Line (world units). */
const PAD_RADIUS = 150;
const ROWS: Array<{ title: string; keys: SpriteKey[] }> = [
  { title: 'LEVEL 1', keys: ['structBarracks', 'structDepot', 'structBunker', 'structFlak'] },
  { title: 'LEVEL 2', keys: ['structBarracks2', 'structDepot2', 'structBunker2', 'structFlak2'] },
];
const ZOOM = 1.1;
const INV_RES = 1 / SPRITE_RESOLUTION;

/**
 * Hold-the-Line build-pad structures (`?view=pads`), level 1 and level 2, each drawn at true size
 * (×ZOOM) inside a dashed pad circle on painted terrain (`&biome=winter` for the winter map).
 */
export class PadStructuresScene extends Phaser.Scene {
  constructor() {
    super('PadStructures');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#141610');
    const painter = new TerrainPainter(new TerrainModel(withGalleryBiome(riverCrossing)));
    const width = 1920;
    const rowH = 520;
    ROWS.forEach((row, r) => {
      const y = 12 + r * (rowH + 8);
      const key = `pads-band-${r}`;
      const tex = this.textures.createCanvas(key, width, rowH);
      if (!tex) throw new Error(`Could not create ${key}`);
      const worldW = width / ZOOM;
      const worldH = rowH / ZOOM;
      painter.paint(tex.getContext(), 4700 - worldW / 2, 4150 - worldH / 2, worldW, worldH, ZOOM, 'near');
      tex.refresh();
      this.add.image(0, y, key).setOrigin(0);
      this.add.text(12, y + 8, row.title, {
        fontFamily: 'system-ui, sans-serif',
        fontStyle: 'bold',
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: 'rgba(20, 16, 10, 0.78)',
        padding: { x: 6, y: 3 },
      });
      row.keys.forEach((k, i) => {
        const cx = (width / row.keys.length) * (i + 0.5);
        const cy = y + rowH / 2;
        const ring = this.add.graphics();
        ring.fillStyle(0x3f8ef0, 0.12).fillCircle(cx, cy, PAD_RADIUS * ZOOM);
        ring.lineStyle(3, 0x3f8ef0, 0.8).strokeCircle(cx, cy, PAD_RADIUS * ZOOM);
        this.add.image(cx, cy, k).setScale(ZOOM * INV_RES);
        this.add
          .text(cx, y + rowH - 26, `${k} · ${SPRITES[k].w}×${SPRITES[k].h}`, {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '14px',
            color: '#ffffff',
            backgroundColor: 'rgba(20, 16, 10, 0.7)',
            padding: { x: 5, y: 2 },
          })
          .setOrigin(0.5, 0);
      });
    });
  }
}
