/** Square-wave blink: true for the first half of each period at `hz`. */
export function blink(nowMs: number, hz: number): boolean {
  const period = 1000 / hz;
  return nowMs % period < period / 2;
}

/** Smooth 0..1 pulse at `hz`. */
export function pulse(nowMs: number, hz: number): number {
  return 0.5 + 0.5 * Math.sin((nowMs / 1000) * hz * Math.PI * 2);
}
