import type { ControlInput } from '../input';
import type { World } from '../world';

export interface StepContext {
  world: World;
  /** Fixed step duration in seconds. */
  dt: number;
  input: Readonly<ControlInput>;
}

/** One slice of game rules, run once per fixed step in a fixed order. */
export abstract class SimSystem {
  abstract update(ctx: StepContext): void;
}
