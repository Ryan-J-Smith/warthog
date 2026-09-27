import Phaser from 'phaser';
import { RadioQueue } from '../model';
import { COLOR, css, textStyle } from '../theme';
import { blink, drawPanel } from '../widgets';
import { HudWidget, type HudFrame } from './hudWidget';
import { LAYOUT } from './layout';
import { toneColor } from './toneColor';

/**
 * Radio ticker: queued transmissions, speaker tag in the tone colour, typewriter text with a
 * cursor, each line held ~4–6 s then faded. Idle shows a dim "no traffic" state.
 */
export class RadioTicker extends HudWidget {
  private readonly container: Phaser.GameObjects.Container;
  private readonly queue = new RadioQueue();
  private readonly tag: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly idle: Phaser.GameObjects.Text;
  private readonly rx: Phaser.GameObjects.Arc;
  private readonly pending: Phaser.GameObjects.Text;
  private readonly squelch: Phaser.GameObjects.Rectangle;
  private serialShown = -1;
  private wrapped = '';
  private bodyShown = '';
  private pendingShown = -1;

  constructor(scene: Phaser.Scene) {
    super();
    const { x, y, w, h } = LAYOUT.radio;
    const g = scene.add.graphics();
    drawPanel(g, 0, 0, w, h);
    this.squelch = scene.add.rectangle(0, 0, w, h, COLOR.green, 0).setOrigin(0);
    const label = scene.add.text(w - 16, 12, 'COMMS', textStyle({ size: 15, color: COLOR.greenDim, glow: false })).setOrigin(1, 0);
    this.rx = scene.add.circle(w - 86, 21, 5, COLOR.green, 1);
    this.pending = scene.add.text(w - 102, 12, '', textStyle({ size: 15, color: COLOR.amber, glow: false })).setOrigin(1, 0);
    this.tag = scene.add.text(16, 10, '', textStyle({ size: 17, color: COLOR.panel, glow: false })).setPadding(8, 2, 8, 2);
    this.body = scene.add.text(16, 44, '', textStyle({ size: 21, color: COLOR.white, glow: 3, wrap: w - 32, lineSpacing: 3 }));
    this.idle = scene.add.text(16, 12, '— NO TRAFFIC —', textStyle({ size: 15, color: COLOR.greenFaint, glow: false }));
    this.container = scene.add.container(x, y, [g, this.squelch, label, this.rx, this.pending, this.tag, this.body, this.idle]);
  }

  update({ events, dt, now }: HudFrame): void {
    for (const e of events) {
      if (e.type === 'radio') this.queue.push({ speaker: e.speaker, text: e.text, tone: e.tone });
    }
    this.queue.update(dt);
    const d = this.queue.display;

    if (!d) {
      if (this.serialShown !== 0) {
        this.serialShown = 0;
        this.tag.setVisible(false);
        this.body.setText('');
        this.bodyShown = '';
        this.idle.setVisible(true);
        this.rx.setFillStyle(COLOR.greenFaint, 1);
        this.container.setAlpha(0.6);
      }
      this.setPending(0);
      return;
    }

    if (d.serial !== this.serialShown) {
      this.serialShown = d.serial;
      const color = toneColor(d.line.tone);
      this.tag.setVisible(true).setText(d.line.speaker);
      this.tag.setBackgroundColor(css(color));
      this.body.setColor(css(color === COLOR.white ? COLOR.white : color));
      this.body.setShadowColor(css(color));
      this.wrapped = this.body.getWrappedText(d.line.text).join('\n');
      this.idle.setVisible(false);
      this.squelch.setFillStyle(color, 0.22);
      this.container.setAlpha(1);
    }
    this.setPending(d.queued);

    const revealed = Math.round((d.visibleChars / Math.max(1, d.line.text.length)) * this.wrapped.length);
    const text = this.wrapped.slice(0, revealed) + (d.typing && blink(now, 8) ? '▌' : '');
    if (text !== this.bodyShown) {
      this.bodyShown = text;
      this.body.setText(text);
    }
    const squelch = this.squelch.fillAlpha;
    if (squelch > 0) this.squelch.setFillStyle(this.squelch.fillColor, Math.max(0, squelch - dt * 0.8));
    this.rx.setFillStyle(toneColor(d.line.tone), d.typing ? (blink(now, 10) ? 1 : 0.2) : 1);
    this.container.setAlpha(0.35 + 0.65 * d.alpha);
    this.body.setAlpha(d.alpha);
    this.tag.setAlpha(d.alpha);
  }

  destroy(): void {
    this.container.destroy();
  }

  private setPending(n: number): void {
    if (n === this.pendingShown) return;
    this.pendingShown = n;
    this.pending.setText(n > 0 ? `+${n}` : '');
  }
}
