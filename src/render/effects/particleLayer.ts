import Phaser from 'phaser';
import type { ColorRamp } from './colorRamp';

/**
 * One pooled particle. Sizes are in world units (the image is scaled from its texture width).
 * All fields are reset by `ParticleLayer.spawn`; callers set what they need.
 */
export class Particle {
  image: Phaser.GameObjects.Image;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  /** Exponential velocity damping, 1/s. */
  drag = 0;
  /** How strongly the global wind carries this particle (0..1). */
  wind = 0;
  life = 1;
  age = 0;
  /** Seconds before the particle appears. */
  delay = 0;
  /** Diameter (texture width) at birth / death, world units. */
  size0 = 10;
  size1 = 10;
  /** Size easing exponent: 1 = linear, >1 = fast start then slow (ease-out). */
  grow = 2;
  /** Horizontal stretch (x scale multiplier). */
  stretch = 1;
  alpha = 1;
  /** Fraction of life spent fading in. */
  fadeIn = 0;
  /** Fraction of life after which it fades out (linearly to 0 at death). */
  fadeStart = 0.4;
  rotation = 0;
  spin = 0;
  /** Point along velocity (sparks, tracers). */
  align = false;
  /** Pseudo-height bounce: scale × (1 + arc·sin(πt)) (debris thrown up and falling). */
  arc = 0;
  ramp: ColorRamp | null = null;
  /** Offset into the ramp so a particle can start part-way along it. */
  rampStart = 0;
  tint = 0xffffff;
  /** Texture width in pixels (for size → scale). */
  texWidth = 1;

  constructor(image: Phaser.GameObjects.Image) {
    this.image = image;
  }
}

/**
 * A capped pool of particles rendered as Images at one depth and blend mode.
 * No per-frame allocation; dead particles are hidden and recycled.
 */
export class ParticleLayer {
  private readonly pool: Particle[] = [];
  private readonly live: Particle[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth: number,
    private readonly blend: Phaser.BlendModes,
    private readonly max: number,
  ) {}

  get count(): number {
    return this.live.length;
  }

  get capacity(): number {
    return this.max;
  }

  /** Free slots left before the cap. */
  get headroom(): number {
    return this.max - this.live.length;
  }

  /** Spawn a particle (null when the layer is full). Fields are reset to defaults. */
  spawn(texture: string, x: number, y: number): Particle | null {
    let p = this.pool.pop();
    if (!p) {
      if (this.live.length >= this.max) return null;
      const img = this.scene.add.image(0, 0, texture).setDepth(this.depth).setBlendMode(this.blend).setVisible(false);
      p = new Particle(img);
    }
    const img = p.image;
    if (img.texture.key !== texture) img.setTexture(texture);
    p.texWidth = img.frame.width || 1;
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.drag = 0;
    p.wind = 0;
    p.life = 1;
    p.age = 0;
    p.delay = 0;
    p.size0 = 10;
    p.size1 = 10;
    p.grow = 2;
    p.stretch = 1;
    p.alpha = 1;
    p.fadeIn = 0;
    p.fadeStart = 0.4;
    p.rotation = 0;
    p.spin = 0;
    p.align = false;
    p.arc = 0;
    p.ramp = null;
    p.rampStart = 0;
    p.tint = 0xffffff;
    img.setVisible(false);
    this.live.push(p);
    return p;
  }

  update(dt: number, windX: number, windY: number): void {
    const live = this.live;
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      if (!p) continue;
      const img = p.image;
      if (p.delay > 0) {
        p.delay -= dt;
        if (p.delay > 0) continue;
      }
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1) {
        img.setVisible(false);
        const last = live.pop();
        if (last && last !== p) live[i] = last;
        this.pool.push(p);
        continue;
      }
      if (p.drag > 0) {
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.x += (p.vx + windX * p.wind) * dt;
      p.y += (p.vy + windY * p.wind) * dt;
      p.rotation = p.align ? Math.atan2(p.vy, p.vx) : p.rotation + p.spin * dt;

      const g = 1 - Math.pow(1 - t, p.grow);
      let size = p.size0 + (p.size1 - p.size0) * g;
      if (p.arc !== 0) size *= 1 + p.arc * Math.sin(Math.PI * t);
      const scale = size / p.texWidth;

      let a = p.alpha;
      if (p.fadeIn > 0 && t < p.fadeIn) a *= t / p.fadeIn;
      if (t > p.fadeStart) a *= (1 - t) / (1 - p.fadeStart);

      img.setPosition(p.x, p.y);
      img.setScale(scale * p.stretch, scale);
      img.setRotation(p.rotation);
      img.setAlpha(a);
      img.setTint(p.ramp ? p.ramp.at(p.rampStart + t * (1 - p.rampStart)) : p.tint);
      if (!img.visible) img.setVisible(true);
    }
  }

  clear(): void {
    for (const p of this.live) {
      p.image.setVisible(false);
      this.pool.push(p);
    }
    this.live.length = 0;
  }

  destroy(): void {
    for (const p of this.live) p.image.destroy();
    for (const p of this.pool) p.image.destroy();
    this.live.length = 0;
    this.pool.length = 0;
  }
}

/** Blend modes re-exported for layer construction without importing Phaser everywhere. */
export const BLEND = {
  normal: Phaser.BlendModes.NORMAL,
  add: Phaser.BlendModes.ADD,
} as const;
