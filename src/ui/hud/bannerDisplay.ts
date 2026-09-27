import Phaser from 'phaser';
import type { BannerSpec } from '../model';
import { COLOR, css, textStyle } from '../theme';
import { HudWidget, type HudFrame } from './hudWidget';
import { LAYOUT, SCREEN } from './layout';
import { toneColor } from './toneColor';

const SWEEP_MS = 320;
const HOLD_MS = 2000;
const BAND_H = 150;

interface Queued {
  spec: BannerSpec;
  /** null = stay until the scene ends (mission complete). */
  holdMs: number | null;
}

/** Full-width banners that sweep in from the left, hold, and sweep out right. Queued. */
export class BannerDisplay extends HudWidget {
  private readonly container: Phaser.GameObjects.Container;
  private readonly band: Phaser.GameObjects.Graphics;
  private readonly headline: Phaser.GameObjects.Text;
  private readonly sub: Phaser.GameObjects.Text;
  private readonly queue: Queued[] = [];
  private busy = false;

  constructor(private readonly scene: Phaser.Scene) {
    super();
    this.band = scene.add.graphics();
    this.headline = scene.add.text(SCREEN.width / 2, -12, '', textStyle({ size: 84, font: 'display', color: COLOR.green, glow: 20, stroke: true })).setOrigin(0.5);
    this.sub = scene.add.text(SCREEN.width / 2, 50, '', textStyle({ size: 24, color: COLOR.white, stroke: true })).setOrigin(0.5);
    this.container = scene.add.container(-SCREEN.width, LAYOUT.banner.cy, [this.band, this.headline, this.sub]).setVisible(false);
  }

  show(spec: BannerSpec, holdMs: number | null = HOLD_MS): void {
    if (holdMs === null) {
      // A permanent banner jumps the queue and replaces whatever is showing.
      this.queue.length = 0;
      this.scene.tweens.killTweensOf(this.container);
      this.busy = false;
    }
    this.queue.push({ spec, holdMs });
    if (!this.busy) this.next();
  }

  update(_frame: HudFrame): void {}

  destroy(): void {
    this.scene.tweens.killTweensOf(this.container);
    this.container.destroy();
  }

  private next(): void {
    const item = this.queue.shift();
    if (!item) {
      this.busy = false;
      this.container.setVisible(false);
      return;
    }
    this.busy = true;
    const color = toneColor(item.spec.tone);
    this.drawBand(color);
    this.headline.setText(item.spec.headline).setColor(css(color)).setShadowColor(css(color));
    this.sub.setText(item.spec.sub);
    this.container.setVisible(true).setX(-SCREEN.width).setAlpha(1);
    this.headline.setScale(1.25);

    this.scene.tweens.add({ targets: this.container, x: 0, duration: SWEEP_MS, ease: 'Cubic.easeOut' });
    this.scene.tweens.add({ targets: this.headline, scale: 1, duration: SWEEP_MS + 200, delay: SWEEP_MS * 0.6, ease: 'Back.easeOut' });
    if (item.holdMs === null) return;
    this.scene.tweens.add({
      targets: this.container,
      x: SCREEN.width,
      delay: SWEEP_MS + item.holdMs,
      duration: SWEEP_MS,
      ease: 'Cubic.easeIn',
      onComplete: () => this.next(),
    });
  }

  private drawBand(color: number): void {
    const g = this.band;
    g.clear();
    const top = -BAND_H / 2 - 10;
    g.fillStyle(COLOR.black, 0.6);
    g.fillRect(0, top, SCREEN.width, BAND_H);
    g.fillStyle(color, 0.1);
    g.fillRect(0, top, SCREEN.width, BAND_H);
    g.lineStyle(3, color, 0.95);
    g.lineBetween(0, top, SCREEN.width, top);
    g.lineBetween(0, top + BAND_H, SCREEN.width, top + BAND_H);
    // Speed streaks.
    g.lineStyle(1, color, 0.35);
    for (let i = 0; i < 6; i++) {
      const y = top + 14 + i * 24;
      g.lineBetween(60 + i * 37, y, 360 + i * 21, y);
      g.lineBetween(SCREEN.width - 360 - i * 21, y, SCREEN.width - 60 - i * 37, y);
    }
  }
}
