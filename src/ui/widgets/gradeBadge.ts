import type Phaser from 'phaser';
import { COLOR, textStyle } from '../theme';

/** Stamp colour per grade (results stamp, level select and hangar badges). */
export const GRADE_COLOR: Readonly<Record<string, number>> = {
  S: 0xffd24a,
  A: COLOR.green,
  B: COLOR.blue,
  C: COLOR.amber,
  D: COLOR.red,
};

export function gradeColor(grade: string): number {
  return GRADE_COLOR[grade] ?? COLOR.green;
}

/**
 * Small grade stamp: a double-ruled square with the letter, centred on (x, y). A null grade draws
 * an empty dashed slot ("not flown yet"). Returns a container.
 */
export function createGradeBadge(scene: Phaser.Scene, x: number, y: number, size: number, grade: string | null): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  const g = scene.add.graphics();
  container.add(g);
  const h = size / 2;
  if (grade === null) {
    g.lineStyle(2, COLOR.greenFaint, 1);
    const dash = size / 7;
    for (let i = 0; i < 7; i += 2) {
      const a = -h + i * dash;
      g.lineBetween(a, -h, a + dash, -h);
      g.lineBetween(a, h, a + dash, h);
      g.lineBetween(-h, a, -h, a + dash);
      g.lineBetween(h, a, h, a + dash);
    }
    container.add(scene.add.text(0, 0, '–', textStyle({ size: Math.round(size * 0.5), color: COLOR.greenFaint, glow: false })).setOrigin(0.5));
    return container;
  }
  const color = gradeColor(grade);
  g.fillStyle(color, 0.1);
  g.fillRect(-h, -h, size, size);
  g.lineStyle(Math.max(2, size / 22), color, 1);
  g.strokeRect(-h, -h, size, size);
  g.lineStyle(1.5, color, 0.6);
  g.strokeRect(-h + size * 0.1, -h + size * 0.1, size * 0.8, size * 0.8);
  container.add(scene.add.text(0, size * 0.03, grade, textStyle({ size: Math.round(size * 0.72), font: 'display', color, glow: 8 })).setOrigin(0.5));
  return container;
}
