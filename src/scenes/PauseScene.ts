import Phaser from 'phaser';
import { audioSettingsFor } from '../audio';
import { getLevel } from '../content/levels';
import { formatMissionClock, formatScore } from '../ui/format';
import { UI_SOUND_REGISTRY_KEY, resolveUiSound, type UiSoundPort } from '../ui/sound';
import { COLOR, textStyle } from '../ui/theme';
import {
  MenuFocus,
  MenuList,
  SoundSettingsPanel,
  UI_TEX,
  bindMenuKeys,
  createControlsCard,
  drawPanel,
  drawRule,
  ensureUiTextures,
} from '../ui/widgets';
import type { GameScene } from './GameScene';
import { SCENES, type GameSceneData, type PauseSceneData } from './sceneKeys';

const PANEL_W = 1180;
const PANEL_H = 700;

/**
 * Pause menu over the frozen mission: RESUME / RESTART MISSION / QUIT TO TITLE, music and sound
 * effects volume/mute, plus a controls card. ESC or P resumes. The HUD pauses and resumes with
 * the Game scene.
 */
export class PauseScene extends Phaser.Scene {
  private levelId = '';
  private uiSound!: UiSoundPort;
  private leaving = false;

  constructor() {
    super(SCENES.pause);
  }

  create(data: PauseSceneData): void {
    this.levelId = data.levelId;
    this.uiSound = resolveUiSound(this.registry.get(UI_SOUND_REGISTRY_KEY));
    this.leaving = false;
    ensureUiTextures(this);
    const { width, height } = this.scale;

    const shade = this.add.rectangle(0, 0, width, height, 0x000000, 0.66).setOrigin(0);
    const lines = this.add.tileSprite(0, 0, width, height, UI_TEX.scanlines).setOrigin(0).setAlpha(0.3);

    const x0 = (width - PANEL_W) / 2;
    const y0 = (height - PANEL_H) / 2;
    const g = this.add.graphics();
    drawPanel(g, x0, y0, PANEL_W, PANEL_H, { fillAlpha: 0.88, chamfer: 18, cornerLength: 26 });
    g.lineStyle(1, COLOR.green, 0.25);
    g.lineBetween(x0 + 560, y0 + 40, x0 + 560, y0 + PANEL_H - 40);

    this.add.text(x0 + 48, y0 + 36, 'PAUSED', textStyle({ size: 84, font: 'display', color: COLOR.green, glow: 16 }));
    const level = getLevel(this.levelId);
    this.add.text(x0 + 52, y0 + 134, level.name.toUpperCase(), textStyle({ size: 22, color: COLOR.greenDim, glow: false }));
    const game = this.scene.get(SCENES.game) as GameScene;
    if (game.sim) {
      const view = game.sim.view;
      this.add.text(
        x0 + 52,
        y0 + 164,
        `T+ ${formatMissionClock(view.time)}   ·   SCORE ${formatScore(view.score)}`,
        textStyle({ size: 22, color: COLOR.green, glow: false }),
      );
    }
    drawRule(g, x0 + 48, y0 + 212, 460);

    let focus: MenuFocus | null = null;
    const menu = new MenuList(this, ['RESUME', 'RESTART MISSION', 'QUIT TO TITLE'], {
      x: x0 + 40,
      y: y0 + 280,
      width: 480,
      spacing: 72,
      fontSize: 34,
      sound: this.uiSound,
      onConfirm: (i) => this.choose(i),
      onMove: () => focus?.menuFocused(),
    });
    const soundPanel = new SoundSettingsPanel(this, audioSettingsFor(this.game), {
      x: x0 + 40,
      y: y0 + 510,
      width: 480,
      rowHeight: 52,
      fontSize: 24,
      sound: this.uiSound,
      onFocusRequest: (row) => focus?.focusRow(row),
    });
    focus = new MenuFocus(menu, soundPanel);
    const nav = focus;

    this.add.text(x0 + 52, y0 + PANEL_H - 56, '↑↓ SELECT  ·  ←→ VOLUME  ·  ENTER OK  ·  ESC RESUME', textStyle({ size: 17, color: COLOR.greenDim, glow: false }));

    this.add.text(x0 + 600, y0 + 48, 'CONTROLS', textStyle({ size: 22, color: COLOR.greenDim, glow: false }));
    drawRule(g, x0 + 600, y0 + 84, PANEL_W - 648);
    createControlsCard(this, x0 + 600, y0 + 104, 210, 56, 21);

    // Quick fade-in.
    for (const o of [shade, lines]) o.setAlpha(0);
    this.tweens.add({ targets: shade, alpha: 1, duration: 140 });
    this.tweens.add({ targets: lines, alpha: 0.3, duration: 140 });

    bindMenuKeys(this, {
      up: () => nav.up(),
      down: () => nav.down(),
      left: () => nav.left(),
      right: () => nav.right(),
      confirm: () => nav.confirm(),
      back: () => this.resume(),
      actions: { pause: () => this.resume(), mute: () => audioSettingsFor(this.game).toggleAll() },
    });
  }

  private choose(index: number): void {
    if (index === 0) this.resume();
    else if (index === 1) this.restart();
    else this.quit();
  }

  private resume(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.uiSound.back();
    this.scene.resume(SCENES.game);
    this.scene.stop();
  }

  private restart(): void {
    if (this.leaving) return;
    this.leaving = true;
    const data: GameSceneData = { levelId: this.levelId };
    // The Game scene paused all sounds; un-pause them before it is torn down.
    this.sound.resumeAll();
    this.scene.stop(SCENES.hud);
    // Starting a running (paused) scene shuts it down and creates it afresh; this scene stops.
    this.scene.start(SCENES.game, data);
  }

  private quit(): void {
    if (this.leaving) return;
    this.leaving = true;
    // The Game scene paused all sounds; un-pause them so the title theme can crossfade in.
    this.sound.resumeAll();
    this.scene.stop(SCENES.hud);
    this.scene.stop(SCENES.game);
    this.scene.start(SCENES.title);
  }
}
