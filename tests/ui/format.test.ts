import { describe, expect, it } from 'vitest';
import {
  altitudeFeet,
  formatClock,
  formatDistance,
  formatMissionClock,
  formatPercent,
  formatScore,
  formatSigned,
  shareLine,
  speedKnots,
} from '../../src/ui/format';
import type { MissionResults } from '../../src/sim/world';

function results(overrides: Partial<MissionResults> = {}): MissionResults {
  return {
    outcome: 'victory',
    time: 372.4,
    killPoints: 5000,
    kills: 20,
    bonusPoints: 0,
    objectives: [],
    objectivePoints: 15000,
    timeBonus: 470,
    livesBonus: 2000,
    friendlyFirePenalty: 0,
    total: 23450,
    grade: 'A',
    ...overrides,
  };
}

describe('number formatting', () => {
  it('groups thousands without depending on the locale', () => {
    expect(formatScore(0)).toBe('0');
    expect(formatScore(999)).toBe('999');
    expect(formatScore(23450)).toBe('23,450');
    expect(formatScore(1234567)).toBe('1,234,567');
    expect(formatScore(-1000)).toBe('−1,000');
    expect(formatScore(12.6)).toBe('13');
  });

  it('signs deltas', () => {
    expect(formatSigned(300)).toBe('+300');
    expect(formatSigned(-2000)).toBe('−2,000');
    expect(formatSigned(0)).toBe('0');
  });

  it('formats clocks', () => {
    expect(formatClock(372.9)).toBe('6:12');
    expect(formatClock(5)).toBe('0:05');
    expect(formatClock(-3)).toBe('0:00');
    expect(formatMissionClock(74)).toBe('01:14');
    expect(formatMissionClock(3599)).toBe('59:59');
  });

  it('formats percentages, clamped', () => {
    expect(formatPercent(0.643)).toBe('64%');
    expect(formatPercent(1.4)).toBe('100%');
    expect(formatPercent(-1)).toBe('0%');
  });
});

describe('avionics units', () => {
  it('converts speed to knots', () => {
    expect(speedKnots(150)).toBe(188);
    expect(speedKnots(360)).toBe(450);
  });

  it('maps altitude bands to feet, monotonic and continuous', () => {
    expect(altitudeFeet(0)).toBe(300);
    expect(altitudeFeet(1)).toBe(6000);
    expect(altitudeFeet(2)).toBe(15000);
    expect(altitudeFeet(3)).toBe(15000);
    expect(altitudeFeet(0.5)).toBeGreaterThan(altitudeFeet(0.25));
    expect(altitudeFeet(1.5)).toBeGreaterThan(altitudeFeet(1));
  });

  it('formats distances in metres and kilometres', () => {
    expect(formatDistance(842)).toBe('840 m');
    expect(formatDistance(2440)).toBe('2.4 km');
  });
});

describe('shareLine', () => {
  it('builds the shareable one-liner', () => {
    expect(shareLine('River Crossing', results())).toBe('WARTHOG · River Crossing · Grade A · 23,450 pts · 6:12');
  });

  it('flags a failed mission', () => {
    expect(shareLine('River Crossing', results({ outcome: 'defeat', grade: 'D', total: 3100, time: 200 }))).toBe(
      'WARTHOG · River Crossing · Mission failed · Grade D · 3,100 pts · 3:20',
    );
  });
});
