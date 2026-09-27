import type { SimEvent } from './simEvent';

/**
 * Contract for anything that reacts to simulation events (effects, audio, HUD).
 * Called once per rendered frame with every event produced since the previous call.
 */
export abstract class SimEventListener {
  abstract handleEvents(events: readonly SimEvent[]): void;
}
