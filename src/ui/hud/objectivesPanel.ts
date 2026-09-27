import Phaser from 'phaser';
import type { LevelDefinition } from '../../sim/level';
import type { ObjectiveState } from '../../sim/world';
import { isDefendObjective, objectiveUrgency, type Urgency } from '../model';
import { COLOR, css, textStyle } from '../theme';
import { blink, drawPanel, drawRule, pulse } from '../widgets';
import { HudWidget, type HudFrame } from './hudWidget';
import { LAYOUT } from './layout';

const HEADER_H = 40;
const ROW_H = 56;
const METER_W = 150;

interface Row {
  id: string;
  flash: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Graphics;
  title: Phaser.GameObjects.Text;
  tag: Phaser.GameObjects.Text;
  detail: Phaser.GameObjects.Text;
  meter: Phaser.GameObjects.Graphics;
  state: string;
  detailShown: string;
  meterShown: number;
  urgency: Urgency;
  defend: boolean;
}

/**
 * Objectives: primary (filled diamond) vs optional (hollow), live detail line, meter bar
 * (outpost integrity), ✓ / ✗ when resolved, and a flashing row when time or integrity runs low.
 */
export class ObjectivesPanel extends HudWidget {
  private readonly container: Phaser.GameObjects.Container;
  private readonly rows: Row[];
  private readonly count: Phaser.GameObjects.Text;
  private countShown = '';
  /** Screen y of the panel's bottom edge. */
  readonly bottom: number;

  constructor(scene: Phaser.Scene, level: LevelDefinition) {
    super();
    const { x, y, w } = LAYOUT.objectives;
    const h = HEADER_H + level.objectives.length * ROW_H + 8;
    this.bottom = y + h;
    const g = scene.add.graphics();
    drawPanel(g, 0, 0, w, h);
    drawRule(g, 12, HEADER_H - 2, w - 24);
    const title = scene.add.text(16, 10, 'OBJECTIVES', textStyle({ size: 18, color: COLOR.greenDim, glow: false }));
    this.count = scene.add.text(w - 16, 10, '', textStyle({ size: 18, color: COLOR.green, glow: false })).setOrigin(1, 0);

    this.rows = level.objectives.map((def, i) => {
      const top = HEADER_H + i * ROW_H;
      const flash = scene.add.rectangle(6, top + 3, w - 12, ROW_H - 6, COLOR.amber, 0).setOrigin(0);
      const icon = scene.add.graphics({ x: 30, y: top + 20 });
      const titleText = scene.add.text(52, top + 7, def.title, textStyle({ size: 21, color: COLOR.white, glow: false }));
      const tag = scene.add.text(w - 16, top + 9, def.primary ? 'PRIMARY' : 'OPTIONAL', textStyle({ size: 14, color: COLOR.greenDim, glow: false })).setOrigin(1, 0);
      const detail = scene.add.text(52, top + 32, '', textStyle({ size: 17, color: COLOR.green, glow: false }));
      const meter = scene.add.graphics({ x: w - 16 - METER_W, y: top + 38 });
      return {
        id: def.id,
        flash,
        icon,
        title: titleText,
        tag,
        detail,
        meter,
        state: '',
        detailShown: '\u0000',
        meterShown: -1,
        urgency: 'none' as Urgency,
        defend: isDefendObjective(level, def.id),
      };
    });

    this.container = scene.add.container(x, y, [
      g,
      title,
      this.count,
      ...this.rows.flatMap((r) => [r.flash, r.icon, r.title, r.tag, r.detail, r.meter]),
    ]);
  }

  update({ view, now }: HudFrame): void {
    const done = view.objectives.filter((o) => o.primary && o.status === 'completed').length;
    const primaries = view.objectives.filter((o) => o.primary).length;
    const count = `PRIMARY ${done}/${primaries}`;
    if (count !== this.countShown) {
      this.countShown = count;
      this.count.setText(count);
    }

    for (const row of this.rows) {
      const o = view.objectives.find((ob) => ob.id === row.id);
      if (!o) continue;
      const urgency = objectiveUrgency(o);
      const state = `${o.status}|${urgency}`;
      if (state !== row.state) {
        row.state = state;
        row.urgency = urgency;
        this.applyState(row, o, urgency);
      }
      if (o.detail !== row.detailShown) {
        row.detailShown = o.detail;
        row.detail.setText(o.detail.toUpperCase());
      }
      // Redraw on a visible change of value, or when the status changes (resolved rows drop it).
      const meter = o.status !== 'active' || o.meter === null ? -1 : Math.round(o.meter * 200) / 200;
      if (meter !== row.meterShown) {
        row.meterShown = meter;
        this.drawMeter(row, o.meter, o.status);
      }
      // Urgent rows flash.
      if (o.status === 'active' && row.urgency !== 'none') {
        const critical = row.urgency === 'critical';
        const a = critical ? (blink(now, 2.5) ? 0.3 : 0.06) : 0.06 + 0.12 * pulse(now, 1.2);
        row.flash.setFillStyle(critical ? COLOR.red : COLOR.amber, a);
      } else if (row.flash.fillAlpha !== 0) {
        row.flash.setFillStyle(COLOR.amber, 0);
      }
    }
  }

  destroy(): void {
    this.container.destroy();
  }

  private applyState(row: Row, o: ObjectiveState, urgency: Urgency): void {
    const g = row.icon;
    g.clear();
    const accent = row.defend ? COLOR.blue : COLOR.amber;
    if (o.status === 'completed') {
      g.fillStyle(COLOR.green, 0.2);
      g.fillRect(-11, -11, 22, 22);
      g.lineStyle(2, COLOR.green, 1);
      g.strokeRect(-11, -11, 22, 22);
      g.lineStyle(3.5, COLOR.greenBright, 1);
      g.beginPath();
      g.moveTo(-6, 0);
      g.lineTo(-1, 6);
      g.lineTo(7, -6);
      g.strokePath();
    } else if (o.status === 'failed') {
      g.fillStyle(COLOR.red, 0.2);
      g.fillRect(-11, -11, 22, 22);
      g.lineStyle(2, COLOR.red, 1);
      g.strokeRect(-11, -11, 22, 22);
      g.lineStyle(3.5, COLOR.red, 1);
      g.lineBetween(-6, -6, 6, 6);
      g.lineBetween(6, -6, -6, 6);
    } else {
      const d = [
        { x: 0, y: -12 },
        { x: 12, y: 0 },
        { x: 0, y: 12 },
        { x: -12, y: 0 },
      ];
      if (o.primary) {
        g.fillStyle(accent, 1);
        g.fillPoints(d, true);
      } else {
        g.lineStyle(2.5, accent, 1);
        g.strokePoints(d, true);
      }
    }
    const resolved = o.status !== 'active';
    row.title.setColor(css(o.status === 'failed' ? COLOR.red : resolved ? COLOR.greenDim : COLOR.white));
    const detailColor = o.status === 'completed' ? COLOR.green : o.status === 'failed' ? COLOR.red : urgency === 'critical' ? COLOR.red : urgency === 'warn' ? COLOR.amber : COLOR.green;
    row.detail.setColor(css(detailColor));
    row.tag.setColor(css(resolved ? COLOR.greyDim : o.primary ? COLOR.green : COLOR.greenDim));
  }

  private drawMeter(row: Row, meter: number | null, status: ObjectiveState['status']): void {
    const g = row.meter;
    g.clear();
    if (meter === null || status !== 'active') return;
    const color = meter > 0.5 ? COLOR.blue : meter > 0.25 ? COLOR.amber : COLOR.red;
    g.fillStyle(COLOR.black, 0.5);
    g.fillRect(0, 0, METER_W, 10);
    g.fillStyle(color, 0.95);
    g.fillRect(1, 1, (METER_W - 2) * Math.max(0, Math.min(1, meter)), 8);
    g.lineStyle(1, color, 0.6);
    g.strokeRect(0, 0, METER_W, 10);
    // Quarter ticks.
    g.lineStyle(1, COLOR.black, 0.6);
    for (let i = 1; i < 4; i++) g.lineBetween((METER_W * i) / 4, 0, (METER_W * i) / 4, 10);
  }
}
