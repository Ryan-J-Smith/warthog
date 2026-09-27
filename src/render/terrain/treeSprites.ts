import { Rng } from '../../sim/math';
import { createCanvas, context2d } from './canvasUtil';
import { TERRAIN_COLORS } from './terrainPalette';

/** Nominal canopy radius (world units) the sprites are drawn for; scaled per tree. */
export const TREE_BASE_RADIUS = 16;
/** Sprite side length in world units (canopy + lumps overhang). */
export const TREE_SPRITE_SIZE = TREE_BASE_RADIUS * 2.7;

/**
 * Pre-rendered tree canopies (3 colour families × 4 lump shapes) and matching shadow silhouettes,
 * lit from the upper-left. Drawn with `drawImage`, which is far cheaper than per-tree gradients.
 */
export class TreeSprites {
  readonly canopies: HTMLCanvasElement[] = [];
  readonly shadows: HTMLCanvasElement[] = [];

  /** @param pxPerUnit sprite resolution; match it to the bake scale so drawImage barely resamples. */
  constructor(
    seed: number,
    private readonly pxPerUnit: number,
  ) {
    const rng = new Rng(seed ^ 0x3ee5);
    const families = TERRAIN_COLORS.canopies;
    for (let f = 0; f < families.length; f++) {
      const family = families[f];
      if (!family) continue;
      for (let s = 0; s < 4; s++) {
        const lumps = this.makeLumps(rng, s);
        this.canopies.push(this.drawCanopy(lumps, family, rng));
        this.shadows.push(this.drawShadow(lumps));
      }
    }
  }

  private makeLumps(rng: Rng, shape: number): Array<[number, number, number]> {
    const R = TREE_BASE_RADIUS;
    const lumps: Array<[number, number, number]> = [[0, 0, R * 0.62]];
    const n = 5 + shape + rng.int(0, 2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const d = R * rng.range(0.34, 0.55);
      lumps.push([Math.cos(a) * d, Math.sin(a) * d, R * rng.range(0.34, 0.5)]);
    }
    return lumps;
  }

  private drawCanopy(lumps: Array<[number, number, number]>, family: readonly string[], rng: Rng): HTMLCanvasElement {
    const size = Math.ceil(TREE_SPRITE_SIZE * this.pxPerUnit);
    const canvas = createCanvas(size, size);
    const ctx = context2d(canvas);
    ctx.setTransform(this.pxPerUnit, 0, 0, this.pxPerUnit, size / 2, size / 2);
    const [dark = '#333', mid = '#555', light = '#777'] = family;

    // Dark rim for silhouette definition.
    ctx.fillStyle = dark;
    for (const [x, y, r] of lumps) {
      ctx.beginPath();
      ctx.arc(x + 0.5, y + 0.7, r + 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    // Lit lumps, back to front (lower-right first so upper-left lumps sit on top).
    const sorted = [...lumps].sort((a, b) => b[0] + b[1] - (a[0] + a[1]));
    for (const [x, y, r] of sorted) {
      const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05);
      g.addColorStop(0, light);
      g.addColorStop(0.45, mid);
      g.addColorStop(1, dark);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Leaf texture: bright specks on the lit side, dark specks on the shaded side.
    for (let i = 0; i < 26; i++) {
      const lump = lumps[rng.int(0, lumps.length - 1)];
      if (!lump) continue;
      const [lx, ly, lr] = lump;
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(0, lr * 0.8);
      const px = lx + Math.cos(a) * d;
      const py = ly + Math.sin(a) * d;
      const lit = Math.cos(a - Math.PI * 1.3) > 0;
      ctx.fillStyle = lit ? light : dark;
      ctx.globalAlpha = lit ? 0.55 : 0.4;
      ctx.beginPath();
      ctx.arc(px, py, rng.range(0.9, 1.8), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    return canvas;
  }

  private drawShadow(lumps: Array<[number, number, number]>): HTMLCanvasElement {
    const size = Math.ceil(TREE_SPRITE_SIZE * this.pxPerUnit);
    const canvas = createCanvas(size, size);
    const ctx = context2d(canvas);
    ctx.setTransform(this.pxPerUnit, 0, 0, this.pxPerUnit, size / 2, size / 2);
    ctx.fillStyle = 'rgb(38, 32, 14)';
    for (const [x, y, r] of lumps) {
      ctx.beginPath();
      ctx.arc(x, y, r + 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    return canvas;
  }
}
