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

/**
 * Attack-helicopter salvo cycle: `aiming` is the telegraph (nose glow + aim line; it tracks, then
 * holds still for the last `lockTime` s), `firing` ripples the rockets down the held line.
 */
export type HeliPhase = 'idle' | 'aiming' | 'firing';

/** Attack-helicopter brain state (see `HelicopterSystem`). */
export interface HeliState {
  /** Patrol route: looped if its ends meet, otherwise flown once (then it loiters at the end). Null = loiter. */
  path: Vec2[] | null;
  waypoint: number;
  /** Point it circles when it has no route. */
  loiter: Vec2;
  /** Velocity, world units / s. Independent of the nose: gunships strafe sideways. */
  vel: Vec2;
  /** What it is attacking: -1 = the player, an entity id, or null. */
  targetId: number | null;
  phase: HeliPhase;
  /** Seconds left in the current phase (aiming) or until the next rocket (firing). */
  phaseTime: number;
  /** Seconds until the next salvo telegraph may start. */
  cooldown: number;
  /** Where the current salvo is aimed (ground point or predicted aircraft position). */
  aimPoint: Vec2;
  rocketsLeft: number;
  /** Strafing direction around the target (+1 / -1) and seconds until it flips. */
  orbit: number;
  orbitFlipIn: number;
  /** Flying height above ground, band units. */
  height: number;
}

/**
 * One impact ring of an MLRS barrage. Shown from `shownAt`; its rocket launches at `launchAt` and
 * lands at `impactAt` exactly on `pos`. Anything inside `radius` then is hit.
 */
export interface MlrsStrike {
  pos: Vec2;
  radius: number;
  shownAt: number;
  launchAt: number;
  impactAt: number;
  /** Its rocket is in the air (it lands even if the launcher dies). */
  launched: boolean;
  /** Projectile id of its rocket once launched (visual only), else null. */
  rocketId: number | null;
  /** Aimed at the aircraft (else at a friendly). */
  atPlayer: boolean;
}

/** MLRS rocket-artillery brain state (see `MlrsSystem`). */
export interface MlrsState {
  /** What it is shelling: -1 = the player, an entity id, or null. */
  targetId: number | null;
  /** Seconds until the next barrage may start. */
  cooldown: number;
  /** Rings of the barrage in progress (pending and in flight), in impact order. */
  strikes: MlrsStrike[];
  /** Barrages started so far (radio cues fire on the first). */
  barrages: number;
}

/** Units that shoot at ground targets (tanks, infantry, friendly defenders). */
export interface AttackerState {
  targetId: number | null;
  range: number;
  cooldown: number;
  /** Scales this unit's damage per shot (base-defence structures field upgraded units). */
  damageMultiplier: number;
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
  /** Attack helicopters only (they fly; no `mover`). */
  heli: HeliState | null;
  /** MLRS rocket artillery only. */
  mlrs: MlrsState | null;
}
