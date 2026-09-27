/** Characters revealed by a typewriter after `elapsed` seconds at `charsPerSecond`. */
export function typedChars(elapsed: number, charsPerSecond: number, length: number): number {
  if (elapsed <= 0) return 0;
  return Math.min(length, Math.floor(elapsed * charsPerSecond + 1e-6));
}

/** Seconds a typewriter needs to reveal `length` characters. */
export function typeDuration(length: number, charsPerSecond: number): number {
  return length / charsPerSecond;
}
