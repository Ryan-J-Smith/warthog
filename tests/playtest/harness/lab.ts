import type { EntitySpawn } from '../../../src/sim/level';
import type { ControlInput } from '../../../src/sim/input';
import type { SimEvent } from '../../../src/sim/events';
import { distance, type Vec2 } from '../../../src/sim/math';
import { SIM_STEP, Simulation } from '../../../src/sim/simulation';
import type { SimSystem } from '../../../src/sim/systems';
import type { AltitudeBand, WeaponId } from '../../../src/sim/types';
import { arenaLevel } from './arena';
import { Pilot, type Intent, type PilotOptions } from './pilot';
import type { SkillProfile } from './skill';

export interface TimedEvent {
  t: number;
  event: SimEvent;
}

export interface LabOutcome {
  damage: number;
  dead: boolean;
  events: SimEvent[];
  timed: TimedEvent[];
  sim: Simulation;
}

export type LabControl = (sim: Simulation, t: number) => ControlInput;

/** Scripted flight on the empty arena, starting already settled in `startBand`. */
export function labFlight(
  entities: EntitySpawn[],
  spawn: Vec2,
  headingDeg: number,
  seconds: number,
  seed: number,
  control: LabControl,
  startBand: AltitudeBand = 'low',
  /** Stop early once this returns true (checked every step). */
  stopWhen?: (sim: Simulation) => boolean,
  systems?: SimSystem[],
): LabOutcome {
  const sim = new Simulation(arenaLevel({ player: { spawn, headingDeg }, entities }), seed, systems);
  const p = sim.world.player;
  const alt = startBand === 'low' ? 0 : startBand === 'medium' ? 1 : 2;
  p.alt = alt;
  p.targetBand = startBand;
  p.band = startBand;
  p.speed = [150, 230, 360][alt] ?? 150;
  const events: SimEvent[] = [];
  const timed: TimedEvent[] = [];
  let damage = 0;
  let dead = false;
  for (let i = 0; i < Math.round(seconds / SIM_STEP) && !dead; i++) {
    sim.step(control(sim, i * SIM_STEP));
    for (const e of sim.drainEvents()) {
      events.push(e);
      timed.push({ t: sim.world.time, event: e });
      // Incoming damage: hull hits plus what the shield absorbed (exposure, not just hull loss).
      if (e.type === 'playerHit') damage += e.damage;
      if (e.type === 'shieldHit') damage += e.amount;
      if (e.type === 'playerDestroyed') dead = true;
    }
    if (stopWhen?.(sim)) break;
  }
  return { damage, dead, events, timed, sim };
}

/** Time of the first event matching `pred`, or NaN. */
export function firstTime(outcome: LabOutcome, pred: (e: SimEvent) => boolean): number {
  return outcome.timed.find((x) => pred(x.event))?.t ?? NaN;
}

/** Wrap a per-frame intent function with a fresh `Pilot`. */
export function piloted(
  skill: SkillProfile,
  intentFor: (sim: Simulation, t: number) => Intent,
  seed: number,
  options: PilotOptions = {},
): LabControl {
  const pilot = new Pilot(skill, seed, options);
  return (sim, t) => pilot.control(sim.view, intentFor(sim, t), SIM_STEP);
}

/**
 * Repeated attack runs on the entity with `refId`: pure pursuit, extend when it slips
 * inside the weapon's reach, come back. Returns the per-frame intent function.
 */
export function attackRuns(refId: string, band: AltitudeBand, weapon: WeaponId): (sim: Simulation) => Intent {
  let extending = false;
  const reach = weapon === 'gun' ? (band === 'low' ? 170 : 280) : weapon === 'rockets' ? (band === 'low' ? 260 : 380) : 420;
  return (sim) => {
    const target = sim.world.findByRef(refId);
    const p = sim.world.player;
    if (!target?.alive) return { steerTo: null, band, weapon, fire: 'hold', committed: false, avoidSam: false };
    const d = distance(p.pos, target.pos);
    if (!extending && d < reach * 0.55) extending = true;
    if (extending && d > reach + 300) extending = false;
    return { steerTo: extending ? null : target.pos, band, weapon, fire: 'onTarget', committed: !extending, avoidSam: false };
  };
}
