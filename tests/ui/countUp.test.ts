import { describe, expect, it } from 'vitest';
import { CountUp, countUpValue } from '../../src/ui/model';

describe('CountUp', () => {
  it('chases a new target and settles exactly on it', () => {
    const c = new CountUp(0, 0.8, 60);
    c.setTarget(1000);
    c.update(0.1);
    expect(c.value).toBeGreaterThan(0);
    expect(c.value).toBeLessThan(1000);
    for (let i = 0; i < 43; i++) c.update(1 / 60);
    expect(c.value).toBe(1000);
    expect(c.settled).toBe(true);
  });

  it('moves small differences at the minimum rate', () => {
    const c = new CountUp(0, 0.8, 60);
    c.setTarget(40);
    c.update(0.5);
    expect(c.value).toBe(30);
    c.update(0.5);
    expect(c.value).toBe(40);
  });

  it('counts down too (friendly-fire penalties) and can snap', () => {
    const c = new CountUp(500);
    c.setTarget(-500);
    c.update(0.1);
    expect(c.value).toBeLessThan(500);
    c.snap();
    expect(c.value).toBe(-500);
  });
});

describe('countUpValue', () => {
  it('eases from 0 to the target over the duration', () => {
    expect(countUpValue(1000, 0, 1)).toBe(0);
    expect(countUpValue(1000, 0.5, 1)).toBe(875);
    expect(countUpValue(1000, 1, 1)).toBe(1000);
    expect(countUpValue(1000, 5, 1)).toBe(1000);
    expect(countUpValue(-300, 1, 1)).toBe(-300);
    expect(countUpValue(700, 0.2, 0)).toBe(700);
  });
});
