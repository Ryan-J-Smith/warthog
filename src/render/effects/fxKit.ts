import type Phaser from 'phaser';
import type { SpriteKey } from '../../assets';
import type { ExplosionSize } from '../../sim/types';
import { DEPTH } from '../layers';
import { CameraShaker } from './cameraShaker';
import { RAMPS } from './colorRamp';
import type { ColorRamp } from './colorRamp';
import { DecalLayer } from './decalLayer';
import { FX_TEXTURES } from './fxTextures';
import { BLEND, ParticleLayer } from './particleLayer';
import type { Particle } from './particleLayer';

const TEX = {
  soft: 'particleSoft' satisfies SpriteKey,
  smoke: 'particleSmoke' satisfies SpriteKey,
  spark: 'particleSpark' satisfies SpriteKey,
  debris: 'particleDebris' satisfies SpriteKey,
  ring: FX_TEXTURES.ring,
  tracer: FX_TEXTURES.tracer,
  flash: FX_TEXTURES.flash,
} as const;

export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Tuning per explosion size. `r` is the nominal blast radius in world units. */
export const EXPLOSION_TUNING: Record<ExplosionSize, {
  r: number;
  fire: number;
  smoke: number;
  sparks: number;
  debris: number;
  dust: number;
  shake: number;
  shakeMs: number;
  scorch: number;
}> = {
  small: { r: 14, fire: 7, smoke: 5, sparks: 10, debris: 6, dust: 0, shake: 0.0035, shakeMs: 170, scorch: 38 },
  medium: { r: 24, fire: 12, smoke: 9, sparks: 18, debris: 10, dust: 8, shake: 0.0065, shakeMs: 260, scorch: 62 },
  large: { r: 40, fire: 18, smoke: 14, sparks: 28, debris: 16, dust: 16, shake: 0.012, shakeMs: 420, scorch: 100 },
  huge: { r: 68, fire: 28, smoke: 22, sparks: 44, debris: 26, dust: 26, shake: 0.02, shakeMs: 700, scorch: 160 },
};

/** Named particle layers, ordered for draw order inside each depth band. */
export interface FxLayers {
  pocks: ParticleLayer;
  groundUnder: ParticleLayer;
  groundMid: ParticleLayer;
  groundAdd: ParticleLayer;
  groundOver: ParticleLayer;
  lowUnder: ParticleLayer;
  lowAdd: ParticleLayer;
  airUnder: ParticleLayer;
  airMid: ParticleLayer;
  airAdd: ParticleLayer;
  airOver: ParticleLayer;
}

/** Which altitude band an effect lives in. */
export type FxPlane = 'ground' | 'low' | 'air';

/**
 * The effect recipe book: owns the particle layers, decals and camera shake, and knows how to
 * compose explosions, impacts, tracers and so on out of pooled particles.
 */
export class FxKit {
  readonly layers: FxLayers;
  readonly decals: DecalLayer;
  readonly shaker: CameraShaker;
  /** Global wind (world units / s) that carries smoke. */
  windX = 14;
  windY = -8;

  constructor(scene: Phaser.Scene) {
    this.layers = {
      pocks: new ParticleLayer(scene, DEPTH.decals + 0.3, BLEND.normal, 460),
      groundUnder: new ParticleLayer(scene, DEPTH.groundFx, BLEND.normal, 1100),
      groundMid: new ParticleLayer(scene, DEPTH.groundFx + 0.1, BLEND.normal, 360),
      groundAdd: new ParticleLayer(scene, DEPTH.groundFx + 0.2, BLEND.add, 700),
      groundOver: new ParticleLayer(scene, DEPTH.groundFx + 0.4, BLEND.normal, 260),
      lowUnder: new ParticleLayer(scene, DEPTH.lowAir, BLEND.normal, 800),
      lowAdd: new ParticleLayer(scene, DEPTH.lowAir + 0.2, BLEND.add, 360),
      airUnder: new ParticleLayer(scene, DEPTH.airFx, BLEND.normal, 420),
      airMid: new ParticleLayer(scene, DEPTH.airFx + 0.1, BLEND.normal, 200),
      airAdd: new ParticleLayer(scene, DEPTH.airFx + 0.2, BLEND.add, 420),
      airOver: new ParticleLayer(scene, DEPTH.airFx + 0.4, BLEND.normal, 120),
    };
    this.decals = new DecalLayer(scene, DEPTH.decals, 90);
    this.shaker = new CameraShaker(scene);
  }

  update(dt: number): void {
    for (const layer of Object.values(this.layers)) layer.update(dt, this.windX, this.windY);
    this.decals.update(dt);
  }

  /** Total live particles (debug overlay). */
  get liveCount(): number {
    let n = 0;
    for (const layer of Object.values(this.layers)) n += layer.count;
    return n;
  }

  destroy(): void {
    for (const layer of Object.values(this.layers)) layer.destroy();
    this.decals.destroy();
  }

  private under(plane: FxPlane): ParticleLayer {
    return plane === 'ground' ? this.layers.groundUnder : plane === 'low' ? this.layers.lowUnder : this.layers.airUnder;
  }

  private add(plane: FxPlane): ParticleLayer {
    return plane === 'ground' ? this.layers.groundAdd : plane === 'low' ? this.layers.lowAdd : this.layers.airAdd;
  }

  private over(plane: FxPlane): ParticleLayer {
    return plane === 'air' ? this.layers.airOver : this.layers.groundOver;
  }

  // ---------------------------------------------------------------------------
  // Building blocks
  // ---------------------------------------------------------------------------

  /** Additive glow flash. */
  flash(plane: FxPlane, x: number, y: number, size: number, life: number, tint = 0xfff0c8, alpha = 1): Particle | null {
    const p = this.add(plane).spawn(TEX.soft, x, y);
    if (!p) return null;
    p.life = life;
    p.size0 = size * 0.7;
    p.size1 = size;
    p.grow = 3;
    p.alpha = alpha;
    p.fadeStart = 0.15;
    p.tint = tint;
    return p;
  }

  /**
   * Fireball: opaque orange billows that char into smoke (normal blend) plus a smaller,
   * short-lived additive hot core so it glows without blowing out to white.
   */
  fireball(plane: FxPlane, x: number, y: number, r: number, count: number, lifeScale = 1): void {
    const body = plane === 'air' ? this.layers.airMid : this.layers.groundMid;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * r * 0.4;
      const p = body.spawn(TEX.smoke, x + Math.cos(a) * d, y + Math.sin(a) * d);
      if (!p) break;
      const speed = r * rand(1.0, 3.2);
      p.vx = Math.cos(a) * speed;
      p.vy = Math.sin(a) * speed;
      p.drag = 3;
      p.wind = 0.4;
      p.life = rand(0.8, 1.35) * lifeScale;
      p.size0 = r * rand(0.5, 0.85);
      p.size1 = r * rand(1.5, 2.2);
      p.grow = 2.6;
      p.alpha = 0.95;
      p.fadeStart = 0.45;
      p.rotation = Math.random() * Math.PI * 2;
      p.spin = rand(-1, 1);
      p.ramp = RAMPS.fireBody;
      p.rampStart = rand(0, 0.15);
    }
    const core = this.add(plane);
    const cores = Math.max(2, Math.round(count * 0.6));
    for (let i = 0; i < cores; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * r * 0.3;
      const p = core.spawn(TEX.smoke, x + Math.cos(a) * d, y + Math.sin(a) * d);
      if (!p) return;
      const speed = r * rand(0.8, 2.6);
      p.vx = Math.cos(a) * speed;
      p.vy = Math.sin(a) * speed;
      p.drag = 3.5;
      p.wind = 0.3;
      p.life = rand(0.3, 0.6) * lifeScale;
      p.size0 = r * rand(0.45, 0.8);
      p.size1 = r * rand(1.1, 1.6);
      p.grow = 2.5;
      p.alpha = 0.75;
      p.fadeStart = 0.25;
      p.rotation = Math.random() * Math.PI * 2;
      p.spin = rand(-1.5, 1.5);
      p.ramp = RAMPS.fire;
      p.rampStart = i < 2 ? 0 : rand(0.05, 0.2);
    }
  }

  /** Smoke puffs (normal blend). */
  smoke(
    plane: FxPlane,
    x: number,
    y: number,
    count: number,
    opts: { spread: number; speed: number; size0: number; size1: number; life: number; alpha: number; ramp: ColorRamp; delay?: number; wind?: number },
  ): void {
    const layer = this.under(plane);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * opts.spread;
      const p = layer.spawn(TEX.smoke, x + Math.cos(a) * d, y + Math.sin(a) * d);
      if (!p) return;
      const speed = opts.speed * rand(0.4, 1.2);
      p.vx = Math.cos(a) * speed;
      p.vy = Math.sin(a) * speed;
      p.drag = 1.4;
      p.wind = opts.wind ?? 1;
      p.life = opts.life * rand(0.75, 1.25);
      p.delay = (opts.delay ?? 0) * Math.random();
      p.size0 = opts.size0 * rand(0.8, 1.2);
      p.size1 = opts.size1 * rand(0.8, 1.25);
      p.grow = 2;
      p.alpha = opts.alpha * rand(0.8, 1);
      p.fadeIn = 0.12;
      p.fadeStart = 0.3;
      p.rotation = Math.random() * Math.PI * 2;
      p.spin = rand(-0.4, 0.4);
      p.ramp = opts.ramp;
    }
  }

  /** Fast additive sparks that streak along their velocity. */
  sparks(plane: FxPlane, x: number, y: number, count: number, speedMin: number, speedMax: number, life: number, length = 12): void {
    const layer = this.add(plane);
    for (let i = 0; i < count; i++) {
      const p = layer.spawn(TEX.spark, x, y);
      if (!p) return;
      const a = Math.random() * Math.PI * 2;
      const speed = rand(speedMin, speedMax);
      p.vx = Math.cos(a) * speed;
      p.vy = Math.sin(a) * speed;
      p.drag = 2.4;
      p.life = life * rand(0.5, 1.2);
      p.size0 = length * rand(0.8, 1.3);
      p.size1 = length * 0.3;
      p.grow = 1;
      p.fadeStart = 0.5;
      p.align = true;
      p.ramp = RAMPS.spark;
    }
  }

  /** Chunks thrown outward that arc up and fall back (scale bounce). */
  debris(plane: FxPlane, x: number, y: number, count: number, speed: number, tint: number, size = 5): void {
    const layer = this.over(plane);
    for (let i = 0; i < count; i++) {
      const p = layer.spawn(TEX.debris, x, y);
      if (!p) return;
      const a = Math.random() * Math.PI * 2;
      const s = speed * rand(0.35, 1);
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.drag = 2.2;
      p.life = rand(0.6, 1.3);
      p.size0 = size * rand(0.6, 1.3);
      p.size1 = p.size0;
      p.arc = rand(0.6, 1.3);
      p.fadeStart = 0.75;
      p.rotation = Math.random() * Math.PI * 2;
      p.spin = rand(-9, 9);
      p.tint = tint;
    }
  }

  /** Expanding ring (shockwave / ping). */
  ring(plane: FxPlane, x: number, y: number, size0: number, size1: number, life: number, tint: number, alpha: number, additive = false, delay = 0): void {
    const layer = additive ? this.add(plane) : this.under(plane);
    const p = layer.spawn(TEX.ring, x, y);
    if (!p) return;
    p.life = life;
    p.delay = delay;
    p.size0 = size0;
    p.size1 = size1;
    p.grow = 3;
    p.alpha = alpha;
    p.fadeStart = 0;
    p.tint = tint;
  }

  /** Dust thrown outward in a ring hugging the ground. */
  dustRing(x: number, y: number, r: number, count: number): void {
    const layer = this.layers.groundUnder;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rand(-0.2, 0.2);
      const p = layer.spawn(TEX.smoke, x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5);
      if (!p) return;
      const speed = r * rand(3, 5);
      p.vx = Math.cos(a) * speed;
      p.vy = Math.sin(a) * speed;
      p.drag = 3.4;
      p.wind = 0.8;
      p.life = rand(1.2, 2.2);
      p.size0 = r * 0.5;
      p.size1 = r * rand(1.3, 2);
      p.alpha = 0.55;
      p.fadeIn = 0.05;
      p.fadeStart = 0.25;
      p.rotation = Math.random() * Math.PI * 2;
      p.spin = rand(-0.5, 0.5);
      p.ramp = RAMPS.dust;
    }
  }

  /** A streak travelling from (x0, y0) to (x1, y1) over `duration` seconds. */
  streak(plane: FxPlane, x0: number, y0: number, x1: number, y1: number, duration: number, length: number, tint: number, alpha: number, delay = 0): void {
    const p = this.add(plane).spawn(TEX.tracer, x0, y0);
    if (!p) return;
    p.vx = (x1 - x0) / duration;
    p.vy = (y1 - y0) / duration;
    p.life = duration;
    p.delay = delay;
    p.size0 = length;
    p.size1 = length;
    p.alpha = alpha;
    p.fadeStart = 0.85;
    p.align = true;
    p.tint = tint;
  }

  /** Star-burst muzzle flash pointing along `heading`. */
  muzzleFlash(plane: FxPlane, x: number, y: number, heading: number, size: number, tint = 0xffe6a0, life = 0.05): void {
    const p = this.add(plane).spawn(TEX.flash, x, y);
    if (!p) return;
    p.life = life;
    p.size0 = size * rand(0.8, 1.2);
    p.size1 = p.size0 * 1.1;
    p.rotation = heading + rand(-0.15, 0.15);
    p.fadeStart = 0.3;
    p.tint = tint;
  }

  // ---------------------------------------------------------------------------
  // Composite effects
  // ---------------------------------------------------------------------------

  /** Ground explosion (fire, smoke, sparks, debris, shockwave, scorch, shake). */
  explosion(
    x: number,
    y: number,
    size: ExplosionSize,
    opts: { scale?: number; scorch?: boolean; crater?: boolean; shake?: boolean; dirt?: boolean } = {},
  ): void {
    const T = EXPLOSION_TUNING[size];
    const k = opts.scale ?? 1;
    const r = T.r * k;
    // Light: a wide warm glow on the terrain + a hot core.
    this.flash('ground', x, y, r * 9, 0.34, 0xffb86a, 0.42);
    this.flash('ground', x, y, r * 2.6, 0.12, 0xfff2d0, 0.95);
    this.muzzleFlash('ground', x, y, Math.random() * Math.PI * 2, r * 3.4, 0xffe2a8, 0.09);
    if (T.dust > 0) this.dustRing(x, y, r, Math.round(T.dust * k));
    this.fireball('ground', x, y, r, Math.round(T.fire * Math.sqrt(k)));
    this.smoke('ground', x, y, Math.round(T.smoke * Math.sqrt(k)), {
      spread: r * 0.5,
      speed: r * 1.1,
      size0: r * 0.8,
      size1: r * 2.8,
      life: 2.2 + r / 40,
      alpha: opts.dirt ? 0.62 : 0.72,
      ramp: opts.dirt ? RAMPS.dirt : RAMPS.smokeDark,
      delay: 0.25,
    });
    this.sparks('ground', x, y, Math.round(T.sparks * Math.sqrt(k)), r * 4, r * 11, 0.7, 10 + r * 0.15);
    this.debris('ground', x, y, Math.round(T.debris * 0.6 * Math.sqrt(k)), r * 7, opts.dirt ? 0x5a4a36 : 0x3b3128, 2.2 + r * 0.035);
    this.ring('ground', x, y, r * 0.6, r * 5.2, 0.45 + r / 200, 0xfff2da, 0.55);
    if (opts.crater) this.decals.add('crater', x, y, r * 1.9, 0.95, 0.2);
    if (opts.scorch ?? true) this.decals.add('scorch', x, y, T.scorch * k, 0.85, 0.3);
    if (opts.shake ?? true) this.shaker.shakeAt(x, y, T.shake * Math.min(1.6, k), T.shakeMs);
  }

  /** Airburst (SAM detonation, aircraft kill): flash, fireball, black flak smoke, fragments. */
  airburst(x: number, y: number, r: number, flakPuffs: number): void {
    this.flash('air', x, y, r * 7, 0.22, 0xffd9a0, 0.7);
    this.flash('air', x, y, r * 2.6, 0.1, 0xffffff, 1);
    this.fireball('air', x, y, r * 0.8, 8, 0.8);
    this.smoke('air', x, y, flakPuffs, { spread: r * 0.5, speed: r * 1.4, size0: r * 0.8, size1: r * 2.6, life: 2.2, alpha: 0.85, ramp: RAMPS.flak, delay: 0.08, wind: 1 });
    this.sparks('air', x, y, 18, r * 5, r * 12, 0.55, 12);
    this.ring('air', x, y, r * 0.5, r * 4, 0.3, 0xffffff, 0.35, true);
  }

  /** One GAU-8 round landing. Cheap: ~4–7 particles. */
  gunImpact(x: number, y: number, hit: boolean, armored: boolean): void {
    this.flash('ground', x, y, armored ? 18 : 12, armored ? 0.08 : 0.06, armored ? 0xfff6d0 : 0xffd890, 0.95);
    const layer = this.layers.groundUnder;
    const puffs = armored ? 1 : 2;
    for (let i = 0; i < puffs; i++) {
      const p = layer.spawn(TEX.smoke, x + rand(-3, 3), y + rand(-3, 3));
      if (!p) break;
      const a = Math.random() * Math.PI * 2;
      const s = rand(10, 45);
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.drag = 2.5;
      p.wind = 0.6;
      p.life = rand(0.7, 1.2);
      p.size0 = rand(5, 9);
      p.size1 = rand(20, 34);
      p.alpha = 0.7;
      p.fadeIn = 0.04;
      p.fadeStart = 0.2;
      p.rotation = Math.random() * 6.28;
      p.ramp = hit && !armored ? RAMPS.smokeDark : RAMPS.dust;
    }
    if (armored) this.sparks('ground', x, y, 5, 70, 230, 0.32, 10);
    else if (Math.random() < 0.5) {
      // Dirt spurt: a short streak of soil kicked up.
      const p = this.layers.groundOver.spawn(TEX.spark, x, y);
      if (p) {
        const a = Math.random() * Math.PI * 2;
        p.vx = Math.cos(a) * rand(60, 120);
        p.vy = Math.sin(a) * rand(60, 120);
        p.drag = 4;
        p.life = rand(0.25, 0.4);
        p.size0 = rand(8, 12);
        p.size1 = 4;
        p.grow = 1;
        p.align = true;
        p.alpha = 0.8;
        p.fadeStart = 0.5;
        p.tint = 0x5a4a32;
      }
    }
    // Pock mark that lingers a few seconds.
    const pock = this.layers.pocks.spawn(TEX.soft, x + rand(-2, 2), y + rand(-2, 2));
    if (pock) {
      pock.life = 7;
      pock.size0 = rand(6, 9);
      pock.size1 = pock.size0;
      pock.alpha = 0.55;
      pock.fadeStart = 0.55;
      pock.tint = 0x241c12;
    }
  }

  /** Gun smoke puff left behind at the muzzle. */
  gunSmoke(x: number, y: number): void {
    const p = this.layers.lowUnder.spawn(TEX.smoke, x + rand(-2, 2), y + rand(-2, 2));
    if (!p) return;
    p.vx = rand(-10, 10);
    p.vy = rand(-10, 10);
    p.drag = 1.5;
    p.wind = 1;
    p.life = rand(0.9, 1.4);
    p.size0 = rand(5, 8);
    p.size1 = rand(22, 32);
    p.alpha = 0.32;
    p.fadeIn = 0.05;
    p.fadeStart = 0.2;
    p.rotation = Math.random() * 6.28;
    p.ramp = RAMPS.smokeGrey;
  }

  /** Cyan shimmer + ping rings when a hidden cache is revealed. */
  revealPing(x: number, y: number): void {
    this.ring('ground', x, y, 8, 120, 0.9, 0x8ff0ff, 0.9, true);
    this.ring('ground', x, y, 8, 80, 0.8, 0xffffff, 0.7, true, 0.18);
    this.flash('ground', x, y, 60, 0.4, 0x9ff4ff, 0.7);
    const layer = this.layers.groundAdd;
    for (let i = 0; i < 10; i++) {
      const p = layer.spawn(TEX.soft, x, y);
      if (!p) break;
      const a = (i / 10) * Math.PI * 2;
      p.vx = Math.cos(a) * rand(30, 70);
      p.vy = Math.sin(a) * rand(30, 70);
      p.drag = 1.5;
      p.life = rand(0.6, 1.0);
      p.delay = rand(0, 0.2);
      p.size0 = rand(5, 9);
      p.size1 = 2;
      p.grow = 1;
      p.fadeStart = 0.3;
      p.ramp = RAMPS.reveal;
    }
  }
}
