export const SCORING = {
  primaryObjective: 5000,
  optionalObjective: 2500,
  friendlyKillPenalty: 1000,
  /** Bonus per vehicle dropped into the river with the bridge. */
  bridgeDropBonus: 250,
  /** "Catch them on the bridge" callout when the column is this many seconds from the span. */
  bridgeCalloutEta: 15,
  /** Per HP of friendly structure damage the player causes. */
  friendlyDamagePenalty: 2,
  timeBonusPerSecondUnderPar: 10,
  lifeBonus: 1000,
  /** Mission auto-ends this long after RTB is called. */
  rtbGrace: 90,
  grades: [
    { grade: 'S', min: 30000 },
    { grade: 'A', min: 21000 },
    { grade: 'B', min: 16000 },
    { grade: 'C', min: 8000 },
    { grade: 'D', min: -Infinity },
  ],
} as const;
