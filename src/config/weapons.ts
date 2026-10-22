import type { AltitudeBand, ArmorClass, WeaponId } from '../sim/types';

/** Bands in which each weapon can be used. */
export const WEAPON_BANDS: Record<WeaponId, readonly AltitudeBand[]> = {
  gun: ['low', 'medium'],
  rockets: ['low', 'medium'],
  maverick: ['medium'],
  bombs: ['medium', 'high'],
};

export const WEAPON_NAMES: Record<WeaponId, string> = {
  gun: 'GAU-8',
  rockets: 'HYDRA',
  maverick: 'MAVERICK',
  bombs: 'MK-82',
};

// Starting / maximum ammo and flare counts live in the player loadout (`DEFAULT_LOADOUT`), so upgrades can change them.

export const GUN = {
  roundsPerSecond: 70,
  /** Seconds from trigger to impact. */
  travelTime: 0.25,
  /** Distance of the pipper ahead of the nose, interpolated Low→Medium. */
  pipperLow: 230,
  pipperMedium: 340,
  spreadLow: 14,
  spreadMedium: 34,
  damageLow: 2.0,
  damageMedium: 1.0,
  /** A round hits an entity if it lands within entity radius + this. */
  hitSlop: 7,
  /**
   * Gun tracking: while firing, the pipper slides back toward the nose by up to `maxDip`
   * of its distance at `dipRate` per second (so it holds on the aim point for ~0.5 s),
   * and recovers at `dipRecovery` per second after release.
   */
  maxDip: 0.5,
  dipRate: 0.7,
  dipRecovery: 2.0,
} as const;

export const ROCKETS = {
  perSalvo: 3,
  cooldown: 0.4,
  rangeLow: 300,
  rangeMedium: 420,
  speed: 700,
  damage: 25,
  splash: 44,
  spreadDeg: 3,
} as const;

export const MAVERICK = {
  cooldown: 0.8,
  lockTime: 0.6,
  lockRange: 700,
  lockConeDeg: 35,
  speed: 520,
  turnRateDeg: 220,
  damage: 200,
  splash: 30,
  life: 5,
  /** Detonates when this close to its target. */
  fuse: 20,
} as const;

export const BOMBS = {
  cooldown: 0.35,
  /**
   * Fall time = factor × aircraft height (band units). Medium ≈ 1.1 s, High ≈ 1.9 s.
   * Bombs land exactly on the CCIP reticle at every altitude: no hidden scatter.
   */
  fallTimePerHeight: 0.82,
  damage: 150,
  splash: 85,
} as const;

/** Popping flares always decoys every SAM missile tracking you (no hidden roll). */
export const FLARES = {
  cooldown: 0.8,
  life: 2.5,
} as const;

/** Damage multiplier by weapon and target armor. */
export const ARMOR_MULTIPLIER: Record<'gun' | 'rocket' | 'maverick' | 'bomb' | 'ground' | 'secondary', Record<ArmorClass, number>> = {
  gun: { soft: 1, armored: 1, hardened: 0 },
  rocket: { soft: 1, armored: 0.5, hardened: 0 },
  maverick: { soft: 1, armored: 1, hardened: 0 },
  bomb: { soft: 1, armored: 1, hardened: 1 },
  ground: { soft: 1, armored: 1, hardened: 1 },
  secondary: { soft: 1, armored: 0.6, hardened: 0.3 },
};
