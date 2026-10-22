import { describe, expect, it } from 'vitest';
import { missionCredits } from '../../src/meta/credits';
import { UPGRADE_TRACKS, catalogCost } from '../../src/meta/upgrades';
import { missionResults } from './fixtures';

const firstLevelCosts = UPGRADE_TRACKS.map((t) => t.costs[0] ?? 0).sort((a, b) => a - b);

describe('missionCredits', () => {
  it('pays sortie + score / 10 + grade bonus on a victory', () => {
    const c = missionCredits(missionResults({ total: 22000, grade: 'A' }));
    expect(c).toEqual({ sortie: 150, score: 2200, grade: 400, total: 2750 });
  });

  it('rounds down to tens', () => {
    expect(missionCredits(missionResults({ total: 22099, grade: 'A' })).score).toBe(2200);
  });

  it('still pays on a defeat, at half rate and with no grade bonus', () => {
    const c = missionCredits(missionResults({ outcome: 'defeat', total: 9000, grade: 'C' }));
    expect(c).toEqual({ sortie: 150, score: 450, grade: 0, total: 600 });
  });

  it('never goes negative', () => {
    expect(missionCredits(missionResults({ outcome: 'defeat', total: -4000, grade: 'D' })).total).toBe(150);
  });

  it('a good run buys about two first-level upgrades', () => {
    const earned = missionCredits(missionResults({ total: 22000, grade: 'A' })).total;
    const [a = 0, b = 0, c = 0] = firstLevelCosts;
    expect(earned).toBeGreaterThanOrEqual(a + b);
    expect(earned).toBeLessThan(a + b + c);
  });

  it('the full catalog takes roughly 6–10 good-to-great runs', () => {
    const good = missionCredits(missionResults({ total: 22000, grade: 'A' })).total;
    const great = missionCredits(missionResults({ total: 31000, grade: 'S' })).total;
    const runs = catalogCost() / ((good + great) / 2);
    expect(runs).toBeGreaterThanOrEqual(6);
    expect(runs).toBeLessThanOrEqual(10);
  });
});
