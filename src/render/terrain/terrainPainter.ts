import { degToRad } from '../../sim/math';
import { hash2 } from './canvasUtil';
import type { DenseCurve } from './curves';
import type { RiverModel, TerrainModel } from './terrainModel';
import { TERRAIN_COLORS } from './terrainPalette';
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
 *
 * Art direction v1 (lush green toy countryside): flat, calm grass with only large soft variation;
 * clean-edged patchwork fields and light roads; a bright blue river with sandy banks; outlined
 * lollipop trees and red-roofed houses. No noise textures and almost no scatter, so units pop.
 */
export class TerrainPainter {
  private readonly treesNear: TreeSprites;
  private readonly treesFar: TreeSprites;

  constructor(private readonly model: TerrainModel) {
    // Sprites at roughly the bake resolution (trees are ~0.7–1.3× the base radius).
    this.treesNear = new TreeSprites(model.seed, 1.25);
    this.treesFar = new TreeSprites(model.seed, 0.5);
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
    this.paintFields(ctx, rect, detail);
    const m = this.model;
    ctx.drawImage(m.shade, -m.shadeCell / 2, -m.shadeCell / 2, m.shade.width * m.shadeCell, m.shade.height * m.shadeCell);
    ctx.imageSmoothingQuality = 'high';
    this.paintContours(ctx, rect, detail);
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
    const C = TERRAIN_COLORS;
    ctx.drawImage(m.macro, -m.macroCell / 2, -m.macroCell / 2, m.macro.width * m.macroCell, m.macro.height * m.macroCell);
    ctx.imageSmoothingQuality = 'high';

    // Forest floor: deeper green under the canopy so gaps between trees read as woodland.
    for (const f of m.level.terrain.forests) {
      if (!overlaps(rect, f.center.x - f.radius * 1.4, f.center.y - f.radius * 1.4, f.radius * 2.8, f.radius * 2.8)) continue;
      const g = ctx.createRadialGradient(f.center.x, f.center.y, f.radius * 0.35, f.center.x, f.center.y, f.radius * 1.2);
      g.addColorStop(0, C.forestFloor);
      g.addColorStop(0.72, 'rgba(34, 104, 44, 0.4)');
      g.addColorStop(1, 'rgba(34, 104, 44, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(f.center.x - f.radius * 1.3, f.center.y - f.radius * 1.3, f.radius * 2.6, f.radius * 2.6);
    }

    // Trampled ground around structures and in village yards.
    for (const fp of m.footprints) {
      if (fp.kind === 'bridge' || fp.kind === 'cache' || fp.kind === 'aaGun') continue;
      const r = Math.max(fp.w, fp.h) * 0.6;
      if (!overlaps(rect, fp.x - r, fp.y - r, r * 2, r * 2)) continue;
      ctx.save();
      ctx.translate(fp.x, fp.y);
      ctx.rotate(fp.angle);
      ctx.scale(fp.w / Math.max(fp.w, fp.h), fp.h / Math.max(fp.w, fp.h));
      const g = ctx.createRadialGradient(0, 0, r * 0.45, 0, 0, r);
      g.addColorStop(0, C.worn);
      g.addColorStop(0.8, 'rgba(214, 206, 138, 0.35)');
      g.addColorStop(1, 'rgba(214, 206, 138, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.restore();
    }
    for (const v of m.level.terrain.villages) {
      const r = v.radius * 1.15;
      if (!overlaps(rect, v.center.x - r, v.center.y - r, r * 2, r * 2)) continue;
      const g = ctx.createRadialGradient(v.center.x, v.center.y, r * 0.25, v.center.x, v.center.y, r);
      g.addColorStop(0, 'rgba(206, 214, 140, 0.55)');
      g.addColorStop(1, 'rgba(206, 214, 140, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(v.center.x - r, v.center.y - r, r * 2, r * 2);
    }
  }

  /** Patchwork fields: a dark hedge border, a flat crop fill with broad rows, a crisp inner edge. */
  private paintFields(ctx: CanvasRenderingContext2D, rect: Rect, detail: PaintDetail): void {
    const C = TERRAIN_COLORS;
    this.model.level.terrain.fields.forEach((f, fi) => {
      const r = Math.hypot(f.width, f.height) / 2 + 12;
      if (!overlaps(rect, f.center.x - r, f.center.y - r, r * 2, r * 2)) return;
      const [base, stripe, edge] = C[f.crop];
      const hw = f.width / 2;
      const hh = f.height / 2;
      ctx.save();
      ctx.translate(f.center.x, f.center.y);
      ctx.rotate(degToRad(f.rotationDeg));
      // Soft hedge shadow, then the hedge border itself.
      ctx.fillStyle = 'rgba(14, 58, 22, 0.25)';
      roundRect(ctx, -hw - 5 + 3, -hh - 5 + 4, f.width + 10, f.height + 10, 6);
      ctx.fill();
      ctx.fillStyle = C.hedgeDark;
      roundRect(ctx, -hw - 6, -hh - 6, f.width + 12, f.height + 12, 7);
      ctx.fill();
      ctx.fillStyle = C.hedge;
      roundRect(ctx, -hw - 4.5, -hh - 4.5, f.width + 9, f.height + 9, 6);
      ctx.fill();
      ctx.fillStyle = base;
      roundRect(ctx, -hw, -hh, f.width, f.height, 3);
      ctx.fill();
      ctx.save();
      ctx.clip();
      // Broad crop rows along the long axis (same geometry at both LODs so chunks match).
      const along = f.width >= f.height;
      const span = along ? f.height : f.width;
      const spacing = f.crop === 'plowed' ? 12 : 16;
      ctx.fillStyle = stripe;
      ctx.globalAlpha = f.crop === 'plowed' ? 0.8 : 0.6;
      for (let t = -span / 2 + spacing / 2; t < span / 2; t += spacing) {
        if (along) ctx.fillRect(-hw, t - spacing * 0.22, f.width, spacing * 0.44);
        else ctx.fillRect(t - spacing * 0.22, -hh, spacing * 0.44, f.height);
      }
      ctx.globalAlpha = 1;
      // Split some fields into two crops for the patchwork look.
      if (fi % 2 === 0) {
        const other = fi % 4 === 0 ? C.green[0] : C.wheat[0];
        if (other !== base) {
          ctx.fillStyle = other;
          ctx.globalAlpha = 0.9;
          if (along) ctx.fillRect(hw * 0.35, -hh, hw * 0.65, f.height);
          else ctx.fillRect(-hw, hh * 0.35, f.width, hh * 0.65);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = C.hedge;
          ctx.lineWidth = 4;
          ctx.beginPath();
          if (along) {
            ctx.moveTo(hw * 0.35, -hh);
            ctx.lineTo(hw * 0.35, hh);
          } else {
            ctx.moveTo(-hw, hh * 0.35);
            ctx.lineTo(hw, hh * 0.35);
          }
          ctx.stroke();
        }
      }
      ctx.restore();
      // Crisp lit inner edge on the upper-left sides.
      ctx.strokeStyle = edge;
      ctx.lineWidth = detail === 'near' ? 2 : 3;
      ctx.beginPath();
      ctx.moveTo(-hw + 2, hh - 3);
      ctx.lineTo(-hw + 2, -hh + 2);
      ctx.lineTo(hw - 3, -hh + 2);
      ctx.stroke();
      ctx.restore();
    });
  }

  /** Hill terraces: very soft darker-green contour steps (the hill-shade overlay does the rest). */
  private paintContours(ctx: CanvasRenderingContext2D, rect: Rect, detail: PaintDetail): void {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = TERRAIN_COLORS.contour;
    ctx.lineWidth = detail === 'near' ? 3 : 4;
    const m = this.model;
    for (let k = 0; k < m.contours.length; k++) {
      const line = m.contours[k];
      const b = m.contourBounds[k];
      if (!line || !b) continue;
      if (!overlaps(rect, b[0] - 4, b[1] - 4, b[2] - b[0] + 8, b[3] - b[1] + 8)) continue;
      ctx.beginPath();
      for (let i = 0; i < line.length; i += 2) {
        const x = (line[i] ?? 0) + 1;
        const y = (line[i + 1] ?? 0) + 1.5;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  /** Old shell craters (toy dirt bowls) and flattened-grass tank tracks near the outpost. */
  private paintScars(ctx: CanvasRenderingContext2D, rect: Rect): void {
    const m = this.model;
    const C = TERRAIN_COLORS;
    ctx.strokeStyle = C.trackMark;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const track of m.trackMarks) {
      if (!touches(track, rect, 20)) continue;
      for (const side of [-15, 15]) {
        ctx.beginPath();
        traceCurve(ctx, track, side);
        ctx.stroke();
      }
    }
    for (const c of m.craters) {
      if (!overlaps(rect, c.x - c.r * 2, c.y - c.r * 2, c.r * 4, c.r * 4)) continue;
      ctx.fillStyle = C.craterDark;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r * 1.3 + 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.craterRim;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r * 1.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.craterDark;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.crater;
      ctx.beginPath();
      ctx.arc(c.x + c.r * 0.18, c.y + c.r * 0.22, c.r * 0.66, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // -------------------------------------------------------------------------
  // Roads & river
  // -------------------------------------------------------------------------

  private paintRoads(ctx: CanvasRenderingContext2D, rect: Rect, detail: PaintDetail): void {
    const C = TERRAIN_COLORS;
    const m = this.model;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Village tracks first (narrow, same clean style).
    for (const t of m.villageTracks) {
      if (!touches(t, rect, 20)) continue;
      ctx.strokeStyle = C.trackEdge;
      ctx.lineWidth = 15;
      stroke(ctx, t, 0);
    }
    for (const t of m.villageTracks) {
      if (!touches(t, rect, 20)) continue;
      ctx.strokeStyle = C.track;
      ctx.lineWidth = 11;
      stroke(ctx, t, 0);
    }

    const dirt = m.roads.filter((r) => r.surface === 'dirt');
    const paved = m.roads.filter((r) => r.surface === 'paved');
    // Edges for everything, then bodies, so junctions merge cleanly.
    for (const road of dirt) {
      if (!touches(road.curve, rect, road.width + 20)) continue;
      ctx.strokeStyle = C.dirtRoadEdge;
      ctx.lineWidth = road.width + 6;
      stroke(ctx, road.curve, 0);
    }
    for (const road of paved) {
      if (!touches(road.curve, rect, road.width + 20)) continue;
      ctx.strokeStyle = C.pavedEdge;
      ctx.lineWidth = road.width + 7;
      stroke(ctx, road.curve, 0);
    }
    for (const road of dirt) {
      if (!touches(road.curve, rect, road.width + 20)) continue;
      ctx.strokeStyle = C.dirtRoad;
      ctx.lineWidth = road.width;
      stroke(ctx, road.curve, 0);
      if (detail === 'near') {
        // Two faint wheel tracks: barely there, just enough to say "road".
        ctx.strokeStyle = 'rgba(182, 151, 88, 0.22)';
        ctx.lineWidth = 3;
        stroke(ctx, road.curve, -road.width * 0.24);
        stroke(ctx, road.curve, road.width * 0.24);
      }
    }
    for (const road of paved) {
      if (!touches(road.curve, rect, road.width + 20)) continue;
      ctx.strokeStyle = C.paved;
      ctx.lineWidth = road.width;
      stroke(ctx, road.curve, 0);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = road.width * 0.4;
      stroke(ctx, road.curve, -road.width * 0.2);
      ctx.strokeStyle = C.roadDash;
      ctx.lineWidth = 2.6;
      ctx.setLineDash([18, 16]);
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
    const C = TERRAIN_COLORS;
    const band = (extra: number, fill: string, scale = 1): void => {
      ctx.fillStyle = fill;
      fillBandRange(ctx, river, i0, i1, extra, scale);
    };
    band(46, C.riparian);
    band(13, C.bankEdge);
    band(10.5, C.bank);
    band(0, C.waterShallow);
    band(-7, C.water);
    band(-20, C.waterDeep, 0.9);

    // Shadow cast by the north (upper-left-lit) bank onto the water.
    ctx.fillStyle = 'rgba(20, 70, 140, 0.28)';
    ctx.beginPath();
    for (let i = i0; i <= i1; i++) {
      const o = -(river.halfL[i] ?? 0);
      const px = (c.xs[i] ?? 0) + (c.nx[i] ?? 0) * o;
      const py = (c.ys[i] ?? 0) + (c.ny[i] ?? 0) * o;
      if (i === i0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    for (let i = i1; i >= i0; i--) {
      const o = -(river.halfL[i] ?? 0) + 7;
      ctx.lineTo((c.xs[i] ?? 0) + (c.nx[i] ?? 0) * o, (c.ys[i] ?? 0) + (c.ny[i] ?? 0) * o);
    }
    ctx.closePath();
    ctx.fill();

    // White foam line along the lit south shore.
    ctx.strokeStyle = C.foam;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = i0; i <= i1; i++) {
      const o = (river.halfR[i] ?? 0) - 2.5;
      const px = (c.xs[i] ?? 0) + (c.nx[i] ?? 0) * o;
      const py = (c.ys[i] ?? 0) + (c.ny[i] ?? 0) * o;
      if (i === i0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // A few calm flow dashes (sparse, long, soft).
    const seed = this.model.seed;
    ctx.strokeStyle = C.flow;
    ctx.lineWidth = detail === 'near' ? 2.2 : 3;
    for (let i = i0; i < i1 - 10; i += 4) {
      if (hash2(i, 5, seed) > 0.14) continue;
      const lateral = (hash2(i, 9, seed) - 0.5) * 1.1;
      const len = 5 + Math.floor(hash2(i, 13, seed) * 5);
      ctx.beginPath();
      for (let k = 0; k <= len; k++) {
        const j = i + k;
        const half = lateral < 0 ? (river.halfL[j] ?? 0) : (river.halfR[j] ?? 0);
        const o = lateral * half * 0.8;
        const px = (c.xs[j] ?? 0) + (c.nx[j] ?? 0) * o;
        const py = (c.ys[j] ?? 0) + (c.ny[j] ?? 0) * o;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }

  // -------------------------------------------------------------------------
  // Villages & trees
  // -------------------------------------------------------------------------

  private paintVillages(ctx: CanvasRenderingContext2D, rect: Rect, detail: PaintDetail): void {
    const C = TERRAIN_COLORS;
    const visible = this.model.buildings.filter((b) => overlaps(rect, b.x - 70, b.y - 70, 140, 140));
    // Gardens: bright hedged vegetable plots behind the houses.
    for (const b of visible) {
      if (!b.garden) continue;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      const gw = b.w * 0.95;
      const gh = b.h * 0.85;
      const oy = -b.gardenSide * (b.h / 2 + gh / 2 + 4);
      ctx.fillStyle = C.hedge;
      roundRect(ctx, -gw / 2 - 3, oy - gh / 2 - 3, gw + 6, gh + 6, 4);
      ctx.fill();
      ctx.fillStyle = C.garden;
      roundRect(ctx, -gw / 2, oy - gh / 2, gw, gh, 2);
      ctx.fill();
      ctx.fillStyle = C.gardenRow;
      for (let x = -gw / 2 + 4; x < gw / 2 - 2; x += 7) ctx.fillRect(x, oy - gh / 2 + 3, 3, gh - 6);
      ctx.restore();
    }
    // Soft shadows (swept footprint) then roofs.
    ctx.fillStyle = C.buildingShadow;
    for (const b of visible) {
      for (let k = 1; k <= 3; k++) {
        const t = k / 3;
        ctx.save();
        ctx.translate(b.x + SHADOW_DIR.x * b.height * t, b.y + SHADOW_DIR.y * b.height * t);
        ctx.rotate(b.angle);
        roundRect(ctx, -b.w / 2, -b.h / 2, b.w, b.h, 3);
        ctx.fill();
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
      const hw = b.w / 2;
      const hh = b.h / 2;
      // Thick dark outline, base roof, lit half, shaded half, ridge, chimney.
      ctx.fillStyle = C.roofEdge;
      roundRect(ctx, -hw - 1.8, -hh - 1.8, b.w + 3.6, b.h + 3.6, 3.5);
      ctx.fill();
      ctx.fillStyle = b.roof;
      roundRect(ctx, -hw, -hh, b.w, b.h, 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 236, 200, 0.3)';
      ctx.fillRect(-hw, firstLit ? -hh : 0, b.w, hh);
      ctx.fillStyle = 'rgba(60, 10, 10, 0.22)';
      ctx.fillRect(-hw, firstLit ? 0 : -hh, b.w, hh);
      if (detail === 'near') {
        ctx.strokeStyle = 'rgba(90, 20, 16, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = -hw + 5; x < hw - 1; x += 5) {
          ctx.moveTo(x, -hh + 1.5);
          ctx.lineTo(x, hh - 1.5);
        }
        ctx.stroke();
      }
      ctx.strokeStyle = C.roofEdge;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-hw + 1, 0);
      ctx.lineTo(hw - 1, 0);
      ctx.stroke();
      const cx = hw * 0.45;
      const cy = firstLit ? -hh * 0.5 : hh * 0.5;
      ctx.fillStyle = C.roofEdge;
      ctx.fillRect(cx - 4, cy - 4, 8, 8);
      ctx.fillStyle = C.chimney;
      ctx.fillRect(cx - 2.8, cy - 2.8, 5.6, 5.6);
      ctx.restore();
    }
  }

  private paintTrees(ctx: CanvasRenderingContext2D, rect: Rect, detail: PaintDetail): void {
    const t = this.model.trees;
    const sprites = detail === 'near' ? this.treesNear : this.treesFar;
    ctx.imageSmoothingQuality = 'low';
    const pad = TREE_SPRITE_SIZE * 1.4;
    const visible: number[] = [];
    t.grid.query(rect.x, rect.y, rect.w, rect.h, pad, (i) => visible.push(i));
    visible.sort((a, b) => a - b);
    const size = TREE_SPRITE_SIZE;
    ctx.globalAlpha = 0.5;
    for (const i of visible) {
      const r = t.r[i] ?? 0;
      const k = r / TREE_BASE_RADIUS;
      const s = size * k * 1.08;
      const sprite = sprites.shadows[t.variant[i] ?? 0];
      if (!sprite) continue;
      const off = r * 0.75;
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
}

function overlaps(r: Rect, x: number, y: number, w: number, h: number): boolean {
  return x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y;
}

function touches(c: DenseCurve, r: Rect, pad: number): boolean {
  return c.maxX + pad >= r.x && c.minX - pad <= r.x + r.w && c.maxY + pad >= r.y && c.minY - pad <= r.y + r.h;
}

/** Rounded rectangle path (current path is replaced). */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
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
