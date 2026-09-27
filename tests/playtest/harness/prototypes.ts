import { BAND_ALTITUDE, BOMBS, CLIMB_RATE, ENTITY_STATS, FLARES, GUN, SCORING, bandOf } from '../../../src/config';
import type { LevelDefinition } from '../../../src/sim/level';
import type { EntityKind } from '../../../src/sim/types';
import { approach } from '../../../src/sim/math';
import { Simulation } from '../../../src/sim/simulation';
import { FlightSystem, type SimSystem, type StepContext } from '../../../src/sim/systems';
import { set, type Override } from './tuning';

/**
 * Prototype of a separate, faster dive rate (climbing stays at `CLIMB_RATE`).
 * Injected through the `Simulation` systems list: no patching of the real FlightSystem.
 */
export class FastDiveFlightSystem extends FlightSystem {
  constructor(private readonly diveRate: number) {
    super();
  }

  override update(ctx: StepContext): void {
    super.update(ctx);
    const p = ctx.world.player;
    if (!p.alive) return;
    const target = BAND_ALTITUDE[p.targetBand];
    if (target >= p.alt) return;
    p.alt = approach(p.alt, target, Math.max(0, this.diveRate - CLIMB_RATE) * ctx.dt);
    const band = bandOf(p.alt);
    if (band !== p.band) {
      ctx.world.emit({ type: 'bandChanged', from: p.band, to: band });
      p.band = band;
    }
  }
}

/**
 * Prototype turn ramp: the heading responds to a smoothed stick that reaches full deflection
 * after `rampTime` seconds, so a keyboard tap nudges the nose and a hold turns hard.
 * Wraps the real FlightSystem by feeding it the smoothed input (injected, not patched).
 */
export class RampedTurnFlightSystem extends FlightSystem {
  private stick = 0;

  constructor(private readonly rampTime: number) {
    super();
  }

  override update(ctx: StepContext): void {
    this.stick = approach(this.stick, ctx.input.turn, ctx.dt / this.rampTime);
    super.update({ ...ctx, input: { ...ctx.input, turn: this.stick } });
  }
}

export function rampedTurnSystems(rampTime: number): SimSystem[] {
  return Simulation.defaultSystems().map((s) => (s instanceof FlightSystem ? new RampedTurnFlightSystem(rampTime) : s));
}

/** Default systems with the flight system swapped for the fast-dive prototype. */
export function fastDiveSystems(diveRate: number): SimSystem[] {
  return Simulation.defaultSystems().map((s) => (s instanceof FlightSystem ? new FastDiveFlightSystem(diveRate) : s));
}

function shilka() {
  const aa = ENTITY_STATS.aaGun.aa;
  if (!aa) throw new Error('aaGun has no AA stats');
  return aa;
}

function samStats() {
  const sam = ENTITY_STATS.samSite.sam;
  if (!sam) throw new Error('samSite has no SAM stats');
  return sam;
}

/**
 * The proposed v1 config changes (see docs/ai_docs/fun.md). Prototype-only overrides.
 * - AA: survivable-but-scary at Low (was a one-pass kill).
 * - Gun: rounds walk forward onto the target; slightly bigger hit slop.
 * - Bombs from High scatter widely (toss bombing costs ammo, not safety).
 * - RTB grace long enough to finish an optional after the primaries.
 */
export const PROPOSED_CONFIG: readonly Override[] = [
  set(shilka(), { roundDamage: 2, spreadLow: 30, spreadMedium: 50, burstPause: 1.2, roundsPerBurst: 10 }),
  set(GUN, { dipRate: 0.7, hitSlop: 7 }),
  set(BOMBS, { scatterHigh: 140 }),
  set(SCORING, { rtbGrace: 90 }),
];

/**
 * Proposed SAM changes: the ring properly covers the bridge, flares are a backup rather than a
 * guarantee, and diving is the answer (pair with `fastDiveSystems(1.6)`).
 */
export const PROPOSED_SAM: readonly Override[] = [set(samStats(), { range: 1250 }), set(FLARES, { decoyChance: 0.6 })];

/** Dive rate used by the proposal (bands / s); climbing stays at 1.0. */
export const PROPOSED_DIVE_RATE = 1.6;

export interface LevelProposalOptions {
  /** Spawn time for wave 2 (seconds). Default: unchanged (120). */
  waveTwoAt?: number;
  /** Replace wave 2's units. Default: unchanged. */
  waveTwoUnits?: Array<{ kind: EntityKind }>;
  /** Split wave 2 into a pincer: the east road plus a new north-east track. */
  pincer?: boolean;
}

/** New north-east approach to Bravo for the pincer (off-map → forest edge → Bravo's flank). */
export const NORTH_EAST_TRACK = [
  { x: 7300, y: 2600 },
  { x: 6500, y: 2950 },
  { x: 5900, y: 3350 },
  { x: 5480, y: 3620 },
];

/** Wave 2 reinforced: three tanks and a mobile AA (a second Maverick-worthy target). */
export const HEAVY_WAVE_TWO: Array<{ kind: EntityKind }> = [
  { kind: 'tank' },
  { kind: 'tank' },
  { kind: 'mobileAa' },
  { kind: 'truck' },
  { kind: 'tank' },
];

/**
 * The proposed River Crossing data changes:
 * - "Take the bridge intact" optional: stop the column by killing it and the bridge is a prize.
 *   (Wave 2 already reaches Bravo at ~2:50, just as the column reaches the bridge at ~2:55,
 *   so keeping the bridge creates the triage the design wants.)
 * - Optional wave 2 retiming / reinforcement for experiments.
 */
export function proposedLevel(base: LevelDefinition, options: LevelProposalOptions = {}): LevelDefinition {
  const { waveTwoAt, waveTwoUnits, pincer } = options;
  const groups = base.groups.map((g) =>
    g.id === 'waveB'
      ? {
          ...g,
          ...(waveTwoAt !== undefined ? { trigger: { kind: 'time' as const, at: waveTwoAt } } : {}),
          ...(waveTwoUnits ? { units: waveTwoUnits } : {}),
          ...(pincer ? { units: [{ kind: 'tank' as const }, { kind: 'truck' as const }, { kind: 'tank' as const }] } : {}),
        }
      : g,
  );
  const waveB = groups.find((g) => g.id === 'waveB');
  if (pincer && waveB) {
    groups.push({
      ...waveB,
      id: 'waveB2',
      pathId: 'northEast',
      units: [{ kind: 'tank' }, { kind: 'mobileAa' }, { kind: 'tank' }],
    });
  }
  return {
    ...base,
    paths: pincer ? { ...base.paths, northEast: NORTH_EAST_TRACK } : base.paths,
    groups,
    objectives: [
      ...base.objectives,
      {
        id: 'bridgeIntact',
        kind: 'defend',
        title: 'Take the bridge intact',
        primary: false,
        targetRefId: 'bridge',
        attackerTags: ['column'],
      },
    ],
    radio: [
      ...base.radio.map((cue) =>
        waveTwoAt !== undefined && cue.text.startsWith('More armor on the east road')
          ? { ...cue, trigger: { kind: 'time' as const, at: waveTwoAt - 10 } }
          : cue,
      ),
      {
        trigger: { kind: 'time', at: 62 },
        speaker: 'OVERLORD',
        tone: 'info',
        text: 'HQ wants that bridge for the counter-attack. Kill the column if you can. Drop the bridge if you must.',
      },
    ],
  };
}

/** Proposed grade thresholds (applied to result totals in reports). */
export const PROPOSED_GRADES: ReadonlyArray<{ grade: string; min: number }> = [
  { grade: 'S', min: 30000 },
  { grade: 'A', min: 21000 },
  { grade: 'B', min: 16000 },
  { grade: 'C', min: 8000 },
  { grade: 'D', min: -Infinity },
];

export function gradeFor(total: number, grades: ReadonlyArray<{ grade: string; min: number }> = PROPOSED_GRADES): string {
  return grades.find((g) => total >= g.min)?.grade ?? 'D';
}
