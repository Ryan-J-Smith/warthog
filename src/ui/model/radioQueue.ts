import type { RadioTone } from '../../sim/types';

/** One radio transmission, as carried by the sim's `radio` event. */
export interface RadioLine {
  speaker: string;
  text: string;
  tone: RadioTone;
}

/** What the radio ticker should show right now. */
export interface RadioDisplay {
  line: RadioLine;
  /** Increments for every new line, so the view knows when to reset (squelch flash, new tag). */
  serial: number;
  /** Characters of `line.text` revealed so far (typewriter). */
  visibleChars: number;
  typing: boolean;
  /** 1 while shown, fading to 0 at the end of the hold. */
  alpha: number;
  /** Lines waiting behind this one. */
  queued: number;
}

export interface RadioTiming {
  /** Typewriter speed. */
  charsPerSecond: number;
  /** Hold after the text is fully typed: `holdBase + chars × holdPerChar`, clamped. */
  holdBase: number;
  holdPerChar: number;
  minHold: number;
  maxHold: number;
  /** Hold multiplier when more lines are waiting, so a backlog clears faster. */
  backlogFactor: number;
  fadeOut: number;
  /** Silence between lines. */
  gap: number;
}

export const DEFAULT_RADIO_TIMING: RadioTiming = {
  charsPerSecond: 58,
  holdBase: 2.8,
  holdPerChar: 0.03,
  minHold: 4,
  maxHold: 6,
  backlogFactor: 0.6,
  fadeOut: 0.35,
  gap: 0.15,
};

interface Current {
  line: RadioLine;
  serial: number;
  elapsed: number;
}

/**
 * Queue of radio lines played one at a time: typewriter reveal, hold ~4–6 s (shorter when
 * lines are waiting), fade out, short gap, next. Pure and time-driven: call `update(dt)`.
 */
export class RadioQueue {
  private readonly waiting: RadioLine[] = [];
  private current: Current | null = null;
  private serial = 0;
  private gapLeft = 0;

  constructor(private readonly timing: RadioTiming = DEFAULT_RADIO_TIMING) {}

  push(line: RadioLine): void {
    this.waiting.push(line);
    if (!this.current && this.gapLeft <= 0) this.advance();
  }

  update(dt: number): void {
    if (!this.current) {
      this.gapLeft = Math.max(0, this.gapLeft - dt);
      if (this.gapLeft <= 0) this.advance();
      return;
    }
    this.current.elapsed += dt;
    if (this.current.elapsed >= this.totalTime(this.current.line)) {
      this.current = null;
      this.gapLeft = this.timing.gap;
    }
  }

  /** Number of lines not yet started. */
  get pending(): number {
    return this.waiting.length;
  }

  get display(): RadioDisplay | null {
    const c = this.current;
    if (!c) return null;
    const t = this.timing;
    const typeTime = this.typeTime(c.line);
    const visibleChars = Math.min(c.line.text.length, Math.floor(c.elapsed * t.charsPerSecond + 1e-6));
    const fadeStart = this.totalTime(c.line) - t.fadeOut;
    const alpha = c.elapsed <= fadeStart ? 1 : Math.max(0, 1 - (c.elapsed - fadeStart) / t.fadeOut);
    return {
      line: c.line,
      serial: c.serial,
      visibleChars,
      typing: c.elapsed < typeTime,
      alpha,
      queued: this.waiting.length,
    };
  }

  /** Hold duration after typing completes, for the current backlog. */
  holdTime(line: RadioLine): number {
    const t = this.timing;
    const hold = Math.min(t.maxHold, Math.max(t.minHold, t.holdBase + line.text.length * t.holdPerChar));
    return this.waiting.length > 0 ? hold * t.backlogFactor : hold;
  }

  private typeTime(line: RadioLine): number {
    return line.text.length / this.timing.charsPerSecond;
  }

  private totalTime(line: RadioLine): number {
    return this.typeTime(line) + this.holdTime(line) + this.timing.fadeOut;
  }

  private advance(): void {
    const next = this.waiting.shift();
    if (!next) return;
    this.serial += 1;
    this.current = { line: next, serial: this.serial, elapsed: 0 };
  }
}
