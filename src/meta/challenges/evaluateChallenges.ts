import type { MissionResults } from '../../sim/world';
import { CHALLENGE_CATALOG, type Challenge, type ChallengeCatalog } from './challengeCatalog';

/** A challenge and whether the player holds it (level select, briefing). */
export interface ChallengeStatus {
  challenge: Challenge;
  earned: boolean;
}

/** The level's challenges (none for an unknown level). */
export function challengesFor(levelId: string, catalog: ChallengeCatalog = CHALLENGE_CATALOG): readonly Challenge[] {
  return catalog[levelId] ?? [];
}

/** Only victories earn challenges; then the challenge's own skill test decides. */
export function isChallengeEarned(challenge: Challenge, results: MissionResults): boolean {
  return results.outcome === 'victory' && challenge.test(results);
}

/** Every challenge of the level that these results meet, in catalogue order. */
export function evaluateChallenges(levelId: string, results: MissionResults, catalog: ChallengeCatalog = CHALLENGE_CATALOG): Challenge[] {
  return challengesFor(levelId, catalog).filter((c) => isChallengeEarned(c, results));
}

/** The level's challenges, each marked earned if its id is in `earnedIds`. */
export function challengeStatuses(
  levelId: string,
  earnedIds: readonly string[],
  catalog: ChallengeCatalog = CHALLENGE_CATALOG,
): ChallengeStatus[] {
  return challengesFor(levelId, catalog).map((challenge) => ({ challenge, earned: earnedIds.includes(challenge.id) }));
}
