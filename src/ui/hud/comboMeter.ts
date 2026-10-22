import type Phaser from 'phaser';
import { COMBO } from '../../config';
import { COLOR, textStyle } from '../theme';
import { drawPanel } from '../widgets';
import { HudWidget, type HudFrame } from './hudWidget';
import { LAYOUT } from './layout';

/**
 * Kill chain ("CHAIN 4 · ×1.75") with a draining window bar, and active power-up timers.
 * Pops when the chain grows; shows "CHAIN BROKEN" briefly when hull damage ends it.
 */
export class ComboMeter extends HudWidget {
  private readonly container: Phaser.GameObjects.Container;
  private readonly chainText: Phaser.GameObjects.Text;
  private readonly multText: Phaser.GameObjects.Text;
  private readonly powerText: Phaser.GameObjects.Text;
  private readonly bar: Phaser.GameObjects.Graphics;
  private pop = 0;
  private broken = 0;
  private lastChain = 0;

  constructor(scene: Phaser.Scene) {
    super();
    const { x, y, w, h } = LAYOUT.combo;
    const g = scene.add.graphics();
    drawPanel(g, 0, 0, w, h);
    this.chainText = scene.add.text(18, 10, '', textStyle({ size: 34, font: 'display', color: COLOR.amber, glow: 10 }));
    this.multText = scene.add.text(w - 18, 14, '', textStyle({ size: 30, color: COLOR.amber })).setOrigin(1, 0);
    this.powerText = scene.add.text(18, 62, '', textStyle({ size: 18, color: COLOR.white, glow: false }));
    this.bar = scene.add.graphics();
    this.container = scene.add.container(x, y, [g, this.chainText, this.multText, this.bar, this.powerText]).setAlpha(0);
  }

  update({ view, events, dt }: HudFrame): void {
    const combo = view.combo;
    const p = view.player;
    for (const e of events) {
      if (e.type === 'comboChanged') this.pop = 1;
      if (e.type === 'comboEnded' && e.reason === 'hit') this.broken = 1.2;
    }
    this.pop = Math.max(0, this.pop - dt * 4);
    this.broken = Math.max(0, this.broken - dt);

    const chaining = combo.chain >= 2;
    const powers: string[] = [];
    if (p.overdrive > 0) powers.push(`GUN OVERDRIVE ${Math.ceil(p.overdrive)}s`);
    if (p.boostFree > 0) powers.push(`FREE AFTERBURNER ${Math.ceil(p.boostFree)}s`);
    const visible = chaining || this.broken > 0 || powers.length > 0;
    this.container.setAlpha(visible ? Math.min(1, this.container.alpha + dt * 6) : Math.max(0, this.container.alpha - dt * 3));

    if (chaining) {
      this.lastChain = combo.chain;
      this.chainText.setText(`CHAIN ${combo.chain}`).setColor('#ffb627').setScale(1 + this.pop * 0.25);
      this.multText.setText(`×${combo.multiplier.toFixed(2)}`);
    } else if (this.broken > 0) {
      this.chainText.setText(`CHAIN BROKEN (${this.lastChain})`).setColor('#ff3b30').setScale(1);
      this.multText.setText('');
    } else {
      this.chainText.setText(powers.length > 0 ? 'POWER-UP' : '').setColor('#ffb627').setScale(1);
      this.multText.setText('');
    }
    this.powerText.setText(powers.join('   ·   '));

    const g = this.bar;
    g.clear();
    if (chaining) {
      const left = Math.max(0, Math.min(1, (combo.expiresAt - view.time) / COMBO.window));
      g.fillStyle(COLOR.amberDim, 0.5);
      g.fillRect(18, 52, LAYOUT.combo.w - 36, 6);
      g.fillStyle(COLOR.amber, 0.95);
      g.fillRect(18, 52, (LAYOUT.combo.w - 36) * left, 6);
    }
  }

  destroy(): void {
    this.container.destroy();
  }
}
