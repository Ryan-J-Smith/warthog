import { describe, expect, it } from 'vitest';
import { DEFAULT_RADIO_TIMING, RadioQueue, type RadioLine, type RadioTiming } from '../../src/ui/model';

const TIMING: RadioTiming = {
  charsPerSecond: 10,
  holdBase: 4,
  holdPerChar: 0,
  minHold: 4,
  maxHold: 6,
  backlogFactor: 0.5,
  fadeOut: 1,
  gap: 0.5,
};

function line(text: string, speaker = 'OVERLORD'): RadioLine {
  return { speaker, text, tone: 'info' };
}

function tick(queue: RadioQueue, seconds: number, step = 0.05): void {
  for (let t = 0; t < seconds - 1e-9; t += step) queue.update(step);
}

describe('RadioQueue', () => {
  it('shows nothing until a line arrives', () => {
    const q = new RadioQueue(TIMING);
    expect(q.display).toBeNull();
    q.update(1);
    expect(q.display).toBeNull();
  });

  it('types a line out, holds it, fades it, and clears it', () => {
    const q = new RadioQueue(TIMING);
    q.push(line('0123456789')); // 1 s of typing at 10 cps
    expect(q.display?.visibleChars).toBe(0);
    expect(q.display?.typing).toBe(true);

    tick(q, 0.5);
    expect(q.display?.visibleChars).toBe(5);

    tick(q, 0.6); // 1.1 s: fully typed
    expect(q.display?.visibleChars).toBe(10);
    expect(q.display?.typing).toBe(false);
    expect(q.display?.alpha).toBe(1);

    tick(q, 3.5); // 4.6 s: inside the 4 s hold (ends at 5 s)
    expect(q.display?.alpha).toBe(1);

    tick(q, 0.5); // 5.1 s: fading
    const alpha = q.display?.alpha ?? 0;
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(1);

    tick(q, 1); // 6.1 s: gone
    expect(q.display).toBeNull();
  });

  it('plays queued lines in order with increasing serials', () => {
    const q = new RadioQueue(TIMING);
    q.push(line('first', 'BRAVO'));
    q.push(line('second', 'OVERLORD'));
    const first = q.display;
    expect(first?.line.speaker).toBe('BRAVO');
    expect(first?.queued).toBe(1);

    tick(q, 4.5); // first: 0.5 s typing + 2 s backlog hold + 1 s fade, then a 0.5 s gap
    const second = q.display;
    expect(second?.line.speaker).toBe('OVERLORD');
    expect(second?.serial).toBe((first?.serial ?? 0) + 1);
    expect(second?.queued).toBe(0);
  });

  it('holds each line 4-6 s by default depending on length', () => {
    const q = new RadioQueue(DEFAULT_RADIO_TIMING);
    expect(q.holdTime(line('Short.'))).toBe(4);
    expect(q.holdTime(line('x'.repeat(300)))).toBe(6);
  });

  it('shortens the hold when a backlog builds up', () => {
    const q = new RadioQueue(TIMING);
    q.push(line('a'));
    const alone = q.holdTime(line('a'));
    q.push(line('b'));
    expect(q.holdTime(line('a'))).toBeCloseTo(alone * TIMING.backlogFactor);
  });

  it('waits for the gap before starting a line pushed right after one ends', () => {
    const q = new RadioQueue(TIMING);
    q.push(line('a'));
    tick(q, 0.1 + 4 + 1 + 0.05); // type + hold + fade
    expect(q.display).toBeNull();
    q.push(line('b'));
    expect(q.display).toBeNull();
    tick(q, 0.6);
    expect(q.display?.line.text).toBe('b');
  });
});
