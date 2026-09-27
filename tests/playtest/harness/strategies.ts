import type { Entity } from '../../../src/sim/entities';
import type { Vec2 } from '../../../src/sim/math';
import type { WorldView } from '../../../src/sim/world';
import { PlanBot } from './bot';
import type { SkillProfile } from './skill';
import { byKindNear, byRef, byTag, hostiles, keyPoints, union, type KeyPoints, type Selector } from './targets';
import { BombTask, DirectFireTask, SweepTask, WaitTask, type FlightStyle, type Task } from './tasks';

// ---------------------------------------------------------------------------
// Plan building blocks for River Crossing
// ---------------------------------------------------------------------------

function objectiveActive(view: WorldView, id: string): boolean {
  return view.objectives.find((o) => o.id === id)?.status === 'active';
}

const waveOne = (): Task => new DirectFireTask('bravo wave 1', byTag('waveA'));
const bravo = (): Task => new DirectFireTask('bravo', byTag('assault'));
const bridge = (): Task => new BombTask('bridge', byRef('bridge'));
const dump = (): Task => new DirectFireTask('dump', byRef('ammoDump'), { weapons: ['gun', 'rockets'], gunBand: 'low' });

/** Waits over the east road until wave 2 is on the map (or Bravo is resolved). */
const waitWaveTwo = (k: KeyPoints): Task =>
  new WaitTask('wait wave 2', { x: (k.eastRoad.x + k.outpost.x) / 2, y: k.outpost.y - 150 }, (view) =>
    byTag('assault')(view).length > 0 || !objectiveActive(view, 'outpost'),
  );

/** Pop-up Maverick attack on the SAM: run in at Low, climb, lock, fire, dive. */
const samByMaverick = (): Task =>
  new DirectFireTask('sam', byRef('samTango'), { weapons: ['maverick', 'gun', 'rockets'], popUpAt: 820 });

/** SAM plus the three AA guns ringing it. */
const samCompound = (k: KeyPoints): Selector => union(byRef('samTango'), byKindNear(['aaGun'], k.sam, 450));

abstract class RiverCrossingBot extends PlanBot {
  abstract readonly planName: string;

  constructor(skill: SkillProfile, style: FlightStyle, seed: number) {
    super(skill, style, seed);
  }

  get name(): string {
    return `${this.planName}/${this.style.name}`;
  }

  protected override loiterPoint(view: WorldView): Vec2 {
    return keyPoints(view.level).outpost;
  }
}

// ---------------------------------------------------------------------------
// Strategy bots
// ---------------------------------------------------------------------------

/** Relieve Bravo, drop the bridge in the lull, come back for wave 2. Primaries only. */
export class BravoFirstBot extends RiverCrossingBot {
  readonly planName: string = 'bravo-first';
  protected buildPlan(view: WorldView): Task[] {
    const k = keyPoints(view.level);
    return [waveOne(), bridge(), waitWaveTwo(k), bravo()];
  }
}

/** Drop the bridge on the way out, then hold Bravo. Primaries only. */
export class BridgeFirstBot extends RiverCrossingBot {
  readonly planName: string = 'bridge-first';
  protected buildPlan(view: WorldView): Task[] {
    const k = keyPoints(view.level);
    return [bridge(), bravo(), waitWaveTwo(k), bravo()];
  }
}

/** Kill SAM Tango first (pop-up Maverick), then the bridge, then Bravo. */
export class SamFirstBot extends RiverCrossingBot {
  readonly planName: string = 'sam-first';
  protected buildPlan(view: WorldView): Task[] {
    const k = keyPoints(view.level);
    return [samByMaverick(), bridge(), bravo(), waitWaveTwo(k), bravo()];
  }
}

/**
 * "Suppress then strike": Maverick the AA gun covering Bravo from outside its range, then
 * gun the tanks; strafe the bridge's AA gun before bombing. Primaries only.
 */
export class SuppressFirstBot extends RiverCrossingBot {
  readonly planName: string = 'suppress-first';
  protected buildPlan(view: WorldView): Task[] {
    const k = keyPoints(view.level);
    const aaNear = (at: Vec2): Task =>
      new DirectFireTask('suppress AA', byKindNear(['aaGun', 'mobileAa'], at, 800), { weapons: ['maverick', 'rockets', 'gun'] });
    return [aaNear(k.outpost), waveOne(), aaNear(k.bridge), bridge(), waitWaveTwo(k), bravo()];
  }
}

/** Long detour north-west to blow the ammo dump (halves AA fire), then primaries. */
export class DumpFirstBot extends RiverCrossingBot {
  readonly planName: string = 'dump-first';
  protected buildPlan(view: WorldView): Task[] {
    const k = keyPoints(view.level);
    return [dump(), bravo(), bridge(), waitWaveTwo(k), bravo()];
  }
}

/**
 * Greedy bridge drop: relieve Bravo, then loiter south of the river and bomb the bridge only
 * once the column's lead vehicle is on the span (catching vehicles on the bridge).
 */
export class BridgeLateBot extends RiverCrossingBot {
  readonly planName: string;
  constructor(
    skill: SkillProfile,
    style: FlightStyle,
    seed: number,
    private readonly triggerY = 2470,
  ) {
    super(skill, style, seed);
    this.planName = `bridge-late@${triggerY}`;
  }
  protected buildPlan(view: WorldView): Task[] {
    const k = keyPoints(view.level);
    const leadY = (v: WorldView): number =>
      Math.max(-Infinity, ...v.entities.filter((e) => e.alive && e.tags.includes('column')).map((e) => e.pos.y));
    return [
      waveOne(),
      new WaitTask('wait for column', { x: k.bridge.x + 150, y: k.bridge.y + 1150 }, (v) => leadY(v) >= this.triggerY, 'low'),
      bridge(),
      waitWaveTwo(k),
      bravo(),
    ];
  }
}

/** Tries for everything: Bravo, dump, SAM compound, bridge, halted column, caches, wave 2. */
export class CompletionistBot extends RiverCrossingBot {
  readonly planName: string = 'completionist';
  protected buildPlan(view: WorldView): Task[] {
    const k = keyPoints(view.level);
    return [
      waveOne(),
      new DirectFireTask('bravo AA', byKindNear(['aaGun'], k.outpost, 800)),
      dump(),
      new DirectFireTask('dump trucks', byKindNear(['truck', 'aaGun'], k.dump, 500)),
      samByMaverick(),
      new DirectFireTask('sam AA', samCompound(k)),
      bridge(),
      new DirectFireTask('bridge AA', byKindNear(['aaGun'], k.bridge, 500)),
      new DirectFireTask('halted column', byTag('column')),
      waitWaveTwo(k),
      bravo(),
    ];
  }
}

/** Completionist that also sweeps the hidden caches (it has "played before"). */
export class CacheHunterBot extends CompletionistBot {
  override readonly planName: string = 'cache-hunter';
  protected override buildPlan(view: WorldView): Task[] {
    const k = keyPoints(view.level);
    const plan = super.buildPlan(view);
    const caches = new DirectFireTask('caches', (v) => hostiles(v).filter((e) => e.kind === 'cache'));
    // Sweep before wave 2 so the RTB clock doesn't cut it off.
    plan.splice(plan.length - 2, 0, new SweepTask('sweep caches', k.caches), caches);
    return plan;
  }
}

/**
 * Attacks whatever spotted hostile is nearest, ignoring objectives and timers.
 * The "I just like shooting things" player.
 */
export class GreedyBot extends RiverCrossingBot {
  readonly planName: string = 'greedy';
  protected buildPlan(): Task[] {
    return [];
  }
  protected override refill(view: WorldView): Task | null {
    const p = view.player.pos;
    let best: Entity | null = null;
    let bestD = Infinity;
    for (const e of hostiles(view)) {
      if (!e.spotted) continue;
      const d = Math.hypot(e.pos.x - p.x, e.pos.y - p.y);
      if (d < bestD) {
        best = e;
        bestD = d;
      }
    }
    if (!best) return null;
    const id = best.id;
    const one: Selector = (v) => hostiles(v).filter((e) => e.id === id);
    return best.armor === 'hardened' ? new BombTask(`greedy ${best.kind}`, one) : new DirectFireTask(`greedy ${best.kind}`, one);
  }
}

/** Bravo-first, then goes for the ammo dump after the primaries (tests the RTB clock). */
export class PrimariesThenDumpBot extends RiverCrossingBot {
  readonly planName: string = 'primaries-then-dump';
  protected buildPlan(view: WorldView): Task[] {
    const k = keyPoints(view.level);
    const dumpAa = new DirectFireTask('dump AA', byKindNear(['aaGun'], k.dump, 500), { weapons: ['maverick', 'rockets', 'gun'] });
    return [waveOne(), bridge(), waitWaveTwo(k), bravo(), dumpAa, dump()];
  }
  protected override get ignoresRtb(): boolean {
    return true;
  }
}

const columnAa: Selector = (view) => byTag('column')(view).filter((e) => e.kind === 'mobileAa');

/**
 * Keep the bridge: relieve Bravo (suppressing its AA), then hunt the column on the river
 * road — Maverick the mobile AA first — and never touch the bridge.
 */
export class ColumnHuntBot extends RiverCrossingBot {
  readonly planName: string = 'column-hunt';
  protected buildPlan(view: WorldView): Task[] {
    const k = keyPoints(view.level);
    return [
      new DirectFireTask('suppress AA', byKindNear(['aaGun'], k.outpost, 800), { weapons: ['maverick', 'rockets', 'gun'] }),
      waveOne(),
      new WaitTask('wait for column', { x: 1500, y: 2300 }, (v) => columnAa(v).length > 0 || !objectiveActive(v, 'column')),
      new DirectFireTask('column AA', columnAa, { weapons: ['maverick', 'rockets', 'gun'] }),
      new DirectFireTask('column', byTag('column'), { weapons: ['gun', 'rockets', 'maverick'] }),
      waitWaveTwo(k),
      bravo(),
    ];
  }
}

/**
 * Everything, with a strong route: suppress Bravo's AA, wave 1, the dump, the column (bridge
 * intact), toss-bomb the SAM from High, Maverick its AA ring, wave 2, then the caches.
 */
export class CompletionistV2Bot extends RiverCrossingBot {
  readonly planName: string = 'completionist-v2';
  protected buildPlan(view: WorldView): Task[] {
    const k = keyPoints(view.level);
    const standoff = (label: string, select: Selector): Task => new DirectFireTask(label, select, { weapons: ['maverick'] });
    const hasIntactObjective = view.objectives.some((o) => o.id === 'bridgeIntact');
    return [
      standoff('suppress AA', byKindNear(['aaGun'], k.outpost, 800)),
      waveOne(),
      standoff('dump AA', byKindNear(['aaGun'], k.dump, 500)),
      dump(),
      new DirectFireTask('dump trucks', byKindNear(['truck'], k.dump, 500)),
      new WaitTask('wait for column', { x: 1200, y: 1900 }, (v) => columnAa(v).length > 0 || !objectiveActive(v, 'column')),
      new DirectFireTask('column AA', columnAa, { weapons: ['maverick', 'rockets', 'gun'] }),
      ...(hasIntactObjective ? [new DirectFireTask('column', byTag('column'), { weapons: ['gun', 'rockets'] })] : [bridge()]),
      new BombTask('SAM (high toss)', byRef('samTango'), { band: 'high', stick: 3 }),
      standoff('SAM ring AA', byKindNear(['aaGun'], k.sam, 450)),
      ...(hasIntactObjective ? [] : [new DirectFireTask('halted column', byTag('column'))]),
      waitWaveTwo(k),
      bravo(),
      new SweepTask('sweep caches', [k.caches[0] ?? k.base]),
      new DirectFireTask('caches', (v) => hostiles(v).filter((e) => e.kind === 'cache')),
    ];
  }
}

export type BotFactory = (skill: SkillProfile, style: FlightStyle, seed: number) => PlanBot;

export const PLAN_FACTORIES: Record<string, BotFactory> = {
  'bravo-first': (s, st, seed) => new BravoFirstBot(s, st, seed),
  'bridge-first': (s, st, seed) => new BridgeFirstBot(s, st, seed),
  'sam-first': (s, st, seed) => new SamFirstBot(s, st, seed),
  'suppress-first': (s, st, seed) => new SuppressFirstBot(s, st, seed),
  'dump-first': (s, st, seed) => new DumpFirstBot(s, st, seed),
  'bridge-late': (s, st, seed) => new BridgeLateBot(s, st, seed),
  completionist: (s, st, seed) => new CompletionistBot(s, st, seed),
  'cache-hunter': (s, st, seed) => new CacheHunterBot(s, st, seed),
  greedy: (s, st, seed) => new GreedyBot(s, st, seed),
  'column-hunt': (s, st, seed) => new ColumnHuntBot(s, st, seed),
  'primaries-then-dump': (s, st, seed) => new PrimariesThenDumpBot(s, st, seed),
  'completionist-v2': (s, st, seed) => new CompletionistV2Bot(s, st, seed),
};
