import Phaser from 'phaser';
import type { UiSoundPort } from '../sound';
import { COLOR } from '../theme';
import { fillChamfer } from './panel';

export interface RowListOptions {
  /** Top-left of the first row. */
  x: number;
  y: number;
  width: number;
  rowHeight: number;
  /** Vertical space between rows. */
  gap: number;
  /** Visible height; longer lists scroll to keep the selection in view. Defaults to all rows. */
  viewHeight?: number;
  sound: UiSoundPort;
  /**
   * ENTER / click on a row. The list plays no confirm sound itself: the owner decides (a refused
   * purchase sounds different from a launch).
   */
  onConfirm: (index: number) => void;
  /** Called after the selection changes. */
  onMove?: (index: number) => void;
}

/** Restyle a row's content for (de)selection; returned by the row builder. */
export type RowStyler = (selected: boolean) => void;

/**
 * Vertical list of rich rows (several texts per row), in the same look as `MenuList`: each row
 * sits on faint glass, the selected one gets the chamfered green highlight with a bright left
 * edge. The owner builds each row's content into the given container (origin = row top-left).
 * Keyboard input is bound by the owning scene; pointer hover/click works too.
 */
export class RowList {
  readonly container: Phaser.GameObjects.Container;
  enabled = true;
  private index = 0;
  private scroll = 0;
  private readonly content: Phaser.GameObjects.Container;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly stylers: RowStyler[] = [];
  private readonly mask: Phaser.GameObjects.Graphics | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    count: number,
    private readonly options: RowListOptions,
    build: (row: Phaser.GameObjects.Container, index: number) => RowStyler,
  ) {
    const { width, rowHeight } = options;
    const bg = scene.add.graphics();
    this.bar = scene.add.graphics();
    this.bar.fillStyle(COLOR.green, 0.16);
    fillChamfer(this.bar, 0, 0, width, rowHeight, 12);
    this.bar.fillStyle(COLOR.green, 0.95);
    this.bar.fillRect(0, 0, 5, rowHeight);
    this.bar.lineStyle(1.5, COLOR.green, 0.7);
    this.bar.lineBetween(12, rowHeight, width, rowHeight);
    this.content = scene.add.container(0, 0, [bg, this.bar]);

    for (let i = 0; i < count; i++) {
      const top = this.rowTop(i);
      bg.fillStyle(COLOR.panel, 0.72);
      fillChamfer(bg, 0, top, width, rowHeight, 12);
      bg.lineStyle(1, COLOR.green, 0.18);
      bg.lineBetween(12, top + rowHeight, width, top + rowHeight);
      const row = scene.add.container(0, top);
      this.content.add(row);
      this.stylers.push(build(row, i));
      const zone = scene.add.zone(0, top, width, rowHeight).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on(Phaser.Input.Events.POINTER_OVER, () => {
        if (this.enabled && this.index !== i) this.select(i, true);
      });
      zone.on(Phaser.Input.Events.POINTER_DOWN, () => {
        if (!this.enabled) return;
        if (this.index !== i) this.select(i, false);
        this.confirm();
      });
      this.content.add(zone);
    }
    this.container = scene.add.container(options.x, options.y, [this.content]);

    const viewH = options.viewHeight;
    if (viewH !== undefined && this.contentHeight > viewH) {
      this.mask = scene.make.graphics({ x: 0, y: 0 }, false);
      this.mask.fillStyle(0xffffff, 1);
      this.mask.fillRect(options.x - 4, options.y - 4, width + 8, viewH + 8);
      this.content.setMask(this.mask.createGeometryMask());
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.mask?.destroy());
    }
    this.applySelection(false);
  }

  get selected(): number {
    return this.index;
  }

  get count(): number {
    return this.stylers.length;
  }

  move(delta: number): void {
    if (!this.enabled || this.count === 0) return;
    this.select((this.index + delta + this.count) % this.count, true);
  }

  confirm(): void {
    if (!this.enabled || this.count === 0) return;
    this.options.onConfirm(this.index);
  }

  select(index: number, withSound: boolean): void {
    if (index < 0 || index >= this.count) return;
    this.index = index;
    if (withSound) this.options.sound.move();
    this.applySelection(true);
    this.options.onMove?.(index);
  }

  /** Re-run every row's styler (after the owner changed row contents). */
  refresh(): void {
    this.stylers.forEach((style, i) => style(i === this.index));
  }

  /** A short horizontal shake of the selected row's highlight (refused action). */
  nudge(): void {
    const x = this.bar.x;
    this.scene.tweens.add({ targets: this.bar, x: x + 8, duration: 45, yoyo: true, repeat: 2, onComplete: () => this.bar.setX(x) });
  }

  private get contentHeight(): number {
    const { rowHeight, gap } = this.options;
    return this.count * rowHeight + Math.max(0, this.count - 1) * gap;
  }

  private rowTop(i: number): number {
    return i * (this.options.rowHeight + this.options.gap);
  }

  private applySelection(animate: boolean): void {
    const y = this.rowTop(this.index);
    this.scene.tweens.killTweensOf(this.bar);
    this.bar.x = 0;
    if (animate) {
      this.scene.tweens.add({ targets: this.bar, y, duration: 110, ease: 'Cubic.easeOut' });
    } else {
      this.bar.y = y;
    }
    // Scroll so the selected row is fully visible.
    const viewH = this.options.viewHeight;
    if (viewH !== undefined && this.contentHeight > viewH) {
      const { rowHeight } = this.options;
      if (y < this.scroll) this.scroll = y;
      else if (y + rowHeight > this.scroll + viewH) this.scroll = y + rowHeight - viewH;
      this.content.y = -this.scroll;
    }
    this.refresh();
  }
}
