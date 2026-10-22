import type { Vec2 } from '../math';
import type { ArmorClass, EntityKind, Team } from '../types';

/** Ground-unit path following. */
export interface MoverState {
  path: Vec2[];
  /** Index of the waypoint currently being driven toward. */
  waypoint: number;
  speed: number;
  /** When true the unit is holding position (reached the end of its path or a stop point). */
  halted: boolean;
  /** Stop on reaching this waypoint index (e.g. column stalled at a destroyed bridge). */
  stopAtWaypoint: number | null;
}

/**
 * AA laser cycle: `aiming` paints the aircraft with a tracking line (it stops tracking and flashes
 * for the last `lockTime` s), `firing` is the beam, slewing toward the aircraft at a limited rate.
 */
export type AaPhase = 'idle' | 'aiming' | 'firing' | 'cooldown';

/** Anti-aircraft laser state (aaGun, mobileAa). */
export interface AaState {
  range: number;
  phase: AaPhase;
  /** Seconds left in the current phase. */
  phaseTime: number;
  /** Direction of the aim line / beam, radians. */
  beamAngle: number;
  /** Is the beam on the aircraft right now? */
  beamOnTarget: boolean;
  /** Is the gun aiming at or firing on the player? */
  engaging: boolean;
}

/** SAM site state. */
export interface SamState {
  range: number;
  /** 0..1 progress of the radar lock on the player. */
  lock: number;
  locking: boolean;
  reload: number;
  missilesInFlight: number;
  /** Heading of the launcher rails (radians) for rendering. */
  launcherHeading: number;
}

/** Units that shoot at ground targets (tanks, infantry, friendly defenders). */
export interface AttackerState {
  targetId: number | null;
  range: number;
  cooldown: number;
}

export interface Entity {
  /** Unique runtime id. */
  id: number;
  /** Optional stable id from level data (used by objectives & triggers). */
  refId: string | null;
  kind: EntityKind;
  team: Team;
  armor: ArmorClass;
  pos: Vec2;
  /** Hull heading in radians; 0 = east. */
  heading: number;
  /** Turret/launcher heading in radians for units with a rotating top. */
  turretHeading: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  /** Collision/hit radius in world units. */
  radius: number;
  /** Has the player ever seen this entity? Threat rings & minimap only show spotted threats. */
  spotted: boolean;
  /** Hidden until revealed (caches). Hidden entities are not rendered. */
  hidden: boolean;
  tags: string[];
  /** Sim time (s) at which the entity died, or null. */
  diedAt: number | null;
  mover: MoverState | null;
  aa: AaState | null;
  sam: SamState | null;
  attacker: AttackerState | null;
}
