import type { MissionOutcome, ObjectiveStatus } from '../types';

export interface ObjectiveResult {
  id: string;
  title: string;
  primary: boolean;
  status: ObjectiveStatus;
  points: number;
}

export interface MissionResults {
  outcome: MissionOutcome;
  /** Mission time in seconds. */
  time: number;
  killPoints: number;
  kills: number;
  /** Set-piece bonuses (e.g. BRIDGE DROP ×N). */
  bonusPoints: number;
  objectives: ObjectiveResult[];
  objectivePoints: number;
  timeBonus: number;
  livesBonus: number;
  friendlyFirePenalty: number;
  total: number;
  grade: string;
}
