import type { SimEvent } from '../../../src/sim/events';
import type { LevelDefinition } from '../../../src/sim/level';
import { SIM_STEP, Simulation } from '../../../src/sim/simulation';
import { WEAPON_ORDER, type AltitudeBand, type ObjectiveStatus, type PlayerDamageSource, type WeaponId } from '../../../src/sim/types';
import type { SimSystem } from '../../../src/sim/systems';
import type { MissionResults, World } from '../../../src/sim/world';
import type { Bot } from './bot';

export interface ObjectiveRecord {
  status: ObjectiveStatus;
  /** Sim time the objective resolved, or null if still active at the end. */
  time: number | null;
}

/** Everything measured about one bot flying one mission. */
export interface RunRecord {
  bot: string;
  skill: string;
  seed: number;
  outcome: 'victory' | 'defeat' | 'unfinished';
  endTime: number;
  score: number;
  grade: string;
  results: MissionResults | null;
  objectives: Record<string, ObjectiveRecord>;
  deaths: number;
  deathTimes: number[];
  /** Damage taken and hits taken, by source. */
  damage: Record<PlayerDamageSource, number>;
  hits: Record<PlayerDamageSource, number>;
  ammoSpent: Record<WeaponId, number>;
  flaresSpent: number;
  rearms: number;
  bandTime: Record<AltitudeBand, number>;
  kills: Record<string, number>;
  sam: { locks: number; launched: number; decoyed: number; lostLock: number; hitPlayer: number };
  aaBursts: number;
  /** Outpost HP fraction at the end. */
  outpostEnd: number;
  /** Column vehicles killed by the bridge collapsing under them. */
  bridgeDropKills: number;
  /** Seconds the bot spent on each task label. */
  activity: Record<string, number>;
}

export interface RunOptions {
  level: LevelDefinition;
  seed: number;
  bot: Bot;
  skill?: string;
  /** Hard stop in sim seconds. */
  maxTime?: number;
  /** Adjust the freshly built world before the first step (prototype tuning). */
  tweak?: (world: World) => void;
  /** Build a custom systems list (prototype rules, injected rather than patched). */
  systems?: () => SimSystem[];
}

/** Fly one mission headlessly with a bot at the fixed 60 Hz step. */
export function runMission(options: RunOptions): RunRecord {
  const sim = new Simulation(options.level, options.seed, options.systems?.());
  options.tweak?.(sim.world);
  const recorder = new Recorder(options.bot.name, options.skill ?? '', options.seed);
  const maxTime = options.maxTime ?? 600;
  let events: SimEvent[] = [];
  while (!sim.world.ended && sim.world.time < maxTime) {
    const input = options.bot.decide(sim.view, events, SIM_STEP);
    sim.step(input);
    events = sim.drainEvents();
    recorder.consume(sim.world, events, SIM_STEP, options.bot.activity);
  }
  return recorder.finish(sim.world);
}

class Recorder {
  private readonly record: RunRecord;
  private lastAmmo: Record<WeaponId, number> | null = null;
  private lastFlares: number | null = null;

  constructor(bot: string, skill: string, seed: number) {
    this.record = {
      bot,
      skill,
      seed,
      outcome: 'unfinished',
      endTime: 0,
      score: 0,
      grade: '-',
      results: null,
      objectives: {},
      deaths: 0,
      deathTimes: [],
      damage: { aa: 0, beam: 0, sam: 0, splash: 0 },
      hits: { aa: 0, beam: 0, sam: 0, splash: 0 },
      ammoSpent: { gun: 0, rockets: 0, maverick: 0, bombs: 0 },
      flaresSpent: 0,
      rearms: 0,
      bandTime: { low: 0, medium: 0, high: 0 },
      kills: {},
      sam: { locks: 0, launched: 0, decoyed: 0, lostLock: 0, hitPlayer: 0 },
      aaBursts: 0,
      outpostEnd: 1,
      bridgeDropKills: 0,
      activity: {},
    };
  }

  consume(world: World, events: readonly SimEvent[], dt: number, activity: string): void {
    const r = this.record;
    const p = world.player;
    if (p.alive) {
      r.bandTime[p.band] += dt;
      const label = activity || '-';
      r.activity[label] = (r.activity[label] ?? 0) + dt;
    }

    // Ammo accounting: count decreases only (rearm/respawn refill).
    if (this.lastAmmo) {
      for (const w of WEAPON_ORDER) {
        const spent = this.lastAmmo[w] - p.ammo[w];
        if (spent > 0) r.ammoSpent[w] += spent;
      }
    }
    if (this.lastFlares !== null && this.lastFlares > p.flares) r.flaresSpent += this.lastFlares - p.flares;
    this.lastAmmo = { ...p.ammo };
    this.lastFlares = p.flares;

    let bridgeFell = false;
    let columnDeaths = 0;
    for (const e of events) {
      switch (e.type) {
        case 'objectiveUpdated':
          r.objectives[e.objectiveId] = { status: e.status, time: world.time };
          break;
        case 'playerDestroyed':
          r.deaths += 1;
          r.deathTimes.push(world.time);
          break;
        case 'playerHit':
          r.damage[e.source] += e.damage;
          r.hits[e.source] += 1;
          break;
        case 'rearmCompleted':
          r.rearms += 1;
          break;
        case 'scoreAwarded':
          if (e.pos !== null && e.points > 0) r.kills[e.reason] = (r.kills[e.reason] ?? 0) + 1;
          break;
        case 'samLockStarted':
          r.sam.locks += 1;
          break;
        case 'samLaunched':
          r.sam.launched += 1;
          break;
        case 'samDecoyed':
          r.sam.decoyed += 1;
          break;
        case 'samLostLock':
          r.sam.lostLock += 1;
          break;
        case 'samDetonated':
          if (e.hitPlayer) r.sam.hitPlayer += 1;
          break;
        case 'aaBurst':
          r.aaBursts += 1;
          break;
        case 'entityDestroyed':
          if (e.kind === 'bridge') bridgeFell = true;
          else if (world.findById(e.entityId)?.tags.includes('column')) columnDeaths += 1;
          break;
        default:
          break;
      }
    }
    if (bridgeFell) r.bridgeDropKills += columnDeaths;
  }

  finish(world: World): RunRecord {
    const r = this.record;
    r.endTime = world.time;
    r.results = world.results;
    r.outcome = world.results?.outcome ?? 'unfinished';
    r.score = world.results?.total ?? world.score;
    r.grade = world.results?.grade ?? '-';
    for (const o of world.objectives) {
      if (!r.objectives[o.id]) r.objectives[o.id] = { status: o.status, time: null };
    }
    const outpost = world.findByRef('outpost');
    r.outpostEnd = outpost ? Math.max(0, outpost.hp / outpost.maxHp) : 0;
    return r;
  }
}
