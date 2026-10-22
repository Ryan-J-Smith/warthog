import { ARMOR_MULTIPLIER, GUN, bandProfileAt } from '../../../src/config';
import type { ControlInput } from '../../../src/sim/input';
import { angleDelta, angleOf, clamp, degToRad, distance, sub, type Vec2 } from '../../../src/sim/math';
import { ALTITUDE_BANDS, type AltitudeBand, type WeaponId } from '../../../src/sim/types';
import type { WorldView } from '../../../src/sim/world';
import type { SkillProfile } from './skill';

/**
 * - `hold`: never fire.
 * - `onTarget`: fire while the Xevious reticle is lit (after the skill's trigger delay).
 * - `now`: fire this frame regardless (bomb release, spraying).
 */
export type FireMode = 'hold' | 'onTarget' | 'now';

/** What a task wants the aircraft to do this frame. The `Pilot` turns it into keys. */
export interface Intent {
  /** Point to steer toward; null = keep the current heading. */
  steerTo: Vec2 | null;
  band: AltitudeBand;
  weapon: WeaponId;
  fire: FireMode;
  /** Mid attack run: no jinking, no diving on lock (the pilot holds the line). */
  committed: boolean;
  /** Route around the rings of spotted SAM sites while transiting above Low. */
  avoidSam: boolean;
}

/** Digital steering like a keyboard: full turn or nothing, with human-length taps. */
export interface KeyboardModel {
  /** Shortest key press a human makes, seconds. */
  minTap: number;
  /** Shortest gap between presses, seconds. */
  minGap: number;
  /** Heading error (degrees) below which the pilot lets go of the key. */
  deadbandDeg: number;
}

/** Bots boost toward goals further than this (world units). */
const BOOST_TRANSIT = 1100;

export const HUMAN_KEYBOARD: KeyboardModel = { minTap: 0.07, minGap: 0.05, deadbandDeg: 3 };

export interface PilotOptions {
  /** Emulate keyboard steering (-1/0/+1 with human tap lengths). Omit for analogue. */
  keyboard?: KeyboardModel;
  /**
   * Prototype of the proposed reticle rule: the gun reticle only lights when a hostile is
   * within its radius + GUN.hitSlop of the pipper (rounds will actually hit), instead of
   * radius + spread.
   */
  honestGunReticle?: boolean;
}

/**
 * Low-level autopilot shared by every bot: steering, band keys, weapon selection,
 * trigger discipline, jinking, flares and dive-to-break. Stateful (timers), one per run.
 */
export class Pilot {
  private lockHeld = 0;
  private trackHeld = 0;
  private flareCooldown = 0;
  private breakHold = 0;
  private onTargetHeld = 0;
  private sprayTimer = 0;
  private keyTurn = 0;
  private keyHeld = 0;
  private readonly phase: number;

  private readonly keyboard: KeyboardModel | null;
  private readonly honestGunReticle: boolean;

  constructor(
    private readonly skill: SkillProfile,
    phaseSeed = 0,
    options: PilotOptions = {},
  ) {
    this.phase = phaseSeed * 1.37;
    this.keyboard = options.keyboard ?? null;
    this.honestGunReticle = options.honestGunReticle ?? false;
  }

  /** True while a SAM reaction is forcing the aircraft down to Low. */
  get breaking(): boolean {
    return this.breakHold > 0;
  }

  control(view: WorldView, intent: Intent, dt: number): ControlInput {
    const p = view.player;
    const skill = this.skill;

    // --- Threat reactions -----------------------------------------------------
    this.lockHeld = p.radarLocks > 0 ? this.lockHeld + dt : 0;
    this.trackHeld = p.missilesTracking > 0 ? this.trackHeld + dt : 0;
    this.flareCooldown -= dt;
    this.breakHold -= dt;

    const missileReact = this.trackHeld >= skill.reaction;
    let flare = false;
    if (missileReact) {
      if ((skill.samResponse === 'flare' || skill.samResponse === 'flareAndDive') && this.flareCooldown <= 0 && p.flares > 0) {
        flare = true;
        // Humans pop one, wait to see, pop another.
        this.flareCooldown = 1.1;
      }
      if (skill.samResponse === 'dive' || skill.samResponse === 'flareAndDive') this.breakHold = 1.0;
    }
    if (skill.diveOnLock && !intent.committed && this.lockHeld >= skill.reaction) this.breakHold = Math.max(this.breakHold, 0.6);

    const band: AltitudeBand = this.breakHold > 0 ? 'low' : intent.band;

    // --- Steering ---------------------------------------------------------------
    let goal = intent.steerTo;
    if (goal && intent.avoidSam && band !== 'low') goal = avoidSamRings(view, goal);
    let desired = goal ? angleOf(sub(goal, p.pos)) : p.heading;
    const t = view.time + this.phase;
    desired += skill.aimWobble * (Math.sin(t * 1.9) + 0.5 * Math.sin(t * 4.7 + 1.3));
    if (skill.jinks && !intent.committed && aaShooting(view)) desired += 0.7 * Math.sin((t * Math.PI * 2) / 1.1);
    const turnRate = degToRad(bandProfileAt(p.alt).turnRateDeg);
    const error = angleDelta(p.heading, desired);
    let turn = clamp(error / (turnRate * 0.08), -1, 1);
    if (this.keyboard) {
      const want = Math.abs(error) > degToRad(this.keyboard.deadbandDeg) ? Math.sign(error) : 0;
      this.keyHeld += dt;
      const minHold = this.keyTurn !== 0 ? this.keyboard.minTap : this.keyboard.minGap;
      if (want !== this.keyTurn && this.keyHeld >= minHold) {
        this.keyTurn = want;
        this.keyHeld = 0;
      }
      turn = this.keyTurn;
    }

    // --- Boost: on long, roughly straight transits and to burn out of a laser ------
    const far = goal !== null && distance(p.pos, goal) > BOOST_TRANSIT;
    const lined = Math.abs(error) < degToRad(30);
    const boost = !intent.committed && p.boost > p.maxBoost * 0.25 && ((far && lined) || aaShooting(view));

    // --- Band keys (edge-triggered: press until the target band matches) --------
    const want = ALTITUDE_BANDS.indexOf(band);
    const have = ALTITUDE_BANDS.indexOf(p.targetBand);

    // --- Trigger ----------------------------------------------------------------
    const lit = this.honestGunReticle && intent.weapon === 'gun' ? gunWillHit(view) : view.reticle.onTarget && view.reticle.weapon === intent.weapon;
    this.onTargetHeld = lit ? this.onTargetHeld + dt : 0;
    this.sprayTimer = lit ? skill.releaseLag : this.sprayTimer - dt;
    let fire = false;
    if (intent.fire === 'now') fire = true;
    else if (intent.fire === 'onTarget') {
      fire = this.onTargetHeld >= skill.triggerDelay || (p.firing && this.sprayTimer > 0);
      // Mavericks: holding the trigger fires the moment the lock completes.
      if (intent.weapon === 'maverick') fire = true;
    }

    return {
      turn,
      fire,
      boost,
      brake: false,
      climb: want > have,
      dive: want < have,
      flare,
      select: p.selectedWeapon !== intent.weapon ? intent.weapon : null,
    };
  }
}

/** Would gun rounds landing at the pipper hit a damageable hostile? */
function gunWillHit(view: WorldView): boolean {
  const impact = view.reticle.weapon === 'gun' && view.reticle.ready ? view.reticle.impact : null;
  if (!impact) return false;
  return view.entities.some(
    (e) => e.alive && !e.hidden && e.team === 'enemy' && ARMOR_MULTIPLIER.gun[e.armor] > 0 && distance(e.pos, impact) <= e.radius + GUN.hitSlop,
  );
}

/** Is any AA gun currently engaging the player? */
export function aaShooting(view: WorldView): boolean {
  return view.entities.some((e) => e.alive && e.aa !== null && e.aa.engaging);
}

/**
 * If the straight line to `goal` crosses a spotted SAM ring, steer for the tangent point
 * instead. Goals inside a ring are left alone (the task has to go in).
 */
export function avoidSamRings(view: WorldView, goal: Vec2): Vec2 {
  const pos = view.player.pos;
  for (const site of view.entities) {
    if (!site.alive || site.sam === null || !site.spotted) continue;
    const radius = site.sam.range + 180;
    if (distance(goal, site.pos) < radius) continue;
    const dP = distance(pos, site.pos);
    if (dP <= radius) continue;
    if (!segmentHitsCircle(pos, goal, site.pos, radius)) continue;
    const base = angleOf(sub(pos, site.pos));
    const alpha = Math.acos(radius / dP);
    const tangents = [base + alpha, base - alpha].map((a) => ({
      x: site.pos.x + Math.cos(a) * radius * 1.02,
      y: site.pos.y + Math.sin(a) * radius * 1.02,
    }));
    const [first, second] = tangents as [Vec2, Vec2];
    return distance(first, goal) + distance(pos, first) <= distance(second, goal) + distance(pos, second) ? first : second;
  }
  return goal;
}

function segmentHitsCircle(a: Vec2, b: Vec2, c: Vec2, r: number): boolean {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  const t = len2 > 0 ? clamp(((c.x - a.x) * abx + (c.y - a.y) * aby) / len2, 0, 1) : 0;
  return distance({ x: a.x + abx * t, y: a.y + aby * t }, c) < r;
}
