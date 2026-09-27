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

/** Spotting view: half-extents of the 1920×1080 viewport divided by zoom. */
export const VIEW = {
  width: 1920,
  height: 1080,
  /** Hidden caches are revealed when overflown at Low within this distance. */
  revealRadius: 140,
} as const;
