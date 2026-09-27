import type { SimEvent } from '../../../src/sim/events';
import { NO_INPUT, type ControlInput } from '../../../src/sim/input';
import { Rng } from '../../../src/sim/math';
import type { WorldView } from '../../../src/sim/world';
import { Pilot, type Intent } from './pilot';
import type { SkillProfile } from './skill';
import { RearmTask, RtbTask, type FlightStyle, type Task, type TaskContext } from './tasks';

/**
 * Contract for an autopilot that plays a mission. Bots see exactly what the render layer
 * sees (`WorldView`) and answer with the same `ControlInput` the keyboard produces.
 */
export abstract class Bot {
  abstract readonly name: string;

  /** Controls for the next fixed step. `events` are those produced by the previous step. */
  abstract decide(view: WorldView, events: readonly SimEvent[], dt: number): ControlInput;

  /** What the bot is doing right now (for timelines / debugging). */
  get activity(): string {
    return '';
  }
}

/** Hands off the stick. Baseline for the level's own timers. */
export class IdleBot extends Bot {
  readonly name = 'idle';

  decide(): ControlInput {
    return { ...NO_INPUT, turn: 0.3 };
  }
}

/**
 * A bot that works through an ordered plan of tasks, with two interrupts: go home when the
 * plan's next task has no usable ammo (or HP is low), and RTB once the primaries resolve.
 */
export abstract class PlanBot extends Bot {
  protected readonly pilot: Pilot;
  private readonly rng: Rng;
  private plan: Task[] | null = null;
  private interrupt: Task | null = null;
  private current = '';

  constructor(
    readonly skill: SkillProfile,
    readonly style: FlightStyle,
    seed: number,
  ) {
    super();
    this.pilot = new Pilot(skill, seed);
    this.rng = new Rng(seed * 7919 + 17);
  }

  /** The ordered plan, built once on the first frame. */
  protected abstract buildPlan(view: WorldView): Task[];

  /** Called when the plan runs dry; return a new task or null to loiter. */
  protected refill(_view: WorldView): Task | null {
    return null;
  }

  /** Keep working the plan after RTB is called (until the plan is empty). */
  protected get ignoresRtb(): boolean {
    return false;
  }

  /** Where to hang around with nothing to do. */
  protected abstract loiterPoint(view: WorldView): { x: number; y: number };

  override get activity(): string {
    return this.current;
  }

  decide(view: WorldView, events: readonly SimEvent[], dt: number): ControlInput {
    const plan = (this.plan ??= this.buildPlan(view));
    if (events.some((e) => e.type === 'playerRespawned')) {
      this.interrupt = null;
      for (const task of plan) task.reset();
    }
    if (!view.player.alive) return { ...NO_INPUT };

    const ctx: TaskContext = { view, events, skill: this.skill, style: this.style, rng: this.rng, dt };

    while (plan.length > 0 && !plan[0]?.relevant(view)) plan.shift();
    if (plan.length === 0) {
      const next = this.refill(view);
      if (next) plan.push(next);
    }

    const rtbNow = view.rtb && (!this.ignoresRtb || plan.length === 0);
    if (rtbNow && !(this.interrupt instanceof RtbTask)) this.interrupt = new RtbTask();
    else if (this.interrupt === null && this.wantsService(view, ctx, plan[0])) this.interrupt = new RearmTask();

    let intent: Intent | null = null;
    if (this.interrupt) {
      intent = this.interrupt.step(ctx);
      if (intent) this.current = this.interrupt.label;
      else this.interrupt = null;
    }
    while (!intent && plan.length > 0) {
      const head = plan[0];
      if (!head) break;
      intent = head.step(ctx);
      if (intent) this.current = head.label;
      else plan.shift();
    }
    if (!intent) {
      this.current = 'loiter';
      intent = {
        steerTo: this.loiterPoint(view),
        band: this.style.transitBand,
        weapon: view.player.selectedWeapon,
        fire: 'hold',
        committed: false,
        avoidSam: this.style.avoidSam,
      };
    }
    return this.pilot.control(view, intent, dt);
  }

  private wantsService(view: WorldView, ctx: TaskContext, next: Task | undefined): boolean {
    const p = view.player;
    if (this.skill.repairAtHp > 0 && p.hp <= this.skill.repairAtHp) return true;
    if (!next) return false;
    const weapons = next.weapons(ctx);
    return weapons.length > 0 && weapons.every((w) => p.ammo[w] <= 0);
  }
}
