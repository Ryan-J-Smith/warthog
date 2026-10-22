import type { WeaponId } from '../types';

/**
 * Player controls for one frame. `turn` and `fire` are held states; the rest are
 * edge-triggered ("pressed this frame") and applied to the first fixed step only.
 */
export interface ControlInput {
  /** -1 = turn left, +1 = turn right. */
  turn: number;
  fire: boolean;
  /** Held: afterburner (drains the boost meter). */
  boost: boolean;
  /** Held: air brake (slower, much tighter turns). */
  brake: boolean;
  climb: boolean;
  dive: boolean;
  flare: boolean;
  select: WeaponId | null;
  /** Base defence: launch the next wave (edge-triggered). */
  ready: boolean;
}

export const NO_INPUT: Readonly<ControlInput> = {
  turn: 0,
  fire: false,
  boost: false,
  brake: false,
  climb: false,
  dive: false,
  flare: false,
  select: null,
  ready: false,
};
