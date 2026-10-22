import type { PlayerLoadout } from '../../sim/loadout';
import type { MissionResults } from '../../sim/world';
import {
  CHALLENGE_BOUNTY,
  CHALLENGE_CATALOG,
  challengeStatuses,
  evaluateChallenges,
  type Challenge,
  type ChallengeCatalog,
  type ChallengeStatus,
} from '../challenges';
import { missionCredits, type CreditBreakdown } from '../credits';
import { buildLoadout, checkPurchase, levelOf, type PurchaseCheck, type UpgradeId, type UpgradeLevels } from '../upgrades';
import { gradeRank, parseSave, serializeSave, type LevelRecord, type SaveData } from './saveData';
import type { SaveStorage } from './saveStorage';

/** What a finished mission earned. */
export interface MissionAward {
  credits: CreditBreakdown;
  newBestScore: boolean;
  newBestGrade: boolean;
  /** The level's record before this mission (null on the first run). */
  previous: LevelRecord | null;
  /** Challenges completed for the first time on this mission (each paid `CHALLENGE_BOUNTY`). */
  challenges: Challenge[];
  /** Credits paid for those challenges (on top of `credits.total`). */
  bounty: number;
  /** Everything this mission paid: `credits.total + bounty`. */
  totalCredits: number;
}

/**
 * The player's progression: credits, owned upgrades, best result per level, missions flown.
 * Loaded once from a `SaveStorage` and written back after every change.
 */
export class SaveStore {
  private data: SaveData;
  /** Awards by results object, so re-entering a results screen never pays twice. */
  private readonly awards = new WeakMap<MissionResults, MissionAward>();

  /** @param catalog the per-level challenges (injectable for tests). */
  constructor(
    private readonly storage: SaveStorage,
    private readonly catalog: ChallengeCatalog = CHALLENGE_CATALOG,
  ) {
    this.data = parseSave(storage.read());
  }

  get credits(): number {
    return this.data.credits;
  }

  get missionsFlown(): number {
    return this.data.missionsFlown;
  }

  get upgrades(): Readonly<UpgradeLevels> {
    return this.data.upgrades;
  }

  level(id: UpgradeId): number {
    return levelOf(this.data.upgrades, id);
  }

  bestFor(levelId: string): LevelRecord | null {
    return this.data.levels[levelId] ?? null;
  }

  /** Ids of the level's completed challenges. */
  completedChallenges(levelId: string): readonly string[] {
    return this.data.challenges[levelId] ?? [];
  }

  /** The level's challenges, each marked earned or not. */
  challengeStatus(levelId: string): ChallengeStatus[] {
    return challengeStatuses(levelId, this.completedChallenges(levelId), this.catalog);
  }

  /** The aircraft as currently upgraded. */
  loadout(): PlayerLoadout {
    return buildLoadout(this.data.upgrades);
  }

  /** Buy the next level of an upgrade if affordable and not maxed; returns the check either way. */
  buy(id: UpgradeId): PurchaseCheck {
    const check = checkPurchase(this.data.upgrades, this.data.credits, id);
    if (!check.ok) return check;
    this.data.credits -= check.cost;
    this.data.upgrades[id] = check.level;
    this.persist();
    return check;
  }

  /**
   * Pay out a finished mission, update the level's best and pay the bounty of any challenge
   * completed for the first time. Idempotent per results object: calling it again with the same
   * `results` returns the original award without paying again. A challenge already held is never
   * paid again by a later mission.
   */
  recordMission(levelId: string, results: MissionResults): MissionAward {
    const existing = this.awards.get(results);
    if (existing) return existing;

    const credits = missionCredits(results);
    const previous = this.bestFor(levelId);
    // Only victories set records (a defeat still pays credits).
    const won = results.outcome === 'victory';
    const newBestScore = won && (previous === null || results.total > previous.bestScore);
    const newBestGrade = won && (previous === null || gradeRank(results.grade) < gradeRank(previous.bestGrade));
    if (won) {
      this.data.levels[levelId] = {
        bestScore: newBestScore ? results.total : (previous?.bestScore ?? results.total),
        bestGrade: newBestGrade ? results.grade : (previous?.bestGrade ?? results.grade),
      };
    }
    const held = this.completedChallenges(levelId);
    const challenges = evaluateChallenges(levelId, results, this.catalog).filter((c) => !held.includes(c.id));
    if (challenges.length > 0) this.data.challenges[levelId] = [...held, ...challenges.map((c) => c.id)];
    const bounty = challenges.length * CHALLENGE_BOUNTY;
    const totalCredits = credits.total + bounty;
    this.data.credits += totalCredits;
    this.data.missionsFlown += 1;
    this.persist();

    const award: MissionAward = {
      credits,
      newBestScore,
      newBestGrade,
      previous: previous ? { ...previous } : null,
      challenges,
      bounty,
      totalCredits,
    };
    this.awards.set(results, award);
    return award;
  }

  /** The award already paid for `results`, if any. */
  awardFor(results: MissionResults): MissionAward | null {
    return this.awards.get(results) ?? null;
  }

  private persist(): void {
    this.storage.write(serializeSave(this.data));
  }
}
