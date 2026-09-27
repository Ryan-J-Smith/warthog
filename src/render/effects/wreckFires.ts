import type { ExplosionSize } from '../../sim/types';
import { RAMPS } from './colorRamp';
import { rand } from './fxKit';
import type { FxKit, FxPlane } from './fxKit';

interface WreckFire {
  x: number;
  y: number;
  age: number;
  duration: number;
  /** 0..1 by explosion size; scales smoke rate, puff size and flames. */
  intensity: number;
  smokeAcc: number;
  fireAcc: number;
  glowAcc: number;
}

interface Streamer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  acc: number;
  plane: FxPlane;
}

const INTENSITY: Record<ExplosionSize, number> = { small: 0.3, medium: 0.55, large: 0.8, huge: 1 };
const DURATION: Record<ExplosionSize, [number, number]> = {
  small: [18, 24],
  medium: [26, 34],
  large: [32, 40],
  huge: [38, 44],
};

/**
 * Persistent burning wrecks: a rising, wind-drifting black smoke column with flickering flames at
 * the base, thinning out over 20–40 s. Also "streamers": burning debris that trails smoke.
 */
export class WreckFires {
  private readonly fires: WreckFire[] = [];
  private readonly debrisTrails: Streamer[] = [];

  constructor(
    private readonly kit: FxKit,
    private readonly maxFires = 18,
  ) {}

  get count(): number {
    return this.fires.length;
  }

  start(x: number, y: number, size: ExplosionSize, intensityScale = 1): void {
    if (this.fires.length >= this.maxFires) {
      // Retire the oldest early rather than refusing a fresh (more relevant) fire.
      let oldest = 0;
      this.fires.forEach((f, i) => {
        if (f.age / f.duration > (this.fires[oldest]?.age ?? 0) / (this.fires[oldest]?.duration ?? 1)) oldest = i;
      });
      this.fires.splice(oldest, 1);
    }
    const [d0, d1] = DURATION[size];
    this.fires.push({
      x,
      y,
      age: 0,
      duration: rand(d0, d1),
      intensity: INTENSITY[size] * intensityScale,
      smokeAcc: 0,
      fireAcc: 0,
      glowAcc: 0,
    });
  }

  /** Burning debris flung from a big explosion, trailing fire and smoke as it falls. */
  streamers(x: number, y: number, count: number, speed: number, plane: FxPlane): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * rand(0.5, 1);
      this.debrisTrails.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, age: 0, life: rand(0.7, 1.3), acc: 0, plane });
    }
  }

  update(dt: number): void {
    const kit = this.kit;
    const crowd = this.fires.length > 10 ? 10 / this.fires.length : 1;
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      if (!f) continue;
      f.age += dt;
      if (f.age >= f.duration) {
        this.fires.splice(i, 1);
        continue;
      }
      const remain = 1 - f.age / f.duration;
      const I = f.intensity;

      // Smoke column.
      f.smokeAcc += dt * (2.5 + 7 * I) * (0.3 + 0.7 * remain) * crowd;
      while (f.smokeAcc >= 1) {
        f.smokeAcc -= 1;
        const p = kit.layers.groundUnder.spawn('particleSmoke', f.x + rand(-4, 4) * (1 + I), f.y + rand(-4, 4) * (1 + I));
        if (!p) break;
        p.vx = rand(-6, 6);
        p.vy = rand(-8, 2);
        p.drag = 0.4;
        p.wind = rand(0.8, 1.2);
        p.life = (3.2 + 2.4 * I) * rand(0.8, 1.2);
        p.size0 = (6 + 10 * I) * rand(0.8, 1.2);
        p.size1 = (34 + 64 * I) * rand(0.8, 1.2);
        p.grow = 1.6;
        p.alpha = (0.5 + 0.25 * I) * (0.45 + 0.55 * remain);
        p.fadeIn = 0.12;
        p.fadeStart = 0.25;
        p.rotation = Math.random() * 6.28;
        p.spin = rand(-0.3, 0.3);
        p.ramp = RAMPS.smokeColumn;
      }

      // Flames at the base for the first half of the burn.
      const flameLeft = Math.max(0, 1 - f.age / (f.duration * 0.55));
      if (flameLeft > 0) {
        f.fireAcc += dt * (5 + 12 * I) * flameLeft * crowd;
        while (f.fireAcc >= 1) {
          f.fireAcc -= 1;
          const p = kit.layers.groundAdd.spawn('particleSmoke', f.x + rand(-5, 5) * (0.6 + I), f.y + rand(-5, 5) * (0.6 + I));
          if (!p) break;
          p.vx = rand(-4, 4);
          p.vy = rand(-10, -2);
          p.wind = 0.35;
          p.life = rand(0.3, 0.55);
          p.size0 = (5 + 7 * I) * rand(0.7, 1.2) * (0.5 + 0.5 * flameLeft);
          p.size1 = p.size0 * 1.5;
          p.alpha = 0.9;
          p.fadeStart = 0.3;
          p.rotation = Math.random() * 6.28;
          p.ramp = RAMPS.flame;
        }
        f.glowAcc += dt * 3;
        if (f.glowAcc >= 1) {
          f.glowAcc -= 1;
          kit.flash('ground', f.x, f.y, (30 + 50 * I) * rand(0.85, 1.15) * (0.4 + 0.6 * flameLeft), 0.5, 0xff8a3a, 0.28);
          if (Math.random() < 0.5) kit.sparks('ground', f.x, f.y, 1, 10, 40, 1.2, 5);
        }
      }
    }

    for (let i = this.debrisTrails.length - 1; i >= 0; i--) {
      const s = this.debrisTrails[i];
      if (!s) continue;
      s.age += dt;
      if (s.age >= s.life) {
        this.debrisTrails.splice(i, 1);
        continue;
      }
      const k = Math.exp(-1.6 * dt);
      s.vx *= k;
      s.vy *= k;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.acc += dt * 40;
      while (s.acc >= 1) {
        s.acc -= 1;
        kit.smoke(s.plane, s.x, s.y, 1, { spread: 1, speed: 4, size0: 4, size1: 16, life: 1.1, alpha: 0.55, ramp: RAMPS.smokeDark });
        const p = kit.flash(s.plane, s.x, s.y, 9 * (1 - s.age / s.life) + 3, 0.12, 0xffa040, 0.9);
        if (p) p.fadeStart = 0;
      }
    }
  }

  clear(): void {
    this.fires.length = 0;
    this.debrisTrails.length = 0;
  }
}
