import type Phaser from 'phaser';
import { COLOR, PANEL_ALPHA } from '../theme';

export interface PanelStyle {
  fill?: number;
  fillAlpha?: number;
  border?: number;
  borderAlpha?: number;
  /** Bright corner brackets. */
  corner?: number;
  cornerAlpha?: number;
  cornerLength?: number;
  /** Chamfer size on the top-right and bottom-left corners. */
  chamfer?: number;
  lineWidth?: number;
}

/** Avionics glass panel: dark translucent fill, hairline border, bright corner brackets. */
export function drawPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, style: PanelStyle = {}): void {
  const c = style.chamfer ?? 10;
  const outline = [
    { x, y },
    { x: x + w - c, y },
    { x: x + w, y: y + c },
    { x: x + w, y: y + h },
    { x: x + c, y: y + h },
    { x, y: y + h - c },
  ];
  g.fillStyle(style.fill ?? COLOR.panel, style.fillAlpha ?? PANEL_ALPHA);
  g.fillPoints(outline, true);
  g.lineStyle(style.lineWidth ?? 1.5, style.border ?? COLOR.green, style.borderAlpha ?? 0.28);
  g.strokePoints(outline, true);

  const len = style.cornerLength ?? 14;
  g.lineStyle(2, style.corner ?? COLOR.green, style.cornerAlpha ?? 0.9);
  // Top-left.
  g.lineBetween(x, y, x + len, y);
  g.lineBetween(x, y, x, y + len);
  // Bottom-right.
  g.lineBetween(x + w, y + h, x + w - len, y + h);
  g.lineBetween(x + w, y + h, x + w, y + h - len);
  // Chamfered corners get a short bright diagonal.
  g.lineBetween(x + w - c, y, x + w, y + c);
  g.lineBetween(x + c, y + h, x, y + h - c);
}

/** Thin horizontal rule with a bright tick at each end. */
export function drawRule(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, color: number = COLOR.green, alpha = 0.35): void {
  g.lineStyle(1, color, alpha);
  g.lineBetween(x, y, x + w, y);
  g.lineStyle(2, color, Math.min(1, alpha * 2.4));
  g.lineBetween(x, y, x + 8, y);
  g.lineBetween(x + w - 8, y, x + w, y);
}

/** Chamfered rectangle (menu highlight bars, tags). */
export function fillChamfer(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, c: number): void {
  g.fillPoints(
    [
      { x: x + c, y },
      { x: x + w, y },
      { x: x + w, y: y + h - c },
      { x: x + w - c, y: y + h },
      { x, y: y + h },
      { x, y: y + c },
    ],
    true,
  );
}
