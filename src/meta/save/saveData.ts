import { SCORING } from '../../config';
import { isDifficultyId, type DifficultyId } from '../../sim/difficulty';
import { UPGRADE_TRACKS, levelOf, type UpgradeLevels } from '../upgrades';

/** Bump when the save format changes incompatibly (older saves are then discarded). */
export const SAVE_VERSION = 1;

/** Best result on one level. */
export interface LevelRecord {
  bestScore: number;
  bestGrade: string;
}

/** Everything that persists between sessions. */
export interface SaveData {
  version: number;
  credits: number;
  upgrades: UpgradeLevels;
  /** Best results by level id. */
  levels: Record<string, LevelRecord>;
  missionsFlown: number;
  /**
   * Completed challenge ids by level id. Added after version 1 shipped without a version bump:
   * a save without it simply has none completed.
   */
  challenges: Record<string, string[]>;
  /** Preferred difficulty (picked on Select Mission). Older saves default to regular. */
  difficulty: DifficultyId;
}

export function emptySave(): SaveData {
  return { version: SAVE_VERSION, credits: 0, upgrades: {}, levels: {}, missionsFlown: 0, challenges: {}, difficulty: 'regular' };
}

export function serializeSave(data: SaveData): string {
  return JSON.stringify(data);
}

/**
 * Parse stored save text. Anything unusable (missing, corrupted JSON, a different version) gives a
 * fresh save; individual bad fields are dropped or clamped rather than failing the whole save.
 */
export function parseSave(text: string | null): SaveData {
  if (text === null) return emptySave();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return emptySave();
  }
  if (!isRecord(raw) || raw['version'] !== SAVE_VERSION) return emptySave();

  const save = emptySave();
  save.credits = count(raw['credits']);
  save.missionsFlown = count(raw['missionsFlown']);
  const upgrades = raw['upgrades'];
  if (isRecord(upgrades)) {
    for (const track of UPGRADE_TRACKS) {
      const level = levelOf({ [track.id]: count(upgrades[track.id]) }, track.id);
      if (level > 0) save.upgrades[track.id] = level;
    }
  }
  const levels = raw['levels'];
  if (isRecord(levels)) {
    for (const [id, record] of Object.entries(levels)) {
      if (!isRecord(record)) continue;
      const bestScore = record['bestScore'];
      const bestGrade = record['bestGrade'];
      if (typeof bestScore !== 'number' || !Number.isFinite(bestScore) || typeof bestGrade !== 'string') continue;
      save.levels[id] = { bestScore: Math.round(bestScore), bestGrade };
    }
  }
  const challenges = raw['challenges'];
  if (isRecord(challenges)) {
    for (const [id, list] of Object.entries(challenges)) {
      if (!Array.isArray(list)) continue;
      const ids = [...new Set(list.filter((c): c is string => typeof c === 'string'))];
      if (ids.length > 0) save.challenges[id] = ids;
    }
  }
  if (isDifficultyId(raw['difficulty'])) save.difficulty = raw['difficulty'];
  return save;
}

/** Lower is better (S = 0); unknown grades rank last. */
export function gradeRank(grade: string): number {
  const i = SCORING.grades.findIndex((g) => g.grade === grade);
  return i < 0 ? Number.POSITIVE_INFINITY : i;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A non-negative whole number, or 0. */
function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}
