import { degToRad } from '../../sim/math';
import { createCanvas, context2d, hash2 } from './canvasUtil';
import type { DenseCurve } from './curves';
import { smoothstep } from './noise';
import type { ValueNoise } from './noise';
import { MASK } from './terrainModel';
import type { RiverModel, TerrainModel } from './terrainModel';
import type { FrostColors, TerrainPalette } from './terrainPalette';
import { TREE_BASE_RADIUS, TREE_SPRITE_SIZE, TreeSprites } from './treeSprites';

/** `near` = full detail for close zoom; `far` skips sub-pixel decoration. */
export type PaintDetail = 'near' | 'far';

/** Shadow direction per unit of height (matches `shadowOffset` in render/layers: 30:40). */
const SHADOW_DIR = { x: 0.6, y: 0.8 };

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Paints any world rectangle of a `TerrainModel` into a canvas at any resolution.
 * Everything is anchored to world coordinates, so adjacent chunks tile seamlessly.
 */
export class TerrainPainter {
  private readonly treesNear: TreeSprites;
  private readonly treesFar: TreeSprites;
  private readonly mottle: HTMLCanvasElement;
  private readonly grain: HTMLCanvasElement;
  private readonly palette: TerrainPalette;

  constructor(private readonly model: TerrainModel) {
    this.palette = model.palette;
    // Sprites at roughly the bake resolution (trees are ~0.7–1.1× the base radius).
    this.treesNear = new TreeSprites(model.seed, 1.25, model.palette);
    this.treesFar = new TreeSprites(model.seed, 0.5, model.palette);
    this.mottle = this.noiseTile(model.noise, 256, 8, 4, 0.9, 11);
    this.grain = this.noiseTile(model.noise, 128, 16, 4, 1.0, 23);
  }

  /**
   * Paint world rect (x, y, w, h) into `ctx` at `scale` pixels per world unit.
   * The canvas must be at least (w * scale) × (h * scale) pixels.
   */
  paint(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, scale: number, detail: PaintDetail): void {
    const rect: Rect = { x, y, w, h };
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, -x * scale, -y * scale);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    this.paintGround(ctx, rect);
    this.paintTexture(ctx, rect, detail);
    this.paintFields(ctx, rect, detail);
    const m = this.model;
    ctx.drawImage(m.shade, -m.shadeCell / 2, -m.shadeCell / 2, m.shade.width * m.shadeCell, m.shade.height * m.shadeCell);
    ctx.imageSmoothingQuality = 'high';
    this.paintContours(ctx, rect, detail);
    this.paintWashes(ctx, rect, detail);
    this.paintScatter(ctx, rect, detail);
    this.paintScars(ctx, rect);
    this.paintRoads(ctx, rect, detail);
    for (const river of this.model.rivers) this.paintRiver(ctx, river, rect, detail);
    this.paintVillages(ctx, rect, detail);
    this.paintTrees(ctx, rect, detail);
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // Ground
  // -------------------------------------------------------------------------

  private paintGround(ctx: CanvasRenderingContext2D, rect: Rect): void {
    const m = this.model;
    const C = this.palette;
    ctx.drawImage(m.macro, -m.macroCell / 2, -m.macroCell / 2, m.macro.width * m.macroCell, m.macro.height * m.macroCell);
    ctx.imageSmoothingQuality = 'high';

    // Forest floor: darker, greener ground under the canopy so gaps don't read as sand.
    for (const f of m.level.terrain.forests) {
      if (!overlaps(rect, f.center.x - f.radius * 1.4, f.center.y - f.radius * 1.4, f.radius * 2.8, f.radius * 2.8)) continue;
      const g = ctx.createRadialGradient(f.center.x, f.center.y, f.radius * 0.3, f.center.x, f.center.y, f.radius * 1.25);
      g.addColorStop(0, C.forestFloor[0]);
      g.addColorStop(0.7, C.forestFloor[1]);
      g.addColorStop(1, C.forestFloor[2]);
      ctx.fillStyle = g;
      ctx.fillRect(f.center.x - f.radius * 1.3, f.center.y - f.radius * 1.3, f.radius * 2.6, f.radius * 2.6);
    }

    // Worn, dusty ground around structures and villages.
    for (const fp of m.footprints) {
      if (fp.kind === 'bridge' || fp.kind === 'cache' || fp.kind === 'aaGun') continue;
      const r = Math.max(fp.w, fp.h) * 0.62;
      if (!overlaps(rect, fp.x - r, fp.y - r, r * 2, r * 2)) continue;
      ctx.save();
      ctx.translate(fp.x, fp.y);
      ctx.rotate(fp.angle);
      ctx.scale(fp.w / Math.max(fp.w, fp.h), fp.h / Math.max(fp.w, fp.h));
      const g = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r);
      g.addColorStop(0, C.footprintWear[0]);
      g.addColorStop(0.75, C.footprintWear[1]);
      g.addColorStop(1, C.footprintWear[2]);
      ctx.fillStyle = g;
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.restore();
    }
    for (const v of m.level.terrain.villages) {
      const r = v.radius * 1.3;
      if (!overlaps(rect, v.center.x - r, v.center.y - r, r * 2, r * 2)) continue;
      const g = ctx.createRadialGradient(v.center.x, v.center.y, r * 0.2, v.center.x, v.center.y, r);
      g.addColorStop(0, C.villageWear[0]);
      g.addColorStop(1, C.villageWear[1]);
      ctx.fillStyle = g;
      ctx.fillRect(v.center.x - r, v.center.y - r, r * 2, r * 2);
    }
  }

  private paintFields(ctx: CanvasRenderingContext2D, rect: Rect, detail: PaintDetail): void {
    const C = this.palette;
    this.model.level.terrain.fields.forEach((f, fi) => {
      const r = Math.hypot(f.width, f.height) / 2 + 10;
      if (!overlaps(rect, f.center.x - r, f.center.y - r, r * 2, r * 2)) return;
      const [base, stripe, edge] = C[f.crop];
      const hw = f.width / 2;
      const hh = f.height / 2;
      ctx.save();
      ctx.translate(f.center.x, f.center.y);
      ctx.rotate(degToRad(f.rotationDeg));
      // hedge / earth margin
      ctx.fillStyle = C.hedge;
      ctx.fillRect(-hw - 5, -hh - 5, f.width + 10, f.height + 10);
      ctx.fillStyle = base;
      ctx.fillRect(-hw, -hh, f.width, f.height);
      ctx.beginPath();
      ctx.rect(-hw, -hh, f.width, f.height);
      ctx.clip();
      // patchwork strips across the short axis
      const strips = 2 + (fi % 3);
      for (let k = 0; k < strips; k++) {
        const t = hash2(fi, k, 77);
        ctx.fillStyle = t > 0.5 ? edge : stripe;
        ctx.globalAlpha = 0.12 + t * 0.2;
        ctx.fillRect(-hw, -hh + (k * f.height) / strips, f.width, f.height / strips);
      }
      // furrows along the long axis
      ctx.globalAlpha = f.crop === 'plowed' ? 0.55 : 0.4;
      ctx.strokeStyle = stripe;
      const spacing = detail === 'near' ? (f.crop === 'plowed' ? 4 : 5.5) : 11;
      ctx.lineWidth = detail === 'near' ? 1.7 : 3.2;
      ctx.beginPath();
      for (let yy = -hh + spacing / 2; yy < hh; yy += spacing) {
        ctx.moveTo(-hw, yy);
        ctx.lineTo(hw, yy);
      }
      ctx.stroke();
      if (f.crop !== 'plowed') {
        // tractor tramlines
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = C.plowed[0];
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let yy = -hh + 30; yy < hh; yy += 60) {
          ctx.moveTo(-hw, yy);
          ctx.lineTo(hw, yy);
          ctx.moveTo(-hw, yy + 3.5);
          ctx.lineTo(hw, yy + 3.5);
        }
        ctx.stroke();
      }
      ctx.restore();
      // crisp field edge
      ctx.save();
      ctx.translate(f.center.x, f.center.y);
      ctx.rotate(degToRad(f.rotationDeg));
      ctx.strokeStyle = C.fieldEdge;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-hw, -hh, f.width, f.height);
      if (C.frost) this.paintFence(ctx, hw + 4, hh + 4, C.frost, detail);
      ctx.restore();
    });
  }

  /** Winter field boundary (in the field's rotated frame): a post-and-rail fence just outside the edge. */
  private paintFence(ctx: CanvasRenderingContext2D, hw: number, hh: number, frost: FrostColors, detail: PaintDetail): void {
    ctx.strokeStyle = frost.fence;
    if (detail === 'far') {
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.6;
      ctx.strokeRect(-hw, -hh, hw * 2, hh * 2);
      ctx.globalAlpha = 1;
      return;
    }
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 0.7;
    ctx.strokeRect(-hw, -hh, hw * 2, hh * 2);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'butt';
    ctx.setLineDash([1.6, 9]);
    ctx.strokeRect(-hw, -hh, hw * 2, hh * 2);
    ctx.setLineDash([]);
  }

  private paintTexture(ctx: CanvasRenderingContext2D, rect: Rect, detail: PaintDetail): void {
    const fillPattern = (tile: HTMLCanvasElement, matrix: DOMMatrix, op: GlobalCompositeOperation, alpha: number): void => {
      const pattern = ctx.createPattern(tile, 'repeat');
      if (!pattern) return;
      pattern.setTransform(matrix);
      ctx.globalCompositeOperation = op;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pattern;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    };
    const [wind, grain, fine] = this.palette.textureAlpha;
    // Wind-streaked soil (or snow drifts): isotropic noise stretched along the prevailing wind.
    fillPattern(this.mottle, new DOMMatrix().rotateSelf(-22).scaleSelf(9, 2.4), 'overlay', wind);
    // Medium soil texture (same at every LOD so near/far chunks match).
    fillPattern(this.grain, new DOMMatrix().translateSelf(37, 91).rotateSelf(31).scaleSelf(2.3, 2.3), 'soft-light', grain);
    if (detail === 'near') fillPattern(this.grain, new DOMMatrix().rotateSelf(-17).scaleSelf(0.85, 0.85), 'soft-light', fine);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  /** Hill strata: a dark step line with a sunlit lip just above it. */
  private paintContours(ctx: CanvasRenderingContext2D, rect: Rect, detail: PaintDetail): void {
    const trace = (line: Float32Array, dx: number, dy: number): void => {
      ctx.beginPath();
      for (let i = 0; i < line.length; i += 2) {
        const x = (line[i] ?? 0) + dx;
        const y = (line[i + 1] ?? 0) + dy;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const m = this.model;
    for (let k = 0; k < m.contours.length; k++) {
      const line = m.contours[k];
      const b = m.contourBounds[k];
      if (!line || !b) continue;
      if (!overlaps(rect, b[0] - 4, b[1] - 4, b[2] - b[0] + 8, b[3] - b[1] + 8)) continue;
      ctx.strokeStyle = this.palette.contourShadow;
      ctx.lineWidth = detail === 'near' ? 2.2 : 3;
      trace(line, 0.8, 1);
      ctx.strokeStyle = this.palette.contourLight;
      ctx.lineWidth = detail === 'near' ? 1.4 : 2.4;
      trace(line, -1.2, -1.5);
    }
  }

  /** Dry washes: pale sandy beds with a shaded bank. */
  private paintWashes(ctx: CanvasRenderingContext2D, rect: Rect, detail: PaintDetail): void {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const wash of this.model.washes) {
      if (!touches(wash.curve, rect, 20)) continue;
      ctx.strokeStyle = this.palette.washBank;
      ctx.lineWidth = wash.width + 5;
      stroke(ctx, wash.curve, 1.2);
      ctx.strokeStyle = this.palette.washBed;
      ctx.lineWidth = wash.width;
      stroke(ctx, wash.curve, 0);
      if (detail === 'near') {
        ctx.strokeStyle = this.palette.washLine;
        ctx.lineWidth = 1;
        stroke(ctx, wash.curve, wash.width * 0.15);
      }
    }
  }

  /**
   * Scrub bushes, grass tufts and rocks, scattered per 48-unit cell from a stateless hash.
   * Shapes are accumulated into a few paths and filled once per colour (thousands of tiny
   * shapes per chunk would otherwise cost one fill call each).
   */
  private paintScatter(ctx: CanvasRenderingContext2D, rect: Rect, detail: PaintDetail): void {
    const m = this.model;
    const cell = 48;
    const seed = m.seed;
    const C = this.palette;
    const { scrubDensity, rockDensity } = C.scatter;
    const [capOffset, capRx, capRy] = C.scatter.rockCap;
    const c0 = Math.floor((rect.x - 12) / cell);
    const c1 = Math.floor((rect.x + rect.w + 12) / cell);
    const r0 = Math.floor((rect.y - 12) / cell);
    const r1 = Math.floor((rect.y + rect.h + 12) / cell);
    const block = MASK.water | MASK.road | MASK.field | MASK.structure;
    const near = detail === 'near';
    const scrubShadow = new Path2D();
    const scrubA = new Path2D();
    const scrubB = new Path2D();
    const scrubHi = new Path2D();
    const rockShadow = new Path2D();
    const rockBody = new Path2D();
    const rockHi = new Path2D();
    const tufts = new Path2D();
    const circle = (path: Path2D, x: number, y: number, r: number): void => {
      path.moveTo(x + r, y);
      path.arc(x, y, r, 0, Math.PI * 2);
    };
    const oval = (path: Path2D, x: number, y: number, rx: number, ry: number, rot: number): void => {
      path.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot));
      path.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    };
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        const bx = cx * cell;
        const by = cy * cell;
        const patch = m.noise.fbm(bx / 460 + 3, by / 460 + 9, 3);
        const slope = m.slopeAt(bx + cell / 2, by + cell / 2);
        const nScrub = Math.floor(hash2(cx, cy, seed) * (1.35 + 9 * smoothstep(0.54, 0.74, patch)) * scrubDensity);
        const nRock =
          Math.floor(hash2(cx, cy, seed + 5) * (0.6 + 3.2 * smoothstep(0.35, 0.9, slope)) * rockDensity) + (hash2(cx, cy, seed + 4) > 0.94 ? 1 : 0);
        const nTuft = 2 + Math.floor(hash2(cx, cy, seed + 9) * 6);
        for (let k = 0; k < nScrub; k++) {
          const x = bx + hash2(cx * 31 + k, cy, seed + 1) * cell;
          const y = by + hash2(cx, cy * 17 + k, seed + 2) * cell;
          if (m.maskAt(x, y) & (block | MASK.forest)) continue;
          const r = 2 + hash2(cx + k, cy - k, seed + 3) * 3.6;
          circle(scrubShadow, x + r * 0.5, y + r * 0.7, r);
          circle(hash2(k, cx + cy, seed) > 0.5 ? scrubA : scrubB, x, y, r);
          if (near) circle(scrubHi, x - r * 0.3, y - r * 0.35, r * 0.45);
        }
        for (let k = 0; k < nRock; k++) {
          const x = bx + hash2(cx * 13 + k, cy * 3, seed + 6) * cell;
          const y = by + hash2(cx * 5, cy * 11 + k, seed + 7) * cell;
          if (m.maskAt(x, y) & block) continue;
          const r = 1.3 + hash2(cx - k, cy + k, seed + 8) * (1.4 + Math.min(1, slope) * 2.4);
          if (!near && r < 2.2) continue;
          oval(rockShadow, x + r * 0.45, y + r * 0.55, r * 1.05, r * 0.85, 0);
          oval(rockBody, x, y, r, r * 0.82, hash2(k, cy, seed) * 3);
          oval(rockHi, x - r * capOffset, y - r * capOffset, r * capRx, r * capRy, 0);
        }
        for (let k = 0; k < nTuft; k++) {
          const x = bx + hash2(cx * 7 + k, cy * 19, seed + 11) * cell;
          const y = by + hash2(cx * 23, cy * 7 + k, seed + 12) * cell;
          if (m.maskAt(x, y) & block) continue;
          if (near) {
            for (let j = 0; j < 4; j++) tufts.rect(x + (j % 2) * 1.8 - 1.7, y + Math.floor(j / 2) * 1.6 - 1.6, 1.6, 1.6);
          } else {
            tufts.rect(x - 1.6, y - 1.6, 3.4, 3.2);
          }
        }
      }
    }
    ctx.fillStyle = C.tufts;
    ctx.globalAlpha = near ? 1 : 0.55;
    ctx.fill(tufts);
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.treeShadow;
    ctx.fill(scrubShadow);
    ctx.fillStyle = C.scrub;
    ctx.fill(scrubA);
    ctx.fillStyle = C.scrubDark;
    ctx.fill(scrubB);
    if (near) {
      ctx.fillStyle = C.scrubHi;
      ctx.fill(scrubHi);
    }
    ctx.fillStyle = C.rockShadow;
    ctx.fill(rockShadow);
    ctx.fillStyle = C.rock;
    ctx.fill(rockBody);
    ctx.fillStyle = C.rockLight;
    ctx.fill(rockHi);
  }

  private paintScars(ctx: CanvasRenderingContext2D, rect: Rect): void {
    const m = this.model;
    const C = this.palette;
    ctx.strokeStyle = C.trackMark;
    ctx.lineWidth = 2;
    for (const track of m.trackMarks) {
      if (!touches(track, rect, 20)) continue;
      for (const side of [-4.5, 4.5]) {
        ctx.beginPath();
        traceCurve(ctx, track, side);
        ctx.stroke();
      }
    }
    for (const c of m.craters) {
      if (!overlaps(rect, c.x - c.r * 3, c.y - c.r * 3, c.r * 6, c.r * 6)) continue;
      // Scorched halo, pale ejecta ring, shaded bowl (lit from the upper-left).
      const g = ctx.createRadialGradient(c.x, c.y, c.r * 0.4, c.x, c.y, c.r * 2.8);
      g.addColorStop(0, C.craterHalo[0]);
      g.addColorStop(1, C.craterHalo[1]);
      ctx.fillStyle = g;
      ctx.fillRect(c.x - c.r * 2.8, c.y - c.r * 2.8, c.r * 5.6, c.r * 5.6);
      ctx.fillStyle = C.craterEjecta;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r * 1.25, 0, Math.PI * 2);
      ctx.fill();
      const bowl = ctx.createLinearGradient(c.x - c.r, c.y - c.r, c.x + c.r, c.y + c.r);
      bowl.addColorStop(0, C.craterBowl[0]);
      bowl.addColorStop(1, C.craterBowl[1]);
      ctx.fillStyle = bowl;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r * 0.85, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // -------------------------------------------------------------------------
  // Roads & river
  // -------------------------------------------------------------------------

  private paintRoads(ctx: CanvasRenderingContext2D, rect: Rect, detail: PaintDetail): void {
    const C = this.palette;
    const m = this.model;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Village tracks first (thin, faint).
    for (const t of m.villageTracks) {
      if (!touches(t, rect, 20)) continue;
      ctx.strokeStyle = C.villageTrackEdge;
      ctx.lineWidth = 9;
      stroke(ctx, t, 0);
      ctx.strokeStyle = C.villageTrack;
      ctx.lineWidth = 6;
      stroke(ctx, t, 0);
    }

    const dirt = m.roads.filter((r) => r.surface === 'dirt');
    const paved = m.roads.filter((r) => r.surface === 'paved');
    // Verges for everything, then bodies, so junctions merge cleanly.
    for (const road of [...dirt, ...paved]) {
      if (!touches(road.curve, rect, road.width + 20)) continue;
      ctx.strokeStyle = C.verge;
      ctx.lineWidth = road.width + 16;
      stroke(ctx, road.curve, 0);
    }
    for (const road of dirt) {
      if (!touches(road.curve, rect, road.width + 20)) continue;
      ctx.strokeStyle = C.dirtRoadEdge;
      ctx.lineWidth = road.width + 3;
      stroke(ctx, road.curve, 0);
    }
    for (const road of dirt) {
      if (!touches(road.curve, rect, road.width + 20)) continue;
      ctx.strokeStyle = C.dirtRoad;
      ctx.lineWidth = road.width;
      stroke(ctx, road.curve, 0);
    }
    for (const road of dirt) {
      if (!touches(road.curve, rect, road.width + 20)) continue;
      ctx.strokeStyle = C.dirtRut;
      ctx.lineWidth = detail === 'near' ? 2.4 : 3.5;
      stroke(ctx, road.curve, -road.width * 0.24);
      stroke(ctx, road.curve, road.width * 0.24);
      if (detail === 'near') {
        ctx.strokeStyle = C.dirtCentre;
        ctx.lineWidth = 3;
        stroke(ctx, road.curve, 0);
      }
    }
    for (const road of paved) {
      if (!touches(road.curve, rect, road.width + 20)) continue;
      ctx.strokeStyle = C.asphaltEdge;
      ctx.lineWidth = road.width + 7;
      stroke(ctx, road.curve, 0);
      ctx.strokeStyle = C.asphalt;
      ctx.lineWidth = road.width;
      stroke(ctx, road.curve, 0);
      ctx.strokeStyle = C.asphaltSheen;
      ctx.lineWidth = road.width * 0.45;
      stroke(ctx, road.curve, -road.width * 0.18);
      ctx.strokeStyle = C.roadLine;
      ctx.lineWidth = 1.3;
      stroke(ctx, road.curve, -road.width / 2 + 3);
      stroke(ctx, road.curve, road.width / 2 - 3);
      ctx.strokeStyle = C.roadDash;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([16, 18]);
      ctx.lineCap = 'butt';
      stroke(ctx, road.curve, 0);
      ctx.setLineDash([]);
      ctx.lineCap = 'round';
    }
  }

  private paintRiver(ctx: CanvasRenderingContext2D, river: RiverModel, rect: Rect, detail: PaintDetail): void {
    const c = river.curve;
    if (!touches(c, rect, river.width + 200)) return;
    const range = sampleRange(c, rect, river.width + 220);
    if (!range) return;
    const [i0, i1] = range;
    const C = this.palette;
    const band = (extra: number, fill: string, scale = 1): void => {
      ctx.fillStyle = fill;
      fillBandRange(ctx, river, i0, i1, extra, scale);
    };
    band(150, C.floodplain);
    band(95, C.floodplain);
    band(55, C.floodplain);
    band(24, C.riparian);
    band(10, C.bankSand);
    band(3.5, C.bankWet);
    band(0, C.waterShallow);
    band(-9, C.waterMid);
    band(-22, C.waterDeep, 0.9);
    band(0, C.waterCore, 0.36);

    // Shadow cast by the north (upper-left-lit) bank onto the water.
    if (C.frost) this.paintIce(ctx, river, i0, i1, detail, C.frost);

    ctx.fillStyle = C.bankShadow;
    ctx.beginPath();
    for (let i = i0; i <= i1; i++) {
      const o = -(river.halfL[i] ?? 0);
      const px = (c.xs[i] ?? 0) + (c.nx[i] ?? 0) * o;
      const py = (c.ys[i] ?? 0) + (c.ny[i] ?? 0) * o;
      if (i === i0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    for (let i = i1; i >= i0; i--) {
      const o = -(river.halfL[i] ?? 0) + 11;
      ctx.lineTo((c.xs[i] ?? 0) + (c.nx[i] ?? 0) * o, (c.ys[i] ?? 0) + (c.ny[i] ?? 0) * o);
    }
    ctx.closePath();
    ctx.fill();

    // Lit shoreline shimmer on the south bank.
    ctx.strokeStyle = C.shoreline;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = i0; i <= i1; i++) {
      const o = (river.halfR[i] ?? 0) - 2.2;
      const px = (c.xs[i] ?? 0) + (c.nx[i] ?? 0) * o;
      const py = (c.ys[i] ?? 0) + (c.ny[i] ?? 0) * o;
      if (i === i0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Flow streaks and sun glints.
    const seed = this.model.seed;
    ctx.lineCap = 'round';
    for (let i = i0; i < i1 - 8; i += 3) {
      const h = hash2(i, 5, seed);
      if (h > 0.34) continue;
      const lateral = (hash2(i, 9, seed) - 0.5) * 1.3;
      const len = 3 + Math.floor(hash2(i, 13, seed) * 6);
      ctx.strokeStyle = h < 0.12 ? C.flowLight : C.flowDark;
      ctx.lineWidth = detail === 'near' ? 1.3 : 2.4;
      ctx.beginPath();
      for (let k = 0; k <= len; k++) {
        const j = i + k;
        const half = lateral < 0 ? (river.halfL[j] ?? 0) : (river.halfR[j] ?? 0);
        const o = lateral * half * 0.75;
        const px = (c.xs[j] ?? 0) + (c.nx[j] ?? 0) * o;
        const py = (c.ys[j] ?? 0) + (c.ny[j] ?? 0) * o;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    if (detail === 'near') {
      ctx.fillStyle = C.glint;
      for (let i = i0; i <= i1; i++) {
        if (hash2(i, 21, seed) > 0.22) continue;
        const lateral = (hash2(i, 25, seed) - 0.5) * 1.4;
        const half = lateral < 0 ? (river.halfL[i] ?? 0) : (river.halfR[i] ?? 0);
        const o = lateral * half;
        const px = (c.xs[i] ?? 0) + (c.nx[i] ?? 0) * o;
        const py = (c.ys[i] ?? 0) + (c.ny[i] ?? 0) * o;
        ctx.fillRect(px, py, 2.2, 0.9);
      }
      // Reeds along the banks.
      ctx.fillStyle = C.reeds;
      for (let i = i0; i <= i1; i++) {
        for (const side of [-1, 1]) {
          if (hash2(i, side + 40, seed) > 0.3) continue;
          const half = side < 0 ? (river.halfL[i] ?? 0) : (river.halfR[i] ?? 0);
          const o = side * (half + 1 + hash2(i, side + 44, seed) * 6);
          const px = (c.xs[i] ?? 0) + (c.nx[i] ?? 0) * o;
          const py = (c.ys[i] ?? 0) + (c.ny[i] ?? 0) * o;
          ctx.beginPath();
          ctx.arc(px, py, 1.6 + hash2(i, side, seed) * 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  /**
   * Frozen river extras, drawn over the ice bands: wind-blown snow drifts, a dark open-water lead
   * that winds down the channel and pinches shut where the ice has closed over, and cracks.
   */
  private paintIce(ctx: CanvasRenderingContext2D, river: RiverModel, i0: number, i1: number, detail: PaintDetail, frost: FrostColors): void {
    const c = river.curve;
    const seed = this.model.seed;
    const noise = this.model.noise;
    const near = detail === 'near';
    const at = (i: number, lateral: number, along = 0): [number, number] => {
      const nx = c.nx[i] ?? 0;
      const ny = c.ny[i] ?? 0;
      // Tangent = normal rotated back a quarter turn.
      return [(c.xs[i] ?? 0) + nx * lateral + ny * along, (c.ys[i] ?? 0) + ny * lateral - nx * along];
    };
    const halfAt = (i: number): number => Math.min(river.halfL[i] ?? 0, river.halfR[i] ?? 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Snow drifts lying along the ice.
    ctx.strokeStyle = frost.iceSnow;
    for (let i = i0; i < i1 - 10; i += 5) {
      if (hash2(i, 71, seed) > 0.3) continue;
      const lateral = (hash2(i, 73, seed) - 0.5) * 1.5 * halfAt(i);
      const len = 5 + Math.floor(hash2(i, 75, seed) * 9);
      ctx.lineWidth = (near ? 3 : 4) + hash2(i, 77, seed) * 6;
      ctx.globalAlpha = 0.5 + hash2(i, 79, seed) * 0.4;
      ctx.beginPath();
      for (let k = 0; k <= len; k++) {
        const [x, y] = at(i + k, lateral + Math.sin(k * 0.7) * 2);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Open-water lead: runs of samples where the noise opens it up, with ragged ice edges.
    const leadNoise = (i: number): number => noise.fbm((c.s[i] ?? 0) / 520 + 61, 13.7, 3);
    const lead = new Path2D();
    let run: number[] = [];
    const flush = (): void => {
      if (run.length >= 3) {
        const half = run.map(
          (i) => smoothstep(0.55, 0.72, leadNoise(i)) * halfAt(i) * 0.3 * (0.75 + 0.5 * noise.fbm((c.s[i] ?? 0) / 70, 5.3, 2)) * (0.85 + 0.3 * hash2(i, 59, seed)),
        );
        const drift = run.map((i) => (noise.fbm((c.s[i] ?? 0) / 300 + 7, 31.1, 2) - 0.5) * 0.6 * halfAt(i));
        run.forEach((i, k) => {
          const [x, y] = at(i, (drift[k] ?? 0) - (half[k] ?? 0));
          if (k === 0) lead.moveTo(x, y);
          else lead.lineTo(x, y);
        });
        for (let k = run.length - 1; k >= 0; k--) {
          const [x, y] = at(run[k] ?? 0, (drift[k] ?? 0) + (half[k] ?? 0));
          lead.lineTo(x, y);
        }
        lead.closePath();
      }
      run = [];
    };
    for (let i = i0; i <= i1; i++) {
      if (leadNoise(i) > 0.55) run.push(i);
      else flush();
    }
    flush();
    ctx.fillStyle = frost.iceCrackLit;
    ctx.save();
    ctx.translate(-1, -1.3);
    ctx.fill(lead);
    ctx.restore();
    ctx.fillStyle = frost.openWater;
    ctx.fill(lead);

    // Cracks: jagged lines running roughly across the ice from one bank.
    const dark = new Path2D();
    for (let i = i0; i <= i1; i += 2) {
      if (hash2(i, 61, seed) > (near ? 0.2 : 0.12)) continue;
      const side = hash2(i, 63, seed) < 0.5 ? -1 : 1;
      const halfW = side < 0 ? (river.halfL[i] ?? 0) : (river.halfR[i] ?? 0);
      let lateral = side * halfW * (0.6 + 0.35 * hash2(i, 65, seed));
      let along = 0;
      const steps = 3 + Math.floor(hash2(i, 67, seed) * 4);
      const [sx, sy] = at(i, lateral);
      dark.moveTo(sx, sy);
      for (let k = 0; k < steps; k++) {
        lateral -= side * halfW * (0.1 + 0.18 * hash2(i, 80 + k, seed));
        along += (hash2(i, 90 + k, seed) - 0.5) * halfW * 0.4;
        const [x, y] = at(i, lateral, along);
        dark.lineTo(x, y);
        if (k === 1 && hash2(i, 69, seed) < 0.5) {
          // A short side branch.
          const [bx, by] = at(i, lateral + side * halfW * 0.08, along + (hash2(i, 70, seed) - 0.5) * halfW * 0.5);
          dark.lineTo(bx, by);
          dark.moveTo(x, y);
        }
      }
    }
    ctx.lineWidth = near ? 1.1 : 1.8;
    ctx.strokeStyle = frost.iceCrackLit;
    ctx.save();
    ctx.translate(0.8, 1);
    ctx.stroke(dark);
    ctx.restore();
    ctx.strokeStyle = frost.iceCrack;
    ctx.lineWidth = near ? 0.9 : 1.6;
    ctx.stroke(dark);
  }

  // -------------------------------------------------------------------------
  // Villages & trees
  // -------------------------------------------------------------------------

  private paintVillages(ctx: CanvasRenderingContext2D, rect: Rect, detail: PaintDetail): void {
    const C = this.palette;
    const visible = this.model.buildings.filter((b) => overlaps(rect, b.x - 40, b.y - 40, 80, 80));
    // Gardens.
    for (const b of visible) {
      if (!b.garden) continue;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      const gw = b.w * 1.1;
      const gh = b.h * 1.1;
      const oy = -b.gardenSide * (b.h / 2 + gh / 2 + 2);
      ctx.fillStyle = C.garden;
      ctx.fillRect(-gw / 2, oy - gh / 2, gw, gh);
      ctx.strokeStyle = C.gardenRows;
      ctx.lineWidth = detail === 'near' ? 1 : 2;
      ctx.beginPath();
      for (let x = -gw / 2 + 2.5; x < gw / 2; x += detail === 'near' ? 3.2 : 6) {
        ctx.moveTo(x, oy - gh / 2 + 1);
        ctx.lineTo(x, oy + gh / 2 - 1);
      }
      ctx.stroke();
      ctx.strokeStyle = C.gardenEdge;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(-gw / 2, oy - gh / 2, gw, gh);
      ctx.restore();
    }
    // Shadows (swept footprint) then roofs.
    ctx.fillStyle = C.buildingShadow;
    for (const b of visible) {
      for (let k = 1; k <= 3; k++) {
        const t = k / 3;
        ctx.save();
        ctx.translate(b.x + SHADOW_DIR.x * b.height * t, b.y + SHADOW_DIR.y * b.height * t);
        ctx.rotate(b.angle);
        ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        ctx.restore();
      }
    }
    for (const b of visible) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      // Which roof half faces the sun (light comes from the upper-left)?
      const nx = Math.sin(b.angle);
      const ny = -Math.cos(b.angle);
      const firstLit = nx * -SHADOW_DIR.x + ny * -SHADOW_DIR.y > 0;
      ctx.fillStyle = b.roof;
      ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      if (C.frost) {
        // Snow covers the sunlit slope down to the eaves; on the shaded slope it has slid off,
        // leaving a band along the ridge and the roof colour showing below it.
        const eave = Math.min(3, b.h * 0.16);
        const gable = Math.min(1.6, b.w * 0.06);
        const slope = b.h / 2 - eave;
        ctx.fillStyle = C.frost.snow;
        ctx.fillRect(-b.w / 2 + gable, firstLit ? -b.h / 2 + eave : 0, b.w - gable * 2, slope);
        ctx.fillStyle = C.frost.snowShade;
        ctx.fillRect(-b.w / 2 + gable, firstLit ? 0 : -slope * 0.45, b.w - gable * 2, slope * 0.45);
      }
      ctx.fillStyle = C.roofLit;
      ctx.fillRect(-b.w / 2, firstLit ? -b.h / 2 : 0, b.w, b.h / 2);
      ctx.fillStyle = C.roofShade;
      ctx.fillRect(-b.w / 2, firstLit ? 0 : -b.h / 2, b.w, b.h / 2);
      ctx.strokeStyle = C.roofRidge;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(-b.w / 2, 0);
      ctx.lineTo(b.w / 2, 0);
      ctx.stroke();
      ctx.strokeStyle = C.roofOutline;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);
      if (detail === 'near') {
        ctx.strokeStyle = C.roofTiles;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        for (let x = -b.w / 2 + 2.5; x < b.w / 2; x += 2.5) {
          ctx.moveTo(x, -b.h / 2);
          ctx.lineTo(x, b.h / 2);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private paintTrees(ctx: CanvasRenderingContext2D, rect: Rect, detail: PaintDetail): void {
    const t = this.model.trees;
    const sprites = detail === 'near' ? this.treesNear : this.treesFar;
    ctx.imageSmoothingQuality = 'low';
    const pad = TREE_SPRITE_SIZE;
    const visible: number[] = [];
    t.grid.query(rect.x, rect.y, rect.w, rect.h, pad, (i) => visible.push(i));
    visible.sort((a, b) => a - b);
    const size = TREE_SPRITE_SIZE;
    ctx.globalAlpha = 0.42;
    for (const i of visible) {
      const r = t.r[i] ?? 0;
      const k = r / TREE_BASE_RADIUS;
      const s = size * k;
      const sprite = sprites.shadows[t.variant[i] ?? 0];
      if (!sprite) continue;
      const off = r * 1.05;
      ctx.drawImage(sprite, (t.x[i] ?? 0) + SHADOW_DIR.x * off - s / 2, (t.y[i] ?? 0) + SHADOW_DIR.y * off - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    for (const i of visible) {
      const r = t.r[i] ?? 0;
      const s = size * (r / TREE_BASE_RADIUS);
      const sprite = sprites.canopies[t.variant[i] ?? 0];
      if (!sprite) continue;
      ctx.drawImage(sprite, (t.x[i] ?? 0) - s / 2, (t.y[i] ?? 0) - s / 2, s, s);
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** Tileable greyscale fBm tile, centred on mid-grey for overlay/soft-light blending. */
  private noiseTile(noise: ValueNoise, size: number, period: number, octaves: number, contrast: number, offset: number): HTMLCanvasElement {
    const canvas = createCanvas(size, size);
    const ctx = context2d(canvas);
    const img = ctx.createImageData(size, size);
    const d = img.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const v = noise.fbm((x / size) * period + offset * period, (y / size) * period, octaves, 0.55, period);
        const grey = Math.max(0, Math.min(255, 128 + (v - 0.5) * 2 * contrast * 127 * 1.6));
        const o = (y * size + x) * 4;
        d[o] = grey;
        d[o + 1] = grey;
        d[o + 2] = grey;
        d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }
}

function overlaps(r: Rect, x: number, y: number, w: number, h: number): boolean {
  return x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y;
}

function touches(c: DenseCurve, r: Rect, pad: number): boolean {
  return c.maxX + pad >= r.x && c.minX - pad <= r.x + r.w && c.maxY + pad >= r.y && c.minY - pad <= r.y + r.h;
}

/** First/last sample index inside the rect grown by `pad` (null if none). */
function sampleRange(c: DenseCurve, r: Rect, pad: number): [number, number] | null {
  let first = -1;
  let last = -1;
  const n = c.xs.length;
  for (let i = 0; i < n; i++) {
    const x = c.xs[i] ?? 0;
    const y = c.ys[i] ?? 0;
    if (x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad) {
      if (first < 0) first = i;
      last = i;
    }
  }
  if (first < 0) return null;
  return [Math.max(0, first - 2), Math.min(n - 1, last + 2)];
}

function fillBandRange(ctx: CanvasRenderingContext2D, river: RiverModel, i0: number, i1: number, extra: number, scale: number): void {
  const c = river.curve;
  ctx.beginPath();
  for (let i = i0; i <= i1; i++) {
    const o = -((river.halfL[i] ?? 0) * scale + extra);
    const x = (c.xs[i] ?? 0) + (c.nx[i] ?? 0) * o;
    const y = (c.ys[i] ?? 0) + (c.ny[i] ?? 0) * o;
    if (i === i0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  for (let i = i1; i >= i0; i--) {
    const o = (river.halfR[i] ?? 0) * scale + extra;
    ctx.lineTo((c.xs[i] ?? 0) + (c.nx[i] ?? 0) * o, (c.ys[i] ?? 0) + (c.ny[i] ?? 0) * o);
  }
  ctx.closePath();
  ctx.fill();
}

function traceCurve(ctx: CanvasRenderingContext2D, c: DenseCurve, offset: number): void {
  for (let i = 0; i < c.xs.length; i++) {
    const x = (c.xs[i] ?? 0) + (c.nx[i] ?? 0) * offset;
    const y = (c.ys[i] ?? 0) + (c.ny[i] ?? 0) * offset;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
}

function stroke(ctx: CanvasRenderingContext2D, c: DenseCurve, offset: number): void {
  ctx.beginPath();
  traceCurve(ctx, c, offset);
  ctx.stroke();
}
