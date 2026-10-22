import { Rng } from '../../sim/math';
import { createCanvas, context2d } from './canvasUtil';
import type { TerrainPalette } from './terrainPalette';

/** Nominal canopy radius (world units) the sprites are drawn for; scaled per tree. */
export const TREE_BASE_RADIUS = 16;
/** Sprite side length in world units (canopy + lumps overhang). */
export const TREE_SPRITE_SIZE = TREE_BASE_RADIUS * 2.7;

/** A conifer seen from above: a whorl of branch tips, as polar (angle, radius) pairs. */
type Whorl = Array<[number, number]>;

/**
 * Pre-rendered tree canopies (3 colour families × 4 lump shapes) and matching shadow silhouettes,
 * lit from the upper-left. Drawn with `drawImage`, which is far cheaper than per-tree gradients.
 * Palettes with `frost` get snow-dusted conifers instead of broadleaf canopies.
 */
export class TreeSprites {
  readonly canopies: HTMLCanvasElement[] = [];
  readonly shadows: HTMLCanvasElement[] = [];

  /** @param pxPerUnit sprite resolution; match it to the bake scale so drawImage barely resamples. */
  constructor(
    seed: number,
    private readonly pxPerUnit: number,
    private readonly palette: TerrainPalette,
  ) {
    const rng = new Rng(seed ^ 0x3ee5);
    const families = palette.canopies;
    const snow = palette.frost?.canopySnow ?? null;
    for (let f = 0; f < families.length; f++) {
      const family = families[f];
      if (!family) continue;
      for (let s = 0; s < 4; s++) {
        if (snow) {
          const whorl = this.makeWhorl(rng, s);
          this.canopies.push(this.drawConifer(whorl, family, snow, rng));
          this.shadows.push(this.drawWhorlShadow(whorl));
          continue;
        }
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
    ctx.fillStyle = this.palette.treeShadowSprite;
    for (const [x, y, r] of lumps) {
      ctx.beginPath();
      ctx.arc(x, y, r + 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    return canvas;
  }

  // -------------------------------------------------------------------------
  // Conifers (winter)
  // -------------------------------------------------------------------------

  private makeWhorl(rng: Rng, shape: number): Whorl {
    const R = TREE_BASE_RADIUS;
    const n = 9 + shape + rng.int(0, 2);
    const phase = rng.range(0, Math.PI * 2);
    const whorl: Whorl = [];
    for (let i = 0; i < n; i++) {
      whorl.push([phase + ((i + rng.range(-0.22, 0.22)) / n) * Math.PI * 2, R * rng.range(0.86, 1.12)]);
    }
    return whorl;
  }

  /** Star-shaped tier of branches: tips at `scale` × the whorl radii, notches at `notch` × that. */
  private traceTier(ctx: CanvasRenderingContext2D, whorl: Whorl, scale: number, notch: number, ox: number, oy: number, twist: number): void {
    ctx.beginPath();
    const n = whorl.length;
    for (let i = 0; i < n; i++) {
      const [a, r] = whorl[i] ?? [0, 0];
      const [b] = whorl[(i + 1) % n] ?? [0, 0];
      const mid = a + (Math.atan2(Math.sin(b - a), Math.cos(b - a)) / 2);
      const tipA = a + twist;
      const tx = ox + Math.cos(tipA) * r * scale;
      const ty = oy + Math.sin(tipA) * r * scale;
      const nr = r * scale * notch;
      const nx = ox + Math.cos(mid + twist) * nr;
      const ny = oy + Math.sin(mid + twist) * nr;
      if (i === 0) ctx.moveTo(tx, ty);
      else ctx.lineTo(tx, ty);
      ctx.quadraticCurveTo(ox + Math.cos(mid + twist) * nr * 1.18, oy + Math.sin(mid + twist) * nr * 1.18, nx, ny);
    }
    ctx.closePath();
  }

  /**
   * Top-down spruce: three stacked star tiers (dark skirt, mid, lit crown) leaning toward the
   * light, needle specks, and snow caught on the sun-facing branch tips.
   */
  private drawConifer(whorl: Whorl, family: readonly string[], snow: string, rng: Rng): HTMLCanvasElement {
    const size = Math.ceil(TREE_SPRITE_SIZE * this.pxPerUnit);
    const canvas = createCanvas(size, size);
    const ctx = context2d(canvas);
    ctx.setTransform(this.pxPerUnit, 0, 0, this.pxPerUnit, size / 2, size / 2);
    const [dark = '#222', mid = '#333', light = '#555'] = family;
    const R = TREE_BASE_RADIUS;
    // Light comes from the upper-left; upper tiers lean toward it (the tree is a cone).
    const lx = -0.6;
    const ly = -0.8;
    // Gradient stops per tier: [lit side, middle, rim].
    const tiers: Array<{ scale: number; notch: number; lean: number; twist: number; stops: [string, string, string] }> = [
      { scale: 1, notch: 0.52, lean: 0, twist: 0, stops: [mid, dark, dark] },
      { scale: 0.74, notch: 0.5, lean: 0.07, twist: 0.3, stops: [mid, mid, dark] },
      { scale: 0.46, notch: 0.48, lean: 0.13, twist: -0.2, stops: [light, mid, dark] },
    ];
    // Silhouette rim.
    ctx.fillStyle = dark;
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    this.traceTier(ctx, whorl, 1, 0.52, 0.4, 0.5, 0);
    ctx.fill();
    ctx.stroke();
    for (const tier of tiers) {
      const ox = lx * R * tier.lean;
      const oy = ly * R * tier.lean;
      const g = ctx.createRadialGradient(ox + lx * R * tier.scale * 0.4, oy + ly * R * tier.scale * 0.4, R * 0.05, ox, oy, R * tier.scale * 1.05);
      g.addColorStop(0, tier.stops[0]);
      g.addColorStop(0.55, tier.stops[1]);
      g.addColorStop(1, tier.stops[2]);
      ctx.fillStyle = g;
      this.traceTier(ctx, whorl, tier.scale, tier.notch, ox, oy, tier.twist);
      ctx.fill();
    }
    // Needle texture.
    for (let i = 0; i < 22; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(R * 0.2, R * 0.85);
      const lit = Math.cos(a - Math.atan2(ly, lx)) > 0.2;
      ctx.fillStyle = lit ? light : dark;
      ctx.globalAlpha = lit ? 0.45 : 0.5;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * d, Math.sin(a) * d, rng.range(0.7, 1.3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Snow on the sun-facing tips of each tier, plus a cap on the crown.
    ctx.fillStyle = snow;
    const lightAngle = Math.atan2(ly, lx);
    for (const tier of tiers) {
      const ox = lx * R * tier.lean;
      const oy = ly * R * tier.lean;
      for (const [a0, r] of whorl) {
        const a = a0 + tier.twist;
        const facing = Math.cos(a - lightAngle);
        if (facing < -0.35 || rng.chance(0.25)) continue;
        const d = r * tier.scale * rng.range(0.55, 0.8);
        const sr = (1.1 + facing * 0.7) * rng.range(0.8, 1.25) * (0.6 + tier.scale * 0.5);
        ctx.globalAlpha = 0.55 + 0.35 * Math.max(0, facing);
        ctx.beginPath();
        ctx.ellipse(ox + Math.cos(a) * d, oy + Math.sin(a) * d, sr * 1.5, sr, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(lx * R * 0.17, ly * R * 0.17, R * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    return canvas;
  }

  private drawWhorlShadow(whorl: Whorl): HTMLCanvasElement {
    const size = Math.ceil(TREE_SPRITE_SIZE * this.pxPerUnit);
    const canvas = createCanvas(size, size);
    const ctx = context2d(canvas);
    ctx.setTransform(this.pxPerUnit, 0, 0, this.pxPerUnit, size / 2, size / 2);
    ctx.fillStyle = this.palette.treeShadowSprite;
    this.traceTier(ctx, whorl, 1.04, 0.55, 0, 0, 0);
    ctx.fill();
    return canvas;
  }
}
