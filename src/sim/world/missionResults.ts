import type { EntityKind, MissionOutcome, ObjectiveStatus } from '../types';

export interface ObjectiveResult {
  id: string;
  title: string;
  primary: boolean;
  status: ObjectiveStatus;
  points: number;
}

/** Skill feats for the debrief. */
export interface MissionFeats {
  bestChain: number;
  missilesDefeated: number;
  zonesCleared: number;
  pickupsCollected: number;
  killsByKind: Partial<Record<EntityKind, number>>;
  hullDamage: number;
  deaths: number;
  /** Convoy vehicles that got away (score-attack missions). */
  escapes: number;
}

export interface MissionResults {
  outcome: MissionOutcome;
  /** Mission time in seconds. */
  time: number;
  killPoints: number;
  kills: number;
  /** Set-piece and skill bonuses (bridge drop, nests cleared, missiles defeated). */
  bonusPoints: number;
  /** Optional so results saved by older builds still parse. */
  feats?: MissionFeats;
  objectives: ObjectiveResult[];
  objectivePoints: number;
  timeBonus: number;
  livesBonus: number;
  friendlyFirePenalty: number;
  total: number;
  grade: string;
}
