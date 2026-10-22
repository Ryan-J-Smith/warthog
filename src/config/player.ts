export const PLAYER = {
  maxHp: 100,
  lives: 3,
  respawnDelay: 2.5,
  invulnerableAfterRespawn: 2.0,
  /** Rearm: stay at Low within this radius of the home base for `rearmTime` seconds. */
  rearmRadius: 300,
  rearmTime: 3.0,
  /** Soft map boundary margin; beyond it the aircraft is steered back. */
  boundaryMargin: 120,
  /** Speed smoothing, units / s². */
  acceleration: 220,
  /** Muzzle offset ahead of the aircraft centre. */
  muzzleOffset: 70,
  /** Where ordnance is released relative to the aircraft centre. */
  hardpointOffset: 10,
  /** Low-HP warning threshold. */
  lowHp: 30,
  /** Respawn this far north of the home base — outside the rearm zone, so a respawn during RTB doesn't count as landing. */
  respawnOffset: 380,
} as const;

/** Afterburner (hold Shift): faster, a little less agile, drains the meter. */
export const BOOST = {
  speedMultiplier: 1.65,
  turnMultiplier: 0.75,
  /** Seconds off the key before the meter refills. */
  regenDelay: 0.5,
  /** Speed change rate while boosting / braking, units / s². */
  acceleration: 700,
} as const;

/** Air brake (hold E or C): slow and very agile, for tight gun runs and SAM breaks. */
export const BRAKE = {
  speedFactor: 0.55,
  turnMultiplier: 1.8,
  deceleration: 520,
} as const;

/** Turn easing: seconds to reach the full turn rate from straight flight, and to straighten out. */
export const TURN_EASE = { rampIn: 0.15, rampOut: 0.1 } as const;

/** Spotting view: half-extents of the 1920×1080 viewport divided by zoom. */
export const VIEW = {
  width: 1920,
  height: 1080,
  /** Hidden caches are revealed when overflown at Low within this distance. */
  revealRadius: 140,
} as const;
