/**
 * Hold the Line (base defence) balance: build plans × pilot skill × seed.
 *
 * Build phase: the bot works through its plan's wish list, one action per build press, in order,
 * stopping at the first thing it cannot afford (no clock, so it then launches the wave). It
 * TELEPORTS onto each pad / the airstrip and presses the option key (flying there adds nothing to
 * a clockless phase but runtime), then is parked back at the spawn and presses ready.
 * Wave phase: the real Pilot flies DirectFireTask against the most urgent wave unit: a
 * gunship only when no ground unit is within DEFEND_RADIUS of the base (gun only), otherwise the
 * wave unit nearest the base (gun / rockets / Mavericks).
 *
 * Draft cards (after every wave but the last): `first` always takes card 1; `greedy` takes the
 * best card by GREEDY_ORDER (economy first).
 *
 * Run with: npx vitest run --config tests/playtest/vitest.config.ts tests/playtest/holdTheLine.playtest.ts
 */
import { describe, expect, it } from 'vitest';
import { holdTheLine } from '../../src/content/levels';
import { ARMORY, structureCost, type ArmoryId, type DefenseState, type PerkId, type StructureId } from '../../src/sim/defense';
import type { Entity } from '../../src/sim/entities';
import { NO_INPUT, type ControlInput } from '../../src/sim/input';
import { Rng, distance, type Vec2 } from '../../src/sim/math';
import { Simulation } from '../../src/sim/simulation';
import type { SimEvent } from '../../src/sim/events';
import { DEFENSE_WAVE_TAG } from '../../src/sim/systems';
import type { WeaponId } from '../../src/sim/types';
import type { WorldView } from '../../src/sim/world';
import { ACE, AVERAGE, BALANCED, DirectFireTask, Pilot, ROOKIE, table, type SkillProfile } from './harness';

const SEEDS = [1, 2];
const DT = 1 / 60;
/** Give up on a run after this much sim time (a stalled wave). */
const MAX_TIME = 1500;
/** Number keys: option 1–4 = gun / rockets / maverick / bombs. */
const KEY: readonly WeaponId[] = ['gun', 'rockets', 'maverick', 'bombs'];
const STRUCTURE_KEY: Record<StructureId, number> = { barracks: 0, depot: 1, bunker: 2, flak: 3 };
const ARMORY_KEY: Record<ArmoryId, number> = { gun: 0, ordnance: 1, repair: 2 };

type CardPolicy = 'first' | 'greedy';
const POLICIES: readonly CardPolicy[] = ['first', 'greedy'];
/** Greedy card preference: economy, then the army, then the aircraft. */
const GREEDY_ORDER: readonly PerkId[] = [
  'discount',
  'supplyDrop',
  'warBonds',
  'veterans',
  'reinforcements',
  'sandbags',
  'longFlak',
  'gunOverdrive',
  'reinforcedBase',
  'quickTurnaround',
  'hardpoints',
];

function pickCard(offer: readonly PerkId[], policy: CardPolicy): number {
  if (policy === 'first') return 0;
  let best = 0;
  offer.forEach((id, i) => {
    if (GREEDY_ORDER.indexOf(id) < GREEDY_ORDER.indexOf(offer[best] ?? id)) best = i;
  });
  return best;
}

/** Take a draft card if one is on offer; returns its id. */
function takeCard(sim: Simulation, policy: CardPolicy): PerkId | null {
  const offer = defense(sim).offer;
  if (!offer) return null;
  const i = pickCard(offer, policy);
  sim.step({ ...NO_INPUT, select: KEY[i] ?? 'gun' });
  sim.drainEvents();
  return offer[i] ?? null;
}

/** One build-phase purchase: build / upgrade a structure on a pad, or buy an armory item. */
type Action = { pad: string; structure: StructureId } | { armory: ArmoryId };

interface Plan {
  name: string;
  actions: readonly Action[];
  /** Buy a base repair whenever the base is below this fraction (after the plan's other buys). */
  repairBelow?: number;
}

const build = (pad: string, structure: StructureId): Action => ({ pad, structure });

const PLANS: readonly Plan[] = [
  { name: 'a-none', actions: [] },
  {
    name: 'b-bunkers',
    actions: [build('n2', 'bunker'), build('w2', 'bunker'), build('e2', 'bunker'), build('n2', 'bunker'), build('w2', 'bunker'), build('e2', 'bunker')],
  },
  {
    name: 'c-forward',
    actions: [build('n1', 'barracks'), build('w1', 'depot'), build('e1', 'depot'), build('n1', 'barracks'), build('w1', 'depot'), build('e1', 'depot')],
  },
  {
    name: 'd-mixed',
    actions: [
      build('n2', 'bunker'),
      build('w2', 'bunker'),
      build('e2', 'flak'),
      build('e1', 'depot'),
      build('n1', 'flak'),
      build('n2', 'bunker'),
      build('w2', 'bunker'),
      build('w1', 'barracks'),
      build('e2', 'flak'),
    ],
  },
  {
    name: 'e-armory',
    actions: [{ armory: 'gun' }, { armory: 'ordnance' }, { armory: 'gun' }, { armory: 'ordnance' }, { armory: 'gun' }, { armory: 'ordnance' }],
    repairBelow: 0.7,
  },
];

interface Result {
  plan: string;
  policy: CardPolicy;
  skill: string;
  seed: number;
  outcome: 'won' | 'lost' | 'timeout';
  /** Waves cleared. */
  cleared: number;
  /** Base integrity (%) after each cleared wave (and at the loss). */
  basePct: number[];
  gold: number;
  /** Total gold spent across the run. */
  spent: number;
  deaths: number;
  time: number;
  /** Wave units still alive when the run ended (kind×count, hp%). */
  left: string;
  /** Draft cards taken, in order. */
  cards: PerkId[];
}

function defense(sim: Simulation): DefenseState {
  const d = sim.world.defense;
  if (!d) throw new Error('not a defence level');
  return d;
}

function basePct(sim: Simulation): number {
  const base = sim.world.findByRef('base');
  return base && base.alive ? Math.round((base.hp / base.maxHp) * 100) : 0;
}

/** Cost of the action right now (null = nothing left to buy / not applicable). */
function costOf(state: DefenseState, action: Action): number | null {
  if ('armory' in action) return ARMORY[action.armory].costs[state.armory[action.armory]] ?? null;
  const pad = state.pads.find((p) => p.id === action.pad);
  if (!pad) return null;
  if (pad.structure !== null && pad.structure !== action.structure) return null;
  return structureCost(state, action.structure, pad.level) ?? null;
}

/** Teleport over the pad (or the airstrip) and press the option key for one step. */
function press(sim: Simulation, action: Action): void {
  const state = defense(sim);
  let at: Vec2;
  let key: WeaponId;
  if ('armory' in action) {
    at = sim.world.homeBasePos();
    key = KEY[ARMORY_KEY[action.armory]] ?? 'gun';
  } else {
    const pad = state.pads.find((p) => p.id === action.pad);
    if (!pad) return;
    at = pad.pos;
    // An occupied pad takes 1 to upgrade.
    key = pad.structure === null ? KEY[STRUCTURE_KEY[action.structure]] ?? 'gun' : 'gun';
  }
  sim.world.player.pos = { ...at };
  sim.step({ ...NO_INPUT, select: key });
  sim.drainEvents();
}

class BuildBot {
  private next = 0;
  spent = 0;

  constructor(private readonly plan: Plan) {}

  /** Spend in plan order until the next item is unaffordable. */
  buildPhase(sim: Simulation): void {
    const state = defense(sim);
    while (this.next < this.plan.actions.length) {
      const action = this.plan.actions[this.next];
      if (!action) break;
      const cost = costOf(state, action);
      if (cost === null) {
        this.next++;
        continue;
      }
      if (state.gold < cost) break;
      const before = state.gold;
      press(sim, action);
      if (state.gold >= before) break; // refused (shouldn't happen): don't loop forever
      this.spent += before - state.gold;
      this.next++;
    }
    const base = sim.world.findByRef('base');
    if (this.plan.repairBelow !== undefined && base) {
      while (base.hp < base.maxHp * this.plan.repairBelow) {
        const cost = costOf(state, { armory: 'repair' });
        if (cost === null || state.gold < cost) break;
        const before = state.gold;
        press(sim, { armory: 'repair' });
        if (state.gold >= before) break;
        this.spent += before - state.gold;
      }
    }
  }
}

/** Ground units this close to the base are dealt with before any gunship. */
const DEFEND_RADIUS = 1000;

/**
 * The wave unit to go after: the ground unit closest to the base if one is inside DEFEND_RADIUS,
 * else a gunship (gun), else the ground unit closest to the base.
 */
function urgent(view: WorldView, basePos: Vec2): Entity[] {
  const wave = view.entities.filter((e) => e.alive && !e.hidden && e.tags.includes(DEFENSE_WAVE_TAG));
  const helis = wave.filter((e) => e.heli);
  const ground = wave.filter((e) => !e.heli);
  const close = ground.filter((e) => distance(e.pos, basePos) <= DEFEND_RADIUS);
  const pool = close.length > 0 ? close : helis.length > 0 ? helis : ground;
  let best: Entity | null = null;
  for (const e of pool) if (!best || distance(e.pos, basePos) < distance(best.pos, basePos)) best = e;
  return best ? [best] : [];
}

function play(plan: Plan, policy: CardPolicy, skill: SkillProfile, seed: number): Result {
  const sim = new Simulation(holdTheLine, seed);
  const builder = new BuildBot(plan);
  const pilot = new Pilot(skill, seed);
  const rng = new Rng(seed * 7919 + 13);
  const base = sim.world.findByRef('base');
  const basePos = base ? { ...base.pos } : { x: 2200, y: 2620 };
  const gunships = new DirectFireTask('gunships', (v) => urgent(v, basePos).filter((e) => e.heli), { weapons: ['gun'], gunBand: 'low' });
  const ground = new DirectFireTask('ground', (v) => urgent(v, basePos), { weapons: ['gun', 'rockets', 'maverick'], gunBand: 'low' });
  const pcts: number[] = [];
  let deaths = 0;
  let events: SimEvent[] = [];
  let lastWave = -1;
  const cards: PerkId[] = [];

  while (!sim.world.ended && sim.world.time < MAX_TIME) {
    const state = defense(sim);
    if (state.phase === 'build') {
      if (state.wave !== lastWave && state.wave > 0) pcts.push(basePct(sim));
      lastWave = state.wave;
      // Wait out a respawn before building (the pads need a live aircraft over them).
      if (!sim.world.player.alive) {
        sim.step(NO_INPUT);
        events = sim.drainEvents();
        continue;
      }
      const card = takeCard(sim, policy);
      if (card) cards.push(card);
      builder.buildPhase(sim);
      const p = sim.world.player;
      p.pos = { ...holdTheLine.player.spawn };
      p.heading = -Math.PI / 2;
      gunships.reset();
      ground.reset();
      sim.step({ ...NO_INPUT, ready: true });
      events = sim.drainEvents();
      continue;
    }
    if (state.phase !== 'wave') break;
    const view = sim.view;
    const ctx = { view, events, skill, style: BALANCED, rng, dt: DT };
    const intent = gunships.step(ctx) ?? ground.step(ctx);
    const input: ControlInput = intent ? pilot.control(view, intent, DT) : NO_INPUT;
    sim.step(input);
    events = sim.drainEvents();
    deaths += events.filter((e) => e.type === 'playerDestroyed').length;
  }
  const state = defense(sim);
  if (state.phase === 'lost') pcts.push(0);
  const left = sim.world.entities
    .filter((e) => e.alive && e.tags.includes(DEFENSE_WAVE_TAG))
    .map((e) => `${e.kind} ${Math.round((e.hp / e.maxHp) * 100)}% @${Math.round(distance(e.pos, basePos))}u`)
    .join(', ');
  return {
    plan: plan.name,
    policy,
    skill: skill.name,
    seed,
    outcome: state.phase === 'won' ? 'won' : state.phase === 'lost' ? 'lost' : 'timeout',
    cleared: state.phase === 'won' ? state.totalWaves : state.wave,
    basePct: pcts,
    gold: state.gold,
    spent: builder.spent,
    deaths,
    time: Math.round(sim.world.time),
    left,
    cards,
  };
}

describe('Hold the Line: build plans × skill × seed', () => {
  it('plays every plan to a result and prints the table', () => {
    const results: Result[] = [];
    for (const plan of PLANS) {
      for (const policy of POLICIES) {
        for (const skill of [ACE, AVERAGE, ROOKIE]) {
          for (const seed of SEEDS) {
            const t0 = performance.now();
            const r = play(plan, policy, skill, seed);
            results.push(r);
            console.log(`${plan.name}/${policy}/${skill.name}/${seed}: ${r.outcome} w${r.cleared} ${r.time}s sim, ${Math.round(performance.now() - t0)} ms`);
          }
        }
      }
    }
    console.log(
      '\n' +
        table(
          ['plan', 'cards', 'skill', 'seed', 'outcome', 'waves cleared', 'base % after each wave', 'gold left', 'gold spent', 'deaths', 'sim time', 'wave units left', 'cards taken'],
          results.map((r) => [r.plan, r.policy, r.skill, String(r.seed), r.outcome, `${r.cleared}/8`, r.basePct.join(' '), String(r.gold), String(r.spent), String(r.deaths), `${r.time}s`, r.left || '—', r.cards.join(' ') || '—']),
        ),
    );
    for (const r of results) {
      expect(['won', 'lost', 'timeout']).toContain(r.outcome);
      expect(r.time).toBeGreaterThan(0);
    }
  });
});
