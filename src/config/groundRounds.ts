import type { EntityKind } from '../sim/types';

/** The rounds ground units trade with each other (kept out of ENTITY_STATS on purpose). */
export type GroundRoundKind = 'smallArms' | 'cannon' | 'autocannon';

export interface GroundRoundProfile {
  /** Travel speed, world units / s (flight time = distance / speed). */
  speed: number;
  /** A round hits a body whose edge is within this distance of where it lands. */
  hitSlop: number;
}

/**
 * Ground rounds fly in the simulation and deal their damage on arrival, so the bullet on screen is
 * the damage being traded. They are slow on purpose (MOBA-style, watchable). Units drive at ~30
 * units/s, so a cannon shell at full range (~1.7 s) can lose a moving target by ~50 units: its slop
 * is wide enough to keep the hit rate where it was with fast rounds (~89% in Three Roads; most
 * misses are targets that died in flight).
 */
export const GROUND_ROUNDS: Record<GroundRoundKind, GroundRoundProfile> = {
  /** Infantry: small, quick bullets. */
  smallArms: { speed: 320, hitSlop: 14 },
  /** Tanks: big, slow shell. */
  cannon: { speed: 220, hitSlop: 32 },
  /** Mobile AA / AA guns (if they ever engage ground targets): quick, bright. */
  autocannon: { speed: 900, hitSlop: 10 },
};

/** Which round each shooter fires (anything not listed fires small arms). */
const ROUND_BY_KIND: Partial<Record<EntityKind, GroundRoundKind>> = {
  tank: 'cannon',
  friendlyTank: 'cannon',
  mobileAa: 'autocannon',
  aaGun: 'autocannon',
};

export function groundRoundFor(kind: EntityKind): GroundRoundKind {
  return ROUND_BY_KIND[kind] ?? 'smallArms';
}
