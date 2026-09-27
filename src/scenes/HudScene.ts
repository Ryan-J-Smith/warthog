import Phaser from 'phaser';
import { getLevel } from '../content/levels';
import { Hud } from '../ui/hud';
import { GAME_EVENTS, SCENES, type EndedHandler, type FrameHandler, type HudSceneData } from './sceneKeys';

/** Longest frame step the HUD animates by (s), so a hitch doesn't skip radio lines. */
const MAX_DT = 0.1;

/**
 * In-mission HUD, drawn over the Game scene. Fed by `GAME_EVENTS.frame` from the Game scene's
 * emitter; pauses and resumes with it.
 */
export class HudScene extends Phaser.Scene {
  private hud: Hud | null = null;

  constructor() {
    super(SCENES.hud);
  }

  create(data: HudSceneData): void {
    const hud = new Hud(this, getLevel(data.levelId));
    this.hud = hud;
    const game = this.scene.get(SCENES.game);
    const camera = game.cameras.main;

    const onFrame: FrameHandler = (view, events) => {
      const dt = Math.min(MAX_DT, this.game.loop.delta / 1000);
      hud.update(view, events, dt, this.time.now, camera.worldView);
    };
    const onEnded: EndedHandler = (results) => hud.missionEnded(results);
    const onPause = (): void => {
      this.scene.pause();
    };
    const onResume = (): void => {
      this.scene.resume();
    };

    game.events.on(GAME_EVENTS.frame, onFrame);
    game.events.on(GAME_EVENTS.ended, onEnded);
    game.events.on(Phaser.Scenes.Events.PAUSE, onPause);
    game.events.on(Phaser.Scenes.Events.RESUME, onResume);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      game.events.off(GAME_EVENTS.frame, onFrame);
      game.events.off(GAME_EVENTS.ended, onEnded);
      game.events.off(Phaser.Scenes.Events.PAUSE, onPause);
      game.events.off(Phaser.Scenes.Events.RESUME, onResume);
      this.hud?.destroy();
      this.hud = null;
    });
  }
}
