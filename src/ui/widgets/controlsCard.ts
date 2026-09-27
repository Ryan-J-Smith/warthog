import type Phaser from 'phaser';
import { controlRows } from '../copy';
import { COLOR, textStyle } from '../theme';

/**
 * Controls card: keycaps on the left, actions on the right. Returns a container whose origin is
 * the top-left corner; height is `rows × rowHeight`.
 */
export function createControlsCard(scene: Phaser.Scene, x: number, y: number, keyWidth: number, rowHeight = 40, fontSize = 20): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  const g = scene.add.graphics();
  container.add(g);
  controlRows().forEach((row, i) => {
    const ry = i * rowHeight;
    const keys = scene.add.text(12, ry + rowHeight / 2, row.keys, textStyle({ size: fontSize, color: COLOR.greenBright, glow: 6 })).setOrigin(0, 0.5);
    const w = Math.min(keyWidth - 8, keys.width + 24);
    g.fillStyle(COLOR.green, 0.1);
    g.fillRect(0, ry + 5, w, rowHeight - 10);
    g.lineStyle(1, COLOR.green, 0.45);
    g.strokeRect(0, ry + 5, w, rowHeight - 10);
    const action = scene.add.text(keyWidth + 8, ry + rowHeight / 2, row.action, textStyle({ size: fontSize, color: COLOR.white, glow: false })).setOrigin(0, 0.5);
    container.add([keys, action]);
  });
  return container;
}
