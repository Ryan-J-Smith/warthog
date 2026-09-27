import Phaser from 'phaser';
import type { UiSoundPort } from '../sound';
import { COLOR, css, textStyle } from '../theme';
import { fillChamfer } from './panel';

export interface MenuListOptions {
  x: number;
  y: number;
  width: number;
  spacing: number;
  fontSize: number;
  sound: UiSoundPort;
  onConfirm: (index: number) => void;
  /** Called after the selection changes. */
  onMove?: (index: number) => void;
}

/**
 * Vertical menu: chamfered highlight bar sliding to the selected item, chevron, glow.
 * Keyboard input is bound by the owning scene (see `bindMenuKeys`); pointer hover/click works too.
 */
export class MenuList {
  readonly container: Phaser.GameObjects.Container;
  enabled = true;
  private index = 0;
  /** False while keyboard focus is elsewhere (e.g. the sound settings rows): no highlight. */
  private focused = true;
  private readonly texts: Phaser.GameObjects.Text[];
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly chevron: Phaser.GameObjects.Text;

  constructor(
    private readonly scene: Phaser.Scene,
    labels: readonly string[],
    private readonly options: MenuListOptions,
  ) {
    const { width, spacing, fontSize } = options;
    const barH = Math.round(fontSize * 1.55);
    this.bar = scene.add.graphics();
    this.bar.fillStyle(COLOR.green, 0.16);
    fillChamfer(this.bar, 0, -barH / 2, width, barH, 10);
    this.bar.fillStyle(COLOR.green, 0.95);
    this.bar.fillRect(0, -barH / 2, 5, barH);
    this.bar.lineStyle(1, COLOR.green, 0.5);
    this.bar.lineBetween(10, barH / 2, width, barH / 2);

    this.chevron = scene.add.text(width - 16, 0, '◀', textStyle({ size: Math.round(fontSize * 0.6), color: COLOR.green })).setOrigin(1, 0.5);

    this.texts = labels.map((label, i) => {
      const t = scene.add
        .text(28, i * spacing, label, textStyle({ size: fontSize, color: COLOR.greenDim, glow: false }))
        .setOrigin(0, 0.5)
        .setPadding(0, 4, 0, 4);
      // Hit area in the text's local space (top-left origin): the whole highlight bar.
      t.setInteractive(new Phaser.Geom.Rectangle(-28, t.height / 2 - barH / 2, width, barH), Phaser.Geom.Rectangle.Contains);
      t.on(Phaser.Input.Events.POINTER_OVER, () => {
        if (this.enabled && (this.index !== i || !this.focused)) this.select(i, true);
      });
      t.on(Phaser.Input.Events.POINTER_DOWN, () => {
        if (!this.enabled) return;
        this.select(i, false);
        this.confirm();
      });
      return t;
    });
    this.container = scene.add.container(options.x, options.y, [this.bar, this.chevron, ...this.texts]);
    this.applySelection(false);
  }

  get selected(): number {
    return this.index;
  }

  get count(): number {
    return this.texts.length;
  }

  move(delta: number): void {
    if (!this.enabled || this.texts.length === 0) return;
    const next = (this.index + delta + this.texts.length) % this.texts.length;
    this.select(next, true);
  }

  confirm(): void {
    if (!this.enabled) return;
    this.options.sound.confirm();
    const t = this.texts[this.index];
    if (t) this.scene.tweens.add({ targets: t, scaleX: 1.06, scaleY: 1.06, duration: 70, yoyo: true });
    this.options.onConfirm(this.index);
  }

  select(index: number, withSound: boolean): void {
    this.index = index;
    if (withSound) this.options.sound.move();
    this.setFocused(true);
    this.applySelection(true);
    this.options.onMove?.(index);
  }

  /** Show or hide the selection highlight (keyboard focus moved to another widget and back). */
  setFocused(focused: boolean): void {
    if (this.focused === focused) return;
    this.focused = focused;
    this.bar.setVisible(focused);
    this.chevron.setVisible(focused);
    this.applySelection(false);
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  destroy(): void {
    this.container.destroy();
  }

  private applySelection(animate: boolean): void {
    const y = this.index * this.options.spacing;
    if (animate) {
      this.scene.tweens.killTweensOf([this.bar, this.chevron]);
      this.scene.tweens.add({ targets: [this.bar, this.chevron], y, duration: 110, ease: 'Cubic.easeOut' });
    } else {
      this.bar.y = y;
      this.chevron.y = y;
    }
    this.texts.forEach((t, i) => {
      const on = this.focused && i === this.index;
      t.setColor(css(on ? COLOR.greenBright : COLOR.greenDim));
      t.setShadow(0, 0, css(COLOR.green), on ? 12 : 0, false, on);
    });
  }
}
