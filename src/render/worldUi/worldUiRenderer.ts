import Phaser from 'phaser';
import { SPRITE_RESOLUTION, type SpriteKey } from '../../assets';
import { PLAYER } from '../../config';
import { clamp, distance, type Vec2 } from '../../sim/math';
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
  strike: 0xff2a1a,
  strikeFlash: 0xffffff,
} as const;

/**
 * Dark keyline under every overlay stroke (extra screen px of width, and opacity relative to the
 * stroke), so thin coloured lines stay legible on light desert and busy terrain, like the
 * outlined reticle sprites.
 */
const KEYLINE = { color: 0x000000, width: 2.5, alpha: 0.75 } as const;

/** Danger-zone look: `idle` = your band is out of its reach, `threat` = in reach, `active` = it's shooting at / locking you. */
const ZONE_STYLE = {
  idle: { fill: 0, edge: 0.2, width: 2 },
  threat: { fill: 0.09, edge: 0.75, width: 3 },
  active: { fill: 0.16, edge: 1, width: 4 },
} as const;
type ZoneState = keyof typeof ZONE_STYLE;

/** Kinds that get IFF markers (vehicles, infantry and air defences; not big structures). */
const IFF_KINDS = new Set(['tank', 'truck', 'infantry', 'aaGun', 'mobileAa', 'samSite', 'helicopter', 'mlrs', 'friendlyTank', 'friendlyInfantry']);

/** MLRS rings aimed at friendlies are drawn fainter than ones aimed at you (they still hurt you). */
const STRIKE_GROUND_ALPHA = 0.6;
/** The last this-many seconds of a ring's countdown strobe white: it is about to land. */
const STRIKE_FLASH_TIME = 0.3;

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
    this.overlay.clear();
    this.drawRings(view, px);
    this.drawStrikes(view, px);
    this.drawIff(view, px);
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
      const g = this.overlay;
      const impact = r.impact;
      keylined(g, px, 2, color, 0.6, (ext) => dashedLine(g, p.pos.x, p.pos.y, impact.x, impact.y, 14 * px, 10 * px, 0, ext));
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
    const margin = 1400;
    const t = this.scene.time.now / 1000;

    for (const e of view.entities) {
      if (!e.alive || !e.spotted || e.hidden) continue;
      if (e.pos.x < cam.x - margin || e.pos.x > cam.right + margin || e.pos.y < cam.y - margin || e.pos.y > cam.bottom + margin) continue;
      if (e.sam) {
        const state: ZoneState = e.sam.locking ? 'active' : p.band !== 'low' ? 'threat' : 'idle';
        drawZone(g, e.pos, e.sam.range, COLORS.sam, state, px, t, distance(e.pos, p.pos) <= e.sam.range);
        if (e.sam.locking && p.alive) this.drawTether(e.pos, e.radius, p.pos, COLORS.sam, 0.45 + 0.5 * e.sam.lock, px, t);
      }
      if (e.aa) {
        const state: ZoneState = e.aa.engaging ? 'active' : p.band !== 'high' ? 'threat' : 'idle';
        drawZone(g, e.pos, e.aa.range, COLORS.aa, state, px, t, distance(e.pos, p.pos) <= e.aa.range);
      }
    }

    // Rearm zones (home base + forward points earned), with a progress arc on the one in use.
    for (const at of view.rearmPoints()) {
      if (distance(at, p.pos) >= 2200) continue;
      const dashes = dashCount(PLAYER.rearmRadius, px);
      keylined(g, px, 2.5, COLORS.rearm, 0.6, (ext) => dashedCircle(g, at.x, at.y, PLAYER.rearmRadius, dashes, 0, ext));
      if (p.rearm > 0 && distance(at, p.pos) <= PLAYER.rearmRadius) {
        g.lineStyle(8 * px, COLORS.rearm, 0.9);
        g.beginPath();
        g.arc(at.x, at.y, PLAYER.rearmRadius, -Math.PI / 2, -Math.PI / 2 + p.rearm * Math.PI * 2);
        g.strokePath();
      }
    }
  }

  /**
   * MLRS impact rings: exactly the blast radius, a red fill that grows from the centre to the edge as
   * the countdown runs out (it lands when the fill reaches the ring), a pulsing keylined edge that
   * quickens and strobes white just before impact, and a faint line back to the launcher.
   */
  private drawStrikes(view: WorldView, px: number): void {
    const g = this.rings;
    const now = view.time;
    for (const e of view.entities) {
      const strikes = e.mlrs?.strikes;
      if (!strikes || strikes.length === 0) continue;
      const first = strikes[0];
      if (first && first.atPlayer && e.alive && now < first.launchAt) {
        // Before the first rocket leaves: show who is about to fire.
        const t = this.scene.time.now / 1000;
        this.drawTether(e.pos, e.radius, centroid(strikes.map((s) => s.pos)), COLORS.strike, 0.7, px, t);
      }
      for (const s of strikes) {
        if (now >= s.impactAt) continue;
        const span = Math.max(1e-3, s.impactAt - s.shownAt);
        const progress = clamp((now - s.shownAt) / span, 0, 1);
        const left = s.impactAt - now;
        const alpha = s.atPlayer ? 1 : STRIKE_GROUND_ALPHA;
        // Danger area, then the countdown fill.
        g.fillStyle(COLORS.strike, 0.12 * alpha);
        g.fillCircle(s.pos.x, s.pos.y, s.radius);
        g.fillStyle(COLORS.strike, (0.2 + 0.25 * progress) * alpha);
        g.fillCircle(s.pos.x, s.pos.y, s.radius * progress);
        const flash = left <= STRIKE_FLASH_TIME && Math.floor(left * 20) % 2 === 0;
        const pulse = 0.5 + 0.5 * Math.sin(now * (8 + progress * 22));
        const edge = flash ? COLORS.strikeFlash : COLORS.strike;
        const width = 3 + progress * 2 + pulse * 1.5;
        keylined(g, px, width, edge, (0.85 + 0.15 * pulse) * alpha, () => g.strokeCircle(s.pos.x, s.pos.y, s.radius));
        // Bullseye tick.
        const tick = 7 * px;
        keylined(g, px, 2, edge, 0.8 * alpha, (ext) => {
          segment(g, s.pos.x - tick, s.pos.y, s.pos.x + tick, s.pos.y, ext);
          segment(g, s.pos.x, s.pos.y - tick, s.pos.x, s.pos.y + tick, ext);
        });
      }
    }
  }

  /**
   * A marching dashed line from an air defence to the aircraft while it shoots at or locks you, so
   * it's obvious who is firing and from where. Trimmed so it doesn't cover either sprite.
   */
  private drawTether(from: Vec2, fromRadius: number, to: Vec2, color: number, alpha: number, px: number, t: number): void {
    const len = distance(from, to);
    const start = fromRadius + 6 * px;
    const end = len - PLAYER_CLEARANCE;
    if (end - start < 20 * px) return;
    const dx = (to.x - from.x) / len;
    const dy = (to.y - from.y) / len;
    const x1 = from.x + dx * start;
    const y1 = from.y + dy * start;
    const x2 = from.x + dx * end;
    const y2 = from.y + dy * end;
    const g = this.overlay;
    const offset = t * 90 * px;
    keylined(g, px, 2, color, alpha, (ext) => dashedLine(g, x1, y1, x2, y2, 12 * px, 9 * px, offset, ext));
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
        const x = e.pos.x;
        const y = e.pos.y - e.radius * unitScale - 10 * px;
        keylined(g, px, 3, COLORS.iffFriendly, alpha, (ext) => {
          segment(g, x - 7 * px, y - 6 * px, x, y, ext);
          segment(g, x, y, x + 7 * px, y - 6 * px, ext);
        });
        continue;
      }
      if (!e.spotted) continue;
      const threat = e.aa !== null || e.sam !== null || e.heli !== null || e.mlrs !== null;
      const half = Math.max(e.radius * unitScale * 1.25, 9 * px);
      const arm = Math.max(half * 0.45, 4 * px);
      const x = e.pos.x;
      const y = e.pos.y;
      keylined(g, px, threat ? 3.5 : 3, threat ? COLORS.iffThreat : COLORS.iffEnemy, alpha, (ext) => corners(g, x, y, half, arm, ext));
      if (threat) {
        // Warning triangle above air defences.
        const ty = y - half - 11 * px;
        g.fillStyle(COLORS.iffThreat, alpha);
        g.fillTriangle(x - 7 * px, ty + 5 * px, x + 7 * px, ty + 5 * px, x, ty - 7 * px);
        g.lineStyle(1.5 * px, KEYLINE.color, alpha * KEYLINE.alpha);
        g.strokeTriangle(x - 7 * px, ty + 5 * px, x + 7 * px, ty + 5 * px, x, ty - 7 * px);
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

function centroid(points: readonly Vec2[]): Vec2 {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  const n = Math.max(1, points.length);
  return { x: x / n, y: y / n };
}

/** Keep tethers this far (world units) from the aircraft centre so they don't draw over the sprite. */
const PLAYER_CLEARANCE = 70;

/** Points reused by `drawZone` fills (one zone at a time). */
const ZONE_POINTS: Vec2[] = Array.from({ length: 64 }, () => ({ x: 0, y: 0 }));

/**
 * Stroke `draw` twice: a dark keyline underneath, then the colour on top. `draw` receives how far
 * (world units) to extend segment ends so the keyline also caps them.
 */
function keylined(
  g: Phaser.GameObjects.Graphics,
  px: number,
  width: number,
  color: number,
  alpha: number,
  draw: (extend: number) => void,
): void {
  g.lineStyle((width + KEYLINE.width) * px, KEYLINE.color, alpha * KEYLINE.alpha);
  draw((KEYLINE.width / 2) * px);
  g.lineStyle(width * px, color, alpha);
  draw(0);
}

/**
 * An air-defence danger zone: keylined marching dashed edge, plus a tinted fill while you're inside
 * it and it can reach you (only inside, so overlapping zones don't wash the map orange).
 */
function drawZone(
  g: Phaser.GameObjects.Graphics,
  c: Vec2,
  radius: number,
  color: number,
  state: ZoneState,
  px: number,
  t: number,
  playerInside: boolean,
): void {
  const style = ZONE_STYLE[state];
  if (style.fill > 0 && playerInside) {
    const n = ZONE_POINTS.length;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const pt = ZONE_POINTS[i];
      if (!pt) continue;
      pt.x = c.x + Math.cos(a) * radius;
      pt.y = c.y + Math.sin(a) * radius;
    }
    g.fillStyle(color, style.fill);
    g.fillPoints(ZONE_POINTS, true);
  }
  // Dashes march around the edge (faster while it's shooting at you).
  const speed = (state === 'active' ? 48 : 20) * px;
  const phase = (t * speed) / radius;
  const dashes = dashCount(radius, px);
  keylined(g, px, style.width, color, style.edge, (ext) => dashedCircle(g, c.x, c.y, radius, dashes, phase, ext));
}

/** About one dash per 36 screen px of circumference. */
function dashCount(radius: number, px: number): number {
  return clamp(Math.round((Math.PI * 2 * radius) / (36 * px)), 24, 140);
}

/**
 * Dashed circle drawn with straight line segments. (Phaser's WebGL `arc` tessellates ~100 points
 * per call regardless of length, which is expensive for dozens of dashes every frame.) `phase`
 * rotates the dashes (radians); `extend` lengthens each dash at both ends (world units).
 */
function dashedCircle(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  radius: number,
  dashes: number,
  phase = 0,
  extend = 0,
): void {
  const step = (Math.PI * 2) / dashes;
  const pad = extend / radius;
  const span = step * 0.6 + pad * 2;
  // Short dashes are straight enough as one segment.
  const subdivisions = Math.max(1, Math.ceil(span / 0.06));
  for (let i = 0; i < dashes; i++) {
    const a0 = phase + i * step - pad;
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

/** Four corner brackets around a square of half-size `half` centred on (x, y); `extend` lengthens each arm at both ends. */
function corners(g: Phaser.GameObjects.Graphics, x: number, y: number, half: number, arm: number, extend = 0): void {
  const l = x - half;
  const r = x + half;
  const t = y - half;
  const b = y + half;
  const e = extend;
  g.lineBetween(l - e, t, l + arm + e, t);
  g.lineBetween(l, t - e, l, t + arm + e);
  g.lineBetween(r + e, t, r - arm - e, t);
  g.lineBetween(r, t - e, r, t + arm + e);
  g.lineBetween(l - e, b, l + arm + e, b);
  g.lineBetween(l, b + e, l, b - arm - e);
  g.lineBetween(r + e, b, r - arm - e, b);
  g.lineBetween(r, b + e, r, b - arm - e);
}

/** A line segment lengthened by `extend` at both ends. */
function segment(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, extend: number): void {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 1e-6) return;
  const ex = ((x2 - x1) / len) * extend;
  const ey = ((y2 - y1) / len) * extend;
  g.lineBetween(x1 - ex, y1 - ey, x2 + ex, y2 + ey);
}

/** Dashed line; `offset` slides the dash pattern along the line, `extend` lengthens each dash at both ends. */
function dashedLine(
  g: Phaser.GameObjects.Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  dash: number,
  gap: number,
  offset = 0,
  extend = 0,
): void {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 1) return;
  const dx = (x2 - x1) / len;
  const dy = (y2 - y1) / len;
  const period = dash + gap;
  for (let d = (offset % period) - period; d < len; d += period) {
    const s = Math.max(0, d);
    const e = Math.min(len, d + dash);
    if (e <= s) continue;
    g.lineBetween(x1 + dx * (s - extend), y1 + dy * (s - extend), x1 + dx * (e + extend), y1 + dy * (e + extend));
  }
}
