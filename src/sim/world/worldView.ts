import type { Entity, Pickup, PlayerState, Projectile } from '../entities';
import type { MissionResults } from './missionResults';
import type { LevelDefinition } from '../level';
import type { PlayerLoadout } from '../loadout';
import type { Vec2 } from '../math';
import type { ObjectiveStatus, WeaponId } from '../types';

/** Runtime objective state for the HUD. */
export interface ObjectiveState {
  id: string;
  /** Objective type from the level definition (defend objectives are drawn blue, attack amber). */
  kind: 'stopColumn' | 'defend' | 'destroy';
  title: string;
  primary: boolean;
  status: ObjectiveStatus;
  /** Short live detail, e.g. "Column ETA 1:42" or "Outpost 64%". */
  detail: string;
  /** 0..1 progress/health indicator where meaningful, else null. */
  meter: number | null;
  /** World position to point at with off-screen arrows / minimap, if any. */
  marker: Vec2 | null;
}

/** Kill chain. */
export interface ComboState {
  /** Kills in the current chain (0 = no chain). */
  chain: number;
  /** Kill-point multiplier for the next kill. */
  multiplier: number;
  /** Sim time the chain lapses without another kill. */
  expiresAt: number;
}

/** Runtime state of a defence zone. */
export interface ZoneState {
  id: string;
  name: string;
  center: Vec2;
  radius: number;
  memberIds: number[];
  cleared: boolean;
}

/** Where the selected weapon will hit and whether it can fire. */
export interface ReticleState {
  weapon: WeaponId;
  /** Predicted impact point on the ground, or null if the weapon can't reach the ground. */
  impact: Vec2 | null;
  /** Can the weapon fire right now (band + ammo)? */
  ready: boolean;
  /** Is a valid hostile target under the reticle? (Xevious-style light-up.) */
  onTarget: boolean;
  /** Reason text when not ready, e.g. "TOO LOW", "OUT OF RANGE", "NO AMMO". */
  blockedReason: string | null;
}

/** Read-only view of the world for render, audio and HUD layers. */
export interface WorldView {
  readonly level: LevelDefinition;
  /** The aircraft as upgraded (max ammo, shield, boost…). */
  readonly loadout: Readonly<PlayerLoadout>;
  /** Simulation time in seconds. */
  readonly time: number;
  readonly width: number;
  readonly height: number;
  readonly player: Readonly<PlayerState>;
  readonly entities: readonly Entity[];
  readonly projectiles: readonly Projectile[];
  readonly pickups: readonly Pickup[];
  readonly combo: Readonly<ComboState>;
  readonly zones: readonly ZoneState[];
  readonly objectives: readonly ObjectiveState[];
  readonly reticle: Readonly<ReticleState>;
  readonly score: number;
  /** True once every primary objective is resolved and the player should return to base. */
  readonly rtb: boolean;
  /** Sim time at which RTB was called (mission auto-ends `SCORING.rtbGrace` seconds later). */
  readonly rtbAt: number | null;
  readonly ended: boolean;
  /** Where the player can rearm: the home base plus forward points earned this mission. */
  rearmPoints(): Vec2[];
  /** Final results once the mission has ended. */
  readonly results: MissionResults | null;
}
