/**
 * How a bot reacts to SAM threats. Humans mostly press flares (Q) first; the design wants
 * players to learn "dive to break".
 */
export type SamResponse = 'none' | 'flare' | 'dive' | 'flareAndDive';

/**
 * A crude model of pilot skill. Bots react on the exact frame by default, which is
 * superhuman; these knobs add human-ish delays and sloppiness so the numbers mean something.
 */
export interface SkillProfile {
  readonly name: string;
  /** Seconds between a threat appearing (lock tone / launch) and the pilot reacting. */
  readonly reaction: number;
  readonly samResponse: SamResponse;
  /** Dive to Low as soon as a SAM starts locking (before launch), when not mid-attack. */
  readonly diveOnLock: boolean;
  /** Weave while AA guns are shooting, outside of committed attack runs. */
  readonly jinks: boolean;
  /** Seconds the reticle must be lit before the trigger is pulled. */
  readonly triggerDelay: number;
  /** Seconds the trigger stays down after the reticle goes dark (spray). */
  readonly releaseLag: number;
  /** Bomb release timing error, seconds (uniform ±). */
  readonly releaseError: number;
  /** Heading wobble amplitude, radians (imperfect keyboard steering). */
  readonly aimWobble: number;
  /** Go home to repair when HP falls to or below this (0 = never). */
  readonly repairAtHp: number;
}

export const ACE: SkillProfile = {
  name: 'ace',
  reaction: 0.2,
  samResponse: 'flareAndDive',
  diveOnLock: false,
  jinks: true,
  triggerDelay: 0.03,
  releaseLag: 0.05,
  releaseError: 0.03,
  aimWobble: 0.02,
  repairAtHp: 35,
};

export const AVERAGE: SkillProfile = {
  name: 'average',
  reaction: 0.5,
  samResponse: 'flareAndDive',
  diveOnLock: false,
  jinks: false,
  triggerDelay: 0.15,
  releaseLag: 0.2,
  releaseError: 0.12,
  aimWobble: 0.07,
  repairAtHp: 25,
};

export const ROOKIE: SkillProfile = {
  name: 'rookie',
  reaction: 0.9,
  samResponse: 'flare',
  diveOnLock: false,
  jinks: false,
  triggerDelay: 0.25,
  releaseLag: 0.35,
  releaseError: 0.25,
  aimWobble: 0.14,
  repairAtHp: 0,
};

export const SKILLS: readonly SkillProfile[] = [ACE, AVERAGE, ROOKIE];
