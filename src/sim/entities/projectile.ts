import type { Vec2 } from '../math';
import type { ProjectileKind, Team } from '../types';

export interface Projectile {
  id: number;
  kind: ProjectileKind;
  team: Team;
  pos: Vec2;
  vel: Vec2;
  /** Direction of travel in radians (for sprite rotation). */
  heading: number;
  /**
   * Height above ground in band units (0 = ground). The player flies at `player.alt + AIRCRAFT_BASE_HEIGHT`.
   * Used for 2.5D rendering: bombs fall toward 0, SAMs climb from 0, AA rounds rise toward the player.
   */
  alt: number;
  age: number;
  /** Seconds before the projectile expires. */
  life: number;
  /** Homing target: an entity id, or -1 for the player. null = unguided. */
  targetId: number | null;
  /** Whether a homing projectile has lost its lock (flies straight). */
  lostLock: boolean;
  /** Impact point for ballistic ordnance (bombs, rockets); null otherwise. */
  aimPoint: Vec2 | null;
  damage: number;
  splashRadius: number;
  /** Entity that fired it (SAM site, AA gun, tank), or null for the player. */
  sourceId: number | null;
  /** Height the projectile started at (band units), for altitude interpolation. */
  startAlt: number;
  /** Distance to target at launch, for altitude interpolation of guided weapons. */
  startDistance: number;
}
