import type { MissionResults } from '../../sim/world';

/** Credit tuning. See `UPGRADE_TRACKS` for what the credits buy. */
export const CREDIT_RULES = {
  /** Paid for every sortie flown, win or lose. */
  sortiePay: 150,
  /** Credits per point of (positive) mission score on a victory. */
  perPoint: 1 / 10,
  /** Defeats still pay, at this fraction of the score rate (failing isn't a dead end). */
  defeatRate: 0.5,
  /** Extra credits for the grade, victories only. */
  gradeBonus: { S: 600, A: 400, B: 250, C: 100, D: 0 } as Readonly<Record<string, number>>,
  /** Awards are rounded down to a multiple of this. */
  roundTo: 10,
} as const;

export interface CreditBreakdown {
  sortie: number;
  score: number;
  grade: number;
  total: number;
}

/**
 * Credits earned for a finished mission: sortie pay + total score / 10 + a grade bonus on a
 * victory; a defeat earns the sortie pay plus half the score rate. Never negative.
 * A good River Crossing run (A, ~22,000) earns about 2,750; an S run about 3,950.
 */
export function missionCredits(results: MissionResults): CreditBreakdown {
  const won = results.outcome === 'victory';
  const rate = CREDIT_RULES.perPoint * (won ? 1 : CREDIT_RULES.defeatRate);
  const score = roundDown(Math.max(0, results.total) * rate);
  const grade = won ? (CREDIT_RULES.gradeBonus[results.grade] ?? 0) : 0;
  const sortie = CREDIT_RULES.sortiePay;
  return { sortie, score, grade, total: sortie + score + grade };
}

function roundDown(value: number): number {
  const step = CREDIT_RULES.roundTo;
  return Math.floor(value / step) * step;
}
