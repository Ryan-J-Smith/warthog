import { AIRCRAFT_BASE_HEIGHT, BAND_PROFILES, PLAYER } from '../../config';
import type { GroundRoundKind } from '../../config';
import { initDefense, type DefenseState } from '../defense';
import type { Entity, Pickup, PlayerState, Projectile } from '../entities';
import type { SimEvent } from '../events';
import { DEFAULT_DIFFICULTY, type Difficulty } from '../difficulty';
import type { LevelDefinition } from '../level';
import { DEFAULT_LOADOUT, type PlayerLoadout } from '../loadout';
import { Rng, degToRad, type Vec2 } from '../math';
import type { MissionResults } from './missionResults';
import type { EntityKind, Team } from '../types';
import type { ComboState, ObjectiveState, ReticleState, WorldView, ZoneState } from './worldView';

/** Tag on a friendly structure that has become a forward rearm point. */
export const FORWARD_REARM_TAG = 'forwardRearm';

/** A GAU-8 round in flight (not rendered as a projectile; lands after the travel time). */
export interface PendingRound {
  landsAt: number;
  pos: Vec2;
  damage: number;
}

/** A ground unit's round in flight (rendered from its `groundFire` event; lands at `pos`). */
export interface GroundRound {
  landsAt: number;
  pos: Vec2;
  damage: number;
  round: GroundRoundKind;
  shooterKind: EntityKind;
  /** The shooter's team: rounds only hurt the other side. */
  team: Team;
  /** What it was aimed at (it may have moved or died by the time the round lands). */
  targetId: number;
}

/** A delayed explosion (ammo dump cook-off). */
export interface PendingSecondary {
  at: number;
  pos: Vec2;
}

/** Player combat statistics used for the results screen. */
export interface CombatStats {
  kills: number;
  killPoints: number;
  /** Set-piece bonuses (e.g. BRIDGE DROP ×N). */
  bonusPoints: number;
  friendlyFirePenalty: number;
  /** Skill feats, shown on the debrief. */
  bestChain: number;
  missilesDefeated: number;
  zonesCleared: number;
  pickupsCollected: number;
  /** Player kills per entity kind (challenges: "down 3 gunships"). */
  killsByKind: Partial<Record<EntityKind, number>>;
  /** Hull damage taken (shield hits don't count). */
  hullDamage: number;
  deaths: number;
}

/**
 * Mutable simulation state. Systems mutate it; render layers read it through `WorldView`.
 */
export class World implements WorldView {
  readonly level: LevelDefinition;
  readonly width: number;
  readonly height: number;
  readonly rng: Rng;
  /** The aircraft as upgraded in the hangar (base defence swaps it for armory upgrades mid-mission). */
  loadout: Readonly<PlayerLoadout>;

  time = 0;
  player: PlayerState;
  entities: Entity[] = [];
  projectiles: Projectile[] = [];
  pickups: Pickup[] = [];
  combo: ComboState = { chain: 0, multiplier: 1, expiresAt: 0 };
  /** Defence zones and their member entity ids (filled at mission start). */
  zones: ZoneState[] = [];
  objectives: ObjectiveState[] = [];
  reticle: ReticleState;
  score = 0;
  rtb = false;
  rtbAt: number | null = null;
  ended = false;
  results: MissionResults | null = null;

  /** Global AA fire-rate multiplier (ammo dump destroyed → 0.5). */
  aaFireRate: number;
  pendingRounds: PendingRound[] = [];
  groundRounds: GroundRound[] = [];
  pendingSecondaries: PendingSecondary[] = [];
  stats: CombatStats = { kills: 0, killPoints: 0, bonusPoints: 0, friendlyFirePenalty: 0, bestChain: 0, missilesDefeated: 0, zonesCleared: 0, pickupsCollected: 0, killsByKind: {}, hullDamage: 0, deaths: 0 };
  /** Convoy vehicles that reached the end of their road (score-attack missions). */
  escapes = 0;
  /** Base-defence state (null outside base-defence levels). */
  defense: DefenseState | null;
  /** Group ids that have spawned. */
  spawnedGroups = new Set<string>();
  /** Indices of radio cues already played. */
  playedRadio = new Set<number>();

  private events: SimEvent[] = [];
  private nextEntityId = 1;

  constructor(
    level: LevelDefinition,
    seed: number = level.seed,
    loadout: Readonly<PlayerLoadout> = DEFAULT_LOADOUT,
    readonly difficulty: Readonly<Difficulty> = DEFAULT_DIFFICULTY,
  ) {
    this.level = level;
    this.aaFireRate = difficulty.enemyFireRate;
    this.loadout = loadout;
    this.width = level.width;
    this.height = level.height;
    this.rng = new Rng(seed);
    this.player = createPlayer(level, loadout);
    this.defense = initDefense(level);
    this.reticle = { weapon: 'gun', impact: null, ready: true, onTarget: false, blockedReason: null };
  }

  emit(event: SimEvent): void {
    this.events.push(event);
  }

  /** Remove and return all events emitted since the last drain. */
  drainEvents(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  nextId(): number {
    return this.nextEntityId++;
  }

  findByRef(refId: string): Entity | undefined {
    return this.entities.find((e) => e.refId === refId);
  }

  findById(id: number): Entity | undefined {
    return this.entities.find((e) => e.id === id);
  }

  withTag(tag: string): Entity[] {
    return this.entities.filter((e) => e.tags.includes(tag));
  }

  /** Where the player can rearm: the home base plus any forward points earned this mission. */
  rearmPoints(): Vec2[] {
    const points = [this.homeBasePos()];
    for (const e of this.entities) if (e.alive && e.tags.includes(FORWARD_REARM_TAG)) points.push(e.pos);
    return points;
  }

  /** Home base position (rearm + respawn). */
  homeBasePos(): Vec2 {
    const base = this.findByRef(this.level.homeBaseRefId);
    return base ? base.pos : this.level.player.spawn;
  }

  /** Player height above ground in band units. */
  playerHeight(): number {
    return this.player.alt + AIRCRAFT_BASE_HEIGHT;
  }

  /** Player velocity vector. */
  playerVelocity(): Vec2 {
    const p = this.player;
    return { x: Math.cos(p.heading) * p.speed, y: Math.sin(p.heading) * p.speed };
  }
}

export function fullAmmo(loadout: Readonly<PlayerLoadout>): PlayerState['ammo'] {
  return { ...loadout.ammo };
}

function createPlayer(level: LevelDefinition, loadout: Readonly<PlayerLoadout>): PlayerState {
  return {
    pos: { ...level.player.spawn },
    heading: degToRad(level.player.headingDeg),
    alt: 0,
    targetBand: 'low',
    band: 'low',
    speed: BAND_PROFILES.low.speed,
    energy: 1,
    turnInput: 0,
    turnRate: 0,
    hp: loadout.maxHull,
    maxHp: loadout.maxHull,
    shield: loadout.maxShield,
    maxShield: loadout.maxShield,
    shieldRegenIn: 0,
    boost: loadout.boostCapacity,
    maxBoost: loadout.boostCapacity,
    boosting: false,
    braking: false,
    boostFree: 0,
    overdrive: 0,
    lives: PLAYER.lives,
    alive: true,
    invulnerable: 0,
    respawnIn: 0,
    selectedWeapon: 'gun',
    ammo: fullAmmo(loadout),
    flares: loadout.flares,
    firing: false,
    gunDip: 0,
    rearm: 0,
    lockTargetId: null,
    lockProgress: 0,
    missilesTracking: 0,
    radarLocks: 0,
  };
}
