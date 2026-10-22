import type Phaser from 'phaser';
import { COLOR } from '../theme';

/** Medal colour (earned challenge pips and ticks). */
export const MEDAL_COLOR = COLOR.amber;

/**
 * A row of challenge medals starting at (x, y) (left edge, vertical centre): a filled, glowing
 * diamond for each earned challenge and a faint outline for each one still open. Returns a
 * container whose width is the row's.
 */
export function createMedalPips(scene: Phaser.Scene, x: number, y: number, earned: readonly boolean[], size = 18): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  const g = scene.add.graphics();
  container.add(g);
  const h = size / 2;
  const gap = size * 0.55;
  earned.forEach((won, i) => {
    const cx = h + i * (size + gap);
    const points = [
      { x: cx, y: -h },
      { x: cx + h, y: 0 },
      { x: cx, y: h },
      { x: cx - h, y: 0 },
    ];
    if (won) {
      g.fillStyle(MEDAL_COLOR, 0.22);
      g.fillCircle(cx, 0, h + 4);
      g.fillStyle(MEDAL_COLOR, 1);
      g.fillPoints(points, true);
      g.lineStyle(1.5, COLOR.panel, 0.9);
      g.lineBetween(cx - h * 0.45, 0, cx + h * 0.45, 0);
    } else {
      g.lineStyle(2, COLOR.greenFaint, 1);
      g.strokePoints(points, true);
    }
  });
  container.setSize(earned.length * size + Math.max(0, earned.length - 1) * gap, size);
  return container;
}
