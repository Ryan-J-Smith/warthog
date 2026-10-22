import type { MissionResults } from '../../src/sim/world';

/** A finished mission with the given outcome, total and grade (other fields are plausible filler). */
export function missionResults(overrides: Partial<MissionResults> = {}): MissionResults {
  return {
    outcome: 'victory',
    time: 300,
    killPoints: 8000,
    kills: 30,
    bonusPoints: 0,
    objectives: [],
    objectivePoints: 10000,
    timeBonus: 1200,
    livesBonus: 2000,
    friendlyFirePenalty: 0,
    total: 22000,
    grade: 'A',
    ...overrides,
  };
}
