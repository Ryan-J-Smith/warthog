import { SPRITES } from '../../assets';
import type { SpriteKey } from '../../assets';
import { Rng, degToRad } from '../../sim/math';
import type { Vec2 } from '../../sim/math';
import type { LevelDefinition } from '../../sim/level';
import type { EntityKind } from '../../sim/types';
import { createCanvas, context2d, SpatialGrid } from './canvasUtil';
import { sampleSpline } from './curves';
import type { DenseCurve } from './curves';
import { ValueNoise, smoothstep } from './noise';
import { mixRgb, terrainPalette } from './terrainPalette';
import type { TerrainBiome, TerrainPalette } from './terrainPalette';

/** Bit flags stored per mask cell. */
export const MASK = {
  water: 1,
  road: 2,
  field: 4,
  village: 8,
  structure: 16,
  forest: 32,
} as const;

export interface RiverModel {
  curve: DenseCurve;
  width: number;
  /** Half-width to the left (negative-normal side) / right of the centreline, per sample. */
  halfL: Float32Array;
  halfR: Float32Array;
}

export interface RoadModel {
  curve: DenseCurve;
  width: number;
  surface: 'dirt' | 'paved';
}

export interface BuildingModel {
  x: number;
  y: number;
  /** Size along / across `angle`. */
  w: number;
  h: number;
  angle: number;
  roof: string;
  /** Shadow length in world units (building height). */
  height: number;
  garden: boolean;
  /** Which side of the building (along its local +y / -y) the garden sits on: away from the street. */
  gardenSide: number;
}

export interface FootprintModel {
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
  kind: EntityKind;
}

export interface CraterModel {
  x: number;
  y: number;
  r: number;
}

/** Trees as parallel arrays (thousands of them). */
export interface TreeSet {
  count: number;
  x: Float32Array;
  y: Float32Array;
  r: Float32Array;
  variant: Uint8Array;
  grid: SpatialGrid;
}

const FOOTPRINT_SPRITES: Partial<Record<EntityKind, { key: SpriteKey; margin: number }>> = {
  homeBase: { key: 'homeBase', margin: 30 },
  outpost: { key: 'outpost', margin: 24 },
  samSite: { key: 'samBase', margin: 12 },
  ammoDump: { key: 'ammoDump', margin: 12 },
  bridge: { key: 'bridge', margin: 6 },
  aaGun: { key: 'aaHull', margin: 10 },
  cache: { key: 'cache', margin: 6 },
  enemyHq: { key: 'enemyHq', margin: 24 },
  friendlyHq: { key: 'friendlyHq', margin: 24 },
};

/** Canopy sprite variants available to the painter (families × shapes). */
export const TREE_VARIANTS = 12;

/**
 * Everything derived once from a `LevelDefinition` for painting: smoothed curves, a height field
 * with hill shading, a macro colour field, a feature mask, and deterministic decor placement.
 * Pure data + offscreen canvases; no Phaser.
 */
export class TerrainModel {
  readonly width: number;
  readonly height: number;
  readonly seed: number;
  readonly noise: ValueNoise;
  readonly biome: TerrainBiome;
  /** Colours for `biome`, shared with the painter. */
  readonly palette: TerrainPalette;
  readonly rivers: RiverModel[];
  readonly roads: RoadModel[];
  readonly footprints: FootprintModel[];

  /** Macro colour field, one pixel per `macroCell` world units. */
  readonly macroCell = 32;
  readonly macro: HTMLCanvasElement;

  /** Hill-shade overlay (light + shadow), one pixel per `shadeCell` world units. */
  readonly shadeCell = 16;
  readonly shade: HTMLCanvasElement;
  private readonly heights: Float32Array;
  private readonly heightCols: number;
  private readonly heightRows: number;

  /** Feature mask, one cell per `maskCell` world units. */
  readonly maskCell = 8;
  private readonly mask: Uint8Array;
  private readonly maskCols: number;
  private readonly maskRows: number;

  readonly trees: TreeSet;
  readonly buildings: BuildingModel[] = [];
  readonly villageTracks: DenseCurve[] = [];
  readonly craters: CraterModel[] = [];
  readonly trackMarks: DenseCurve[] = [];
  /** Contour strata around hills: smoothed iso-height polylines as flat [x0, y0, x1, y1, ...]. */
  readonly contours: Float32Array[] = [];
  /** Bounding box [minX, minY, maxX, maxY] per contour polyline. */
  readonly contourBounds: Array<[number, number, number, number]> = [];
  /** Dry washes (erosion gullies) flowing downhill from the hills. */
  readonly washes: Array<{ curve: DenseCurve; width: number }> = [];

  constructor(readonly level: LevelDefinition) {
    this.width = level.width;
    this.height = level.height;
    this.seed = level.seed;
    this.noise = new ValueNoise(level.seed);
    this.biome = level.terrain.biome;
    this.palette = terrainPalette(this.biome);

    const terrain = level.terrain;
    this.rivers = terrain.rivers.map((r, i) => this.buildRiver(r.points, r.width, i));
    this.roads = terrain.roads.map((r) => ({ curve: sampleSpline(r.points, 12), width: r.width, surface: r.surface }));
    this.footprints = this.buildFootprints();

    this.heightCols = Math.ceil(this.width / this.shadeCell) + 1;
    this.heightRows = Math.ceil(this.height / this.shadeCell) + 1;
    this.heights = this.buildHeights();
    this.shade = this.buildShade();
    this.buildContours([0.3, 0.44, 0.58, 0.72, 0.86]);

    this.maskCols = Math.ceil(this.width / this.maskCell);
    this.maskRows = Math.ceil(this.height / this.maskCell);
    this.mask = this.buildMask();

    this.macro = this.buildMacro();
    this.buildWashes();
    this.buildVillages();
    this.trees = this.buildTrees();
    this.buildBattleScars();
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  /** Mask flags at a world position (0 outside the map). */
  maskAt(x: number, y: number): number {
    const cx = Math.floor(x / this.maskCell);
    const cy = Math.floor(y / this.maskCell);
    if (cx < 0 || cy < 0 || cx >= this.maskCols || cy >= this.maskRows) return 0;
    return this.mask[cy * this.maskCols + cx] ?? 0;
  }

  /** Terrain height (0..~1) at a world position, bilinearly interpolated. */
  heightAt(x: number, y: number): number {
    const gx = Math.min(this.heightCols - 1.001, Math.max(0, x / this.shadeCell));
    const gy = Math.min(this.heightRows - 1.001, Math.max(0, y / this.shadeCell));
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const fx = gx - x0;
    const fy = gy - y0;
    const i = y0 * this.heightCols + x0;
    const a = this.heights[i] ?? 0;
    const b = this.heights[i + 1] ?? 0;
    const c = this.heights[i + this.heightCols] ?? 0;
    const d = this.heights[i + this.heightCols + 1] ?? 0;
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
  }

  /** Terrain slope magnitude (rise over run, with the shading exaggeration) at a world position. */
  slopeAt(x: number, y: number): number {
    const e = 10;
    const gx = (this.heightAt(x + e, y) - this.heightAt(x - e, y)) / (2 * e);
    const gy = (this.heightAt(x, y + e) - this.heightAt(x, y - e)) / (2 * e);
    return Math.hypot(gx, gy) * 420;
  }

  // -------------------------------------------------------------------------
  // Construction
  // -------------------------------------------------------------------------

  private buildRiver(points: Vec2[], width: number, index: number): RiverModel {
    const curve = sampleSpline(points, 10);
    const n = curve.xs.length;
    const halfL = new Float32Array(n);
    const halfR = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const s = curve.s[i] ?? 0;
      const breathe = 1 + 0.16 * (this.noise.fbm(s / 700, 3.7 + index * 13, 2) - 0.5) * 2;
      halfL[i] = (width / 2) * breathe + 7 * (this.noise.fbm(s / 140, 9.1 + index * 7, 3) - 0.5) * 2;
      halfR[i] = (width / 2) * breathe + 7 * (this.noise.fbm(s / 140, 21.3 + index * 7, 3) - 0.5) * 2;
    }
    return { curve, width, halfL, halfR };
  }

  private buildFootprints(): FootprintModel[] {
    const out: FootprintModel[] = [];
    for (const e of this.level.entities) {
      const spec = FOOTPRINT_SPRITES[e.kind];
      if (!spec) continue;
      const size = SPRITES[spec.key];
      out.push({
        x: e.pos.x,
        y: e.pos.y,
        w: size.w + spec.margin * 2,
        h: size.h + spec.margin * 2,
        angle: degToRad(e.headingDeg ?? 0),
        kind: e.kind,
      });
    }
    return out;
  }

  private buildHeights(): Float32Array {
    const cols = this.heightCols;
    const rows = this.heightRows;
    const out = new Float32Array(cols * rows);
    const hills = this.level.terrain.hills;
    const noise = this.noise;
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const x = gx * this.shadeCell;
        const y = gy * this.shadeCell;
        let h = 0.08 * noise.fbm(x / 1400, y / 1400, 3) + 0.02 * noise.fbm(x / 300 + 40, y / 300, 2);
        let near = false;
        for (const hill of hills) {
          const dx = x - hill.center.x;
          const dy = y - hill.center.y;
          const reach = hill.radius * 1.9;
          if (dx * dx + dy * dy < reach * reach) {
            near = true;
            break;
          }
        }
        if (near) {
          const wx = x + 130 * (noise.fbm(x / 560 + 17, y / 560, 2) - 0.5) * 2;
          const wy = y + 130 * (noise.fbm(x / 560, y / 560 + 29, 2) - 0.5) * 2;
          const ridge = noise.fbm(x / 240 + 3, y / 240 + 7, 3);
          for (const hill of hills) {
            const d = Math.hypot(wx - hill.center.x, wy - hill.center.y) / (hill.radius * 1.1);
            if (d > 2.2) continue;
            h += hill.height * Math.exp(-2.1 * d * d) * (0.8 + 0.4 * ridge);
          }
        }
        out[gy * cols + gx] = h;
      }
    }
    return out;
  }

  /** Marching squares over the height grid, chained into polylines and Chaikin-smoothed. */
  private buildContours(levels: number[]): void {
    const cols = this.heightCols;
    const rows = this.heightRows;
    const cell = this.shadeCell;
    const H = this.heights;
    for (const L of levels) {
      const segs: number[] = [];
      for (let gy = 0; gy < rows - 1; gy++) {
        for (let gx = 0; gx < cols - 1; gx++) {
          const a = H[gy * cols + gx] ?? 0;
          const b = H[gy * cols + gx + 1] ?? 0;
          const c = H[(gy + 1) * cols + gx + 1] ?? 0;
          const d = H[(gy + 1) * cols + gx] ?? 0;
          const idx = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
          if (idx === 0 || idx === 15) continue;
          const x0 = gx * cell;
          const y0 = gy * cell;
          const top = (): [number, number] => [x0 + ((L - a) / (b - a)) * cell, y0];
          const right = (): [number, number] => [x0 + cell, y0 + ((L - b) / (c - b)) * cell];
          const bottom = (): [number, number] => [x0 + ((L - d) / (c - d)) * cell, y0 + cell];
          const left = (): [number, number] => [x0, y0 + ((L - a) / (d - a)) * cell];
          const seg = (p: [number, number], q: [number, number]): void => {
            segs.push(p[0], p[1], q[0], q[1]);
          };
          switch (idx) {
            case 1: case 14: seg(left(), bottom()); break;
            case 2: case 13: seg(bottom(), right()); break;
            case 3: case 12: seg(left(), right()); break;
            case 4: case 11: seg(top(), right()); break;
            case 6: case 9: seg(top(), bottom()); break;
            case 7: case 8: seg(left(), top()); break;
            case 5: seg(left(), top()); seg(bottom(), right()); break;
            case 10: seg(top(), right()); seg(left(), bottom()); break;
            default: break;
          }
        }
      }
      for (const line of chainSegments(segs)) {
        if (line.length < 12) continue;
        const smooth = chaikin(chaikin(line));
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (let i = 0; i < smooth.length; i += 2) {
          const x = smooth[i] ?? 0;
          const y = smooth[i + 1] ?? 0;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
        this.contours.push(smooth);
        this.contourBounds.push([minX, minY, maxX, maxY]);
      }
    }
  }

  private buildShade(): HTMLCanvasElement {
    const cols = this.heightCols;
    const rows = this.heightRows;
    const canvas = createCanvas(cols, rows);
    const ctx = context2d(canvas);
    const img = ctx.createImageData(cols, rows);
    const data = img.data;
    const exaggeration = 420; // world units of elevation per height unit
    const el = degToRad(48);
    const lx = -0.6 * Math.cos(el);
    const ly = -0.8 * Math.cos(el);
    const lz = Math.sin(el);
    const cell2 = this.shadeCell * 2;
    const { shadeLight, shadeLightMax, shadeDark, shadeDarkMax } = this.palette;
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const i = gy * cols + gx;
        const hl = this.heights[gy * cols + Math.max(0, gx - 1)] ?? 0;
        const hr = this.heights[gy * cols + Math.min(cols - 1, gx + 1)] ?? 0;
        const hu = this.heights[Math.max(0, gy - 1) * cols + gx] ?? 0;
        const hd = this.heights[Math.min(rows - 1, gy + 1) * cols + gx] ?? 0;
        const sx = ((hr - hl) / cell2) * exaggeration;
        const sy = ((hd - hu) / cell2) * exaggeration;
        const inv = 1 / Math.hypot(sx, sy, 1);
        const dot = (-sx * lx - sy * ly + lz) * inv;
        const diff = dot - lz;
        const o = i * 4;
        if (diff >= 0) {
          data[o] = shadeLight[0];
          data[o + 1] = shadeLight[1];
          data[o + 2] = shadeLight[2];
          data[o + 3] = Math.min(shadeLightMax, diff * 255 * 2.8);
        } else {
          data[o] = shadeDark[0];
          data[o + 1] = shadeDark[1];
          data[o + 2] = shadeDark[2];
          data[o + 3] = Math.min(shadeDarkMax, -diff * 255 * 1.2);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  private buildMask(): Uint8Array {
    const cols = this.maskCols;
    const rows = this.maskRows;
    const cell = this.maskCell;
    const out = new Uint8Array(cols * rows);
    const canvas = createCanvas(cols, rows);
    const ctx = context2d(canvas, true);

    const paint = (draw: () => void, flagsByChannel: [number, number, number]): void => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cols, rows);
      ctx.setTransform(1 / cell, 0, 0, 1 / cell, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      draw();
      const data = ctx.getImageData(0, 0, cols, rows).data;
      for (let i = 0; i < cols * rows; i++) {
        let f = out[i] ?? 0;
        if ((data[i * 4] ?? 0) > 110) f |= flagsByChannel[0];
        if ((data[i * 4 + 1] ?? 0) > 110) f |= flagsByChannel[1];
        if ((data[i * 4 + 2] ?? 0) > 110) f |= flagsByChannel[2];
        out[i] = f;
      }
    };

    const terrain = this.level.terrain;
    paint(() => {
      ctx.fillStyle = 'rgb(255,0,0)';
      for (const r of this.rivers) this.fillRiverBand(ctx, r, 26);
      ctx.strokeStyle = 'rgb(0,255,0)';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const road of this.roads) {
        ctx.lineWidth = road.width + 14;
        ctx.beginPath();
        const c = road.curve;
        for (let i = 0; i < c.xs.length; i++) {
          if (i === 0) ctx.moveTo(c.xs[i] ?? 0, c.ys[i] ?? 0);
          else ctx.lineTo(c.xs[i] ?? 0, c.ys[i] ?? 0);
        }
        ctx.stroke();
      }
      ctx.fillStyle = 'rgb(0,0,255)';
      for (const f of terrain.fields) {
        ctx.save();
        ctx.translate(f.center.x, f.center.y);
        ctx.rotate(degToRad(f.rotationDeg));
        ctx.fillRect(-f.width / 2 - 6, -f.height / 2 - 6, f.width + 12, f.height + 12);
        ctx.restore();
      }
    }, [MASK.water, MASK.road, MASK.field]);

    paint(() => {
      ctx.fillStyle = 'rgb(255,0,0)';
      for (const v of terrain.villages) {
        ctx.beginPath();
        ctx.arc(v.center.x, v.center.y, v.radius * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgb(0,255,0)';
      for (const fp of this.footprints) {
        ctx.save();
        ctx.translate(fp.x, fp.y);
        ctx.rotate(fp.angle);
        ctx.fillRect(-fp.w / 2, -fp.h / 2, fp.w, fp.h);
        ctx.restore();
      }
      ctx.fillStyle = 'rgb(0,0,255)';
      for (const f of terrain.forests) {
        ctx.beginPath();
        ctx.arc(f.center.x, f.center.y, f.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }, [MASK.village, MASK.structure, MASK.forest]);
    return out;
  }

  /** Fill a river band grown by `extra` world units on both banks (current fillStyle). */
  fillRiverBand(ctx: CanvasRenderingContext2D, r: RiverModel, extra: number, scaleL = 1, scaleR = 1): void {
    const c = r.curve;
    const n = c.xs.length;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const o = -((r.halfL[i] ?? 0) * scaleL + extra);
      const x = (c.xs[i] ?? 0) + (c.nx[i] ?? 0) * o;
      const y = (c.ys[i] ?? 0) + (c.ny[i] ?? 0) * o;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let i = n - 1; i >= 0; i--) {
      const o = (r.halfR[i] ?? 0) * scaleR + extra;
      ctx.lineTo((c.xs[i] ?? 0) + (c.nx[i] ?? 0) * o, (c.ys[i] ?? 0) + (c.ny[i] ?? 0) * o);
    }
    ctx.closePath();
    ctx.fill();
  }

  private buildMacro(): HTMLCanvasElement {
    const cell = this.macroCell;
    const cols = Math.ceil(this.width / cell) + 1;
    const rows = Math.ceil(this.height / cell) + 1;

    // Moisture: wide translucent strokes along rivers, accumulated, read back.
    const moist = createCanvas(cols, rows);
    const mctx = context2d(moist, true);
    mctx.fillStyle = '#000';
    mctx.fillRect(0, 0, cols, rows);
    mctx.setTransform(1 / cell, 0, 0, 1 / cell, 0, 0);
    mctx.fillStyle = 'rgba(255,255,255,0.15)';
    for (const r of this.rivers) {
      for (const extra of [900, 620, 420, 280, 180, 110]) this.fillRiverBand(mctx, r, extra);
    }
    mctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (const f of this.level.terrain.forests) {
      mctx.beginPath();
      mctx.arc(f.center.x, f.center.y, f.radius * 1.5, 0, Math.PI * 2);
      mctx.fill();
    }
    const moistData = mctx.getImageData(0, 0, cols, rows).data;

    const canvas = createCanvas(cols, rows);
    const ctx = context2d(canvas);
    const img = ctx.createImageData(cols, rows);
    const data = img.data;
    const C = this.palette;
    const col = [0, 0, 0];
    const tmp = [0, 0, 0];
    const noise = this.noise;
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const x = gx * cell;
        const y = gy * cell;
        const n1 = noise.fbm(x / 1500 + 100, y / 1500, 3);
        const n2 = noise.fbm(x / 420 + 50, y / 420 + 80, 3);
        const n3 = noise.fbm(x / 260 + 7, y / 260 + 300, 2);
        const m = Math.min(1, ((moistData[(gy * cols + gx) * 4] ?? 0) / 255) * 1.1);
        const h = this.heightAt(x, y);

        mixRgb(C.sand, C.dryGrass, smoothstep(0.32, 0.68, n1), col);
        mixRgb(col, C.steppe, smoothstep(0.52, 0.76, n2) * 0.5, tmp);
        mixRgb(tmp, C.sandLight, smoothstep(0.6, 0.78, n3) * 0.55, col);
        mixRgb(col, C.greenSteppe, smoothstep(0.15, 0.9, m) * 0.7, tmp);
        mixRgb(tmp, C.rocky, smoothstep(0.25, 0.8, h) * 0.6, col);

        const o = (gy * cols + gx) * 4;
        data[o] = col[0] ?? 0;
        data[o + 1] = col[1] ?? 0;
        data[o + 2] = col[2] ?? 0;
        data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  private blocked(x: number, y: number, flags: number): boolean {
    return (this.maskAt(x, y) & flags) !== 0;
  }

  /** Trace meandering dry washes downhill from hill flanks (and a few from the open steppe). */
  private buildWashes(): void {
    const rng = new Rng(this.seed ^ 0x3a5);
    const starts: Vec2[] = [];
    for (const hill of this.level.terrain.hills) {
      const n = 3 + Math.round(hill.height * 4);
      for (let k = 0; k < n; k++) {
        const a = rng.range(0, Math.PI * 2);
        const d = hill.radius * rng.range(0.25, 0.6);
        starts.push({ x: hill.center.x + Math.cos(a) * d, y: hill.center.y + Math.sin(a) * d });
      }
    }
    for (let k = 0; k < 10; k++) starts.push({ x: rng.range(300, this.width - 300), y: rng.range(300, this.height - 300) });
    const e = 14;
    const grad = (x: number, y: number): [number, number] => [
      ((this.heightAt(x + e, y) - this.heightAt(x - e, y)) / (2 * e)) * 420,
      ((this.heightAt(x, y + e) - this.heightAt(x, y - e)) / (2 * e)) * 420,
    ];
    starts.forEach((st, k) => {
      let x = st.x;
      let y = st.y;
      if (this.maskAt(x, y) & (MASK.water | MASK.road | MASK.field | MASK.structure | MASK.village)) return;
      // Heading follows the downhill direction plus a pull toward the river, with a limited
      // turn rate and a gentle meander so washes never curl back on themselves.
      const riverPull = (px: number, py: number): [number, number] => {
        let best = Infinity;
        let bx = 0;
        let by = 0;
        for (const r of this.rivers) {
          const c = r.curve;
          for (let i = 0; i < c.xs.length; i += 8) {
            const ddx = (c.xs[i] ?? 0) - px;
            const ddy = (c.ys[i] ?? 0) - py;
            const d = ddx * ddx + ddy * ddy;
            if (d < best) {
              best = d;
              bx = ddx;
              by = ddy;
            }
          }
        }
        const l = Math.hypot(bx, by) || 1;
        return [bx / l, by / l];
      };
      const [g0x, g0y] = grad(x, y);
      const [p0x, p0y] = riverPull(x, y);
      let ang = Math.atan2(-g0y * 2.2 + p0y * 0.35, -g0x * 2.2 + p0x * 0.35);
      const pts: Vec2[] = [{ x, y }];
      let turned = 0;
      for (let i = 0; i < 120; i++) {
        const [gx, gy] = grad(x, y);
        const [px, py] = riverPull(x, y);
        const desired = Math.atan2(-gy * 2.2 + py * 0.35, -gx * 2.2 + px * 0.35);
        let turn = Math.atan2(Math.sin(desired - ang), Math.cos(desired - ang));
        turn = Math.max(-0.1, Math.min(0.1, turn));
        turn += (this.noise.fbm(x / 160 + k * 3.1, y / 160, 2) - 0.5) * 0.5;
        const applied = Math.max(-0.18, Math.min(0.18, turn));
        ang += applied;
        turned += applied;
        if (Math.abs(turned) > 2.4) break;
        x += Math.cos(ang) * 14;
        y += Math.sin(ang) * 14;
        if (x < 0 || y < 0 || x > this.width || y > this.height) break;
        const m = this.maskAt(x, y);
        pts.push({ x, y });
        if (m & (MASK.water | MASK.road | MASK.field | MASK.structure | MASK.village)) break;
      }
      if (pts.length < 10) return;
      const sparse = pts.filter((_, i) => i % 2 === 0 || i === pts.length - 1);
      this.washes.push({ curve: sampleSpline(sparse, 8), width: rng.range(3.5, 7) });
    });
  }

  private buildVillages(): void {
    const rng = new Rng(this.seed ^ 0x5eed);
    const C = this.palette;
    this.level.terrain.villages.forEach((v) => {
      const theta = rng.range(0, Math.PI);
      const placed: BuildingModel[] = [];
      // Houses line a main street (and a cross street for bigger villages), long side to the road.
      const streets: Array<{ angle: number; len: number }> = [{ angle: theta, len: v.radius * 1.9 }];
      if (v.buildings > 6) streets.push({ angle: theta + Math.PI / 2 + rng.range(-0.15, 0.15), len: v.radius * 1.2 });
      let attempts = 0;
      while (placed.length < v.buildings && attempts < v.buildings * 40) {
        attempts++;
        const street = streets[placed.length % streets.length] ?? streets[0];
        if (!street) break;
        const big = placed.length === 0;
        const w = big ? rng.range(46, 56) : rng.range(24, 36);
        const h = big ? rng.range(24, 28) : rng.range(16, 21);
        const along = rng.range(-0.5, 0.5) * street.len;
        const side = rng.chance(0.5) ? 1 : -1;
        const setback = 11 + h / 2 + rng.range(0, 6);
        const dx = Math.cos(street.angle);
        const dy = Math.sin(street.angle);
        const x = v.center.x + dx * along - dy * side * setback;
        const y = v.center.y + dy * along + dx * side * setback;
        const radius = Math.hypot(w, h) / 2;
        if (this.blocked(x, y, MASK.water | MASK.road | MASK.structure)) continue;
        if (placed.some((b) => Math.hypot(b.x - x, b.y - y) < (Math.hypot(b.w, b.h) / 2 + radius) * 0.92)) continue;
        placed.push({
          x,
          y,
          w,
          h,
          angle: street.angle + rng.range(-0.05, 0.05),
          roof: rng.pick(C.roofs),
          height: big ? 12 : rng.range(7, 10),
          garden: !big && rng.chance(0.65),
          gardenSide: side,
        });
      }
      this.buildings.push(...placed);
      for (const street of streets.slice(1)) {
        const dx = Math.cos(street.angle) * street.len * 0.55;
        const dy = Math.sin(street.angle) * street.len * 0.55;
        this.villageTracks.push(
          sampleSpline(
            [
              { x: v.center.x - dx, y: v.center.y - dy },
              { x: v.center.x + dx, y: v.center.y + dy },
            ],
            10,
          ),
        );
      }

      // Dirt track from the village to the nearest road.
      let best: Vec2 | null = null;
      let bestD = 1100;
      for (const road of this.roads) {
        const c = road.curve;
        for (let i = 0; i < c.xs.length; i += 2) {
          const d = Math.hypot((c.xs[i] ?? 0) - v.center.x, (c.ys[i] ?? 0) - v.center.y);
          if (d < bestD) {
            bestD = d;
            best = { x: c.xs[i] ?? 0, y: c.ys[i] ?? 0 };
          }
        }
      }
      if (best) {
        const mx = (best.x + v.center.x) / 2 + rng.range(-40, 40);
        const my = (best.y + v.center.y) / 2 + rng.range(-40, 40);
        this.villageTracks.push(sampleSpline([v.center, { x: mx, y: my }, best], 10));
      }
      const dx = Math.cos(theta) * v.radius * 0.95;
      const dy = Math.sin(theta) * v.radius * 0.95;
      this.villageTracks.push(
        sampleSpline(
          [
            { x: v.center.x - dx, y: v.center.y - dy },
            { x: v.center.x + rng.range(-12, 12), y: v.center.y + rng.range(-12, 12) },
            { x: v.center.x + dx, y: v.center.y + dy },
          ],
          10,
        ),
      );
    });
  }

  private buildTrees(): TreeSet {
    const rng = new Rng(this.seed ^ 0x7a3e);
    const xs: number[] = [];
    const ys: number[] = [];
    const rs: number[] = [];
    const vs: number[] = [];
    const noise = this.noise;
    const hardBlock = MASK.water | MASK.road | MASK.field | MASK.structure;
    const add = (x: number, y: number, r: number, family: number): void => {
      if (x < -40 || y < -40 || x > this.width + 40 || y > this.height + 40) return;
      xs.push(x);
      ys.push(y);
      rs.push(r);
      vs.push(family * 4 + rng.int(0, 3));
    };

    // Forests: jittered grid clipped by a noisy boundary; clearings from noise.
    this.level.terrain.forests.forEach((f, fi) => {
      const spacing = 23 / Math.sqrt(Math.max(0.2, f.density));
      const family = fi % 3;
      for (let gy = -f.radius * 1.5; gy <= f.radius * 1.5; gy += spacing) {
        for (let gx = -f.radius * 1.5; gx <= f.radius * 1.5; gx += spacing) {
          const x = f.center.x + gx + rng.range(-0.45, 0.45) * spacing;
          const y = f.center.y + gy + rng.range(-0.45, 0.45) * spacing;
          const d = Math.hypot(x - f.center.x, y - f.center.y) / f.radius;
          const edge = 0.8 + 0.75 * (noise.fbm(x / 320 + fi * 31, y / 320, 3) - 0.5) * 2;
          if (d > edge) {
            // Sparse outliers thinning out beyond the edge.
            if (d < edge + 0.35 && rng.chance(0.12 * (1 - (d - edge) / 0.35)) && !this.blocked(x, y, hardBlock | MASK.village)) {
              add(x, y, rng.range(8, 13), family);
            }
            continue;
          }
          const clearing = noise.fbm(x / 130 + 500, y / 130 + fi * 17, 2);
          if (clearing > 0.72 && d < edge - 0.1) continue;
          if (this.blocked(x, y, hardBlock | MASK.village)) continue;
          const fam = rng.chance(0.18) ? rng.int(0, 2) : family;
          add(x, y, rng.range(11, 18) * (d > edge - 0.15 ? 0.85 : 1), fam);
        }
      }
    });

    // Riparian trees in clumps along both banks.
    for (const river of this.rivers) {
      const c = river.curve;
      for (let i = 0; i < c.xs.length; i += 2) {
        const s = c.s[i] ?? 0;
        for (const side of [-1, 1]) {
          const clump = noise.fbm(s / 260 + (side > 0 ? 70 : 0), 42, 3);
          if (!rng.chance(smoothstep(0.45, 0.7, clump) * 0.8)) continue;
          const half = side < 0 ? (river.halfL[i] ?? 0) : (river.halfR[i] ?? 0);
          const off = side * (half + rng.range(14, 46));
          const x = (c.xs[i] ?? 0) + (c.nx[i] ?? 0) * off + rng.range(-6, 6);
          const y = (c.ys[i] ?? 0) + (c.ny[i] ?? 0) * off + rng.range(-6, 6);
          if (this.blocked(x, y, MASK.road | MASK.field | MASK.structure)) continue;
          if (this.distanceToRiverCentre(river, i, x, y) < half + 8) continue;
          add(x, y, rng.range(10, 16), 1);
        }
      }
    }

    // Occasional poplar rows along the paved road.
    for (const road of this.roads) {
      if (road.surface !== 'paved') continue;
      const c = road.curve;
      for (let i = 0; i < c.xs.length; i += 3) {
        const s = c.s[i] ?? 0;
        if (noise.fbm(s / 400, 91, 2) < 0.55) continue;
        for (const side of [-1, 1]) {
          const off = side * (road.width / 2 + 14);
          const x = (c.xs[i] ?? 0) + (c.nx[i] ?? 0) * off;
          const y = (c.ys[i] ?? 0) + (c.ny[i] ?? 0) * off;
          if (this.blocked(x, y, MASK.water | MASK.structure | MASK.field)) continue;
          add(x, y, rng.range(6.5, 8.5), 2);
        }
      }
    }

    // Village trees and lone steppe trees/bushes.
    for (const v of this.level.terrain.villages) {
      for (let k = 0; k < v.buildings * 2; k++) {
        const p = rng.inDisc(v.radius * 1.1);
        const x = v.center.x + p.x;
        const y = v.center.y + p.y;
        if (this.blocked(x, y, MASK.road | MASK.water)) continue;
        if (this.buildings.some((b) => Math.hypot(b.x - x, b.y - y) < Math.hypot(b.w, b.h) / 2 + 13)) continue;
        add(x, y, rng.range(10, 15), rng.int(0, 2));
      }
    }
    for (let k = 0; k < 520; k++) {
      const x = rng.range(0, this.width);
      const y = rng.range(0, this.height);
      if (this.blocked(x, y, hardBlock | MASK.village | MASK.forest)) continue;
      const cluster = rng.int(1, 4);
      for (let j = 0; j < cluster; j++) {
        const px = x + rng.range(-22, 22) * (j > 0 ? 1 : 0);
        const py = y + rng.range(-22, 22) * (j > 0 ? 1 : 0);
        if (this.blocked(px, py, hardBlock)) continue;
        add(px, py, rng.chance(0.6) ? rng.range(5, 8) : rng.range(9, 13), rng.int(0, 2));
      }
    }

    const count = xs.length;
    const grid = new SpatialGrid(200, this.width);
    // Draw order: north to south so southern canopies overlap.
    const order = Array.from({ length: count }, (_, i) => i).sort((a, b) => (ys[a] ?? 0) - (ys[b] ?? 0));
    const set: TreeSet = {
      count,
      x: new Float32Array(count),
      y: new Float32Array(count),
      r: new Float32Array(count),
      variant: new Uint8Array(count),
      grid,
    };
    order.forEach((src, dst) => {
      set.x[dst] = xs[src] ?? 0;
      set.y[dst] = ys[src] ?? 0;
      set.r[dst] = rs[src] ?? 0;
      set.variant[dst] = vs[src] ?? 0;
      grid.insert(dst, set.x[dst] ?? 0, set.y[dst] ?? 0);
    });
    return set;
  }

  private distanceToRiverCentre(river: RiverModel, near: number, x: number, y: number): number {
    const c = river.curve;
    let best = Infinity;
    for (let i = Math.max(0, near - 12); i < Math.min(c.xs.length, near + 12); i++) {
      best = Math.min(best, Math.hypot((c.xs[i] ?? 0) - x, (c.ys[i] ?? 0) - y));
    }
    return best;
  }

  /** Old shell craters and tank tracks where the ground battle is already raging. */
  private buildBattleScars(): void {
    const rng = new Rng(this.seed ^ 0xbad);
    const outpost = this.level.entities.find((e) => e.kind === 'outpost');
    if (outpost) {
      for (let k = 0; k < 22; k++) {
        const a = rng.range(-1.3, 1.3);
        const d = rng.range(110, 560);
        const x = outpost.pos.x + Math.cos(a) * d;
        const y = outpost.pos.y + Math.sin(a) * d;
        if (this.blocked(x, y, MASK.water | MASK.structure)) continue;
        this.craters.push({ x, y, r: rng.range(4, 11) });
      }
    }
    for (const e of this.level.entities) {
      if (e.kind !== 'tank' || !(e.tags ?? []).includes('waveA')) continue;
      const pts: Vec2[] = [{ x: e.pos.x, y: e.pos.y }];
      let x = e.pos.x;
      let y = e.pos.y;
      const back = degToRad((e.headingDeg ?? 0) + 180);
      for (let k = 0; k < 5; k++) {
        const a = back + rng.range(-0.35, 0.35);
        x += Math.cos(a) * rng.range(90, 140);
        y += Math.sin(a) * rng.range(90, 140);
        pts.push({ x, y });
      }
      this.trackMarks.push(sampleSpline(pts, 8));
    }
  }
}

/** Join marching-squares segments [x0,y0,x1,y1,...] into polylines [x,y,x,y,...]. */
function chainSegments(segs: number[]): number[][] {
  const key = (x: number, y: number): string => `${Math.round(x * 4)},${Math.round(y * 4)}`;
  const count = segs.length / 4;
  const byEnd = new Map<string, number[]>();
  for (let i = 0; i < count; i++) {
    for (const e of [0, 1]) {
      const k = key(segs[i * 4 + e * 2] ?? 0, segs[i * 4 + e * 2 + 1] ?? 0);
      const list = byEnd.get(k);
      if (list) list.push(i);
      else byEnd.set(k, [i]);
    }
  }
  const used = new Uint8Array(count);
  const lines: number[][] = [];
  const extend = (line: number[], atEnd: boolean): void => {
    for (;;) {
      const x = atEnd ? (line[line.length - 2] ?? 0) : (line[0] ?? 0);
      const y = atEnd ? (line[line.length - 1] ?? 0) : (line[1] ?? 0);
      const next = (byEnd.get(key(x, y)) ?? []).find((j) => !used[j]);
      if (next === undefined) return;
      used[next] = 1;
      const ax = segs[next * 4] ?? 0;
      const ay = segs[next * 4 + 1] ?? 0;
      const bx = segs[next * 4 + 2] ?? 0;
      const by = segs[next * 4 + 3] ?? 0;
      const fromA = key(ax, ay) === key(x, y);
      const [nx, ny] = fromA ? [bx, by] : [ax, ay];
      if (atEnd) line.push(nx, ny);
      else line.unshift(nx, ny);
    }
  };
  for (let i = 0; i < count; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const line = [segs[i * 4] ?? 0, segs[i * 4 + 1] ?? 0, segs[i * 4 + 2] ?? 0, segs[i * 4 + 3] ?? 0];
    extend(line, true);
    extend(line, false);
    lines.push(line);
  }
  return lines;
}

/** One Chaikin corner-cutting pass over an open polyline [x,y,...]. */
function chaikin(line: number[] | Float32Array): Float32Array {
  const n = line.length / 2;
  const out: number[] = [line[0] ?? 0, line[1] ?? 0];
  for (let i = 0; i < n - 1; i++) {
    const x0 = line[i * 2] ?? 0;
    const y0 = line[i * 2 + 1] ?? 0;
    const x1 = line[i * 2 + 2] ?? 0;
    const y1 = line[i * 2 + 3] ?? 0;
    out.push(x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25, x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75);
  }
  out.push(line[(n - 1) * 2] ?? 0, line[(n - 1) * 2 + 1] ?? 0);
  return Float32Array.from(out);
}
