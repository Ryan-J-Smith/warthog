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
 * Ground rounds fly in the simulation and deal their damage on arrival, so the tracer on screen is
 * the damage being traded. Units drive at ~30 units/s, so even a slow shell's target moves well
 * under its radius + slop in flight.
 */
export const GROUND_ROUNDS: Record<GroundRoundKind, GroundRoundProfile> = {
  /** Infantry: small, fast tracer. */
  smallArms: { speed: 700, hitSlop: 10 },
  /** Tanks: bigger, slower shell. */
  cannon: { speed: 420, hitSlop: 14 },
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
