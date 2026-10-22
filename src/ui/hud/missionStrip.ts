import Phaser from 'phaser';
import { formatClock, formatMissionClock, formatScore, formatSigned } from '../format';
import { CountUp } from '../model';
import { COLOR, css, textStyle } from '../theme';
import { drawPanel } from '../widgets';
import { HudWidget, type HudFrame } from './hudWidget';
import { LAYOUT } from './layout';

/**
 * Top-centre strip: mission clock (with par) and the score ticking up, with +points pops.
 * Score-attack missions pass `countdown` (their time limit) and the clock counts down instead.
 */
export class MissionStrip extends HudWidget {
  private readonly container: Phaser.GameObjects.Container;
  private readonly clock: Phaser.GameObjects.Text;
  private readonly score: Phaser.GameObjects.Text;
  private readonly delta: Phaser.GameObjects.Text;
  private readonly counter = new CountUp(0, 0.9, 120);
  private secondShown = -1;
  private scoreShown = Number.NaN;
  private deltaSum = 0;
  private deltaAge = 99;

  constructor(
    scene: Phaser.Scene,
    parTime: number,
    private readonly countdown: number | null = null,
  ) {
    super();
    const { cx, y, w, h } = LAYOUT.strip;
    const g = scene.add.graphics();
    drawPanel(g, 0, 0, w, h);
    g.lineStyle(1, COLOR.green, 0.25);
    g.lineBetween(w * 0.42, 12, w * 0.42, h - 12);
    const clockLabel = scene.add.text(18, 10, countdown === null ? 'MISSION' : 'TIME LEFT', textStyle({ size: 15, color: COLOR.greenDim, glow: false }));
    const parText = countdown === null ? `PAR ${formatClock(parTime)}` : '';
    const par = scene.add.text(w * 0.42 - 14, 10, parText, textStyle({ size: 15, color: COLOR.greenDim, glow: false })).setOrigin(1, 0);
    this.clock = scene.add.text(18, 28, '', textStyle({ size: 38, color: COLOR.green }));
    const scoreLabel = scene.add.text(w * 0.42 + 18, 10, 'SCORE', textStyle({ size: 15, color: COLOR.greenDim, glow: false }));
    this.score = scene.add.text(w - 18, 28, '', textStyle({ size: 38, color: COLOR.green })).setOrigin(1, 0);
    this.delta = scene.add.text(w + 12, h / 2, '', textStyle({ size: 26, color: COLOR.greenBright, stroke: true })).setOrigin(0, 0.5);
    this.container = scene.add.container(cx - w / 2, y, [g, clockLabel, par, this.clock, scoreLabel, this.score, this.delta]);
  }

  update({ view, events, dt }: HudFrame): void {
    const second = Math.floor(view.time);
    if (second !== this.secondShown) {
      this.secondShown = second;
      if (this.countdown === null) {
        this.clock.setText(formatMissionClock(view.time));
      } else {
        const left = Math.max(0, Math.ceil(this.countdown - view.time));
        this.clock.setText(formatMissionClock(left));
        const color = left <= 30 ? COLOR.red : COLOR.green;
        this.clock.setColor(css(color));
        this.clock.setShadowColor(css(color));
      }
    }

    for (const e of events) {
      if (e.type !== 'scoreAwarded') continue;
      this.deltaSum = this.deltaAge < 1.2 ? this.deltaSum + e.points : e.points;
      this.deltaAge = 0;
      this.delta.setText(formatSigned(this.deltaSum));
      const color = this.deltaSum >= 0 ? COLOR.greenBright : COLOR.red;
      this.delta.setColor(css(color));
      this.delta.setShadowColor(css(color));
    }
    this.deltaAge += dt;
    this.delta.setAlpha(this.deltaAge < 1.4 ? 1 : Math.max(0, 1 - (this.deltaAge - 1.4) / 0.5));
    this.delta.x = LAYOUT.strip.w + 12 + Math.min(this.deltaAge, 0.15) * 40;

    this.counter.setTarget(view.score);
    const shown = this.counter.update(dt);
    if (shown !== this.scoreShown) {
      this.scoreShown = shown;
      this.score.setText(formatScore(shown));
      const counting = !this.counter.settled;
      this.score.setColor(css(counting ? COLOR.greenBright : COLOR.green));
    }
  }

  destroy(): void {
    this.container.destroy();
  }
}
