import Phaser from 'phaser';
import { MusicManager, audioSettingsFor, playUiSound } from '../audio';
import { saveStoreFor } from '../meta/session';
import {
  LOADOUT_STATS,
  UPGRADE_TRACKS,
  buildLoadout,
  maxLevel,
  nextCost,
  nextLevelEffect,
  stockLoadout,
  type UpgradeTrack,
} from '../meta/upgrades';
import { formatScore } from '../ui/format';
import { UI_SOUND_REGISTRY_KEY, resolveUiSound, type UiSoundPort } from '../ui/sound';
import { COLOR, css, textStyle } from '../ui/theme';
import { RowList, UI_TEX, artOr, bindMenuKeys, createBackdrop, drawPanel, drawRule } from '../ui/widgets';
import { SCENES, type HangarSceneData } from './sceneKeys';

const LIST = { x: 96, y: 236, w: 1160, row: 104, gap: 12 } as const;
const COL = { pips: 500, effect: 650, cost: LIST.w - 30 } as const;
const PANEL = { x: 1300, y: 236, w: 524, h: 684 } as const;
const STAT_ROW = 33;
/** Effect lines shown in a row; the aircraft panel lists the rest. */
const EFFECT_LINES = 2;
/** Level pips (px). */
const PIP_W = 40;
const PIP_H = 16;
const PIP_GAP = 8;
const PIP_STEP = PIP_W + PIP_GAP;

interface TrackRow {
  pips: Phaser.GameObjects.Graphics;
  level: Phaser.GameObjects.Text;
  effect: Phaser.GameObjects.Text;
  cost: Phaser.GameObjects.Text;
}

interface StatRow {
  label: Phaser.GameObjects.Text;
  value: Phaser.GameObjects.Text;
  preview: Phaser.GameObjects.Text;
}

/**
 * Hangar: spend credits on upgrade tracks (3 levels each). Each row shows the owned level, what
 * the next level changes and its cost; the aircraft panel lists the resulting stats, previewing
 * the selected upgrade. ENTER / click buys, ESC goes back (to the title, or to the results screen
 * it was opened from).
 */
export class HangarScene extends Phaser.Scene {
  private sceneData: HangarSceneData = {};
  private uiSound!: UiSoundPort;
  private list!: RowList;
  private rows: TrackRow[] = [];
  private stats: StatRow[] = [];
  private credits!: Phaser.GameObjects.Text;
  private shownCredits = 0;
  private feedback!: Phaser.GameObjects.Text;
  private plane!: Phaser.GameObjects.Image;
  private planeScale = 1;
  private leaving = false;

  constructor() {
    super(SCENES.hangar);
  }

  create(data: HangarSceneData | undefined): void {
    this.sceneData = data ?? {};
    this.uiSound = resolveUiSound(this.registry.get(UI_SOUND_REGISTRY_KEY));
    // From the results screen the title theme starts here (the sting played there).
    new MusicManager(this).playTitle();
    this.leaving = false;
    this.rows = [];
    this.stats = [];
    const save = saveStoreFor(this.game);
    this.shownCredits = save.credits;
    const { width, height } = this.scale;
    createBackdrop(this, { grid: 60, scanlines: 0.25, vignette: 0.8 });

    // Header.
    this.add.text(100, 52, 'MAINTENANCE BAY', textStyle({ size: 22, color: COLOR.greenDim, glow: false, letterSpacing: 6 }));
    this.add.text(92, 72, 'HANGAR', textStyle({ size: 84, font: 'display', color: COLOR.green, glow: 16 }));
    this.add.text(width - 96, 70, 'CREDITS', textStyle({ size: 20, color: COLOR.greenDim, glow: false, letterSpacing: 4 })).setOrigin(1, 0);
    this.credits = this.add.text(width - 96, 96, '', textStyle({ size: 44, color: COLOR.amber, glow: 10 })).setOrigin(1, 0);
    this.add
      .text(width - 96, 156, `MISSIONS FLOWN ${save.missionsFlown}`, textStyle({ size: 18, color: COLOR.greenDim, glow: false }))
      .setOrigin(1, 0);
    const rule = this.add.graphics();
    drawRule(rule, 96, 204, width - 192);

    // Upgrade tracks.
    this.list = new RowList(
      this,
      UPGRADE_TRACKS.length,
      {
        x: LIST.x,
        y: LIST.y,
        width: LIST.w,
        rowHeight: LIST.row,
        gap: LIST.gap,
        sound: this.uiSound,
        onConfirm: (i) => this.buy(i),
        onMove: () => this.refreshStats(),
      },
      (row, i) => this.buildRow(row, i),
    );

    this.buildAircraftPanel();

    // Footer.
    this.feedback = this.add.text(LIST.x + LIST.w / 2, LIST.y + 6 * (LIST.row + LIST.gap) + 26, '', textStyle({ size: 24, color: COLOR.green })).setOrigin(0.5);
    this.add.text(100, height - 64, '↑↓  SELECT     ENTER  BUY UPGRADE     ESC  BACK     M  MUTE ALL', textStyle({ size: 18, color: COLOR.greenDim, glow: false }));
    const backLabel = this.sceneData.returnTo ? '◀  BACK TO DEBRIEF' : '◀  BACK TO TITLE';
    const back = this.add
      .text(width - 96, height - 66, backLabel, textStyle({ size: 20, color: COLOR.greenDim, glow: false }))
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    back.on(Phaser.Input.Events.POINTER_OVER, () => back.setColor(css(COLOR.greenBright)));
    back.on(Phaser.Input.Events.POINTER_OUT, () => back.setColor(css(COLOR.greenDim)));
    back.on(Phaser.Input.Events.POINTER_DOWN, () => this.back());

    this.refreshAll();
    this.cameras.main.fadeIn(350, 0, 0, 0);
    bindMenuKeys(this, {
      up: () => this.list.move(-1),
      down: () => this.list.move(1),
      confirm: () => this.list.confirm(),
      back: () => this.back(),
      actions: { mute: () => audioSettingsFor(this.game).toggleAll() },
    });
  }

  // --- Rows ------------------------------------------------------------------

  private buildRow(row: Phaser.GameObjects.Container, i: number): (selected: boolean) => void {
    const track = UPGRADE_TRACKS[i];
    if (!track) return () => {};
    const name = this.add.text(30, 12, track.name, textStyle({ size: 30, color: COLOR.greenDim, glow: false }));
    const description = this.add.text(30, 52, track.description, textStyle({ size: 17, color: COLOR.grey, glow: false, wrap: COL.pips - 60 }));
    const level = this.add.text(COL.pips, 18, '', textStyle({ size: 17, color: COLOR.greenDim, glow: false, letterSpacing: 2 }));
    const pips = this.add.graphics();
    const effect = this.add.text(COL.effect, LIST.row / 2, '', textStyle({ size: 19, color: COLOR.white, glow: false, lineSpacing: 6 })).setOrigin(0, 0.5);
    const cost = this.add.text(COL.cost, LIST.row / 2, '', textStyle({ size: 28, color: COLOR.amber, glow: 6, align: 'right' })).setOrigin(1, 0.5);
    row.add([name, description, level, pips, effect, cost]);
    this.rows.push({ pips, level, effect, cost });
    return (selected) => {
      name.setColor(css(selected ? COLOR.greenBright : COLOR.greenDim));
      name.setShadow(0, 0, css(COLOR.green), selected ? 10 : 0, false, selected);
      description.setColor(css(selected ? COLOR.white : COLOR.grey));
    };
  }

  private refreshRow(index: number): void {
    const track = UPGRADE_TRACKS[index];
    const row = this.rows[index];
    if (!track || !row) return;
    const save = saveStoreFor(this.game);
    const owned = save.level(track.id);
    const max = maxLevel(track);
    row.level.setText(`LV ${owned}/${max}`);
    drawPips(row.pips, COL.pips, 50, owned, max);

    const changes = nextLevelEffect(save.upgrades, track.id);
    if (changes.length === 0) {
      row.effect.setText('FULLY UPGRADED').setColor(css(COLOR.greenDim));
    } else {
      const lines = changes.slice(0, EFFECT_LINES).map((c) => `${c.label}  ${c.from} → ${c.to}`);
      if (changes.length > EFFECT_LINES) lines[EFFECT_LINES - 1] = `+ ${changes.length - EFFECT_LINES + 1} MORE  (SEE AIRCRAFT ▸)`;
      row.effect.setText(lines.join('\n')).setColor(css(COLOR.white));
    }

    const cost = nextCost(save.upgrades, track.id);
    if (cost === null) {
      row.cost.setText('MAX').setColor(css(COLOR.green)).setShadowColor(css(COLOR.green));
    } else {
      const color = save.credits >= cost ? COLOR.amber : COLOR.red;
      row.cost.setText(`${formatScore(cost)} CR`).setColor(css(color)).setShadowColor(css(color));
    }
  }

  // --- Aircraft panel ----------------------------------------------------------

  private buildAircraftPanel(): void {
    const g = this.add.graphics();
    drawPanel(g, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { fillAlpha: 0.86, chamfer: 18, cornerLength: 26 });
    this.add.text(PANEL.x + 28, PANEL.y + 20, 'AIRCRAFT', textStyle({ size: 22, color: COLOR.greenDim, glow: false, letterSpacing: 4 }));
    this.add.text(PANEL.x + PANEL.w - 28, PANEL.y + 22, 'A-10C  ·  WARTHOG 1-1', textStyle({ size: 18, color: COLOR.greenDim, glow: false })).setOrigin(1, 0);
    drawRule(g, PANEL.x + 28, PANEL.y + 56, PANEL.w - 56);

    // The aircraft, nose up, over a faint glow.
    const cx = PANEL.x + PANEL.w / 2;
    const cy = PANEL.y + 160;
    this.add.image(cx, cy, UI_TEX.glow).setDisplaySize(300, 220).setTint(COLOR.green).setAlpha(0.12);
    const key = artOr(this, 'a10', UI_TEX.a10);
    this.plane = this.add.image(cx, cy, key).setRotation(-Math.PI / 2);
    this.planeScale = 170 / Math.max(this.plane.width, this.plane.height);
    this.plane.setScale(this.planeScale);
    if (key === UI_TEX.a10) this.plane.setTint(0xa9b3b0);

    const top = PANEL.y + 268;
    drawRule(g, PANEL.x + 28, top - 14, PANEL.w - 56, COLOR.green, 0.2);
    LOADOUT_STATS.forEach((stat, i) => {
      const y = top + i * STAT_ROW;
      const label = this.add.text(PANEL.x + 28, y, stat.label, textStyle({ size: 19, color: COLOR.greenDim, glow: false }));
      const value = this.add.text(PANEL.x + 340, y, '', textStyle({ size: 20, color: COLOR.white, glow: false })).setOrigin(1, 0);
      const preview = this.add.text(PANEL.x + 356, y, '', textStyle({ size: 20, color: COLOR.amber, glow: 6 }));
      this.stats.push({ label, value, preview });
    });
  }

  /** Current stats; stats changed by the selected track's next level show "→ next". */
  private refreshStats(): void {
    const save = saveStoreFor(this.game);
    const now = buildLoadout(save.upgrades);
    const stock = stockLoadout();
    const track = UPGRADE_TRACKS[this.list.selected];
    const next = track && nextCost(save.upgrades, track.id) !== null ? buildLoadout({ ...save.upgrades, [track.id]: save.level(track.id) + 1 }) : null;
    LOADOUT_STATS.forEach((stat, i) => {
      const row = this.stats[i];
      if (!row) return;
      const value = stat.value(now);
      const upgraded = value > stat.value(stock);
      const affected = track?.stats.includes(stat.id) ?? false;
      row.value.setText(stat.format(value)).setColor(css(upgraded ? COLOR.green : COLOR.white));
      row.label.setColor(css(affected ? COLOR.green : COLOR.greenDim));
      row.preview.setText(affected && next ? `→ ${stat.format(stat.value(next))}` : '');
    });
  }

  private refreshAll(): void {
    UPGRADE_TRACKS.forEach((_, i) => this.refreshRow(i));
    this.refreshStats();
    this.list.refresh();
    this.credits.setText(`${formatScore(this.shownCredits)} CR`);
  }

  // --- Buying ------------------------------------------------------------------

  private buy(index: number): void {
    const track = UPGRADE_TRACKS[index];
    if (!track || this.leaving) return;
    const save = saveStoreFor(this.game);
    const before = save.credits;
    const result = save.buy(track.id);
    if (!result.ok) {
      this.purchaseSound(false);
      this.list.nudge();
      if (result.reason === 'maxed') this.say(`${track.name} IS FULLY UPGRADED`, COLOR.green);
      else this.say(`NEED ${formatScore(result.short)} MORE CREDITS`, COLOR.red);
      this.refreshAll();
      return;
    }
    this.purchaseSound(true);
    this.say(`${track.name} LV ${result.level} INSTALLED  ·  ${spentLabel(result.cost)}`, COLOR.greenBright);
    UPGRADE_TRACKS.forEach((_, i) => this.refreshRow(i));
    this.refreshStats();
    this.list.refresh();
    this.celebrate(track, index, before, save.credits);
  }

  private celebrate(track: UpgradeTrack, index: number, from: number, to: number): void {
    // Credits count down.
    const counter = { value: from };
    this.tweens.killTweensOf(counter);
    this.tweens.add({
      targets: counter,
      value: to,
      duration: 450,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        this.shownCredits = Math.round(counter.value);
        this.credits.setText(`${formatScore(this.shownCredits)} CR`);
      },
    });
    // Newly lit pip pops; the aircraft flashes.
    const row = this.rows[index];
    if (row) {
      const flash = this.add.graphics();
      const owned = saveStoreFor(this.game).level(track.id);
      const px = LIST.x + COL.pips + (owned - 1) * PIP_STEP;
      const py = LIST.y + index * (LIST.row + LIST.gap) + 50;
      flash.fillStyle(COLOR.greenBright, 1);
      flash.fillRect(px - 4, py - 4, PIP_W + 8, PIP_H + 8);
      this.tweens.add({ targets: flash, alpha: 0, duration: 380, onComplete: () => flash.destroy() });
    }
    this.plane.setTintFill(COLOR.greenBright);
    this.time.delayedCall(90, () => {
      if (artOr(this, 'a10', UI_TEX.a10) === UI_TEX.a10) this.plane.setTint(0xa9b3b0);
      else this.plane.clearTint();
    });
    // Pulse from the resting scale so rapid purchases don't ratchet the plane up.
    this.tweens.killTweensOf(this.plane);
    this.plane.setScale(this.planeScale);
    this.tweens.add({ targets: this.plane, scale: this.planeScale * 1.08, duration: 90, yoyo: true });
    this.cameras.main.shake(120, 0.0025);
  }

  /** The audio track's purchase / denied sounds, or the generic menu ones until those are built. */
  private purchaseSound(ok: boolean): void {
    const key = ok ? 'upgradeBuy' : 'uiError';
    if (this.cache.audio.exists(key)) playUiSound(this, key);
    else if (ok) this.uiSound.confirm();
    else this.uiSound.back();
  }

  private say(text: string, color: number): void {
    this.feedback.setText(text).setColor(css(color)).setShadowColor(css(color)).setAlpha(1);
    this.tweens.killTweensOf(this.feedback);
    this.tweens.add({ targets: this.feedback, alpha: 0, delay: 1800, duration: 500 });
  }

  private back(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.uiSound.back();
    const returnTo = this.sceneData.returnTo;
    if (returnTo) this.scene.start(SCENES.results, returnTo);
    else this.scene.start(SCENES.title);
  }
}

/** Level pips: lit boxes for owned levels, hollow for the rest. (x, y) = top-left of the first. */
function drawPips(g: Phaser.GameObjects.Graphics, x: number, y: number, owned: number, max: number): void {
  g.clear();
  for (let i = 0; i < max; i++) {
    const px = x + i * PIP_STEP;
    if (i < owned) {
      g.fillStyle(COLOR.green, 0.95);
      g.fillRect(px, y, PIP_W, PIP_H);
    } else {
      g.lineStyle(1.5, COLOR.greenFaint, 1);
      g.strokeRect(px + 0.75, y + 0.75, PIP_W - 1.5, PIP_H - 1.5);
    }
  }
}

/** 1100 → "−1,100 CR". */
function spentLabel(cost: number): string {
  return `${formatScore(-cost)} CR`;
}
