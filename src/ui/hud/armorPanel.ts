import Phaser from 'phaser';
import { PLAYER } from '../../config';
import { COLOR, css, textStyle } from '../theme';
import { UI_TEX, blink, drawPanel } from '../widgets';
import { HudWidget, type HudFrame } from './hudWidget';
import { LAYOUT } from './layout';

const SEGMENTS = 20;
const BAR_X = 16;
const BAR_Y = 44;
const BAR_W = 368;
const BAR_H = 18;

/** Armor (HP) bar with segments, numeric readout, lives as A-10 icons, low-armor warning. */
export class ArmorPanel extends HudWidget {
  private readonly container: Phaser.GameObjects.Container;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly value: Phaser.GameObjects.Text;
  private readonly lives: Phaser.GameObjects.Image[] = [];
  private readonly warning: Phaser.GameObjects.Text;
  private readonly hitFlash: Phaser.GameObjects.Rectangle;
  private hpShown = -1;
  private livesShown = -1;
  private flash = 0;

  constructor(scene: Phaser.Scene) {
    super();
    const { x, y, w, h } = LAYOUT.armor;
    const g = scene.add.graphics();
    drawPanel(g, 0, 0, w, h);
    const label = scene.add.text(16, 12, 'ARMOR', textStyle({ size: 18, color: COLOR.greenDim, glow: false }));
    this.value = scene.add.text(BAR_X + BAR_W, 8, '', textStyle({ size: 26, color: COLOR.green })).setOrigin(1, 0);
    this.bar = scene.add.graphics();
    this.hitFlash = scene.add.rectangle(0, 0, w, h, COLOR.red, 0).setOrigin(0);
    const livesLabel = scene.add.text(16, 74, 'LIVES', textStyle({ size: 18, color: COLOR.greenDim, glow: false }));
    for (let i = 0; i < PLAYER.lives; i++) {
      this.lives.push(scene.add.image(100 + i * 40, 84, UI_TEX.a10).setDisplaySize(32, 32).setRotation(-Math.PI / 2).setTint(COLOR.green));
    }
    this.warning = scene.add
      .text(0, -12, 'ARMOR CRITICAL', textStyle({ size: 24, color: COLOR.red }))
      .setOrigin(0, 1)
      .setVisible(false);
    this.container = scene.add.container(x, y, [g, label, this.value, this.bar, livesLabel, ...this.lives, this.hitFlash, this.warning]);
  }

  update({ view, events, dt, now }: HudFrame): void {
    const p = view.player;
    const hp = Math.max(0, Math.ceil(p.hp));
    if (hp !== this.hpShown) {
      this.hpShown = hp;
      this.value.setText(String(hp));
      const color = this.colorFor(hp / p.maxHp);
      this.value.setColor(css(color));
      this.value.setShadowColor(css(color));
      this.drawBar(hp / p.maxHp);
    }
    if (p.lives !== this.livesShown) {
      this.livesShown = p.lives;
      this.lives.forEach((icon, i) => {
        const alive = i < p.lives;
        icon.setTint(alive ? COLOR.green : COLOR.greyDim).setAlpha(alive ? 1 : 0.45);
      });
    }
    if (events.some((e) => e.type === 'playerHit')) this.flash = 1;
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 4);
      this.hitFlash.setFillStyle(COLOR.red, this.flash * 0.35);
    }
    const low = p.alive && p.hp <= PLAYER.lowHp;
    this.warning.setVisible(low);
    if (low) this.warning.setAlpha(blink(now, 2.5) ? 1 : 0.35);
  }

  destroy(): void {
    this.container.destroy();
  }

  private colorFor(fraction: number): number {
    if (fraction > 0.6) return COLOR.green;
    if (fraction > PLAYER.lowHp / PLAYER.maxHp) return COLOR.amber;
    return COLOR.red;
  }

  private drawBar(fraction: number): void {
    const g = this.bar;
    g.clear();
    const segW = BAR_W / SEGMENTS;
    const lit = Math.ceil(fraction * SEGMENTS - 1e-6);
    const color = this.colorFor(fraction);
    for (let i = 0; i < SEGMENTS; i++) {
      const on = i < lit;
      g.fillStyle(on ? color : COLOR.greenFaint, on ? 0.95 : 0.45);
      g.fillRect(BAR_X + i * segW + 1, BAR_Y, segW - 3, BAR_H);
    }
    g.lineStyle(1, COLOR.green, 0.3);
    g.strokeRect(BAR_X - 2, BAR_Y - 3, BAR_W + 2, BAR_H + 6);
  }
}
