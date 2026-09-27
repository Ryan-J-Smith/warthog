import Phaser from 'phaser';
import { SPRITES, SPRITE_RESOLUTION } from '../../assets';
import type { SpriteKey } from '../../assets';
import { ENTITY_VISUALS } from '../../render/entities';
import { DEPTH } from '../../render/layers';
import { degToRad } from '../../sim/math';
import type { Vec2 } from '../../sim/math';

/**
 * Style board staging (`gallery.html?view=board`): who stands where around the River Crossing
 * bridge, plus the texture keys for gallery-only art (player variant B, v0 before/after sprites).
 */

/** Texture key of the player variant B preview (generated to src/gallery/preview/a10B.svg). */
export const VARIANT_B_KEY = 'preview-a10B';
/** Texture key prefix for the v0 (pre-redesign) sprites kept in src/gallery/v0/. */
export const V0_PREFIX = 'v0-';
/** Native sizes of the v0 sprites (they predate the toy-scale sizes in spriteKeys). */
export const V0_SIZES: Record<string, { w: number; h: number }> = {
  a10: { w: 84, h: 90 },
  tankHull: { w: 34, h: 20 },
  tankTurret: { w: 30, h: 12 },
  truck: { w: 26, h: 12 },
  infantry: { w: 18, h: 18 },
  aaHull: { w: 30, h: 20 },
  aaTurret: { w: 18, h: 16 },
  friendlyTankHull: { w: 34, h: 20 },
  friendlyTankTurret: { w: 30, h: 12 },
  friendlyInfantry: { w: 18, h: 18 },
};
/** v0 tank turret pivot in sprite units. */
export const V0_TURRET_PIVOT: Vec2 = { x: 10, y: 6 };

export type UnitKind = 'tank' | 'aa' | 'truck' | 'mech' | 'friendlyTank' | 'friendlyMech';

export interface StagedUnit {
  kind: UnitKind;
  x: number;
  y: number;
  /** Hull heading, degrees (0 = east). */
  heading: number;
  /** Turret heading, degrees (defaults to the hull heading). */
  aim?: number;
}

/** Where both zoom panels look: the bridge where the dirt road crosses the river. */
export const BOARD_CENTRE: Vec2 = { x: 3010, y: 2610 };

/** Enemy column + mech squad on the north bank; friendlies holding the south bank. */
export const STAGED_UNITS: StagedUnit[] = [
  // Enemy armour column rolling down the river road to the bridge.
  { kind: 'tank', x: 3000, y: 2500, heading: 90, aim: 115 },
  { kind: 'tank', x: 2978, y: 2405, heading: 100, aim: 80 },
  { kind: 'aa', x: 2918, y: 2330, heading: 128, aim: 160 },
  { kind: 'truck', x: 2862, y: 2272, heading: 136 },
  // Enemy tank flanking in the open.
  { kind: 'tank', x: 3215, y: 2455, heading: 150, aim: 120 },
  // Enemy mech squad crossing the field toward the bridge.
  { kind: 'mech', x: 2800, y: 2470, heading: 40 },
  { kind: 'mech', x: 2742, y: 2420, heading: 30 },
  { kind: 'mech', x: 2752, y: 2508, heading: 20 },
  // Friendlies dug in on the south bank.
  { kind: 'friendlyTank', x: 3100, y: 2815, heading: -110, aim: -95 },
  { kind: 'friendlyTank', x: 2880, y: 2845, heading: -70, aim: -80 },
  { kind: 'friendlyMech', x: 3185, y: 2860, heading: -120 },
  { kind: 'friendlyMech', x: 3000, y: 2915, heading: -90 },
  { kind: 'friendlyMech', x: 2790, y: 2900, heading: -60 },
];

export interface StagedPlane {
  key: SpriteKey | typeof VARIANT_B_KEY;
  label: string;
  x: number;
  y: number;
  heading: number;
}

/** Both player variants flying over the river (A west of the bridge, B east of it). */
export const STAGED_PLANES: StagedPlane[] = [
  { key: 'a10', label: 'A · toy A-10', x: 2660, y: 2600, heading: -12 },
  { key: VARIANT_B_KEY, label: 'B · future Warthog', x: 3370, y: 2650, heading: -168 },
];

interface UnitSprites {
  hull: SpriteKey;
  top: SpriteKey | null;
  topOrigin: { x: number; y: number };
}

const UNIT_SPRITES: Record<UnitKind, UnitSprites> = {
  tank: fromVisual('tank'),
  aa: fromVisual('aaGun'),
  truck: fromVisual('truck'),
  mech: fromVisual('infantry'),
  friendlyTank: fromVisual('friendlyTank'),
  friendlyMech: fromVisual('friendlyInfantry'),
};

function fromVisual(kind: keyof typeof ENTITY_VISUALS): UnitSprites {
  const v = ENTITY_VISUALS[kind];
  return { hull: v.base, top: v.top, topOrigin: v.topOrigin };
}

const INV_RES = 1 / SPRITE_RESOLUTION;
/** The game's soft ground halo under vehicles (see render/entities EntityRenderer). */
const HALO_SIZE = 1.9;
const HALO_ALPHA = 0.5;

/**
 * Add a unit the way the game draws it: optional soft ground halo, hull, and turret on its pivot.
 * `unitScale` mirrors `unitDisplayScale(zoom)`; `extraScale` is a presentation zoom for cards.
 */
export function addUnit(
  scene: Phaser.Scene,
  u: StagedUnit,
  opts: { unitScale?: number; extraScale?: number; halo?: boolean; v0?: boolean } = {},
): { halo: Phaser.GameObjects.Image | null; images: Phaser.GameObjects.Image[] } {
  const { unitScale = 1, extraScale = 1, halo = true, v0 = false } = opts;
  const spr = UNIT_SPRITES[u.kind];
  const s = INV_RES * unitScale * extraScale;
  const out: Phaser.GameObjects.Image[] = [];
  const hullKey = v0 ? `${V0_PREFIX}${spr.hull}` : spr.hull;
  let haloImage: Phaser.GameObjects.Image | null = null;
  if (halo) {
    const w = v0 ? (V0_SIZES[spr.hull]?.w ?? 32) : SPRITES[spr.hull].w;
    const diameter = w * HALO_SIZE * unitScale * extraScale;
    haloImage = scene.add
      .image(u.x, u.y, 'particleSoft')
      .setTintFill(0x000000)
      .setAlpha(HALO_ALPHA)
      .setScale((diameter / SPRITES.particleSoft.w) * INV_RES)
      .setDepth(DEPTH.groundShadows);
  }
  out.push(scene.add.image(u.x, u.y, hullKey).setScale(s).setRotation(degToRad(u.heading)).setDepth(DEPTH.ground));
  if (spr.top) {
    const topKey = v0 ? `${V0_PREFIX}${spr.top}` : spr.top;
    let origin = spr.topOrigin;
    if (v0 && spr.top.endsWith('ankTurret')) origin = { x: V0_TURRET_PIVOT.x / 30, y: V0_TURRET_PIVOT.y / 12 };
    out.push(
      scene.add
        .image(u.x, u.y, topKey)
        .setOrigin(origin.x, origin.y)
        .setScale(s)
        .setRotation(degToRad(u.aim ?? u.heading))
        .setDepth(DEPTH.ground + 0.5),
    );
  }
  return { halo: haloImage, images: out };
}
