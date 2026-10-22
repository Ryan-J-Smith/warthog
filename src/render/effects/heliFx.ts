import Phaser from 'phaser';
import { ENTITY_STATS } from '../../config';
import type { Entity } from '../../sim/entities';
import type { SimEvent } from '../../sim/events';
import type { WorldView } from '../../sim/world';
import { DEPTH } from '../layers';
import { RAMPS } from './colorRamp';
import { rand, type FxKit } from './fxKit';
import type { WreckFires } from './wreckFires';

const COLOR = {
  aim: 0xff3a2a,
  lockFlash: 0xffffff,
  glow: 0xff4a1e,
  hot: 0xfff0d0,
} as const;
/** The nose (rocket rails) sits this far ahead of the rotor hub. */
const NOSE = 40;
/** The aim line runs this far past the aim point (the rockets keep flying). */
const LINE_OVERRUN = 90;
/** Salvos aimed at friendlies are drawn fainter than ones aimed at you. */
const GROUND_TELEGRAPH_ALPHA = 0.45;
/** Seconds for a shot-down helicopter to hit the ground (matches `HelicopterRenderer`). */
const FALL_TIME = 0.75;
/** Damage smoke below this health fraction (dark smoke and flames below half of it). */
const SMOKE_BELOW = 0.6;

interface PendingCrash {
  at: number;
  x: number;
  y: number;
}

/**
 * Attack-helicopter effects: the salvo telegraph (nose glow + aim line that turns solid and strobes
 * once it locks), launch flashes, rocket bursts, damage smoke, and the kill (airburst, then a
 * ground explosion and burning wreck when it lands).
 */
export class HeliFx {
  private readonly under: Phaser.GameObjects.Graphics;
  private readonly glow: Phaser.GameObjects.Graphics;
  private readonly crashes: PendingCrash[] = [];
  private time = 0;
  private smokeTick = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly kit: FxKit,
    private readonly wrecks: WreckFires,
  ) {
    this.under = scene.add.graphics().setDepth(DEPTH.lowAir + 1);
    this.glow = scene.add.graphics().setDepth(DEPTH.airFx).setBlendMode(Phaser.BlendModes.ADD);
  }

  handleEvent(e: SimEvent): void {
    const kit = this.kit;
    switch (e.type) {
      case 'heliRocketsFired':
        kit.flash('low', e.pos.x, e.pos.y, 34, 0.12, 0xffb070, 0.8);
        break;
      case 'heliRocketExploded':
        if (e.hitPlayer) {
          kit.flash('air', e.pos.x, e.pos.y, 46, 0.12, 0xffd0a0, 0.9);
          kit.fireball('air', e.pos.x, e.pos.y, 10, 5, 0.7);
          kit.sparks('air', e.pos.x, e.pos.y, 10, 80, 260, 0.35, 11);
          kit.shaker.shake(0.006, 200);
        } else {
          kit.explosion(e.pos.x, e.pos.y, 'small', { scale: 0.9, dirt: true, shakeScale: 0.4 });
        }
        break;
      case 'entityDestroyed':
        if (e.kind === 'helicopter') {
          kit.airburst(e.pos.x, e.pos.y, 22, 8);
          kit.debris('air', e.pos.x, e.pos.y, 10, 220, 0x5a2a26, 3.2);
          this.wrecks.streamers(e.pos.x, e.pos.y, 4, 260, 'air');
          kit.shaker.shakeAt(e.pos.x, e.pos.y, 0.008, 300);
          this.crashes.push({ at: this.time + FALL_TIME, x: e.pos.x, y: e.pos.y });
        }
        break;
      default:
        break;
    }
  }

  update(dt: number, view: WorldView): void {
    this.time += dt;
    this.under.clear();
    this.glow.clear();
    const px = 1 / this.scene.cameras.main.zoom;
    this.smokeTick += dt;
    const puff = this.smokeTick >= 0.07;
    if (puff) this.smokeTick = 0;
    for (const e of view.entities) {
      if (!e.alive || e.hidden || !e.heli) continue;
      if (e.heli.phase === 'aiming') this.drawTelegraph(e, px);
      if (puff) this.damageSmoke(e);
    }
    for (let i = this.crashes.length - 1; i >= 0; i--) {
      const crash = this.crashes[i];
      if (!crash || crash.at > this.time) continue;
      this.crashes.splice(i, 1);
      this.kit.explosion(crash.x, crash.y, 'medium', { scale: 1.5, crater: false });
      this.wrecks.start(crash.x, crash.y, 'medium');
    }
  }

  destroy(): void {
    this.under.destroy();
    this.glow.destroy();
    this.crashes.length = 0;
  }

  /** Tracking: dashed line brightening with the charge. Locked: solid, thick, strobing — move now. */
  private drawTelegraph(e: Entity, px: number): void {
    const heli = e.heli;
    const stats = ENTITY_STATS[e.kind].heli;
    if (!heli || !stats) return;
    const locked = heli.phaseTime <= stats.lockTime;
    const progress = 1 - Math.max(0, heli.phaseTime) / stats.aimTime;
    const alpha = heli.targetId === -1 ? 1 : GROUND_TELEGRAPH_ALPHA;
    const angle = Math.atan2(heli.aimPoint.y - e.pos.y, heli.aimPoint.x - e.pos.x);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const nx = e.pos.x + Math.cos(e.heading) * NOSE;
    const ny = e.pos.y + Math.sin(e.heading) * NOSE;
    const reach = Math.min(stats.rocketRange, Math.hypot(heli.aimPoint.x - nx, heli.aimPoint.y - ny) + LINE_OVERRUN);
    const x1 = nx + cos * reach;
    const y1 = ny + sin * reach;
    const g = this.under;
    if (locked) {
      const strobe = Math.floor(this.time * 18) % 2 === 0;
      g.lineStyle(8 * px, 0x000000, 0.55 * alpha);
      g.lineBetween(nx, ny, x1, y1);
      g.lineStyle(4.5 * px, strobe ? COLOR.lockFlash : COLOR.aim, 0.95 * alpha);
      g.lineBetween(nx, ny, x1, y1);
      // The rockets fan out a little: show the spread at the aim point.
      const half = Math.tan((stats.spreadDeg * Math.PI) / 180) * reach + stats.hitRadius;
      const ex = -sin * half;
      const ey = cos * half;
      g.lineStyle(3 * px, strobe ? COLOR.lockFlash : COLOR.aim, 0.8 * alpha);
      g.lineBetween(x1 - ex, y1 - ey, x1 + ex, y1 + ey);
    } else {
      dashed(g, nx, ny, x1, y1, 18 * px, 10 * px, 6.5 * px, 0x000000, 0.5 * alpha);
      dashed(g, nx, ny, x1, y1, 18 * px, 10 * px, 3.5 * px, COLOR.aim, (0.6 + progress * 0.4) * alpha);
    }
    // Nose glow: the rocket pods warming up.
    this.glow.fillStyle(COLOR.glow, (0.3 + progress * 0.5) * alpha);
    this.glow.fillCircle(nx, ny, 9 + progress * 13);
    this.glow.fillStyle(COLOR.hot, (0.25 + progress * 0.6) * alpha);
    this.glow.fillCircle(nx, ny, 3 + progress * 5);
  }

  /** Grey smoke when damaged; dark smoke and flickers of flame when badly hurt. */
  private damageSmoke(e: Entity): void {
    const frac = e.maxHp > 0 ? e.hp / e.maxHp : 1;
    if (frac >= SMOKE_BELOW) return;
    const bad = frac < SMOKE_BELOW / 2;
    const x = e.pos.x - Math.cos(e.heading) * 10;
    const y = e.pos.y - Math.sin(e.heading) * 10;
    // Drawn in the air band so the trail streams over the rotor disc.
    this.kit.smoke('air', x, y, 1, {
      spread: 5,
      speed: 14,
      size0: bad ? 12 : 9,
      size1: bad ? 46 : 32,
      life: bad ? 1.8 : 1.3,
      alpha: bad ? 0.75 : 0.5,
      ramp: bad ? RAMPS.smokeDark : RAMPS.smokeGrey,
    });
    if (bad && Math.random() < 0.5) this.kit.flash('air', x + rand(-4, 4), y + rand(-4, 4), 18, 0.08, 0xff9040, 0.8);
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
