import { AIRCRAFT_BASE_HEIGHT, BAND_PROFILES, FLARES, PLAYER, WEAPON_AMMO } from '../../config';
import type { Entity, PlayerState, Projectile } from '../entities';
import type { SimEvent } from '../events';
import type { LevelDefinition } from '../level';
import { Rng, degToRad, type Vec2 } from '../math';
import type { MissionResults } from './missionResults';
import type { ObjectiveState, ReticleState, WorldView } from './worldView';

/** A GAU-8 round in flight (not rendered as a projectile; lands after the travel time). */
export interface PendingRound {
  landsAt: number;
  pos: Vec2;
  damage: number;
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
}

/**
 * Mutable simulation state. Systems mutate it; render layers read it through `WorldView`.
 */
export class World implements WorldView {
  readonly level: LevelDefinition;
  readonly width: number;
  readonly height: number;
  readonly rng: Rng;

  time = 0;
  player: PlayerState;
  entities: Entity[] = [];
  projectiles: Projectile[] = [];
  objectives: ObjectiveState[] = [];
  reticle: ReticleState;
  score = 0;
  rtb = false;
  rtbAt: number | null = null;
  ended = false;
  results: MissionResults | null = null;

  /** Global AA fire-rate multiplier (ammo dump destroyed → 0.5). */
  aaFireRate = 1;
  pendingRounds: PendingRound[] = [];
  pendingSecondaries: PendingSecondary[] = [];
  stats: CombatStats = { kills: 0, killPoints: 0, bonusPoints: 0, friendlyFirePenalty: 0 };
  /** Group ids that have spawned. */
  spawnedGroups = new Set<string>();
  /** Indices of radio cues already played. */
  playedRadio = new Set<number>();

  private events: SimEvent[] = [];
  private nextEntityId = 1;

  constructor(level: LevelDefinition, seed: number = level.seed) {
    this.level = level;
    this.width = level.width;
    this.height = level.height;
    this.rng = new Rng(seed);
    this.player = createPlayer(level);
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

export function fullAmmo(): PlayerState['ammo'] {
  return { ...WEAPON_AMMO };
}

function createPlayer(level: LevelDefinition): PlayerState {
  return {
    pos: { ...level.player.spawn },
    heading: degToRad(level.player.headingDeg),
    alt: 0,
    targetBand: 'low',
    band: 'low',
    speed: BAND_PROFILES.low.speed,
    energy: 1,
    turnInput: 0,
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    lives: PLAYER.lives,
    alive: true,
    invulnerable: 0,
    respawnIn: 0,
    selectedWeapon: 'gun',
    ammo: fullAmmo(),
    flares: FLARES.count,
    firing: false,
    gunDip: 0,
    rearm: 0,
    lockTargetId: null,
    lockProgress: 0,
    missilesTracking: 0,
    radarLocks: 0,
  };
}
