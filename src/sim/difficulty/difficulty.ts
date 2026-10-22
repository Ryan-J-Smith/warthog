export type DifficultyId = 'recruit' | 'regular' | 'ace';

/** Difficulty ids, easiest first (the order the briefing selector cycles through). */
export const DIFFICULTY_ORDER: readonly DifficultyId[] = ['recruit', 'regular', 'ace'];

/**
 * How hard the enemy hits and how often, and what that's worth. Telegraph timings never change:
 * every threat stays exactly as readable and dodgeable; it just punishes mistakes harder.
 */
export interface Difficulty {
  id: DifficultyId;
  label: string;
  blurb: string;
  /** Multiplies all damage the player takes (shield and hull). */
  damageTaken: number;
  /** Multiplies enemy fire rates (AA, SAM reload, gunship salvos, MLRS barrages). */
  enemyFireRate: number;
  /** Multiplies kill points. */
  scoreMultiplier: number;
}

export const DIFFICULTIES: Readonly<Record<DifficultyId, Difficulty>> = {
  recruit: {
    id: 'recruit',
    label: 'RECRUIT',
    blurb: 'Enemy fire hurts less and comes slower. Kills score ×0.8.',
    damageTaken: 0.6,
    enemyFireRate: 0.8,
    scoreMultiplier: 0.8,
  },
  regular: {
    id: 'regular',
    label: 'REGULAR',
    blurb: 'The intended balance.',
    damageTaken: 1,
    enemyFireRate: 1,
    scoreMultiplier: 1,
  },
  ace: {
    id: 'ace',
    label: 'ACE',
    blurb: 'Enemy fire hits harder and comes faster. Kills score ×1.3.',
    damageTaken: 1.4,
    enemyFireRate: 1.25,
    scoreMultiplier: 1.3,
  },
};

export const DEFAULT_DIFFICULTY: Difficulty = DIFFICULTIES.regular;

export function isDifficultyId(value: unknown): value is DifficultyId {
  return typeof value === 'string' && (DIFFICULTY_ORDER as readonly string[]).includes(value);
}
