import type { GroundRoundKind } from '../../config';
import type { Vec2 } from '../math';
import type {
  AltitudeBand,
  EntityKind,
  ExplosionSize,
  MissionOutcome,
  ObjectiveStatus,
  PickupKind,
  PlayerDamageSource,
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
  /** A gun kill that made this strafing pass a multi-kill (`count` = kills so far this pass, ≥ 2). */
  | { type: 'strafeKill'; count: number; pos: Vec2 }
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
  /**
   * Ground battle: a unit fired a round at another ground unit/structure. It lands at `to` after
   * `flightTime` seconds (see `groundRoundImpact`); damage is dealt on arrival, not here.
   */
  | { type: 'groundFire'; shooterKind: EntityKind; round: GroundRoundKind; from: Vec2; to: Vec2; flightTime: number }
  /** A ground round landed. `hit` = it damaged something; `armored` = it struck armor (sparks). */
  | { type: 'groundRoundImpact'; shooterKind: EntityKind; round: GroundRoundKind; pos: Vec2; hit: boolean; armored: boolean }
  // --- Air defence ----------------------------------------------------------
  | { type: 'aaBurst'; entityId: number; pos: Vec2 }
  /** AA laser telegraph: the gun is painting the player (aim line), beam follows. */
  | { type: 'aaAiming'; entityId: number; pos: Vec2 }
  | { type: 'aaBeamStarted'; entityId: number; pos: Vec2 }
  | { type: 'aaBeamStopped'; entityId: number }
  | { type: 'samLockStarted'; siteId: number; pos: Vec2 }
  | { type: 'samLockBroken'; siteId: number }
  | { type: 'samLaunched'; siteId: number; missileId: number; pos: Vec2 }
  | { type: 'samDecoyed'; missileId: number; pos: Vec2 }
  | { type: 'samLostLock'; missileId: number; pos: Vec2 }
  | { type: 'samDetonated'; missileId: number; pos: Vec2; hitPlayer: boolean }
  /** The player out-turned a SAM (it overshot and its seeker lost the aircraft). Skill reward. */
  | { type: 'samEvaded'; missileId: number; pos: Vec2; bonus: number }
  // --- Attack helicopters ----------------------------------------------------
  /** Salvo telegraph: nose glow + aim line. `atPlayer` = aimed at the aircraft (else at a friendly). */
  | { type: 'heliAiming'; entityId: number; pos: Vec2; atPlayer: boolean }
  /** First rocket of a salvo left the rails (the rest ripple after it). */
  | { type: 'heliRocketsFired'; entityId: number; pos: Vec2; heading: number }
  /** A helicopter rocket burst: on the aircraft (`hitPlayer`), on the ground, or at the end of its flight. */
  | { type: 'heliRocketExploded'; pos: Vec2; hitPlayer: boolean; ground: boolean }
  // --- MLRS rocket artillery --------------------------------------------------
  /** Barrage telegraph: its impact rings are on the ground (in `entity.mlrs.strikes`). `atPlayer` = aimed at the aircraft. */
  | { type: 'mlrsTargeting'; entityId: number; pos: Vec2; atPlayer: boolean; center: Vec2 }
  /** First rocket of a barrage left the tubes (the rest ripple after it). */
  | { type: 'mlrsLaunched'; entityId: number; pos: Vec2; heading: number; atPlayer: boolean }
  /** A rocket landed on its ring. `hitPlayer` = the aircraft was inside it. */
  | { type: 'mlrsImpact'; pos: Vec2; radius: number; hitPlayer: boolean }
  // --- Rewards ----------------------------------------------------------------
  | { type: 'pickupSpawned'; pickupId: number; kind: PickupKind; pos: Vec2 }
  | { type: 'pickupCollected'; pickupId: number; kind: PickupKind; pos: Vec2 }
  | { type: 'pickupExpired'; pickupId: number }
  /** Kill chain grew. `multiplier` applies to kill points. */
  | { type: 'comboChanged'; chain: number; multiplier: number }
  /** Chain ended (timed out, or broken by hull damage). */
  | { type: 'comboEnded'; chain: number; reason: 'timeout' | 'hit' }
  /** Every unit in a named defence zone destroyed (e.g. the SAM/AA cluster). */
  | { type: 'zoneCleared'; zoneId: string; name: string; pos: Vec2; bonus: number }
  // --- Player state ---------------------------------------------------------
  /** Hull damage (after the shield). `source` 'beam' = AA laser. */
  | { type: 'playerHit'; pos: Vec2; damage: number; source: PlayerDamageSource }
  /** Damage absorbed by the shield. */
  | { type: 'shieldHit'; pos: Vec2; amount: number; source: PlayerDamageSource }
  | { type: 'shieldDown' }
  /** The shield started regenerating after the regen delay. */
  | { type: 'shieldRegenStarted' }
  | { type: 'shieldFull' }
  | { type: 'boostStarted' }
  | { type: 'boostStopped' }
  /** The boost meter ran dry while the key was held. */
  | { type: 'boostEmpty' }
  | { type: 'brakeStarted' }
  | { type: 'brakeStopped' }
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
