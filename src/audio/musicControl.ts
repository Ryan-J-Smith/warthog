import type { MissionOutcome } from '../sim/types';

/** The slice of music control the AudioDirector needs (ducking, end-of-mission sting). */
export abstract class MusicControl {
  /**
   * Temporarily lower the music to `level` (0..1) for at least `holdMs`, then release.
   * Overlapping ducks keep the deepest level and the latest release time.
   */
  abstract duck(level: number, holdMs: number): void;
  abstract playSting(outcome: MissionOutcome): void;
}
