import Phaser from 'phaser';
import { SPRITES, SPRITE_RESOLUTION } from '../../assets';
import type { SpriteKey } from '../../assets';
import type { Projectile } from '../../sim/entities';
import type { ProjectileKind } from '../../sim/types';
import { DEPTH, heightScale, shadowAlpha, shadowOffset } from '../layers';
import { RAMPS } from './colorRamp';
import type { ColorRamp } from './colorRamp';
import { rand } from './fxKit';
import type { FxKit, FxPlane } from './fxKit';
import { FX_TEXTURES } from './fxTextures';
import { ImagePool } from './imagePool';

/** Altitude (band units) above which a projectile draws in the high air-FX band. */
const HIGH_ALT = 0.9;

interface TrailSpec {
  /** World units between puffs. */
  spacing: number;
  size0: number;
  size1: number;
  life: number;
  alpha: number;
  ramp: ColorRamp;
}

interface KindSpec {
  sprite: SpriteKey | null;
  shadow: boolean;
  glow: { tint: number; size: number; alpha: number } | null;
  trail: TrailSpec | null;
}

const SPECS: Record<ProjectileKind, KindSpec> = {
  rocket: {
    sprite: 'rocket',
    shadow: true,
    glow: { tint: 0xffa848, size: 11, alpha: 0.9 },
    trail: { spacing: 6, size0: 3, size1: 13, life: 0.8, alpha: 0.5, ramp: RAMPS.smokeGrey },
  },
  maverick: {
    sprite: 'maverick',
    shadow: true,
    glow: { tint: 0xffd488, size: 16, alpha: 1 },
    trail: { spacing: 6, size0: 4, size1: 18, life: 1.3, alpha: 0.55, ramp: RAMPS.smokeGrey },
  },
  samMissile: {
    sprite: 'samMissile',
    shadow: true,
    glow: { tint: 0xff5a3a, size: 44, alpha: 1 },
    trail: { spacing: 6, size0: 8, size1: 40, life: 3.2, alpha: 0.75, ramp: RAMPS.smokeWhite },
  },
  // Enemy helicopter rockets: the Hydra sprite with a hot red motor and a darker, longer trail.
  heliRocket: {
    sprite: 'rocket',
    shadow: true,
    glow: { tint: 0xff3a1e, size: 22, alpha: 1 },
    trail: { spacing: 6, size0: 4, size1: 17, life: 1.1, alpha: 0.6, ramp: RAMPS.smokeGrey },
  },
  // MLRS artillery rockets: big, hot and smoky, so the arc onto the ring reads from far away.
  mlrsRocket: {
    sprite: 'rocket',
    shadow: true,
    glow: { tint: 0xff5a1e, size: 30, alpha: 1 },
    trail: { spacing: 7, size0: 6, size1: 26, life: 1.6, alpha: 0.6, ramp: RAMPS.smokeGrey },
  },
  bomb: { sprite: 'bomb', shadow: true, glow: null, trail: null },
  aaRound: { sprite: null, shadow: false, glow: { tint: 0xff6a24, size: 11, alpha: 0.5 }, trail: null },
  tankShell: { sprite: null, shadow: false, glow: null, trail: null },
  flare: {
    sprite: 'flare',
    shadow: false,
    glow: { tint: 0xffc060, size: 36, alpha: 0.6 },
    trail: { spacing: 5, size0: 3, size1: 15, life: 1.5, alpha: 0.5, ramp: RAMPS.smokeWhite },
  },
};

interface Visual {
  kind: ProjectileKind;
  sprite: Phaser.GameObjects.Image | null;
  spritePool: ImagePool | null;
  glow: Phaser.GameObjects.Image | null;
  glowPool: ImagePool | null;
  shadow: Phaser.GameObjects.Image | null;
  groundGlow: Phaser.GameObjects.Image | null;
  lastX: number;
  lastY: number;
  trailAcc: number;
  seen: number;
  age: number;
}

/**
 * Keeps one pooled visual per live projectile (matched by id): sprite scaled by altitude, drop
 * shadow, engine/tracer glow and a distance-spaced smoke trail. Visuals of projectiles that
 * disappear are released; their trails linger and fade on their own.
 */
export class ProjectileRenderer {
  private readonly visuals = new Map<number, Visual>();
  private frame = 0;
  private readonly spritesLow: ImagePool;
  private readonly spritesHigh: ImagePool;
  private readonly addLow: ImagePool;
  private readonly addHigh: ImagePool;
  private readonly addGround: ImagePool;
  private readonly shadows: ImagePool;

  constructor(
    scene: Phaser.Scene,
    private readonly kit: FxKit,
  ) {
    const N = Phaser.BlendModes.NORMAL;
    const A = Phaser.BlendModes.ADD;
    this.spritesLow = new ImagePool(scene, DEPTH.lowAir + 0.3, N);
    this.addLow = new ImagePool(scene, DEPTH.lowAir + 0.35, A);
    this.spritesHigh = new ImagePool(scene, DEPTH.airFx + 0.3, N);
    this.addHigh = new ImagePool(scene, DEPTH.airFx + 0.35, A);
    this.addGround = new ImagePool(scene, DEPTH.groundFx + 0.25, A);
    this.shadows = new ImagePool(scene, DEPTH.airShadows, N);
  }

  get count(): number {
    return this.visuals.size;
  }

  update(dt: number, projectiles: readonly Projectile[]): void {
    this.frame++;
    for (const p of projectiles) {
      let v = this.visuals.get(p.id);
      if (!v) {
        v = this.create(p);
        this.visuals.set(p.id, v);
        this.onSpawn(p);
      }
      v.seen = this.frame;
      v.age += dt;
      this.sync(v, p);
    }
    for (const [id, v] of this.visuals) {
      if (v.seen !== this.frame) {
        this.release(v);
        this.visuals.delete(id);
      }
    }
  }

  destroy(): void {
    for (const v of this.visuals.values()) this.release(v);
    this.visuals.clear();
    for (const pool of [this.spritesLow, this.spritesHigh, this.addLow, this.addHigh, this.addGround, this.shadows]) pool.destroy();
  }

  // ---------------------------------------------------------------------------

  private create(p: Projectile): Visual {
    return {
      kind: p.kind,
      sprite: null,
      spritePool: null,
      glow: null,
      glowPool: null,
      shadow: null,
      groundGlow: null,
      lastX: p.pos.x,
      lastY: p.pos.y,
      trailAcc: 0,
      seen: this.frame,
      age: 0,
    };
  }

  /** Launch flashes for projectiles that have no dedicated launch event. */
  private onSpawn(p: Projectile): void {
    if (p.kind === 'aaRound') {
      this.kit.muzzleFlash('ground', p.pos.x, p.pos.y, p.heading, 16, 0xffb060, 0.05);
      if (Math.random() < 0.3) this.kit.smoke('ground', p.pos.x, p.pos.y, 1, { spread: 2, speed: 10, size0: 4, size1: 14, life: 0.8, alpha: 0.35, ramp: RAMPS.smokeGrey });
    } else if (p.kind === 'heliRocket') {
      this.kit.muzzleFlash('low', p.pos.x, p.pos.y, p.heading, 20, 0xff9a60, 0.06);
      this.kit.smoke('low', p.pos.x, p.pos.y, 2, { spread: 3, speed: 22, size0: 5, size1: 18, life: 0.9, alpha: 0.45, ramp: RAMPS.smokeGrey });
    } else if (p.kind === 'mlrsRocket') {
      this.kit.muzzleFlash('ground', p.pos.x, p.pos.y, p.heading, 26, 0xffb060, 0.08);
      this.kit.smoke('ground', p.pos.x, p.pos.y, 3, { spread: 6, speed: 30, size0: 8, size1: 30, life: 1.6, alpha: 0.5, ramp: RAMPS.smokeGrey });
    } else if (p.kind === 'tankShell') {
      this.kit.muzzleFlash('ground', p.pos.x, p.pos.y, p.heading, 22, 0xffd080, 0.07);
      this.kit.smoke('ground', p.pos.x, p.pos.y, 3, { spread: 3, speed: 16, size0: 5, size1: 20, life: 1.2, alpha: 0.45, ramp: RAMPS.smokeGrey });
    }
  }

  private release(v: Visual): void {
    if (v.sprite) v.spritePool?.release(v.sprite);
    if (v.glow) v.glowPool?.release(v.glow);
    if (v.shadow) this.shadows.release(v.shadow);
    if (v.groundGlow) this.addGround.release(v.groundGlow);
    v.sprite = null;
    v.glow = null;
    v.shadow = null;
    v.groundGlow = null;
  }

  private sync(v: Visual, p: Projectile): void {
    const spec = SPECS[p.kind];
    const alt = Math.max(0, p.alt);
    const high = alt >= HIGH_ALT;
    const hs = heightScale(alt);
    const x = p.pos.x;
    const y = p.pos.y;
    const additiveSprite = p.kind === 'flare';

    // --- main sprite -------------------------------------------------------
    const tracer = p.kind === 'aaRound' || p.kind === 'tankShell';
    const texture = tracer ? FX_TEXTURES.tracer : spec.sprite;
    if (texture) {
      const pool = tracer || additiveSprite ? (high ? this.addHigh : this.addLow) : high ? this.spritesHigh : this.spritesLow;
      if (!v.sprite || v.spritePool !== pool) {
        if (v.sprite) v.spritePool?.release(v.sprite);
        v.sprite = pool.acquire(texture);
        v.spritePool = pool;
      }
    }
    if (v.sprite && tracer) {
      const aa = p.kind === 'aaRound';
      const length = aa ? 17 * (1 + alt * 0.9) : 15;
      const fadeIn = Math.min(1, v.age / 0.04);
      v.sprite
        .setPosition(x, y)
        .setRotation(p.heading)
        .setScale(length / 64, (length / 64) * (aa ? 1.15 : 0.9))
        .setTint(aa ? RAMPS.aaTracer.at(Math.min(1, v.age * 1.6)) : 0xffe6b0)
        .setAlpha((aa ? 1 : 0.55) * fadeIn);
    } else if (v.sprite) {
      let scale = hs / SPRITE_RESOLUTION;
      if (p.kind === 'bomb') scale *= 1 + alt * 0.45;
      // SAMs are the deadliest thing in the sky: big and pulsing so you always see them coming.
      if (p.kind === 'samMissile') scale *= p.lostLock ? 1.6 : 1.9 + 0.15 * Math.sin(v.age * 18);
      if (p.kind === 'flare') scale *= 1.2 + 0.25 * Math.sin(v.age * 40);
      if (p.kind === 'heliRocket') scale *= 1.35;
      if (p.kind === 'mlrsRocket') scale *= 1.7;
      v.sprite.setPosition(x, y).setRotation(p.kind === 'flare' ? 0 : p.heading).setScale(scale);
      if (p.kind === 'heliRocket' || p.kind === 'mlrsRocket') v.sprite.setTint(0xffb0a0);
    }

    // --- shadow ------------------------------------------------------------
    if (spec.shadow && spec.sprite && alt > 0.02) {
      if (!v.shadow) v.shadow = this.shadows.acquire(spec.sprite).setTintFill(0x000000);
      const off = shadowOffset(alt);
      v.shadow
        .setPosition(x + off.x, y + off.y)
        .setRotation(p.heading)
        .setScale(1 / SPRITE_RESOLUTION)
        .setAlpha(shadowAlpha(alt) * 0.9);
    } else if (v.shadow) {
      this.shadows.release(v.shadow);
      v.shadow = null;
    }

    // --- glow (engine flame / tracer halo / flare halo) ---------------------
    if (spec.glow) {
      const glowPool = high ? this.addHigh : this.addLow;
      if (!v.glow || v.glowPool !== glowPool) {
        if (v.glow) v.glowPool?.release(v.glow);
        v.glow = glowPool.acquire('particleSoft');
        v.glowPool = glowPool;
      }
      const len = spec.sprite ? SPRITES[spec.sprite].w * hs : 0;
      const tailX = p.kind === 'flare' || p.kind === 'aaRound' ? x : x - Math.cos(p.heading) * len * 0.5;
      const tailY = p.kind === 'flare' || p.kind === 'aaRound' ? y : y - Math.sin(p.heading) * len * 0.5;
      const flicker = 0.8 + Math.random() * 0.4;
      const size = spec.glow.size * flicker * (p.kind === 'aaRound' ? 1 + alt * 0.5 : hs);
      v.glow
        .setPosition(tailX, tailY)
        .setScale(size / (SPRITES.particleSoft.w * SPRITE_RESOLUTION))
        .setTint(spec.glow.tint)
        .setAlpha(spec.glow.alpha * (p.lostLock ? 0.7 : 1));
    }

    // Flares light up the ground beneath them.
    if (p.kind === 'flare') {
      if (!v.groundGlow) v.groundGlow = this.addGround.acquire('particleSoft').setTint(0xffb050);
      const off = shadowOffset(alt);
      v.groundGlow
        .setPosition(x + off.x, y + off.y)
        .setScale((130 + Math.random() * 14) / (SPRITES.particleSoft.w * SPRITE_RESOLUTION))
        .setAlpha(0.07 * Math.max(0.25, 1 - alt / 2.5));
    }

    // --- trail ----------------------------------------------------------------
    if (spec.trail) {
      const dx = x - v.lastX;
      const dy = y - v.lastY;
      const dist = Math.hypot(dx, dy);
      v.trailAcc += dist;
      const t = spec.trail;
      let n = Math.floor(v.trailAcc / t.spacing);
      if (n > 0) {
        v.trailAcc -= n * t.spacing;
        n = Math.min(n, 14);
        const plane: FxPlane = high ? 'air' : 'low';
        const tailOffset = spec.sprite ? SPRITES[spec.sprite].w * 0.5 * hs : 0;
        const hx = p.kind === 'flare' ? 0 : Math.cos(p.heading) * tailOffset;
        const hy = p.kind === 'flare' ? 0 : Math.sin(p.heading) * tailOffset;
        for (let i = 1; i <= n; i++) {
          const f = i / n;
          const px = v.lastX + dx * f - hx;
          const py = v.lastY + dy * f - hy;
          this.trailPuff(plane, px, py, t, hs);
        }
      }
    }
    v.lastX = x;
    v.lastY = y;
  }

  private trailPuff(plane: FxPlane, x: number, y: number, t: TrailSpec, scale: number): void {
    const layer = plane === 'air' ? this.kit.layers.airUnder : this.kit.layers.lowUnder;
    const p = layer.spawn('particleSmoke', x + rand(-1, 1), y + rand(-1, 1));
    if (!p) return;
    p.vx = rand(-4, 4);
    p.vy = rand(-4, 4);
    p.drag = 1;
    p.wind = 0.8;
    p.life = t.life * rand(0.8, 1.2);
    p.size0 = t.size0 * scale;
    p.size1 = t.size1 * scale * rand(0.85, 1.2);
    p.grow = 2.2;
    p.alpha = t.alpha;
    p.fadeIn = 0.03;
    p.fadeStart = 0.15;
    p.rotation = Math.random() * 6.28;
    p.spin = rand(-0.6, 0.6);
    p.ramp = t.ramp;
  }
}
