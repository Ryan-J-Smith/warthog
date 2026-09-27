import type { Vec2 } from '../math';
import type { AltitudeBand, WeaponId } from '../types';

export interface PlayerState {
  pos: Vec2;
  /** Radians; 0 = east. */
  heading: number;
  /** Continuous altitude in band units: 0 = Low, 1 = Medium, 2 = High. */
  alt: number;
  /** Band the player has asked for with W/S. `alt` moves toward it. */
  targetBand: AltitudeBand;
  /** Effective band derived from `alt` (Low < 0.5 ≤ Medium < 1.5 ≤ High). */
  band: AltitudeBand;
  /** Current ground speed in world units per second. */
  speed: number;
  /** Energy multiplier from diving (>1) or climbing (<1); decays back to 1. */
  energy: number;
  /** Current turn input in [-1, 1] (for banking visuals). */
  turnInput: number;
  hp: number;
  maxHp: number;
  lives: number;
  alive: boolean;
  /** Seconds of post-respawn invulnerability remaining. */
  invulnerable: number;
  /** Seconds until respawn while dead. */
  respawnIn: number;
  selectedWeapon: WeaponId;
  ammo: Record<WeaponId, number>;
  flares: number;
  firing: boolean;
  /**
   * 0..GUN.maxDip: how far the gun pipper has slid back toward the nose while firing
   * (simulates pushing the nose down onto the target during a gun run).
   */
  gunDip: number;
  /** 0..1 progress of rearming over home base. */
  rearm: number;
  /** Maverick lock: target entity id and 0..1 progress. */
  lockTargetId: number | null;
  lockProgress: number;
  /** Number of SAM missiles currently tracking the player. */
  missilesTracking: number;
  /** Number of SAM sites currently building a lock. */
  radarLocks: number;
}
