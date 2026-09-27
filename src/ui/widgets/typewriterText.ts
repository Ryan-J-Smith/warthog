import type Phaser from 'phaser';
import { typedChars } from '../model';

/**
 * A Text that types itself out. Wrapping is computed for the full string up front, so words
 * don't jump between lines while typing. Drive it with `update(dt)`.
 */
export class TypewriterText {
  private full = '';
  private wrapped = '';
  private elapsed = 0;
  private shown = -1;
  private running = false;
  private onDone: (() => void) | null = null;

  constructor(
    readonly text: Phaser.GameObjects.Text,
    private readonly charsPerSecond = 60,
  ) {}

  get done(): boolean {
    return !this.running;
  }

  start(full: string, onDone?: () => void): void {
    this.full = full;
    this.wrapped = this.text.getWrappedText(full).join('\n');
    this.elapsed = 0;
    this.shown = -1;
    this.running = true;
    this.onDone = onDone ?? null;
    this.text.setText('');
  }

  update(dt: number): void {
    if (!this.running) return;
    this.elapsed += dt;
    const n = typedChars(this.elapsed, this.charsPerSecond, this.full.length);
    const reveal = Math.round((n / Math.max(1, this.full.length)) * this.wrapped.length);
    if (reveal !== this.shown) {
      this.shown = reveal;
      this.text.setText(this.wrapped.slice(0, reveal) + (reveal < this.wrapped.length ? '▌' : ''));
    }
    if (n >= this.full.length) this.finish();
  }

  /** Reveal everything now. */
  finish(): void {
    if (!this.running) return;
    this.running = false;
    this.text.setText(this.wrapped);
    const done = this.onDone;
    this.onDone = null;
    done?.();
  }
}
