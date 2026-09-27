import Phaser from 'phaser';
import { SPRITES, SPRITE_RESOLUTION } from '../../assets';
import type { SpriteKey } from '../../assets';
import { riverCrossing } from '../../content/levels';
import { ENTITY_VISUALS } from '../../render/entities';
import { aircraftHeight, heightScale, shadowAlpha, shadowOffset, unitDisplayScale } from '../../render/layers';
import { TerrainModel, TerrainPainter } from '../../render/terrain';
import { degToRad } from '../../sim/math';

/**
 * Static AA emplacement base. Generated to public/assets/sprites/aaSite.svg; not in the SPRITES
 * table yet (the game still draws a static aaGun on `aaHull`), so the gallery loads it itself.
 */
const AA_SITE_KEY = 'aaSite';
const AA_SITE_SIZE = { w: 64, h: 64 };

type Unit = 'plane' | 'tank' | 'mobileAa' | 'staticAa' | 'truck' | 'mech' | 'friendlyTank' | 'friendlyMech';

const LINEUP: Array<{ unit: Unit; label: string }> = [
  { unit: 'plane', label: 'A-10 (player)' },
  { unit: 'tank', label: 'tank' },
  { unit: 'mobileAa', label: 'mobile AA' },
  { unit: 'staticAa', label: 'static AA' },
  { unit: 'truck', label: 'truck' },
  { unit: 'mech', label: 'mech' },
  { unit: 'friendlyTank', label: 'friendly tank' },
  { unit: 'friendlyMech', label: 'friendly mech' },
];

/** Bands: a 1.6× close-up, then true game scale at each altitude's camera zoom. */
const BANDS: Array<{ title: string; zoom: number; alt: number; unitScale: number; h: number }> = [
  { title: 'CLOSE-UP ×1.6', zoom: 1.6, alt: 0, unitScale: 1, h: 300 },
  { title: 'LOW · zoom 1.0', zoom: 1, alt: 0, unitScale: unitDisplayScale(1), h: 220 },
  { title: 'MEDIUM · zoom 0.72', zoom: 0.72, alt: 1, unitScale: unitDisplayScale(0.72), h: 190 },
  { title: 'HIGH · zoom 0.45', zoom: 0.45, alt: 2, unitScale: unitDisplayScale(0.45), h: 170 },
];

const INV_RES = 1 / SPRITE_RESOLUTION;
/** Ground halo under vehicles, as the game's EntityRenderer draws it. */
const HALO_SIZE = 1.9;
const HALO_ALPHA = 0.5;

/**
 * Every unit composed the way the game draws it (hull + turret on its pivot + ground halo, the
 * player with its altitude shadow) on painted desert terrain, at a close-up and at the true
 * on-screen size for Low / Medium / High. Each ground unit is shown facing east and turned 35°,
 * so tank vs AA can be checked by silhouette at every zoom.
 */
export class UnitsLineupScene extends Phaser.Scene {
  constructor() {
    super('UnitsLineup');
  }

  preload(): void {
    if (!this.textures.exists(AA_SITE_KEY)) {
      this.load.svg(AA_SITE_KEY, `assets/sprites/${AA_SITE_KEY}.svg`, {
        width: AA_SITE_SIZE.w * SPRITE_RESOLUTION,
        height: AA_SITE_SIZE.h * SPRITE_RESOLUTION,
      });
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#141610');
    const painter = new TerrainPainter(new TerrainModel(riverCrossing));
    const width = 1920;
    let y = 12;
    BANDS.forEach((band, i) => {
      this.paintBand(painter, `units-band-${i}`, y, width, band.h, band.zoom);
      this.add.text(12, y + 8, band.title, {
        fontFamily: 'system-ui, sans-serif',
        fontStyle: 'bold',
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: 'rgba(20, 16, 10, 0.78)',
        padding: { x: 6, y: 3 },
      });
      // The plane gets a wide first slot; ground units share the rest.
      const planeSlot = 330;
      const slot = (width - 140 - planeSlot) / (LINEUP.length - 1);
      LINEUP.forEach(({ unit, label }, k) => {
        const cx = k === 0 ? 140 + planeSlot / 2 : 140 + planeSlot + slot * (k - 0.5);
        const cy = y + band.h / 2 + (i === 0 ? -8 : 0);
        this.place(unit, cx, cy, band, i === 0);
        if (i === 0) {
          this.add
            .text(cx, y + band.h - 22, label, { fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#ffffff', backgroundColor: 'rgba(20, 16, 10, 0.7)', padding: { x: 5, y: 2 } })
            .setOrigin(0.5, 0);
        }
      });
      y += band.h + 8;
    });
  }

  /** Desert terrain behind a band, painted at the band's zoom (near LOD at ≥ 0.62, like the game). */
  private paintBand(painter: TerrainPainter, key: string, y: number, w: number, h: number, zoom: number): void {
    const tex = this.textures.createCanvas(key, w, h);
    if (!tex) throw new Error(`Could not create ${key}`);
    const worldW = w / zoom;
    const worldH = h / zoom;
    painter.paint(tex.getContext(), 4700 - worldW / 2, 4150 - worldH / 2, worldW, worldH, zoom, zoom >= 0.62 ? 'near' : 'far');
    tex.refresh();
    this.add.image(0, y, key).setOrigin(0);
  }

  private place(unit: Unit, cx: number, cy: number, band: (typeof BANDS)[number], closeUp: boolean): void {
    if (unit === 'plane') {
      const height = aircraftHeight(band.alt);
      const off = shadowOffset(height);
      const s = band.zoom * INV_RES;
      const rot = degToRad(closeUp ? -90 : -60);
      this.add
        .image(cx + off.x * band.zoom * 0.5, cy + off.y * band.zoom * 0.5, 'a10')
        .setTintFill(0x000000)
        .setAlpha(shadowAlpha(height))
        .setScale(s)
        .setRotation(rot);
      this.add.image(cx - off.x * band.zoom * 0.5, cy - off.y * band.zoom * 0.5, 'a10').setScale(s * heightScale(height)).setRotation(rot);
      return;
    }
    const s = band.zoom * band.unitScale;
    if (closeUp) {
      this.addGroundUnit(unit, cx, cy, 0, s);
      return;
    }
    const dx = 46 * s;
    this.addGroundUnit(unit, cx - dx, cy, 0, s);
    this.addGroundUnit(unit, cx + dx, cy, 35, s);
  }

  private addGroundUnit(unit: Exclude<Unit, 'plane'>, x: number, y: number, deg: number, s: number): void {
    const kind = unit === 'staticAa' ? 'aaGun' : unit === 'mech' ? 'infantry' : unit === 'friendlyMech' ? 'friendlyInfantry' : unit;
    const visual = ENTITY_VISUALS[kind];
    const base: string = unit === 'staticAa' ? AA_SITE_KEY : visual.base;
    const baseW = unit === 'staticAa' ? AA_SITE_SIZE.w : SPRITES[visual.base].w;
    const diameter = baseW * HALO_SIZE * s;
    this.add
      .image(x, y, 'particleSoft')
      .setTintFill(0x000000)
      .setAlpha(HALO_ALPHA)
      .setScale((diameter / SPRITES.particleSoft.w) * INV_RES);
    const rot = degToRad(deg);
    this.add.image(x, y, base).setScale(s * INV_RES).setRotation(rot);
    const top: SpriteKey | null = visual.top;
    if (top) {
      this.add
        .image(x, y, top)
        .setOrigin(visual.topOrigin.x, visual.topOrigin.y)
        .setScale(s * INV_RES)
        .setRotation(rot + degToRad(unit === 'mobileAa' || unit === 'staticAa' ? -20 : 0));
    }
  }
}
