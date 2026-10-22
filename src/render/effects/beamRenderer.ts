import Phaser from 'phaser';
import { ENTITY_STATS } from '../../config';
import type { Entity } from '../../sim/entities';
import type { WorldView } from '../../sim/world';
import { DEPTH } from '../layers';
import { rand, type FxKit } from './fxKit';

const COLOR = {
  aim: 0xff3a2a,
  lockFlash: 0xffffff,
  glow: 0xff3a1e,
  core: 0xff7a40,
  hot: 0xfff2d8,
  shieldSpark: 0x8fe8ff,
  hullSpark: 0xffb050,
} as const;

/**
 * AA lasers: the telegraph (a thin tracking aim line that turns solid and flashes when it stops
 * tracking) and the beam itself (layered additive strokes with a flickering width), plus sparks
 * where the beam meets the aircraft. Readability is the point: you can see who is about to shoot,
 * where, and when to move.
 */
export class BeamRenderer {
  private readonly under: Phaser.GameObjects.Graphics;
  private readonly glow: Phaser.GameObjects.Graphics;
  private sparkTick = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly kit: FxKit,
  ) {
    // Keyline/telegraph under the air layer, glow above it so the beam wraps the aircraft.
    this.under = scene.add.graphics().setDepth(DEPTH.lowAir + 1);
    this.glow = scene.add.graphics().setDepth(DEPTH.airFx).setBlendMode(Phaser.BlendModes.ADD);
  }

  update(dt: number, view: WorldView): void {
    this.under.clear();
    this.glow.clear();
    const zoom = this.scene.cameras.main.zoom;
    const px = 1 / zoom;
    const now = this.scene.time.now / 1000;
    this.sparkTick += dt;
    const spark = this.sparkTick >= 0.05;
    if (spark) this.sparkTick = 0;
    for (const e of view.entities) {
      if (!e.alive || !e.aa || e.hidden) continue;
      if (e.aa.phase === 'aiming') this.drawAim(e, px, now);
      else if (e.aa.phase === 'firing') this.drawBeam(e, view, px, now, spark);
    }
  }

  destroy(): void {
    this.under.destroy();
    this.glow.destroy();
  }

  private drawAim(e: Entity, px: number, now: number): void {
    const aa = e.aa;
    const stats = ENTITY_STATS[e.kind].aa;
    if (!aa || !stats) return;
    const locked = aa.phaseTime <= stats.lockTime;
    const progress = 1 - Math.max(0, aa.phaseTime) / stats.aimTime;
    const x1 = e.pos.x + Math.cos(aa.beamAngle) * aa.range;
    const y1 = e.pos.y + Math.sin(aa.beamAngle) * aa.range;
    const g = this.under;
    if (locked) {
      // Locked: solid, thick, strobing — "move now".
      const strobe = Math.floor(now * 18) % 2 === 0;
      g.lineStyle(7 * px, 0x000000, 0.55);
      g.lineBetween(e.pos.x, e.pos.y, x1, y1);
      g.lineStyle(4 * px, strobe ? COLOR.lockFlash : COLOR.aim, 0.95);
      g.lineBetween(e.pos.x, e.pos.y, x1, y1);
    } else {
      // Tracking: thin dashed line that brightens as the charge builds.
      dashed(g, e.pos.x, e.pos.y, x1, y1, 18 * px, 12 * px, 5 * px, 0x000000, 0.45);
      dashed(g, e.pos.x, e.pos.y, x1, y1, 18 * px, 12 * px, 2.5 * px, COLOR.aim, 0.45 + progress * 0.5);
    }
    // Charge glow at the muzzle.
    this.glow.fillStyle(COLOR.glow, 0.25 + progress * 0.5);
    this.glow.fillCircle(e.pos.x, e.pos.y, 8 + progress * 14);
  }

  private drawBeam(e: Entity, view: WorldView, px: number, now: number, spark: boolean): void {
    const aa = e.aa;
    if (!aa) return;
    const p = view.player;
    const cos = Math.cos(aa.beamAngle);
    const sin = Math.sin(aa.beamAngle);
    // The beam stops at the aircraft when it's on target; otherwise it runs to full range.
    const length = aa.beamOnTarget ? Math.hypot(p.pos.x - e.pos.x, p.pos.y - e.pos.y) : aa.range;
    const x1 = e.pos.x + cos * length;
    const y1 = e.pos.y + sin * length;
    const flicker = 0.85 + Math.sin(now * 60) * 0.1 + rand(-0.05, 0.05);
    const g = this.glow;
    this.under.lineStyle(10 * px + 6, 0x000000, 0.35);
    this.under.lineBetween(e.pos.x, e.pos.y, x1, y1);
    g.lineStyle(30 * flicker, COLOR.glow, 0.22);
    g.lineBetween(e.pos.x, e.pos.y, x1, y1);
    g.lineStyle(12 * flicker, COLOR.core, 0.75);
    g.lineBetween(e.pos.x, e.pos.y, x1, y1);
    g.lineStyle(4, COLOR.hot, 1);
    g.lineBetween(e.pos.x, e.pos.y, x1, y1);
    g.fillStyle(COLOR.hot, 0.9);
    g.fillCircle(e.pos.x, e.pos.y, 10 * flicker);
    if (aa.beamOnTarget) {
      g.fillStyle(p.shield > 0 ? COLOR.shieldSpark : COLOR.hullSpark, 0.8);
      g.fillCircle(x1, y1, 16 * flicker);
    }
    if (spark) {
      if (aa.beamOnTarget) {
        this.kit.sparks('air', x1, y1, 3, 80, 240, 0.25, 10);
      } else {
        // Scorching the ground at the end of the beam.
        this.kit.flash('ground', x1 + rand(-6, 6), y1 + rand(-6, 6), 18, 0.12, 0xffa060, 0.6);
      }
    }
  }
}

function dashed(
  g: Phaser.GameObjects.Graphics,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  dash: number,
  gap: number,
  width: number,
  color: number,
  alpha: number,
): void {
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 1) return;
  const ux = (x1 - x0) / len;
  const uy = (y1 - y0) / len;
  g.lineStyle(width, color, alpha);
  g.beginPath();
  for (let d = 0; d < len; d += dash + gap) {
    const e = Math.min(len, d + dash);
    g.moveTo(x0 + ux * d, y0 + uy * d);
    g.lineTo(x0 + ux * e, y0 + uy * e);
  }
  g.strokePath();
}
