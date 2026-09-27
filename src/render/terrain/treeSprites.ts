import { Rng } from '../../sim/math';
import { createCanvas, context2d } from './canvasUtil';
import { TERRAIN_COLORS } from './terrainPalette';

/** Nominal canopy radius (world units) the sprites are drawn for; scaled per tree. */
export const TREE_BASE_RADIUS = 16;
/** Sprite side length in world units (canopy + lumps overhang). */
export const TREE_SPRITE_SIZE = TREE_BASE_RADIUS * 2.7;
/** Canopy shapes per colour family: 0–1 single round "lollipops", 2 two-lobed, 3 three-lobed. */
export const TREE_SHAPES = 4;
/** Outline width in world units (matches the chunky sprite outlines at close zoom). */
const OUTLINE = 1.9;

type Lump = [number, number, number];

/**
 * Pre-rendered toy "lollipop" tree canopies (3 colour families × 4 shapes) and matching soft
 * shadow blobs. Each canopy is flat-filled with a thick dark outline, one cel-shade crescent on
 * the lower-right and a glossy highlight on the upper-left (light from the upper-left, like every
 * sprite). Drawn with `drawImage`, which is far cheaper than per-tree paths.
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
      for (let s = 0; s < TREE_SHAPES; s++) {
        const lumps = this.makeLumps(rng, s);
        this.canopies.push(this.drawCanopy(lumps, family));
        this.shadows.push(this.drawShadow(lumps));
      }
    }
  }

  private makeLumps(rng: Rng, shape: number): Lump[] {
    const R = TREE_BASE_RADIUS;
    if (shape <= 1) return [[0, 0, R * rng.range(0.94, 1.02)]];
    if (shape === 2) {
      const a = rng.range(0, Math.PI * 2);
      return [
        [Math.cos(a) * R * 0.42, Math.sin(a) * R * 0.42, R * 0.7],
        [-Math.cos(a) * R * 0.34, -Math.sin(a) * R * 0.34, R * 0.8],
      ];
    }
    const out: Lump[] = [];
    const a0 = rng.range(0, Math.PI * 2);
    for (let i = 0; i < 3; i++) {
      const a = a0 + (i / 3) * Math.PI * 2;
      out.push([Math.cos(a) * R * 0.44, Math.sin(a) * R * 0.44, R * rng.range(0.6, 0.7)]);
    }
    return out;
  }

  private drawCanopy(lumps: Lump[], family: readonly string[]): HTMLCanvasElement {
    const size = Math.ceil(TREE_SPRITE_SIZE * this.pxPerUnit);
    const canvas = createCanvas(size, size);
    const ctx = context2d(canvas);
    ctx.setTransform(this.pxPerUnit, 0, 0, this.pxPerUnit, size / 2, size / 2);
    const [outline = '#133', shade = '#274', base = '#394', hi = '#7c5'] = family;
    // Back to front: lower-right lumps last so they overlap (and outline) the ones behind.
    const sorted = [...lumps].sort((a, b) => a[0] + a[1] - (b[0] + b[1]));

    for (const [x, y, r] of sorted) {
      // Outline disc, then the lump: shade fill with the base colour shifted up-left inside it.
      ctx.fillStyle = outline;
      ctx.beginPath();
      ctx.arc(x, y, r + OUTLINE, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = shade;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.fillStyle = base;
      ctx.beginPath();
      ctx.arc(x - r * 0.2, y - r * 0.22, r * 0.98, 0, Math.PI * 2);
      ctx.fill();
      // Glossy highlight on the upper-left.
      ctx.fillStyle = hi;
      ctx.beginPath();
      ctx.ellipse(x - r * 0.36, y - r * 0.4, r * 0.34, r * 0.24, -0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    return canvas;
  }

  private drawShadow(lumps: Lump[]): HTMLCanvasElement {
    const size = Math.ceil(TREE_SPRITE_SIZE * this.pxPerUnit);
    const canvas = createCanvas(size, size);
    const ctx = context2d(canvas);
    ctx.setTransform(this.pxPerUnit, 0, 0, this.pxPerUnit, size / 2, size / 2);
    // Soft blob: a radial falloff per lump, composited with 'lighten' so overlaps don't darken.
    ctx.globalCompositeOperation = 'lighten';
    for (const [x, y, r] of lumps) {
      const g = ctx.createRadialGradient(x, y, r * 0.55, x, y, r * 1.18);
      g.addColorStop(0, 'rgba(255, 255, 255, 1)');
      g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Recolour the white mask to the shadow tint, keeping its alpha.
    ctx.globalCompositeOperation = 'source-in';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgb(14, 58, 22)';
    ctx.fillRect(0, 0, size, size);
    return canvas;
  }
}
