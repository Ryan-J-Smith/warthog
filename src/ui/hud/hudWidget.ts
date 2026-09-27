import type { SimEvent } from '../../sim/events';
import type { WorldView } from '../../sim/world';
import type { Rect } from '../model';

/** Everything a HUD widget gets each rendered frame. */
export interface HudFrame {
  view: WorldView;
  /** Sim events since the previous frame. */
  events: readonly SimEvent[];
  /** Real seconds since the previous frame. */
  dt: number;
  /** HUD scene clock, ms (for blinking). */
  now: number;
  /** The Game camera's visible world rectangle. */
  camera: Rect;
}

/** Contract for HUD widgets: update in place every frame, clean up on shutdown. */
export abstract class HudWidget {
  abstract update(frame: HudFrame): void;
  abstract destroy(): void;
}
