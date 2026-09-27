import type { LevelDefinition } from '../../sim/level';
import { Rng, type Vec2 } from '../../sim/math';
import type { TacMapStyle } from './tacMapStyle';

type Ctx = CanvasRenderingContext2D;

/**
 * Draw a stylised miniature of a level's terrain (river, roads, forests, hills, fields,
 * villages, home base) onto a 2D canvas of `width` × `height` pixels. Pure canvas drawing, no
 * Phaser; deterministic for a given level.
 */
export function drawTacticalMap(ctx: Ctx, level: LevelDefinition, width: number, height: number, style: TacMapStyle): void {
  const sx = width / level.width;
  const sy = height / level.height;
  const s = Math.min(sx, sy);
  const P = (p: Vec2): Vec2 => ({ x: p.x * sx, y: p.y * sy });
  const rng = new Rng(level.seed ^ 0x7ac3a9);
  const t = level.terrain;

  ctx.save();
  // Ground.
  const ground = ctx.createLinearGradient(0, 0, 0, height);
  ground.addColorStop(0, style.groundTop);
  ground.addColorStop(1, style.groundBottom);
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, width, height);
  if (style.noise > 0) {
    const count = Math.round((width * height) / 70);
    ctx.globalAlpha = style.noise;
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = rng.chance(0.5) ? style.noiseLight : style.noiseDark;
      const size = rng.range(1, 2.6);
      ctx.fillRect(rng.range(0, width), rng.range(0, height), size, size);
    }
    ctx.globalAlpha = 1;
  }

  // Hills.
  for (const hill of t.hills) {
    const c = P(hill.center);
    const r = hill.radius * s;
    if (style.hillFill && style.hillShade) {
      const g = ctx.createRadialGradient(c.x - r * 0.35, c.y - r * 0.35, r * 0.1, c.x, c.y, r * 1.05);
      g.addColorStop(0, style.hillFill);
      g.addColorStop(0.7, 'rgba(0,0,0,0)');
      g.addColorStop(1, style.hillShade);
      ctx.fillStyle = g;
      blob(ctx, c, r, rng.range(0, Math.PI * 2), 0.08);
      ctx.fill();
    }
    if (style.contour) {
      ctx.strokeStyle = style.contour;
      ctx.lineWidth = Math.max(0.75, s * 7);
      const rings = 3 + Math.round(hill.height * 3);
      const phase = rng.range(0, Math.PI * 2);
      for (let i = 0; i < rings; i++) {
        const k = 1 - i / rings;
        blob(ctx, { x: c.x - r * 0.12 * (1 - k), y: c.y - r * 0.1 * (1 - k) }, r * k, phase + i * 0.4, 0.1);
        ctx.stroke();
      }
    }
  }

  // Fields.
  for (const field of t.fields) {
    const c = P(field.center);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate((field.rotationDeg * Math.PI) / 180);
    const w = field.width * sx;
    const h = field.height * sy;
    ctx.fillStyle = style.field[field.crop];
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = style.fieldRows;
    ctx.lineWidth = Math.max(0.5, s * 6);
    const step = Math.max(2, s * 40);
    ctx.beginPath();
    for (let y = -h / 2 + step / 2; y < h / 2; y += step) {
      ctx.moveTo(-w / 2, y);
      ctx.lineTo(w / 2, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Forests: a soft base blob plus individual canopies.
  for (const forest of t.forests) {
    const c = P(forest.center);
    const r = forest.radius * s;
    ctx.fillStyle = style.forest;
    blob(ctx, c, r * 0.92, rng.range(0, Math.PI * 2), 0.18);
    ctx.fill();
    const trees = Math.round(forest.density * Math.max(12, (r * r) / 9));
    const treeR = Math.max(1.2, s * 34);
    for (let i = 0; i < trees; i++) {
      const d = rng.inDisc(r);
      const tr = treeR * rng.range(0.7, 1.3);
      ctx.fillStyle = style.forestCanopy;
      ctx.beginPath();
      ctx.arc(c.x + d.x, c.y + d.y, tr, 0, Math.PI * 2);
      ctx.fill();
      if (tr > 2) {
        ctx.fillStyle = style.forestHighlight;
        ctx.beginPath();
        ctx.arc(c.x + d.x - tr * 0.3, c.y + d.y - tr * 0.3, tr * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // River: glow, body, bright banks.
  for (const river of t.rivers) {
    const pts = river.points.map(P);
    const w = Math.max(style.minRiverWidth, river.width * s);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (style.riverGlow) {
      ctx.strokeStyle = style.riverGlow;
      ctx.lineWidth = w * 2.6;
      smoothPath(ctx, pts);
      ctx.stroke();
    }
    ctx.strokeStyle = style.riverEdge;
    ctx.lineWidth = w + Math.max(1.5, w * 0.25);
    smoothPath(ctx, pts);
    ctx.stroke();
    ctx.strokeStyle = style.river;
    ctx.lineWidth = w;
    smoothPath(ctx, pts);
    ctx.stroke();
  }

  // Roads.
  for (const road of t.roads) {
    const pts = road.points.map(P);
    const w = Math.max(style.minRoadWidth, road.width * s);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (style.roadEdge) {
      ctx.strokeStyle = style.roadEdge;
      ctx.lineWidth = w + 2;
      smoothPath(ctx, pts);
      ctx.stroke();
    }
    ctx.strokeStyle = road.surface === 'paved' ? style.roadPaved : style.roadDirt;
    ctx.lineWidth = w;
    smoothPath(ctx, pts);
    ctx.stroke();
  }

  // Villages.
  for (const village of t.villages) {
    const c = P(village.center);
    const r = village.radius * s;
    ctx.fillStyle = style.village;
    for (let i = 0; i < village.buildings; i++) {
      const d = rng.inDisc(r);
      const bw = Math.max(1.5, s * rng.range(28, 44));
      const bh = Math.max(1.5, s * rng.range(20, 30));
      ctx.save();
      ctx.translate(c.x + d.x, c.y + d.y);
      ctx.rotate(rng.range(-0.4, 0.4));
      ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
      ctx.restore();
    }
  }

  // Home base: runway + pad in friendly blue.
  const base = level.entities.find((e) => e.refId === level.homeBaseRefId);
  if (base) {
    const c = P(base.pos);
    const w = Math.max(10, 320 * s);
    const h = Math.max(3, 46 * s);
    ctx.fillStyle = 'rgba(20, 30, 40, 0.8)';
    ctx.fillRect(c.x - w / 2, c.y - h / 2, w, h);
    ctx.strokeStyle = style.friendly;
    ctx.lineWidth = Math.max(1, s * 10);
    ctx.strokeRect(c.x - w / 2, c.y - h / 2, w, h);
    ctx.setLineDash([Math.max(2, s * 30), Math.max(2, s * 24)]);
    ctx.beginPath();
    ctx.moveTo(c.x - w / 2 + 4, c.y);
    ctx.lineTo(c.x + w / 2 - 4, c.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Grid.
  if (style.grid) {
    ctx.strokeStyle = style.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = style.gridSpacing; x < level.width; x += style.gridSpacing) {
      ctx.moveTo(Math.round(x * sx) + 0.5, 0);
      ctx.lineTo(Math.round(x * sx) + 0.5, height);
    }
    for (let y = style.gridSpacing; y < level.height; y += style.gridSpacing) {
      ctx.moveTo(0, Math.round(y * sy) + 0.5);
      ctx.lineTo(width, Math.round(y * sy) + 0.5);
    }
    ctx.stroke();
  }
  if (style.gridLabels) {
    const size = Math.max(10, Math.round(style.gridSpacing * s * 0.16));
    ctx.fillStyle = style.gridLabels;
    ctx.font = `${size}px "Share Tech Mono", monospace`;
    ctx.textBaseline = 'top';
    let col = 0;
    for (let x = 0; x < level.width; x += style.gridSpacing) {
      ctx.fillText(String.fromCharCode(65 + col), x * sx + 5, 4);
      col++;
    }
    let row = 1;
    for (let y = style.gridSpacing; y < level.height; y += style.gridSpacing) {
      ctx.fillText(String(row), 5, y * sy - size - 3);
      row++;
    }
  }
  ctx.restore();
}

/** Slightly irregular closed circle path. */
function blob(ctx: Ctx, c: Vec2, r: number, phase: number, wobble: number): void {
  const steps = 36;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const k = 1 + wobble * (Math.sin(a * 3 + phase) * 0.6 + Math.sin(a * 5 + phase * 1.7) * 0.4);
    const x = c.x + Math.cos(a) * r * k;
    const y = c.y + Math.sin(a) * r * k;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Open Catmull-Rom spline through the points, as cubic Béziers. */
export function smoothPath(ctx: Ctx, pts: readonly Vec2[]): void {
  ctx.beginPath();
  const first = pts[0];
  if (!first) return;
  ctx.moveTo(first.x, first.y);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    if (!p0 || !p1 || !p2 || !p3) continue;
    ctx.bezierCurveTo(
      p1.x + (p2.x - p0.x) / 6,
      p1.y + (p2.y - p0.y) / 6,
      p2.x - (p3.x - p1.x) / 6,
      p2.y - (p3.y - p1.y) / 6,
      p2.x,
      p2.y,
    );
  }
}
