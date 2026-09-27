import Phaser from 'phaser';
import { ALTITUDE_BANDS, type AltitudeBand } from '../../sim/types';
import { BAND_HINTS, BAND_LABEL } from '../copy';
import { altitudeFeet, formatScore, speedKnots } from '../format';
import { COLOR, css, textStyle } from '../theme';
import { drawPanel, pulse } from '../widgets';
import { HudWidget, type HudFrame } from './hudWidget';
import { LAYOUT } from './layout';

const BAND_H = 96;
const SCALE_X = 16;
const SCALE_W = 74;
const TOP = 58;

interface BandRow {
  band: AltitudeBand;
  box: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  good: Phaser.GameObjects.Text;
  threat: Phaser.GameObjects.Text;
  centerY: number;
}

/**
 * Altitude ladder: three band boxes (HIGH on top), a continuous caret from `player.alt`, the
 * target band outlined, what each band is good for and what can hit you there, plus speed.
 */
export class AltitudeLadder extends HudWidget {
  private readonly container: Phaser.GameObjects.Container;
  private readonly rows: BandRow[];
  private readonly caret: Phaser.GameObjects.Graphics;
  private readonly targetArrow: Phaser.GameObjects.Text;
  private readonly feet: Phaser.GameObjects.Text;
  private readonly speed: Phaser.GameObjects.Text;
  private readonly boost: Phaser.GameObjects.Text;
  private lastState = '';
  private lastFeet = -1;
  private lastSpeed = -1;
  private lastBoost = '';

  /** `top`: screen y to place the ladder at (never above its default slot). */
  constructor(scene: Phaser.Scene, top: number = LAYOUT.ladder.y) {
    super();
    const { x, w, h } = LAYOUT.ladder;
    const y = Math.max(LAYOUT.ladder.y, top);
    const g = scene.add.graphics();
    drawPanel(g, 0, 0, w, h);
    const title = scene.add.text(16, 12, 'ALT', textStyle({ size: 18, color: COLOR.greenDim, glow: false }));
    this.feet = scene.add.text(w - 16, 10, '', textStyle({ size: 22, color: COLOR.green })).setOrigin(1, 0);

    // Tape ticks down the scale.
    const ticks = scene.add.graphics();
    ticks.lineStyle(1, COLOR.green, 0.35);
    for (let i = 0; i <= 12; i++) {
      const ty = TOP + (i / 12) * BAND_H * 3;
      const major = i % 4 === 0;
      ticks.lineBetween(SCALE_X - (major ? 10 : 5), ty, SCALE_X - 1, ty);
    }

    const bands = [...ALTITUDE_BANDS].reverse();
    this.rows = bands.map((band, i) => {
      const top = TOP + i * BAND_H;
      const box = scene.add.graphics();
      const label = scene.add.text(SCALE_X + SCALE_W / 2, top + BAND_H / 2, BAND_LABEL[band], textStyle({ size: 22, color: COLOR.green })).setOrigin(0.5);
      const hint = BAND_HINTS[band];
      const good = scene.add.text(SCALE_X + SCALE_W + 14, top + BAND_H / 2 - 13, hint.good, textStyle({ size: 17, color: COLOR.green, glow: false })).setOrigin(0, 0.5);
      const threat = scene.add
        .text(SCALE_X + SCALE_W + 14, top + BAND_H / 2 + 13, `⚠ ${hint.threat}`, textStyle({ size: 17, color: COLOR.amber, glow: false }))
        .setOrigin(0, 0.5);
      return { band, box, label, good, threat, centerY: top + BAND_H / 2 };
    });

    this.caret = scene.add.graphics();
    this.caret.fillStyle(COLOR.greenBright, 1);
    this.caret.fillTriangle(-2, -9, 12, 0, -2, 9);
    this.caret.lineStyle(2, COLOR.greenBright, 0.9);
    this.caret.lineBetween(12, 0, 22, 0);
    this.caret.lineBetween(SCALE_W + 2, 0, SCALE_W + 16, 0);
    this.caret.lineStyle(1, COLOR.greenBright, 0.25);
    this.caret.lineBetween(22, 0, SCALE_W + 2, 0);
    this.caret.x = SCALE_X - 12;

    this.targetArrow = scene.add.text(SCALE_X + SCALE_W - 4, 0, '', textStyle({ size: 18, color: COLOR.greenBright })).setOrigin(1, 0.5);

    const bottom = TOP + BAND_H * 3 + 14;
    const spdLabel = scene.add.text(16, bottom + 4, 'SPD', textStyle({ size: 18, color: COLOR.greenDim, glow: false }));
    this.speed = scene.add.text(70, bottom, '', textStyle({ size: 26, color: COLOR.green }));
    this.boost = scene.add.text(w - 16, bottom + 4, '', textStyle({ size: 17, color: COLOR.greenBright })).setOrigin(1, 0);

    this.container = scene.add.container(x, y, [
      g,
      title,
      this.feet,
      ticks,
      ...this.rows.flatMap((r) => [r.box, r.label, r.good, r.threat]),
      this.caret,
      this.targetArrow,
      spdLabel,
      this.speed,
      this.boost,
    ]);
  }

  update({ view, now }: HudFrame): void {
    const p = view.player;
    // Caret: alt 0 → centre of LOW, 2 → centre of HIGH.
    const lowCenter = TOP + BAND_H * 2.5;
    this.caret.y = lowCenter - Math.max(0, Math.min(2, p.alt)) * BAND_H;
    this.caret.setAlpha(p.alive ? 1 : 0.3);

    const state = `${p.band}|${p.targetBand}|${p.alive}`;
    if (state !== this.lastState) {
      this.lastState = state;
      for (const row of this.rows) this.drawRow(row, p.band, p.targetBand);
    }
    const moving = p.targetBand !== p.band;
    const target = this.rows.find((r) => r.band === p.targetBand);
    this.targetArrow.setVisible(moving && target !== undefined);
    if (moving && target) {
      const up = ALTITUDE_BANDS.indexOf(p.targetBand) > ALTITUDE_BANDS.indexOf(p.band);
      this.targetArrow.setText(up ? '▲' : '▼');
      this.targetArrow.y = target.centerY + (up ? 24 : -24);
      this.targetArrow.setAlpha(0.5 + 0.5 * pulse(now, 3));
      target.box.setAlpha(0.55 + 0.45 * pulse(now, 3));
    } else {
      for (const row of this.rows) row.box.setAlpha(1);
    }

    const feet = altitudeFeet(p.alt);
    if (feet !== this.lastFeet) {
      this.lastFeet = feet;
      this.feet.setText(`${formatScore(feet)} FT`);
    }
    const knots = speedKnots(p.speed);
    if (knots !== this.lastSpeed) {
      this.lastSpeed = knots;
      this.speed.setText(`${knots} KT`);
    }
    const boost = p.energy > 1.03 ? 'DIVE +' : p.energy < 0.97 ? 'CLIMB −' : '';
    if (boost !== this.lastBoost) {
      this.lastBoost = boost;
      this.boost.setText(boost);
      this.boost.setColor(css(boost.startsWith('DIVE') ? COLOR.greenBright : COLOR.amber));
    }
  }

  destroy(): void {
    this.container.destroy();
  }

  private drawRow(row: BandRow, current: AltitudeBand, target: AltitudeBand): void {
    const top = row.centerY - BAND_H / 2;
    const isCurrent = row.band === current;
    const isTarget = row.band === target;
    const g = row.box;
    g.clear();
    g.fillStyle(isCurrent ? COLOR.green : COLOR.black, isCurrent ? 0.2 : 0.25);
    g.fillRect(SCALE_X, top + 3, SCALE_W, BAND_H - 6);
    g.lineStyle(isTarget ? 2.5 : 1, isTarget ? COLOR.greenBright : COLOR.green, isTarget ? 1 : 0.35);
    g.strokeRect(SCALE_X, top + 3, SCALE_W, BAND_H - 6);
    if (isCurrent) {
      g.fillStyle(COLOR.green, 0.9);
      g.fillRect(SCALE_X + SCALE_W + 2, top + 3, 4, BAND_H - 6);
    }
    row.label.setColor(css(isCurrent ? COLOR.greenBright : COLOR.greenDim));
    row.good.setAlpha(isCurrent ? 1 : 0.6);
    row.threat.setAlpha(isCurrent ? 1 : 0.7);
    row.threat.setColor(css(isCurrent ? COLOR.amber : COLOR.amberDim));
  }
}
