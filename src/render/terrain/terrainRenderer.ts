import Phaser from 'phaser';
import type { LevelDefinition } from '../../sim/level';
import { DEPTH } from '../layers';
import { TerrainModel } from './terrainModel';
import { TerrainPainter } from './terrainPainter';
import type { PaintDetail } from './terrainPainter';

export interface TerrainRendererOptions {
  /** Pixels per world unit of the always-resident whole-map layer (good for zoom ≤ ~0.6). */
  farScale: number;
  /** World units per far chunk. */
  farChunk: number;
  /** Pixels per world unit of the lazily baked close-up layer. */
  nearScale: number;
  /** World units per near chunk. */
  nearChunk: number;
  /** Maximum resident near chunks (LRU). Memory = nearMaxChunks × (nearChunk × nearScale)² × 4 bytes. */
  nearMaxChunks: number;
  /** Near chunks are only baked (and shown) when the camera zoom is at least this. */
  nearMinZoom: number;
  /** Extra world units around the view to pre-bake near chunks. */
  nearMargin: number;
  /** Time budget per frame for baking, ms. At least one chunk is baked per frame while work is pending. */
  frameBudgetMs: number;
  /** Time `build()` may spend baking synchronously before deferring to later frames, ms. */
  initialBudgetMs: number;
}

export const DEFAULT_TERRAIN_OPTIONS: TerrainRendererOptions = {
  farScale: 0.4,
  farChunk: 1200,
  nearScale: 1,
  nearChunk: 400,
  nearMaxChunks: 56,
  nearMinZoom: 0.62,
  nearMargin: 120,
  frameBudgetMs: 5,
  initialBudgetMs: 350,
};

/** Live numbers for debugging / the gallery overlay. */
export interface TerrainStats {
  farBaked: number;
  farTotal: number;
  nearResident: number;
  nearBakes: number;
  /** GPU texture bytes currently allocated for terrain. */
  textureBytes: number;
  /** Worst single bake time so far, ms. */
  worstBakeMs: number;
  /** Time spent building the model + initial bake, ms. */
  buildMs: number;
}

interface FarChunk {
  x: number;
  y: number;
  w: number;
  h: number;
  key: string;
  texture: Phaser.Textures.CanvasTexture;
  image: Phaser.GameObjects.Image;
  baked: boolean;
}

interface NearSlot {
  key: string;
  texture: Phaser.Textures.CanvasTexture;
  image: Phaser.GameObjects.Image;
  /** Grid cell currently held, or -1. */
  cell: number;
  x: number;
  y: number;
  lastUsed: number;
  bakedAt: number;
}

/**
 * Bakes a level's procedural terrain into textures at `DEPTH.terrain`.
 *
 * Strategy (≈61 MB of textures with the defaults):
 * - **Far layer:** the whole map at 0.4 px/unit in 1200-unit chunks (≈25 MB), always resident.
 *   Baked nearest-to-camera first; `build()` does as much as fits in `initialBudgetMs`, the rest
 *   streams in over the next frames.
 * - **Near layer:** 1 px/unit, 400-unit chunks baked lazily around the camera when zoomed in
 *   (Low/Medium), kept in an LRU pool of `nearMaxChunks` (≈36 MB). Fades in over the far layer
 *   and fades out when zooming out past `nearMinZoom`.
 *
 * The renderer hooks the scene's POST_UPDATE event itself; callers only `build()` and `destroy()`.
 */
export class TerrainRenderer {
  private static nextId = 0;

  private readonly id = TerrainRenderer.nextId++;
  private readonly opts: TerrainRendererOptions;
  private model: TerrainModel | null = null;
  private painter: TerrainPainter | null = null;
  private backdrop: Phaser.GameObjects.Rectangle | null = null;
  private readonly far: FarChunk[] = [];
  private readonly near: NearSlot[] = [];
  private readonly nearByCell = new Map<number, NearSlot>();
  private nearCols = 0;
  private frame = 0;
  private built = false;
  private destroyed = false;
  private readonly statsData: TerrainStats = {
    farBaked: 0,
    farTotal: 0,
    nearResident: 0,
    nearBakes: 0,
    textureBytes: 0,
    worstBakeMs: 0,
    buildMs: 0,
  };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly level: LevelDefinition,
    options: Partial<TerrainRendererOptions> = {},
  ) {
    this.opts = { ...DEFAULT_TERRAIN_OPTIONS, ...options };
  }

  /** Build the terrain model and start baking. Safe to call once. */
  build(): void {
    if (this.built) return;
    this.built = true;
    const t0 = performance.now();
    this.model = new TerrainModel(this.level);
    this.painter = new TerrainPainter(this.model);

    const avg = this.model.palette.average;
    const pad = 4000;
    this.backdrop = this.scene.add
      .rectangle(-pad, -pad, this.level.width + pad * 2, this.level.height + pad * 2, Phaser.Display.Color.GetColor(avg[0], avg[1], avg[2]))
      .setOrigin(0, 0)
      .setDepth(DEPTH.terrain);

    this.createFarChunks();
    this.nearCols = Math.ceil(this.level.width / this.opts.nearChunk);

    const deadline = performance.now() + this.opts.initialBudgetMs;
    const cam = this.scene.cameras.main;
    const cx = cam.worldView.width > 0 ? cam.worldView.centerX : this.level.width / 2;
    const cy = cam.worldView.height > 0 ? cam.worldView.centerY : this.level.height / 2;
    while (performance.now() < deadline && this.bakeNextFar(cx, cy)) {
      /* keep baking */
    }
    this.statsData.buildMs = performance.now() - t0;

    this.scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.tick, this);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  /** The terrain model (available after `build()`), e.g. for a minimap. */
  get terrainModel(): TerrainModel | null {
    return this.model;
  }

  /** The painter (available after `build()`); can paint any world rect into any canvas. */
  get terrainPainter(): TerrainPainter | null {
    return this.painter;
  }

  get stats(): Readonly<TerrainStats> {
    return this.statsData;
  }

  /** True once every far chunk has been baked. */
  get complete(): boolean {
    return this.statsData.farBaked === this.statsData.farTotal;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.tick, this);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    for (const c of this.far) {
      c.image.destroy();
      this.scene.textures.remove(c.key);
    }
    for (const s of this.near) {
      s.image.destroy();
      this.scene.textures.remove(s.key);
    }
    this.far.length = 0;
    this.near.length = 0;
    this.nearByCell.clear();
    this.backdrop?.destroy();
    this.backdrop = null;
    this.model = null;
    this.painter = null;
  }

  // -------------------------------------------------------------------------

  private createFarChunks(): void {
    const { farChunk, farScale } = this.opts;
    const W = this.level.width;
    const H = this.level.height;
    let i = 0;
    for (let y = 0; y < H; y += farChunk) {
      for (let x = 0; x < W; x += farChunk) {
        const w = Math.min(farChunk, W - x);
        const h = Math.min(farChunk, H - y);
        const key = `terrain${this.id}-far-${i++}`;
        const texture = this.scene.textures.createCanvas(key, Math.ceil(w * farScale), Math.ceil(h * farScale));
        if (!texture) throw new Error(`Could not create terrain texture ${key}`);
        const image = this.scene.add
          .image(x, y, key)
          .setOrigin(0, 0)
          .setScale(1 / farScale)
          .setDepth(DEPTH.terrain)
          .setVisible(false);
        this.far.push({ x, y, w, h, key, texture, image, baked: false });
        this.statsData.textureBytes += texture.width * texture.height * 4;
      }
    }
    this.statsData.farTotal = this.far.length;
  }

  /** Bake the pending far chunk nearest (cx, cy). Returns false when none are left. */
  private bakeNextFar(cx: number, cy: number): boolean {
    let best: FarChunk | null = null;
    let bestD = Infinity;
    for (const c of this.far) {
      if (c.baked) continue;
      const d = Math.hypot(c.x + c.w / 2 - cx, c.y + c.h / 2 - cy);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (!best) return false;
    this.paintInto(best.texture, best.x, best.y, best.w, best.h, this.opts.farScale, 'far');
    best.baked = true;
    best.image.setVisible(true);
    this.statsData.farBaked++;
    return true;
  }

  private paintInto(texture: Phaser.Textures.CanvasTexture, x: number, y: number, w: number, h: number, scale: number, detail: PaintDetail): void {
    const painter = this.painter;
    if (!painter) return;
    const t0 = performance.now();
    const ctx = texture.getContext();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, texture.width, texture.height);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, Math.ceil(w * scale), Math.ceil(h * scale));
    ctx.clip();
    painter.paint(ctx, x, y, w, h, scale, detail);
    ctx.restore();
    texture.refresh();
    this.statsData.worstBakeMs = Math.max(this.statsData.worstBakeMs, performance.now() - t0);
  }

  private tick(): void {
    if (this.destroyed || !this.painter) return;
    this.frame++;
    const cam = this.scene.cameras.main;
    const view = cam.worldView;
    const start = performance.now();
    const deadline = start + this.opts.frameBudgetMs;
    let bakedThisFrame = 0;

    // 1. Far layer: finish streaming (nearest first).
    while ((bakedThisFrame === 0 || performance.now() < deadline) && this.bakeNextFar(view.centerX, view.centerY)) {
      bakedThisFrame++;
    }

    // 2. Near layer.
    const { nearChunk, nearMinZoom, nearMargin, nearMaxChunks, nearScale } = this.opts;
    const zoom = cam.zoom;
    const fadeBand = 0.07;
    const nearAlpha = Phaser.Math.Clamp((zoom - (nearMinZoom - fadeBand)) / fadeBand, 0, 1);
    if (zoom >= nearMinZoom) {
      const x0 = Math.max(0, Math.floor((view.x - nearMargin) / nearChunk));
      const x1 = Math.min(this.nearCols - 1, Math.floor((view.right + nearMargin) / nearChunk));
      const y0 = Math.max(0, Math.floor((view.y - nearMargin) / nearChunk));
      const y1 = Math.min(Math.ceil(this.level.height / nearChunk) - 1, Math.floor((view.bottom + nearMargin) / nearChunk));
      const missing: Array<{ cell: number; d: number }> = [];
      for (let gy = y0; gy <= y1; gy++) {
        for (let gx = x0; gx <= x1; gx++) {
          const cell = gy * this.nearCols + gx;
          const slot = this.nearByCell.get(cell);
          if (slot) {
            slot.lastUsed = this.frame;
            continue;
          }
          const cx = (gx + 0.5) * nearChunk;
          const cy = (gy + 0.5) * nearChunk;
          missing.push({ cell, d: Math.hypot(cx - view.centerX, cy - view.centerY) });
        }
      }
      missing.sort((a, b) => a.d - b.d);
      for (const m of missing) {
        if (bakedThisFrame > 0 && performance.now() >= deadline) break;
        const slot = this.acquireNearSlot(nearMaxChunks, nearChunk, nearScale);
        if (!slot) break;
        const gx = m.cell % this.nearCols;
        const gy = Math.floor(m.cell / this.nearCols);
        const x = gx * nearChunk;
        const y = gy * nearChunk;
        this.paintInto(slot.texture, x, y, Math.min(nearChunk, this.level.width - x), Math.min(nearChunk, this.level.height - y), nearScale, 'near');
        slot.cell = m.cell;
        slot.x = x;
        slot.y = y;
        slot.lastUsed = this.frame;
        slot.bakedAt = this.scene.time.now;
        slot.image.setPosition(x, y);
        this.nearByCell.set(m.cell, slot);
        this.statsData.nearBakes++;
        bakedThisFrame++;
      }
    }

    // 3. Near visibility + fade-in.
    const now = this.scene.time.now;
    for (const slot of this.near) {
      if (slot.cell < 0) continue;
      const onScreen =
        slot.x < view.right && slot.x + nearChunk > view.x && slot.y < view.bottom && slot.y + nearChunk > view.y;
      const fade = Phaser.Math.Clamp((now - slot.bakedAt) / 220, 0, 1);
      const alpha = nearAlpha * fade;
      slot.image.setVisible(onScreen && alpha > 0.01);
      slot.image.setAlpha(alpha);
    }

    // 4. Far chunks: skip ones off-screen or fully hidden under opaque near chunks (saves fill-rate).
    for (const c of this.far) {
      if (!c.baked) continue;
      const x0 = Math.max(c.x, view.x);
      const y0 = Math.max(c.y, view.y);
      const x1 = Math.min(c.x + c.w, view.right);
      const y1 = Math.min(c.y + c.h, view.bottom);
      if (x0 >= x1 || y0 >= y1) {
        c.image.setVisible(false);
        continue;
      }
      c.image.setVisible(!(nearAlpha >= 1 && this.coveredByNear(x0, y0, x1, y1, now)));
    }

    // 5. The backdrop only matters when the view reaches past the map edge.
    this.backdrop?.setVisible(view.x < 0 || view.y < 0 || view.right > this.level.width || view.bottom > this.level.height);
    this.statsData.nearResident = this.nearByCell.size;
  }

  /** True when every near cell overlapping the rect is resident and fully faded in. */
  private coveredByNear(x0: number, y0: number, x1: number, y1: number, now: number): boolean {
    const chunk = this.opts.nearChunk;
    for (let gy = Math.floor(y0 / chunk); gy <= Math.floor((y1 - 0.001) / chunk); gy++) {
      for (let gx = Math.floor(x0 / chunk); gx <= Math.floor((x1 - 0.001) / chunk); gx++) {
        const slot = this.nearByCell.get(gy * this.nearCols + gx);
        if (!slot || now - slot.bakedAt < 220) return false;
      }
    }
    return true;
  }

  private acquireNearSlot(max: number, chunk: number, scale: number): NearSlot | null {
    if (this.near.length < max) {
      const key = `terrain${this.id}-near-${this.near.length}`;
      const size = Math.ceil(chunk * scale);
      const texture = this.scene.textures.createCanvas(key, size, size);
      if (!texture) return null;
      const image = this.scene.add
        .image(0, 0, key)
        .setOrigin(0, 0)
        .setScale(1 / scale)
        .setDepth(DEPTH.terrain)
        .setVisible(false);
      const slot: NearSlot = { key, texture, image, cell: -1, x: 0, y: 0, lastUsed: -1, bakedAt: 0 };
      this.near.push(slot);
      this.statsData.textureBytes += size * size * 4;
      return slot;
    }
    let lru: NearSlot | null = null;
    for (const s of this.near) {
      if (s.lastUsed === this.frame) continue;
      if (!lru || s.lastUsed < lru.lastUsed) lru = s;
    }
    if (lru && lru.cell >= 0) this.nearByCell.delete(lru.cell);
    return lru;
  }
}
