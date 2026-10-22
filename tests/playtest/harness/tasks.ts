import {
  AIRCRAFT_BASE_HEIGHT,
  BAND_ALTITUDE,
  BAND_PROFILES,
  BOMBS,
  GUN,
  ROCKETS,
  bandProfileAt,
} from '../../../src/config';
import type { Entity } from '../../../src/sim/entities';
import type { SimEvent } from '../../../src/sim/events';
import {
  angleDelta,
  angleOf,
  clamp,
  degToRad,
  distance,
  fromAngle,
  lerp,
  normalize,
  sub,
  type Rng,
  type Vec2,
} from '../../../src/sim/math';
import { WEAPON_ORDER, type AltitudeBand, type WeaponId } from '../../../src/sim/types';
import type { WorldView } from '../../../src/sim/world';
import type { Intent } from './pilot';
import type { SkillProfile } from './skill';
import type { Selector } from './targets';

/** How a bot likes to fly: which bands for transit and attacks, which weapons first. */
export interface FlightStyle {
  readonly name: string;
  /** Band for getting from A to B. */
  readonly transitBand: AltitudeBand;
  /** Switch from the transit band to the attack band this far from the target. */
  readonly attackEntry: number;
  /** Route around spotted SAM rings while transiting above Low. */
  readonly avoidSam: boolean;
  /** Anti-vehicle weapons in order of preference. */
  readonly directWeapons: readonly WeaponId[];
  /** Band for gun and rocket runs. */
  readonly gunBand: 'low' | 'medium';
  /** Band bombs are released from. */
  readonly bombBand: 'medium' | 'high';
  /** Approach bomb targets at Low and pop up to Medium just before release. */
  readonly popUpBombs: boolean;
  /** Bombs per pass. */
  readonly stick: number;
}

export interface TaskContext {
  readonly view: WorldView;
  /** Events from the previous step. */
  readonly events: readonly SimEvent[];
  readonly skill: SkillProfile;
  readonly style: FlightStyle;
  readonly rng: Rng;
  readonly dt: number;
}

/** One job in a bot's plan (kill these, bomb that, go home). */
export abstract class Task {
  abstract readonly label: string;

  /** The intent for this frame, or null once the task is finished. */
  abstract step(ctx: TaskContext): Intent | null;

  /** Is there still anything to do? Finished tasks are skipped before ammo checks. */
  relevant(_view: WorldView): boolean {
    return true;
  }

  /** Weapons that can do this job; the bot rearms when every one of them is empty. */
  weapons(_ctx: TaskContext): readonly WeaponId[] {
    return [];
  }

  /** Forget per-pass state (after a respawn). */
  reset(): void {}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function homeBase(view: WorldView): Vec2 {
  const base = view.entities.find((e) => e.refId === view.level.homeBaseRefId);
  return base ? base.pos : view.level.player.spawn;
}

export function needsService(view: WorldView): boolean {
  const p = view.player;
  if (p.hp < p.maxHp || p.flares < view.loadout.flares) return true;
  return WEAPON_ORDER.some((w) => p.ammo[w] < view.loadout.ammo[w]);
}

function turnRadius(band: AltitudeBand): number {
  const profile = BAND_PROFILES[band];
  return profile.speed / degToRad(profile.turnRateDeg);
}

/** Distance ahead of the nose at which a direct-fire weapon lands. */
function weaponReach(weapon: WeaponId, alt: number): number {
  const t = clamp(alt, 0, 1);
  if (weapon === 'rockets') return lerp(ROCKETS.rangeLow, ROCKETS.rangeMedium, t);
  if (weapon === 'maverick') return 420;
  return lerp(GUN.pipperLow, GUN.pipperMedium, t);
}

function nearest(from: Vec2, entities: Entity[]): Entity | undefined {
  let best: Entity | undefined;
  let bestD = Infinity;
  for (const e of entities) {
    const d = distance(from, e.pos);
    if (d < bestD) {
      best = e;
      bestD = d;
    }
  }
  return best;
}

function transit(ctx: TaskContext, to: Vec2, weapon: WeaponId): Intent {
  return { steerTo: to, band: ctx.style.transitBand, weapon, fire: 'hold', committed: false, avoidSam: ctx.style.avoidSam };
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

/**
 * Gun / rocket / Maverick attacks on everything the selector returns, nearest first.
 * Pure pursuit with an "extend and come back" when the target slips inside the reticle.
 */
export class DirectFireTask extends Task {
  private targetId: number | null = null;
  private extending = false;

  constructor(
    readonly label: string,
    private readonly select: Selector,
    private readonly options: {
      weapons?: readonly WeaponId[];
      gunBand?: 'low' | 'medium';
      /** Stay at Low until this close, then climb to the weapon's band (pop-up attack). */
      popUpAt?: number;
    } = {},
  ) {
    super();
  }

  override relevant(view: WorldView): boolean {
    return this.select(view).length > 0;
  }

  override weapons(ctx: TaskContext): readonly WeaponId[] {
    return this.options.weapons ?? ctx.style.directWeapons;
  }

  override reset(): void {
    this.targetId = null;
    this.extending = false;
  }

  step(ctx: TaskContext): Intent | null {
    const { view } = ctx;
    const targets = this.select(view);
    if (targets.length === 0) return null;
    const p = view.player;
    const target = targets.find((e) => e.id === this.targetId) ?? nearest(p.pos, targets);
    if (!target) return null;
    this.targetId = target.id;

    const lockable = target.kind !== 'infantry' && target.kind !== 'cache';
    const weapon =
      this.weapons(ctx).find((w) => p.ammo[w] > 0 && (w !== 'maverick' || lockable) && w !== 'bombs') ?? 'gun';
    const d = distance(p.pos, target.pos);
    const popUpAt = this.options.popUpAt;
    const weaponBand: AltitudeBand = weapon === 'maverick' ? 'medium' : this.options.gunBand ?? ctx.style.gunBand;
    const band: AltitudeBand = popUpAt !== undefined && d > popUpAt && !this.extending ? 'low' : weaponBand;

    if (d > ctx.style.attackEntry && !this.extending) {
      const approach = transit(ctx, target.pos, weapon);
      return { ...approach, band: popUpAt !== undefined ? 'low' : approach.band, fire: 'onTarget' };
    }

    const reach = weaponReach(weapon, p.alt);
    const off = Math.abs(angleDelta(p.heading, angleOf(sub(target.pos, p.pos))));
    const extendTo = reach + (band === 'low' ? 230 : 380) + (weapon === 'maverick' ? 200 : 0);
    if (!this.extending && (d < reach * 0.5 || (d < reach * 0.9 && off > 0.5))) this.extending = true;
    if (this.extending && d > extendTo) this.extending = false;

    if (this.extending) {
      // Pop-up attackers drop back to Low while they reposition.
      const extendBand: AltitudeBand = popUpAt !== undefined ? 'low' : band;
      return { steerTo: null, band: extendBand, weapon, fire: 'onTarget', committed: false, avoidSam: false };
    }
    return { steerTo: target.pos, band, weapon, fire: 'onTarget', committed: d < reach + 250, avoidSam: false };
  }
}

/**
 * Level bombing run: line up, walk a stick of bombs across the target using the CCIP,
 * egress, check the result, go again. Optional pop-up from Low.
 */
export class BombTask extends Task {
  private phase: 'setup' | 'turnIn' | 'run' | 'egress' = 'setup';
  private released = 0;
  private bias = 0;
  private egress = 0;

  constructor(
    readonly label: string,
    private readonly select: Selector,
    private readonly options: { band?: 'medium' | 'high'; stick?: number; popUp?: boolean } = {},
  ) {
    super();
  }

  override relevant(view: WorldView): boolean {
    return this.select(view).length > 0;
  }

  override weapons(): readonly WeaponId[] {
    return ['bombs'];
  }

  override reset(): void {
    this.phase = 'setup';
    this.released = 0;
  }

  step(ctx: TaskContext): Intent | null {
    const { view, style } = ctx;
    const target = this.select(view)[0];
    if (!target) return null;
    const p = view.player;
    const band = this.options.band ?? style.bombBand;
    const popUp = band === 'medium' && (this.options.popUp ?? style.popUpBombs);
    const stick = this.options.stick ?? style.stick;
    const profile = BAND_PROFILES[band];
    const fall = BOMBS.fallTimePerHeight * (BAND_ALTITUDE[band] + AIRCRAFT_BASE_HEIGHT);
    const lead = profile.speed * fall;
    const spacing = profile.speed * BOMBS.cooldown;
    const runIn = lead + 2.2 * turnRadius(band) + (popUp ? 420 : 260);
    const d = distance(p.pos, target.pos);
    const bearing = angleOf(sub(target.pos, p.pos));
    const off = Math.abs(angleDelta(p.heading, bearing));
    const approachBand: AltitudeBand = popUp ? 'low' : band;
    const base = { weapon: 'bombs' as const, fire: 'hold' as const, avoidSam: false };

    for (const e of ctx.events) if (e.type === 'bombReleased') this.released += 1;

    switch (this.phase) {
      case 'egress': {
        this.egress -= ctx.dt;
        const falling = view.projectiles.some((pr) => pr.kind === 'bomb' && pr.team === 'friendly');
        if (this.egress <= 0 && !falling) this.phase = 'setup';
        return { ...base, steerTo: null, band: popUp ? 'low' : band, committed: false };
      }
      case 'setup': {
        if (d > Math.max(style.attackEntry, runIn + 400)) return transit(ctx, target.pos, 'bombs');
        if (d >= runIn) {
          this.phase = 'turnIn';
          return { ...base, steerTo: target.pos, band: approachBand, committed: false };
        }
        // Too close to line up: extend straight away from the target.
        const away = normalize(sub(p.pos, target.pos));
        return { ...base, steerTo: { x: p.pos.x + away.x * 1000, y: p.pos.y + away.y * 1000 }, band: approachBand, committed: false };
      }
      case 'turnIn': {
        if (d < lead * 1.1) {
          this.phase = 'setup';
          return { ...base, steerTo: null, band: approachBand, committed: false };
        }
        if (off < 0.12) {
          this.phase = 'run';
          this.released = 0;
          this.bias = ctx.rng.range(-ctx.skill.releaseError, ctx.skill.releaseError);
        }
        return { ...base, steerTo: target.pos, band: approachBand, committed: false };
      }
      case 'run': {
        const impact = view.reticle.weapon === 'bombs' ? view.reticle.impact : null;
        const heading = fromAngle(p.heading);
        const ccip = impact ?? { x: p.pos.x + heading.x * lead, y: p.pos.y + heading.y * lead };
        const toTarget = sub(target.pos, ccip);
        const along = toTarget.x * heading.x + toTarget.y * heading.y;
        const releaseAt = ((stick - 1) / 2) * spacing + this.bias * p.speed;
        const release = this.released < stick && view.reticle.ready && impact !== null && along <= releaseAt;
        if (this.released >= stick || (this.released === 0 && along < -200)) {
          this.phase = this.released > 0 ? 'egress' : 'setup';
          this.egress = 1.2;
        }
        return { ...base, steerTo: target.pos, band, fire: release ? 'now' : 'hold', committed: true };
      }
    }
  }
}

/** Fly home at Low and hold over the base until rearmed and repaired. */
export class RearmTask extends Task {
  readonly label = 'rearm';
  private done = false;

  override reset(): void {
    this.done = true;
  }

  step(ctx: TaskContext): Intent | null {
    const { view, style } = ctx;
    if (ctx.events.some((e) => e.type === 'rearmCompleted')) this.done = true;
    if (this.done || !needsService(view)) return null;
    const home = homeBase(view);
    const d = distance(view.player.pos, home);
    const band: AltitudeBand = d > Math.max(style.attackEntry, 700) ? style.transitBand : 'low';
    return { steerTo: home, band, weapon: view.player.selectedWeapon, fire: 'hold', committed: false, avoidSam: style.avoidSam };
  }
}

/** RTB: head home and land (the mission ends on arrival at Low). */
export class RtbTask extends Task {
  readonly label = 'rtb';

  step(ctx: TaskContext): Intent | null {
    const home = homeBase(ctx.view);
    const d = distance(ctx.view.player.pos, home);
    const band: AltitudeBand = d > Math.max(ctx.style.attackEntry, 700) ? ctx.style.transitBand : 'low';
    return { steerTo: home, band, weapon: ctx.view.player.selectedWeapon, fire: 'hold', committed: false, avoidSam: ctx.style.avoidSam };
  }
}

/** Orbit a point until a condition holds. */
export class WaitTask extends Task {
  constructor(
    readonly label: string,
    private readonly at: Vec2,
    private readonly until: (view: WorldView) => boolean,
    private readonly band?: AltitudeBand,
  ) {
    super();
  }

  override relevant(view: WorldView): boolean {
    return !this.until(view);
  }

  step(ctx: TaskContext): Intent | null {
    if (this.until(ctx.view)) return null;
    return { ...transit(ctx, this.at, ctx.view.player.selectedWeapon), band: this.band ?? ctx.style.transitBand };
  }
}

/** Fly over a list of points at a band (e.g. sweeping for hidden caches at Low). */
export class SweepTask extends Task {
  private index = 0;

  constructor(
    readonly label: string,
    private readonly points: readonly Vec2[],
    private readonly band: AltitudeBand = 'low',
    private readonly radius = 60,
  ) {
    super();
  }

  override relevant(): boolean {
    return this.index < this.points.length;
  }

  step(ctx: TaskContext): Intent | null {
    let point = this.points[this.index];
    while (point && distance(ctx.view.player.pos, point) <= this.radius) {
      this.index += 1;
      point = this.points[this.index];
    }
    if (!point) return null;
    const d = distance(ctx.view.player.pos, point);
    const band = d > ctx.style.attackEntry ? ctx.style.transitBand : this.band;
    return { ...transit(ctx, point, 'gun'), band, fire: 'onTarget' };
  }
}

/** Band-change duration helper for budget maths: seconds to move between two bands. */
export function bandChangeTime(from: AltitudeBand, to: AltitudeBand): number {
  return Math.abs(BAND_ALTITUDE[from] - BAND_ALTITUDE[to]);
}

/** Cruise speed at a continuous altitude (no energy effects). */
export function cruiseSpeed(alt: number): number {
  return bandProfileAt(alt).speed;
}
