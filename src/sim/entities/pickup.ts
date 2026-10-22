import type { Vec2 } from '../math';
import type { PickupKind } from '../types';

/** A collectible floating over the battlefield, dropped by a destroyed enemy or a supply drop. */
export interface Pickup {
  id: number;
  kind: PickupKind;
  pos: Vec2;
  /** Sim time it appeared (for the pop-in animation). */
  spawnedAt: number;
  /** Sim time it disappears if not collected. */
  expiresAt: number;
}
