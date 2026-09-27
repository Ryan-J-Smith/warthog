import Phaser from 'phaser';
import { SPRITE_RESOLUTION, type SpriteKey } from '../../assets';
import { PLAYER } from '../../config';
import { distance } from '../../sim/math';
import type { WeaponId } from '../../sim/types';
import type { WorldView } from '../../sim/world';
import { DEPTH, iffAlpha, unitDisplayScale } from '../layers';

const INV_RES = 1 / SPRITE_RESOLUTION;

const RETICLE: Record<WeaponId, SpriteKey> = {
  gun: 'reticleGun',
  rockets: 'reticleRocket',
  maverick: 'reticleGun',
  bombs: 'reticleBomb',
};

const COLORS = {
  reticle: 0x9dff7a,
  onTarget: 0xff4a3a,
  blocked: 0x8a8a8a,
  lockTracking: 0xffd24a,
  locked: 0xff4a3a,
  aa: 0xffa040,
  sam: 0xff3030,
  rearm: 0x5ab0ff,
  defend: 0x5ab0ff,
  attack: 0xffc040,
  iffEnemy: 0xff3b30,
  iffThreat: 0xff8a1e,
  iffFriendly: 0x4aa8ff,
} as const;

/** Kinds that get IFF markers (vehicles, infantry and air defences; not big structures). */
const IFF_KINDS = new Set(['tank', 'truck', 'infantry', 'aaGun', 'mobileAa', 'samSite', 'friendlyTank', 'friendlyInfantry']);

/**
 * World-space HUD: weapon reticle (Xevious-style light-up), bomb CCIP line, Maverick lock
 * brackets, threat rings for spotted air defences, rearm zone, and objective markers.
 * Sizes are divided by camera zoom so they stay constant on screen.
 */
export class WorldUiRenderer {
  private readonly reticle: Phaser.GameObjects.Image;
  private readonly lock: Phaser.GameObjects.Image;
  private readonly rings: Phaser.GameObjects.Graphics;
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly iff: Phaser.GameObjects.Graphics;

  constructor(private readonly scene: Phaser.Scene) {
    this.rings = scene.add.graphics().setDepth(DEPTH.groundFx + 1);
    this.overlay = scene.add.graphics().setDepth(DEPTH.worldUi);
    this.iff = scene.add.graphics().setDepth(DEPTH.worldUi - 1);
    this.reticle = scene.add.image(0, 0, 'reticleGun').setDepth(DEPTH.worldUi + 1);
    this.lock = scene.add.image(0, 0, 'lockBracket').setDepth(DEPTH.worldUi + 1).setVisible(false);
  }

  sync(view: WorldView): void {
    const zoom = this.scene.cameras.main.zoom;
    const px = 1 / zoom;
    this.drawRings(view, px);
    this.drawIff(view, px);
    this.overlay.clear();
    this.drawObjectiveMarkers(view, px);
    this.drawReticle(view, px);
    this.drawLock(view, px);
  }

  destroy(): void {
    this.reticle.destroy();
    this.lock.destroy();
    this.rings.destroy();
    this.overlay.destroy();
    this.iff.destroy();
  }

  private drawReticle(view: WorldView, px: number): void {
    const p = view.player;
    const r = view.reticle;
    const visible = p.alive && r.impact !== null && r.weapon !== 'maverick';
    this.reticle.setVisible(visible);
    if (!visible || !r.impact) return;
    const color = !r.ready ? COLORS.blocked : r.onTarget ? COLORS.onTarget : COLORS.reticle;
    const pulse = r.onTarget ? 1 + Math.sin(this.scene.time.now / 60) * 0.08 : 1;
    this.reticle
      .setTexture(RETICLE[r.weapon])
      .setPosition(r.impact.x, r.impact.y)
      .setScale(INV_RES * px * pulse)
      .setTint(color)
      .setAlpha(r.ready ? 0.95 : 0.5);

    // Bomb fall line from aircraft to CCIP.
    if (r.weapon === 'bombs' && r.ready) {
      this.overlay.lineStyle(2 * px, color, 0.45);
      dashedLine(this.overlay, p.pos.x, p.pos.y, r.impact.x, r.impact.y, 14 * px, 10 * px);
    }
  }

  private drawLock(view: WorldView, px: number): void {
    const p = view.player;
    const target = p.lockTargetId !== null ? view.entities.find((e) => e.id === p.lockTargetId) : undefined;
    const visible = p.alive && p.selectedWeapon === 'maverick' && target !== undefined && target.alive;
    this.lock.setVisible(visible);
    if (!visible || !target) return;
    const locked = p.lockProgress >= 1;
    const squeeze = locked ? 1 : 2.2 - p.lockProgress * 1.2;
    // lockBracket is 64 world units natively; scale it to span the target.
    const diameter = Math.max(target.radius * 2.6, 40 * px) * squeeze;
    this.lock
      .setPosition(target.pos.x, target.pos.y)
      .setScale((diameter / 64) * INV_RES)
      .setRotation(locked ? 0 : this.scene.time.now / 400)
      .setTint(locked ? COLORS.locked : COLORS.lockTracking);
  }

  private drawRings(view: WorldView, px: number): void {
    const g = this.rings;
    g.clear();
    const p = view.player;
    const cam = this.scene.cameras.main.worldView;
    const margin = 1200;

    for (const e of view.entities) {
      if (!e.alive || !e.spotted || e.hidden) continue;
      if (e.pos.x < cam.x - margin || e.pos.x > cam.right + margin || e.pos.y < cam.y - margin || e.pos.y > cam.bottom + margin) continue;
      if (e.sam) {
        const threat = p.band !== 'low';
        const alpha = e.sam.locking ? 0.8 : threat ? 0.45 : 0.14;
        g.lineStyle((e.sam.locking ? 4 : 2.5) * px, COLORS.sam, alpha);
        dashedCircle(g, e.pos.x, e.pos.y, e.sam.range, 48);
      }
      if (e.aa) {
        const threat = p.band !== 'high';
        const alpha = e.aa.engaging ? 0.75 : threat ? 0.4 : 0.12;
        g.lineStyle((e.aa.engaging ? 3.5 : 2) * px, COLORS.aa, alpha);
        dashedCircle(g, e.pos.x, e.pos.y, e.aa.range, 28);
      }
    }

    // Rearm zone around home base, with a progress arc.
    const home = view.entities.find((e) => e.refId === view.level.homeBaseRefId);
    if (home && distance(home.pos, p.pos) < 2200) {
      g.lineStyle(2.5 * px, COLORS.rearm, 0.5);
      dashedCircle(g, home.pos.x, home.pos.y, PLAYER.rearmRadius, 36);
      if (p.rearm > 0) {
        g.lineStyle(8 * px, COLORS.rearm, 0.9);
        g.beginPath();
        g.arc(home.pos.x, home.pos.y, PLAYER.rearmRadius, -Math.PI / 2, -Math.PI / 2 + p.rearm * Math.PI * 2);
        g.strokePath();
      }
    }
  }

  /**
   * IFF markers at constant screen size: red corner brackets on spotted enemies (orange for air
   * defences), blue chevrons over friendlies. Keeps units readable against busy terrain when zoomed out.
   */
  private drawIff(view: WorldView, px: number): void {
    const g = this.iff;
    g.clear();
    const cam = this.scene.cameras.main.worldView;
    const alpha = iffAlpha(view.player.alt);
    const unitScale = unitDisplayScale(this.scene.cameras.main.zoom);
    for (const e of view.entities) {
      if (!e.alive || e.hidden || !IFF_KINDS.has(e.kind)) continue;
      if (e.pos.x < cam.x - 60 || e.pos.x > cam.right + 60 || e.pos.y < cam.y - 60 || e.pos.y > cam.bottom + 60) continue;
      if (e.team === 'friendly') {
        const y = e.pos.y - e.radius * unitScale - 10 * px;
        g.lineStyle(2.5 * px, COLORS.iffFriendly, alpha);
        g.beginPath();
        g.moveTo(e.pos.x - 6 * px, y - 5 * px);
        g.lineTo(e.pos.x, y);
        g.lineTo(e.pos.x + 6 * px, y - 5 * px);
        g.strokePath();
        continue;
      }
      if (!e.spotted) continue;
      const threat = e.aa !== null || e.sam !== null;
      const half = Math.max(e.radius * unitScale * 1.25, 9 * px);
      const arm = Math.max(half * 0.45, 4 * px);
      g.lineStyle(2.2 * px, threat ? COLORS.iffThreat : COLORS.iffEnemy, alpha);
      corners(g, e.pos.x, e.pos.y, half, arm);
      if (threat) {
        // Small warning triangle above air defences.
        const ty = e.pos.y - half - 9 * px;
        g.fillStyle(COLORS.iffThreat, alpha);
        g.fillTriangle(e.pos.x - 5 * px, ty + 4 * px, e.pos.x + 5 * px, ty + 4 * px, e.pos.x, ty - 5 * px);
      }
    }
  }

  private drawObjectiveMarkers(view: WorldView, px: number): void {
    const g = this.overlay;
    const bob = Math.sin(this.scene.time.now / 250) * 6 * px;
    for (const o of view.objectives) {
      if (o.status !== 'active' || !o.marker) continue;
      const color = o.kind === 'defend' ? COLORS.defend : COLORS.attack;
      const x = o.marker.x;
      const y = o.marker.y - 110 * px + bob;
      const s = 14 * px;
      g.fillStyle(color, 0.9);
      g.lineStyle(2 * px, 0x000000, 0.6);
      g.beginPath();
      g.moveTo(x, y - s);
      g.lineTo(x + s, y);
      g.lineTo(x, y + s);
      g.lineTo(x - s, y);
      g.closePath();
      g.fillPath();
      g.strokePath();
    }
  }
}

/**
 * Dashed circle drawn with straight line segments. (Phaser's WebGL `arc` tessellates ~100 points
 * per call regardless of length, which is expensive for dozens of dashes every frame.)
 */
function dashedCircle(g: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, dashes: number): void {
  const step = (Math.PI * 2) / dashes;
  const subdivisions = 3;
  for (let i = 0; i < dashes; i++) {
    const a0 = i * step;
    const span = step * 0.6;
    let px = x + Math.cos(a0) * radius;
    let py = y + Math.sin(a0) * radius;
    for (let s = 1; s <= subdivisions; s++) {
      const a = a0 + (span * s) / subdivisions;
      const nx = x + Math.cos(a) * radius;
      const ny = y + Math.sin(a) * radius;
      g.lineBetween(px, py, nx, ny);
      px = nx;
      py = ny;
    }
  }
}

/** Four corner brackets around a square of half-size `half` centred on (x, y). */
function corners(g: Phaser.GameObjects.Graphics, x: number, y: number, half: number, arm: number): void {
  const l = x - half;
  const r = x + half;
  const t = y - half;
  const b = y + half;
  g.lineBetween(l, t, l + arm, t);
  g.lineBetween(l, t, l, t + arm);
  g.lineBetween(r, t, r - arm, t);
  g.lineBetween(r, t, r, t + arm);
  g.lineBetween(l, b, l + arm, b);
  g.lineBetween(l, b, l, b - arm);
  g.lineBetween(r, b, r - arm, b);
  g.lineBetween(r, b, r, b - arm);
}

function dashedLine(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, dash: number, gap: number): void {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 1) return;
  const dx = (x2 - x1) / len;
  const dy = (y2 - y1) / len;
  for (let d = 0; d < len; d += dash + gap) {
    const e = Math.min(len, d + dash);
    g.lineBetween(x1 + dx * d, y1 + dy * d, x1 + dx * e, y1 + dy * e);
  }
}
