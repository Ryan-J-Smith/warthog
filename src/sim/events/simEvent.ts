import type { Vec2 } from '../math';
import type {
  AltitudeBand,
  EntityKind,
  ExplosionSize,
  MissionOutcome,
  ObjectiveStatus,
  RadioTone,
  Team,
  WeaponId,
} from '../types';

/**
 * Everything noteworthy that happened during one simulation step.
 * Render, audio and HUD layers consume these; the simulation never reads them back.
 */
export type SimEvent =
  // --- Player weapons -------------------------------------------------------
  /** Emitted every step the gun is firing. `muzzle` is the nose, `target` the pipper centre. */
  | { type: 'gunFiring'; muzzle: Vec2; target: Vec2; heading: number }
  | { type: 'gunStarted' }
  | { type: 'gunStopped' }
  /** A GAU-8 round landed. `hit` = it damaged something; `armored` = it hit armor (sparks). */
  | { type: 'gunImpact'; pos: Vec2; hit: boolean; armored: boolean }
  | { type: 'rocketLaunched'; pos: Vec2; heading: number }
  | { type: 'missileLaunched'; pos: Vec2; heading: number }
  | { type: 'bombReleased'; pos: Vec2 }
  /** Ordnance detonation (rocket, Maverick, bomb, tank shell). */
  | { type: 'ordnanceImpact'; weapon: 'rocket' | 'maverick' | 'bomb' | 'tankShell'; pos: Vec2; radius: number }
  | { type: 'flareDeployed'; pos: Vec2 }
  | { type: 'weaponSelected'; weapon: WeaponId }
  | { type: 'weaponUnavailable'; weapon: WeaponId; reason: 'noAmmo' | 'tooLow' | 'tooHigh' | 'noTarget' }
  /** Maverick lock acquired on a target. */
  | { type: 'lockAcquired'; targetId: number }
  // --- Entities -------------------------------------------------------------
  | { type: 'entityDamaged'; entityId: number; kind: EntityKind; pos: Vec2; amount: number }
  | { type: 'entityDestroyed'; entityId: number; kind: EntityKind; team: Team; pos: Vec2; size: ExplosionSize }
  /** Extra chained blasts (ammo dump cook-off, etc.). */
  | { type: 'secondaryExplosion'; pos: Vec2; size: ExplosionSize }
  | { type: 'entitySpotted'; entityId: number; kind: EntityKind }
  | { type: 'entityRevealed'; entityId: number; kind: EntityKind; pos: Vec2 }
  /** Ambient ground battle: a unit fired at another ground unit/structure. */
  | { type: 'groundFire'; shooterKind: EntityKind; from: Vec2; to: Vec2 }
  // --- Air defence ----------------------------------------------------------
  | { type: 'aaBurst'; entityId: number; pos: Vec2 }
  | { type: 'samLockStarted'; siteId: number; pos: Vec2 }
  | { type: 'samLockBroken'; siteId: number }
  | { type: 'samLaunched'; siteId: number; missileId: number; pos: Vec2 }
  | { type: 'samDecoyed'; missileId: number; pos: Vec2 }
  | { type: 'samLostLock'; missileId: number; pos: Vec2 }
  | { type: 'samDetonated'; missileId: number; pos: Vec2; hitPlayer: boolean }
  // --- Player state ---------------------------------------------------------
  | { type: 'playerHit'; pos: Vec2; damage: number; source: 'aa' | 'sam' | 'splash' }
  | { type: 'playerDestroyed'; pos: Vec2 }
  | { type: 'playerRespawned'; pos: Vec2 }
  | { type: 'bandChanged'; from: AltitudeBand; to: AltitudeBand }
  | { type: 'targetBandChanged'; to: AltitudeBand }
  | { type: 'rearmStarted' }
  | { type: 'rearmCancelled' }
  | { type: 'rearmCompleted' }
  // --- Mission --------------------------------------------------------------
  | { type: 'objectiveUpdated'; objectiveId: string; status: ObjectiveStatus }
  | { type: 'radio'; speaker: string; text: string; tone: RadioTone }
  | { type: 'scoreAwarded'; points: number; reason: string; pos: Vec2 | null }
  | { type: 'missionEnded'; outcome: MissionOutcome };

export type SimEventType = SimEvent['type'];

/** Narrow a SimEvent union member by its `type` tag. */
export type SimEventOf<T extends SimEventType> = Extract<SimEvent, { type: T }>;
