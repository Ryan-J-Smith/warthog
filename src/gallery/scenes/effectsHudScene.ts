import Phaser from 'phaser';
import { riverCrossing } from '../../content/levels';
import type { SimEvent } from '../../sim/events';
import type { WorldView } from '../../sim/world';
import { Hud } from '../../ui/hud';

/** Scene key of the gallery HUD overlay. */
export const EFFECTS_HUD_KEY = 'EffectsHud';
/** Event the effects gallery emits every frame: (view, events). */
export const FX_FRAME = 'fxFrame';

/** Longest frame step the HUD animates by (s), as in the game's HudScene. */
const MAX_DT = 0.1;

/**
 * The real in-mission `Hud`, drawn over the effects gallery exactly like the game's HudScene:
 * fed every frame with the gallery's world view and events, and the gallery camera's view rect.
 */
export class EffectsHudScene extends Phaser.Scene {
  private hud: Hud | null = null;

  constructor(private readonly source: Phaser.Scene) {
    super(EFFECTS_HUD_KEY);
  }

  create(): void {
    const hud = new Hud(this, riverCrossing);
    this.hud = hud;
    const camera = this.source.cameras.main;
    const onFrame = (view: WorldView, events: readonly SimEvent[]): void => {
      const dt = Math.min(MAX_DT, this.game.loop.delta / 1000);
      hud.update(view, events, dt, this.time.now, camera.worldView);
    };
    this.source.events.on(FX_FRAME, onFrame);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.source.events.off(FX_FRAME, onFrame);
      this.hud?.destroy();
      this.hud = null;
    });
  }
}
