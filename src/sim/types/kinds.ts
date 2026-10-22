/** Shared vocabulary for the simulation. String unions keep level data and events readable. */

export type AltitudeBand = 'low' | 'medium' | 'high';

export const ALTITUDE_BANDS: readonly AltitudeBand[] = ['low', 'medium', 'high'];

export type Team = 'friendly' | 'enemy' | 'neutral';

export type EntityKind =
  // enemy vehicles & units
  | 'tank'
  | 'truck'
  | 'infantry'
  | 'aaGun'
  | 'mobileAa'
  | 'samSite'
  // enemy structures
  | 'bridge'
  | 'ammoDump'
  | 'cache'
  // friendly
  | 'outpost'
  | 'homeBase'
  | 'friendlyTank'
  | 'friendlyInfantry';

export type ArmorClass = 'soft' | 'armored' | 'hardened';

export type ProjectileKind =
  | 'rocket'
  | 'maverick'
  | 'bomb'
  | 'aaRound'
  | 'samMissile'
  | 'tankShell'
  | 'flare';

export type WeaponId = 'gun' | 'rockets' | 'maverick' | 'bombs';

export const WEAPON_ORDER: readonly WeaponId[] = ['gun', 'rockets', 'maverick', 'bombs'];

export type ExplosionSize = 'small' | 'medium' | 'large' | 'huge';

export type ObjectiveStatus = 'active' | 'completed' | 'failed';

export type RadioTone = 'info' | 'urgent' | 'good' | 'bad';

export type MissionOutcome = 'victory' | 'defeat';

/** What hurt the player. */
export type PlayerDamageSource = 'aa' | 'beam' | 'sam' | 'splash';

/** Collectible dropped by destroyed enemies. */
export type PickupKind =
  /** Refills a share of every weapon's ammo and a flare. */
  | 'ammo'
  /** Repairs hull. */
  | 'repair'
  /** Fills the boost meter and grants a few seconds of unlimited boost. */
  | 'boost'
  /** Temporary GAU-8 overdrive: double damage, faster fire. */
  | 'overdrive';
