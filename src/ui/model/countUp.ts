/**
 * A displayed number that chases its target smoothly (score ticking up). Each change of target
 * is covered at a steady rate that catches up in `catchUpTime` seconds, but never slower than
 * `minRate` per second, so small awards still visibly tick.
 */
export class CountUp {
  private current: number;
  private goal: number;
  private rate = 0;

  constructor(
    initial = 0,
    private readonly catchUpTime = 0.8,
    private readonly minRate = 60,
  ) {
    this.current = initial;
    this.goal = initial;
  }

  get target(): number {
    return this.goal;
  }

  /** Rounded value for display. */
  get value(): number {
    return Math.round(this.current);
  }

  get settled(): boolean {
    return this.current === this.goal;
  }

  setTarget(target: number): void {
    if (target === this.goal) return;
    this.goal = target;
    this.rate = Math.max(this.minRate, Math.abs(target - this.current) / this.catchUpTime);
  }

  snap(): void {
    this.current = this.goal;
  }

  update(dt: number): number {
    const diff = this.goal - this.current;
    if (diff === 0) return this.value;
    const step = Math.max(this.rate, this.minRate) * dt;
    this.current = Math.abs(diff) <= step ? this.goal : this.current + Math.sign(diff) * step;
    return this.value;
  }
}

/**
 * Value of a count-up animation from 0 to `target` after `elapsed` of `duration` seconds,
 * with an ease-out so the last digits settle visibly. Rounded.
 */
export function countUpValue(target: number, elapsed: number, duration: number): number {
  if (duration <= 0 || elapsed >= duration) return Math.round(target);
  if (elapsed <= 0) return 0;
  const t = elapsed / duration;
  const eased = 1 - Math.pow(1 - t, 3);
  return Math.round(target * eased);
}
