import Phaser from 'phaser';
import { AudioDirector, MusicManager, audioSettingsFor } from '../audio';
import { ENTITY_STATS } from '../config';
import { getLevel } from '../content/levels';
import { KeyboardControls } from '../controls';
import { CameraRig } from '../render/camera';
import { CloudLayer } from '../render/clouds';
import { EntityRenderer, PlayerRenderer } from '../render/entities';
import { EffectsDirector } from '../render/effects';
import { TerrainRenderer } from '../render/terrain';
import { WorldUiRenderer } from '../render/worldUi';
import type { SimEvent } from '../sim/events';
import { Simulation } from '../sim/simulation';
import type { EntityKind, ExplosionSize } from '../sim/types';
import { GAME_EVENTS, SCENES, type GameSceneData, type HudSceneData, type PauseSceneData, type ResultsSceneData } from './sceneKeys';

/** Delay between the mission ending and the results screen, ms. */
const RESULTS_DELAY = 3200;

/** Render-side hit-stop (sim frozen, effects keep animating) per player kill, by explosion size. */
const HIT_STOP_MS: Record<ExplosionSize, number> = { small: 0, medium: 45, large: 90, huge: 140 };
/** Slow motion for set pieces (bridge dropped with vehicles on it, player shot down). */
const SLOW_MO = { scale: 0.3, bridgeDropMs: 1100, playerDownMs: 700 } as const;

/**
 * The mission. Owns the simulation, feeds it keyboard input at a fixed timestep, and keeps
 * every renderer/listener in sync. The HUD runs as a parallel scene fed by `GAME_EVENTS.frame`.
 */
export class GameScene extends Phaser.Scene {
  /** Public for dev tooling (`window.__warthog`); treat as read-only elsewhere. */
  sim!: Simulation;
  private levelId = '';
  private controls!: KeyboardControls;
  private cameraRig!: CameraRig;
  private terrain!: TerrainRenderer;
  private effects!: EffectsDirector;
  private entities!: EntityRenderer;
  private player!: PlayerRenderer;
  private worldUi!: WorldUiRenderer;
  private clouds!: CloudLayer;
  private audio!: AudioDirector;
  private music!: MusicManager;
  private finishing = false;
  private hitStopMs = 0;
  private slowMoMs = 0;

  constructor() {
    super(SCENES.game);
  }

  create(data: GameSceneData): void {
    this.levelId = data.levelId;
    const level = getLevel(data.levelId);
    this.sim = new Simulation(level);
    this.finishing = false;
    this.hitStopMs = 0;
    this.slowMoMs = 0;

    const camera = this.cameras.main;
    camera.setBounds(0, 0, level.width, level.height);
    camera.setBackgroundColor('#2a2e1c');

    this.cameraRig = new CameraRig(camera);
    this.cameraRig.snapTo(this.sim.view);
    // After the camera is placed, so the terrain chunks nearest the player bake first.
    this.terrain = new TerrainRenderer(this, level);
    this.terrain.build();
    this.entities = new EntityRenderer(this);
    this.player = new PlayerRenderer(this);
    this.worldUi = new WorldUiRenderer(this);
    this.clouds = new CloudLayer(this, level);
    this.effects = new EffectsDirector(this);
    this.controls = new KeyboardControls(this);
    this.audio = new AudioDirector(this);
    this.music = new MusicManager(this);
    this.music.playMission();

    const hudData: HudSceneData = { levelId: this.levelId };
    this.scene.launch(SCENES.hud, hudData);
    camera.fadeIn(600, 0, 0, 0);

    this.events.on(Phaser.Scenes.Events.RESUME, this.onResume, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
  }

  override update(_time: number, delta: number): void {
    if (this.controls.pressed('pause') && !this.sim.world.ended) {
      this.pauseGame();
      return;
    }
    if (this.controls.pressed('mute')) audioSettingsFor(this.game).toggleAll();

    const view = this.sim.view;
    const events = this.sim.advance(this.simDelta(delta) / 1000, this.controls.read());
    this.applyTimeJuice(events);

    this.entities.sync(view, events);
    this.player.sync(view);
    this.cameraRig.update(delta, view);
    this.clouds.update(delta, view);
    this.worldUi.sync(view);
    this.effects.handleEvents(events);
    this.effects.update(delta, view);
    this.audio.update(delta, view);
    this.audio.handleEvents(events);

    this.events.emit(GAME_EVENTS.frame, view, events);

    if (!this.finishing && view.ended && view.results) {
      this.finishing = true;
      const results = view.results;
      this.events.emit(GAME_EVENTS.ended, results);
      this.time.delayedCall(RESULTS_DELAY, () => {
        this.cameras.main.fadeOut(700, 0, 0, 0);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          const data: ResultsSceneData = { levelId: this.levelId, results };
          this.scene.stop(SCENES.hud);
          this.scene.start(SCENES.results, data);
        });
      });
    }
  }

  private onResume(): void {
    this.controls.reset();
    this.sound.resumeAll();
  }

  /** Real frame time → sim time, applying hit-stop and slow motion. */
  private simDelta(delta: number): number {
    if (this.hitStopMs > 0) {
      this.hitStopMs -= delta;
      return 0;
    }
    if (this.slowMoMs > 0) {
      this.slowMoMs -= delta;
      return delta * SLOW_MO.scale;
    }
    return delta;
  }

  private applyTimeJuice(events: readonly SimEvent[]): void {
    for (const event of events) {
      if (event.type === 'scoreAwarded' && event.points > 0 && event.pos) {
        if (event.reason.startsWith('BRIDGE DROP')) this.slowMoMs = Math.max(this.slowMoMs, SLOW_MO.bridgeDropMs);
        else if (event.reason in ENTITY_STATS) {
          const size = ENTITY_STATS[event.reason as EntityKind].explosion;
          this.hitStopMs = Math.max(this.hitStopMs, HIT_STOP_MS[size]);
        }
      } else if (event.type === 'playerDestroyed') {
        this.slowMoMs = Math.max(this.slowMoMs, SLOW_MO.playerDownMs);
      }
    }
  }

  private pauseGame(): void {
    const data: PauseSceneData = { levelId: this.levelId };
    this.scene.pause();
    this.sound.pauseAll();
    this.scene.launch(SCENES.pause, data);
  }

  private teardown(): void {
    this.terrain.destroy();
    this.effects.destroy();
    this.entities.destroy();
    this.player.destroy();
    this.worldUi.destroy();
    this.clouds.destroy();
    this.audio.destroy();
    this.events.off(Phaser.Scenes.Events.RESUME, this.onResume, this);
  }
}
