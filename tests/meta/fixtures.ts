import type { ObjectiveStatus } from '../../src/sim/types';
import type { MissionFeats, MissionResults, ObjectiveResult } from '../../src/sim/world';

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

/** Feats for a run that earns no challenge (other fields are plausible filler). */
export function missionFeats(overrides: Partial<MissionFeats> = {}): MissionFeats {
  return {
    bestChain: 4,
    missilesDefeated: 0,
    zonesCleared: 0,
    pickupsCollected: 0,
    killsByKind: {},
    hullDamage: 120,
    deaths: 0,
    escapes: 6,
    ...overrides,
  };
}

/** An objective result with the given status. */
export function objective(id: string, status: ObjectiveStatus, primary = false): ObjectiveResult {
  return { id, title: id, primary, status, points: 1000 };
}
