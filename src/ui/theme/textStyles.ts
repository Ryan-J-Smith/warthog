import type Phaser from 'phaser';
import { FONT_STACK } from '../fonts';
import { COLOR, css } from './palette';

/** Glows at least this blurry get canvas padding equal to the blur. */
export const GLOW_PAD_THRESHOLD = 12;

export interface TextStyleOptions {
  size: number;
  font?: 'mono' | 'display';
  color?: number;
  /**
   * Soft phosphor glow (a blurred text shadow in the same colour); a number sets the blur.
   * Defaults to on, except for stroked text, which gets a dark drop shadow instead.
   */
  glow?: boolean | number;
  align?: 'left' | 'center' | 'right';
  /** Word-wrap width in pixels. */
  wrap?: number;
  lineSpacing?: number;
  /** Dark outline for legibility over busy terrain. */
  stroke?: boolean;
  letterSpacing?: number;
}

/** Build a Phaser text style in the WARTHOG look. */
export function textStyle(options: TextStyleOptions): Phaser.Types.GameObjects.Text.TextStyle {
  const color = options.color ?? COLOR.green;
  const glow = options.glow === undefined ? !options.stroke : options.glow;
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: options.font === 'display' ? FONT_STACK.display : FONT_STACK.mono,
    fontSize: `${options.size}px`,
    color: css(color),
    align: options.align ?? 'left',
  };
  if (glow !== false) {
    const blur = typeof glow === 'number' ? glow : Math.max(4, Math.round(options.size * 0.35));
    style.shadow = { offsetX: 0, offsetY: 0, color: css(color), blur, stroke: false, fill: true };
    // Big glows would be clipped by the text canvas: pad it (shifts left/top-origin text by `blur`).
    if (blur >= GLOW_PAD_THRESHOLD) style.padding = { x: blur, y: blur };
  }
  if (options.stroke) {
    style.stroke = '#030805';
    style.strokeThickness = Math.max(3, Math.round(options.size / 7));
    if (glow === false) style.shadow = { offsetX: 2, offsetY: 2, color: '#000000', blur: 4, stroke: true, fill: true };
  }
  if (options.wrap !== undefined) style.wordWrap = { width: options.wrap, useAdvancedWrap: true };
  if (options.lineSpacing !== undefined) style.lineSpacing = options.lineSpacing;
  if (options.letterSpacing !== undefined) style.letterSpacing = options.letterSpacing;
  return style;
}
