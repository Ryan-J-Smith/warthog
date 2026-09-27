import type { AudioKey } from '../assets';
import type { VoicePolicy } from './voiceLimiter';

/** Runtime mix settings for one sound. The files already carry the broad loudness balance. */
export interface MixSpec {
  /** Linear gain before distance attenuation. */
  volume: number;
  /** Random playback-rate spread (0.05 = ±5%) so repeated one-shots don't sound identical. */
  vary?: number;
  /** Max simultaneous voices of this key (default 4). */
  cap?: number;
  /** What happens at the cap (default 'drop'). */
  policy?: VoicePolicy;
  /** Ignore retriggers closer together than this. */
  minIntervalMs?: number;
}

export const MIX: Record<AudioKey, MixSpec> = {
  // Music (the MusicManager scales these by its own music volume)
  musicTitle: { volume: 1 },
  musicMission: { volume: 0.85 },
  stingVictory: { volume: 1 },
  stingDefeat: { volume: 1 },

  // Player aircraft & weapons
  engineLoop: { volume: 0.5 },
  gunLoop: { volume: 0.95 },
  gunTail: { volume: 0.95, cap: 2, policy: 'steal' },
  gunImpacts: { volume: 0.7, vary: 0.07, cap: 3 },
  rocketLaunch: { volume: 0.85, vary: 0.05, cap: 3 },
  missileLaunch: { volume: 0.95, vary: 0.03, cap: 2, policy: 'steal' },
  bombRelease: { volume: 0.8, vary: 0.04, cap: 2 },
  bombWhistle: { volume: 0.5, vary: 0.04, cap: 3, policy: 'steal' },
  lockTone: { volume: 0.7, cap: 1 },
  flare: { volume: 0.75, vary: 0.05, cap: 2, policy: 'steal' },
  dryFire: { volume: 0.8, cap: 1, minIntervalMs: 250 },
  weaponSwitch: { volume: 0.9, cap: 1, policy: 'steal' },

  // Explosions & impacts
  explosionSmall: { volume: 0.8, vary: 0.06, cap: 5, policy: 'steal' },
  explosionMedium: { volume: 0.9, vary: 0.05, cap: 4, policy: 'steal' },
  explosionLarge: { volume: 1, vary: 0.04, cap: 3, policy: 'steal' },
  explosionHuge: { volume: 1, vary: 0.03, cap: 2, policy: 'steal' },

  // Enemy fire & threats
  aaFire: { volume: 0.75, vary: 0.05, cap: 4 },
  samLaunch: { volume: 0.95, vary: 0.03, cap: 2, policy: 'steal' },
  rwrLock: { volume: 0.55, cap: 2 },
  rwrLaunch: { volume: 0.6 },
  tankFire: { volume: 0.75, vary: 0.06, cap: 3, minIntervalMs: 90 },
  smallArms: { volume: 0.65, vary: 0.08, cap: 3, minIntervalMs: 120 },
  battleAmbience: { volume: 0.55 },

  // Player state
  playerHit: { volume: 0.85, vary: 0.06, cap: 2, minIntervalMs: 70 },
  playerExplode: { volume: 1, cap: 1, policy: 'steal' },
  rearmLoop: { volume: 0.6 },
  rearmComplete: { volume: 0.75, cap: 1 },
  lowHealth: { volume: 0.55, cap: 1 },

  // Radio & UI
  radioIn: { volume: 0.7, cap: 1, policy: 'steal' },
  radioOut: { volume: 0.7, cap: 1, policy: 'steal' },
  objectiveComplete: { volume: 0.85, cap: 1, policy: 'steal' },
  objectiveFailed: { volume: 0.85, cap: 1, policy: 'steal' },
  uiMove: { volume: 0.8, cap: 2, policy: 'steal' },
  uiConfirm: { volume: 0.85, cap: 1, policy: 'steal' },
  uiBack: { volume: 0.8, cap: 1, policy: 'steal' },
  scoreTick: { volume: 0.55, cap: 3, policy: 'steal' },
};

/** Maximum simultaneous one-shots across all keys. */
export const GLOBAL_VOICE_CAP = 32;
