import type { ArmorClass, EntityKind, ExplosionSize, Team } from '../sim/types';

export interface AttackerStats {
  range: number;
  cooldown: number;
  damage: number;
}

export interface AaStats {
  range: number;
  roundsPerBurst: number;
  roundInterval: number;
  burstPause: number;
  roundSpeed: number;
  roundDamage: number;
  /** Aim error radius at Low / Medium. */
  spreadLow: number;
  spreadMedium: number;
  /** A round hits the player within this 2D distance. */
  hitRadius: number;
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

const SHILKA: AaStats = {
  range: 520,
  roundsPerBurst: 10,
  roundInterval: 0.05,
  burstPause: 1.2,
  roundSpeed: 900,
  roundDamage: 2,
  spreadLow: 30,
  spreadMedium: 50,
  hitRadius: 22,
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
    aa: SHILKA,
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
    aa: SHILKA,
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
      missileMaxSpeed: 700,
      missileAccel: 600,
      turnRateDeg: 110,
      life: 6,
      damage: 55,
      proximity: 30,
      climbRate: 1.6,
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
