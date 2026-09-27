import Phaser from 'phaser';
import type { LevelDefinition } from '../../sim/level';
import type { Vec2 } from '../../sim/math';
import { formatDistance } from '../format';
import { declutter, duplicateMarkers, edgeArrow, isDefendObjective, objectiveShortLabel, worldToScreen } from '../model';
import { COLOR, css, textStyle } from '../theme';
import { UI_TEX, artOr, pulse } from '../widgets';
import { HudWidget, type HudFrame } from './hudWidget';
import { LAYOUT, SCREEN } from './layout';

interface ArrowView {
  container: Phaser.GameObjects.Container;
  arrow: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  labelShown: string;
  color: number;
}

interface Target {
  pos: Vec2;
  label: string;
  color: number;
}

const POOL = 6;
/** Markers closer than this (world units) are treated as one place. */
const SAME_SPOT = 80;
const LABEL_INSET = 58;
/** Minimum distance between two arrows (their labels are ~110 px wide). */
const MIN_SPACING = 112;

/** Chevrons at the screen edges pointing at active objectives (and base when RTB), with range. */
export class OffscreenArrows extends HudWidget {
  private readonly views: ArrowView[] = [];
  private readonly labels = new Map<string, string>();
  private readonly defend = new Set<string>();

  constructor(scene: Phaser.Scene, level: LevelDefinition) {
    super();
    for (const o of level.objectives) {
      this.labels.set(o.id, objectiveShortLabel(level, o.id));
      if (isDefendObjective(level, o.id)) this.defend.add(o.id);
    }
    const texture = artOr(scene, 'offscreenArrow', UI_TEX.chevron);
    for (let i = 0; i < POOL; i++) {
      const arrow = scene.add.image(0, 0, texture).setDisplaySize(44, 44);
      const label = scene.add
        .text(0, 0, '', textStyle({ size: 18, color: COLOR.amber, glow: false, align: 'center', lineSpacing: -2 }))
        .setOrigin(0.5)
        .setPadding(7, 3, 7, 3)
        .setBackgroundColor('rgba(5, 13, 8, 0.72)');
      const container = scene.add.container(0, 0, [arrow, label]).setVisible(false);
      this.views.push({ container, arrow, label, labelShown: '', color: -1 });
    }
  }

  update({ view, camera, now }: HudFrame): void {
    const active = view.objectives.filter((o) => o.status === 'active' && o.marker);
    // Objectives sharing a spot (column + bridge) get one arrow: the first listed wins.
    const shared = duplicateMarkers(active.map((o) => o.marker), SAME_SPOT);
    const targets: Target[] = [];
    active.forEach((o, i) => {
      if (!o.marker || shared.has(i)) return;
      targets.push({ pos: o.marker, label: this.labels.get(o.id) ?? 'TARGET', color: this.defend.has(o.id) ? COLOR.blue : COLOR.amber });
    });
    if (view.rtb) {
      const base = view.entities.find((e) => e.refId === view.level.homeBaseRefId);
      if (base) targets.push({ pos: base.pos, label: 'BASE', color: COLOR.blue });
    }

    const p = view.player;
    const glow = 0.7 + 0.3 * pulse(now, 1.5);
    const placed = p.alive
      ? targets
          .map((t) => {
            const screen = worldToScreen(t.pos, camera, SCREEN.width, SCREEN.height);
            const { margin, rx, ry, cx, cy } = LAYOUT.arrows;
            const place = edgeArrow(screen, SCREEN.width, SCREEN.height, margin, rx, ry, { x: cx, y: cy });
            return { ...place, target: t };
          })
          .filter((a) => !a.onScreen)
      : [];
    // Arrows toward targets on similar bearings would overlap: spread them out.
    declutter(placed, MIN_SPACING);

    this.views.forEach((v, i) => {
      const place = placed[i];
      if (!place) {
        v.container.setVisible(false);
        return;
      }
      const t = place.target;
      v.container.setVisible(true).setPosition(place.x, place.y).setAlpha(glow);
      v.arrow.setRotation(place.angle);
      if (v.color !== t.color) {
        v.color = t.color;
        v.arrow.setTint(t.color);
        v.label.setColor(css(t.color));
      }
      v.label.setPosition(-Math.cos(place.angle) * LABEL_INSET, -Math.sin(place.angle) * LABEL_INSET);
      const text = `${t.label}\n${formatDistance(Math.hypot(t.pos.x - p.pos.x, t.pos.y - p.pos.y))}`;
      if (text !== v.labelShown) {
        v.labelShown = text;
        v.label.setText(text);
      }
    });
  }

  destroy(): void {
    for (const v of this.views) v.container.destroy();
  }
}
