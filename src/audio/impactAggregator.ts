import type { Vec2 } from '../sim/math';

/** Summary of the gun rounds that landed since the last crackle. */
export interface ImpactBurst {
  /** Centroid of the impacts. */
  pos: Vec2;
  count: number;
  /** How many rounds damaged something. */
  hits: number;
  /** How many rounds hit armour. */
  armored: number;
}

/**
 * The GAU-8 lands ~65 rounds per second; playing a sound per round would be mush.
 * This collects impacts and releases at most one burst per `intervalMs`.
 */
export class ImpactAggregator {
  private count = 0;
  private sumX = 0;
  private sumY = 0;
  private hits = 0;
  private armored = 0;
  private lastEmitMs = Number.NEGATIVE_INFINITY;

  constructor(private readonly intervalMs: number) {}

  add(pos: Vec2, hit: boolean, armored: boolean): void {
    this.count++;
    this.sumX += pos.x;
    this.sumY += pos.y;
    if (hit) this.hits++;
    if (armored) this.armored++;
  }

  /** A burst if impacts are pending and the interval has elapsed since the previous burst; else null. */
  flush(nowMs: number): ImpactBurst | null {
    if (this.count === 0 || nowMs - this.lastEmitMs < this.intervalMs) return null;
    const burst: ImpactBurst = {
      pos: { x: this.sumX / this.count, y: this.sumY / this.count },
      count: this.count,
      hits: this.hits,
      armored: this.armored,
    };
    this.lastEmitMs = nowMs;
    this.reset();
    return burst;
  }

  /** Drop pending impacts (keeps the rate limit). */
  reset(): void {
    this.count = 0;
    this.sumX = 0;
    this.sumY = 0;
    this.hits = 0;
    this.armored = 0;
  }
}
