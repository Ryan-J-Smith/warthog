import { Rng } from '../../sim/math';

/**
 * Seeded 2D value noise with smooth (quintic) interpolation, plus fractal sums.
 * Values are in [0, 1]. Deterministic for a given seed.
 */
export class ValueNoise {
  private readonly perm = new Uint16Array(512);
  private readonly values = new Float32Array(256);

  constructor(seed: number) {
    const rng = new Rng(seed);
    const p = new Uint16Array(256);
    for (let i = 0; i < 256; i++) {
      p[i] = i;
      this.values[i] = rng.next();
    }
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      const t = p[i] ?? 0;
      p[i] = p[j] ?? 0;
      p[j] = t;
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255] ?? 0;
  }

  private lattice(ix: number, iy: number): number {
    const a = this.perm[ix & 255] ?? 0;
    return this.values[(this.perm[(a + (iy & 255)) & 511] ?? 0) & 255] ?? 0;
  }

  /** Smooth value noise at (x, y), lattice spacing 1. Optional `period` wraps the lattice (tileable). */
  noise(x: number, y: number, period = 0): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    let ix0 = x0;
    let iy0 = y0;
    let ix1 = x0 + 1;
    let iy1 = y0 + 1;
    if (period > 0) {
      ix0 = ((ix0 % period) + period) % period;
      iy0 = ((iy0 % period) + period) % period;
      ix1 = ((ix1 % period) + period) % period;
      iy1 = ((iy1 % period) + period) % period;
    }
    const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
    const v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const a = this.lattice(ix0, iy0);
    const b = this.lattice(ix1, iy0);
    const c = this.lattice(ix0, iy1);
    const d = this.lattice(ix1, iy1);
    const top = a + (b - a) * u;
    const bottom = c + (d - c) * u;
    return top + (bottom - top) * v;
  }

  /** Fractal Brownian motion: `octaves` layers, each at double frequency and `gain` amplitude. */
  fbm(x: number, y: number, octaves: number, gain = 0.5, period = 0): number {
    let sum = 0;
    let amp = 1;
    let norm = 0;
    let f = 1;
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.noise(x * f, y * f, period > 0 ? period * f : 0);
      norm += amp;
      amp *= gain;
      f *= 2;
    }
    return sum / norm;
  }
}

/** Smoothstep on [e0, e1]. */
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
