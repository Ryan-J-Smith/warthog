import type { ArmorClass, EntityKind, ExplosionSize, Team } from '../sim/types';

export interface AttackerStats {
  range: number;
  cooldown: number;
  damage: number;
}

/** AA laser: telegraphed, then a beam you escape by flying across it (or boosting). */
export interface AaStats {
  range: number;
  /** Telegraph: seconds the aim line paints the aircraft before the beam fires. */
  aimTime: number;
  /** Last part of the telegraph where the line stops tracking and flashes (dodge window). */
  lockTime: number;
  /** How fast the aim line follows the aircraft while tracking, degrees / s. */
  aimTrackDeg: number;
  /** Beam duration, seconds. */
  beamTime: number;
  /** Seconds between beams (divided by the global AA fire-rate multiplier). */
  cooldown: number;
  /** How fast the beam slews toward the aircraft, degrees / s, at Low / Medium. */
  slewDegLow: number;
  slewDegMedium: number;
  /** Damage per second while the beam is on the aircraft, at Low / Medium. */
  dpsLow: number;
  dpsMedium: number;
  /** The beam hits when the aircraft is within this distance of the beam line. */
  hitHalfWidth: number;
}

export interface SamStats {
  range: number;
  lockTime: number;
  reload: number;
  maxInFlight: number;
  missileStartSpeed: number;
  missileMaxSpeed: number;
  missileAccel: number;
  turnRateDeg: number;
  life: number;
  damage: number;
  proximity: number;
  /** Altitude climb rate of the missile, band units / s. */
  climbRate: number;
  /**
   * Seeker gimbal limit, degrees off the nose. If the aircraft gets further off-boresight than this
   * (you out-turned it), the missile loses you: the skill answer to a SAM.
   */
  gimbalDeg: number;
  /** Seconds after launch before the gimbal limit applies (the launch heading is approximate). */
  gimbalArmTime: number;
  /** Style bonus for making one miss. */
  evadeBonus: number;
  /** Lead pursuit: aims at the aircraft's position this fraction of the time-to-go ahead. */
  leadFactor: number;
}

export interface EntityStats {
  team: Team;
  armor: ArmorClass;
  hp: number;
  radius: number;
  explosion: ExplosionSize;
  /** Points when the player destroys it. */
  score: number;
  /** Maverick-lockable and counts as a hostile target for the reticle. */
  lockable: boolean;
  /** A ground unit that other ground units may shoot at. */
  groundTarget: boolean;
  /** Cannot be damaged at all. */
  invulnerable: boolean;
  /** Default path speed for movers. */
  speed: number;
  /** Hull turn rate for movers, degrees / s. */
  turnRateDeg: number;
  attacker: AttackerStats | null;
  aa: AaStats | null;
  sam: SamStats | null;
}

const AA_LASER: AaStats = {
  range: 520,
  aimTime: 1.0,
  lockTime: 0.35,
  aimTrackDeg: 140,
  beamTime: 1.4,
  cooldown: 1.6,
  slewDegLow: 22,
  slewDegMedium: 15,
  dpsLow: 32,
  dpsMedium: 22,
  hitHalfWidth: 34,
};

const base = {
  lockable: false,
  groundTarget: false,
  invulnerable: false,
  speed: 0,
  turnRateDeg: 90,
  attacker: null,
  aa: null,
  sam: null,
} as const;

export const ENTITY_STATS: Record<EntityKind, EntityStats> = {
  tank: {
    ...base,
    team: 'enemy',
    armor: 'armored',
    hp: 60,
    radius: 34,
    explosion: 'medium',
    score: 300,
    lockable: true,
    groundTarget: true,
    speed: 30,
    attacker: { range: 380, cooldown: 4, damage: 12 },
  },
  truck: {
    ...base,
    team: 'enemy',
    armor: 'soft',
    hp: 20,
    radius: 24,
    explosion: 'small',
    score: 100,
    lockable: true,
    groundTarget: true,
    speed: 36,
  },
  infantry: {
    ...base,
    team: 'enemy',
    armor: 'soft',
    hp: 20,
    radius: 24,
    explosion: 'small',
    score: 150,
    groundTarget: true,
    attacker: { range: 220, cooldown: 3, damage: 3 },
  },
  aaGun: {
    ...base,
    team: 'enemy',
    armor: 'soft',
    hp: 40,
    radius: 26,
    explosion: 'medium',
    score: 400,
    lockable: true,
    groundTarget: true,
    aa: AA_LASER,
  },
  mobileAa: {
    ...base,
    team: 'enemy',
    armor: 'soft',
    hp: 40,
    radius: 26,
    explosion: 'medium',
    score: 400,
    lockable: true,
    groundTarget: true,
    speed: 30,
    aa: AA_LASER,
  },
  samSite: {
    ...base,
    team: 'enemy',
    armor: 'soft',
    hp: 80,
    radius: 55,
    explosion: 'large',
    score: 1500,
    lockable: true,
    sam: {
      range: 1250,
      lockTime: 2.0,
      reload: 4,
      maxInFlight: 2,
      missileStartSpeed: 300,
      missileMaxSpeed: 520,
      missileAccel: 600,
      turnRateDeg: 80,
      life: 6,
      damage: 75,
      proximity: 30,
      climbRate: 1.6,
      gimbalDeg: 50,
      gimbalArmTime: 0.8,
      evadeBonus: 300,
      leadFactor: 0.3,
    },
  },
  bridge: {
    ...base,
    team: 'enemy',
    armor: 'hardened',
    hp: 300,
    radius: 100,
    explosion: 'huge',
    score: 1000,
  },
  ammoDump: {
    ...base,
    team: 'enemy',
    armor: 'soft',
    hp: 150,
    radius: 110,
    explosion: 'huge',
    score: 2000,
  },
  cache: {
    ...base,
    team: 'enemy',
    armor: 'soft',
    hp: 30,
    radius: 22,
    explosion: 'medium',
    score: 750,
  },
  /** Lane-war enemy HQ: bombs (and friendly armour that reaches it) only. */
  enemyHq: {
    ...base,
    team: 'enemy',
    armor: 'hardened',
    hp: 1500,
    radius: 140,
    explosion: 'huge',
    score: 5000,
    groundTarget: true,
  },
  outpost: {
    ...base,
    team: 'friendly',
    armor: 'hardened',
    hp: 1400,
    radius: 120,
    explosion: 'huge',
    score: 0,
    groundTarget: true,
  },
  homeBase: {
    ...base,
    team: 'friendly',
    armor: 'hardened',
    hp: 1,
    radius: 200,
    explosion: 'huge',
    score: 0,
    invulnerable: true,
  },
  friendlyTank: {
    ...base,
    team: 'friendly',
    armor: 'armored',
    hp: 60,
    radius: 34,
    explosion: 'medium',
    score: 0,
    groundTarget: true,
    attacker: { range: 380, cooldown: 6, damage: 5 },
  },
  friendlyInfantry: {
    ...base,
    team: 'friendly',
    armor: 'soft',
    hp: 20,
    radius: 24,
    explosion: 'small',
    score: 0,
    groundTarget: true,
    attacker: { range: 220, cooldown: 4, damage: 2 },
  },
  /** Lane-war friendly HQ: the mission is lost when it falls. */
  friendlyHq: {
    ...base,
    team: 'friendly',
    armor: 'hardened',
    hp: 2400,
    radius: 140,
    explosion: 'huge',
    score: 0,
    groundTarget: true,
  },
};

/** Ammo dump cook-off. */
export const SECONDARIES = {
  count: 7,
  duration: 2.6,
  scatter: 110,
  damage: 40,
  splash: 55,
} as const;

/** Vehicles closer than this in front of a mover make it wait (simple convoy spacing). */
export const CONVOY_GAP = 60;
