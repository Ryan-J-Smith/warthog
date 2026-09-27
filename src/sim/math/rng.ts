/** Small deterministic PRNG (mulberry32). Seeded so simulations are reproducible in tests. */
export class Rng {
  private state: number;

  constructor(seed: number) {
    // Scramble the seed (murmur3 finaliser) so nearby seeds give unrelated sequences.
    let h = seed >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    this.state = (h ^ (h >>> 16)) >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  int(minInclusive: number, maxInclusive: number): number {
    return Math.floor(this.range(minInclusive, maxInclusive + 1));
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Uniform point in a disc of the given radius (centred on origin). */
  inDisc(radius: number): { x: number; y: number } {
    const r = radius * Math.sqrt(this.next());
    const a = this.next() * Math.PI * 2;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  }

  pick<T>(items: readonly T[]): T {
    const item = items[Math.floor(this.next() * items.length)];
    if (item === undefined) throw new Error('Rng.pick on empty array');
    return item;
  }
}
