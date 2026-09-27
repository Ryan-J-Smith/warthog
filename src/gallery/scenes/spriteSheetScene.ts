import Phaser from 'phaser';
import { SPRITES, SPRITE_KEYS } from '../../assets';
import type { SpriteKey } from '../../assets';
import { SPRITE_SCALE } from '../../render/sprites';

/** Background colour per sprite family: sand for world art, slate for white (tinted) sprites. */
function cellColor(key: SpriteKey): number {
  if (key.startsWith('particle') || key.startsWith('reticle') || key.startsWith('icon')) return 0x3b4148;
  if (key === 'lockBracket' || key === 'offscreenArrow' || key === 'flare') return 0x3b4148;
  if (key.startsWith('cloud')) return 0x7d7457;
  return 0xb7a57a;
}

/**
 * Every sprite at 1× and 2× on a terrain-coloured card, labelled with its key and native size.
 * Arrow keys / mouse wheel scroll.
 */
export class SpriteSheetScene extends Phaser.Scene {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private contentHeight = 0;

  constructor() {
    super('SpriteSheet');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#20241a');
    const margin = 24;
    const maxRow = 1920 - margin;
    let x = margin;
    let y = margin;
    let rowH = 0;

    // Dev review aids: `?only=a10,tankHull` limits the sheet; `?big=4` adds a third, larger copy.
    const params = new URLSearchParams(window.location.search);
    const only = params.get('only')?.split(',') ?? null;
    const big = Number(params.get('big') ?? '0');
    const keys = only ? SPRITE_KEYS.filter((k) => only.includes(k)) : SPRITE_KEYS;

    for (const key of keys) {
      const { w, h } = SPRITES[key];
      const pad = 12;
      const bigW = big > 0 ? w * big + pad : 0;
      const cellW = Math.max(w + w * 2 + pad * 3 + bigW, 150);
      const cellH = Math.max(h * 2, h * big) + pad * 2 + 22;
      if (x + cellW > maxRow) {
        x = margin;
        y += rowH + margin;
        rowH = 0;
      }
      this.add.rectangle(x, y, cellW, cellH, cellColor(key)).setOrigin(0).setStrokeStyle(1, 0x000000, 0.35);
      this.add.image(x + pad + w / 2, y + pad + h * 2 - h / 2, key).setScale(SPRITE_SCALE);
      this.add.image(x + pad * 2 + w + w, y + pad + h, key).setScale(SPRITE_SCALE * 2);
      if (big > 0) this.add.image(x + pad * 3 + w * 3 + (w * big) / 2, y + pad + (h * big) / 2, key).setScale(SPRITE_SCALE * big);
      this.add.text(x + 6, y + cellH - 19, `${key}  ${w}×${h}`, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#101010',
        backgroundColor: 'rgba(255,255,255,0.55)',
        padding: { x: 3, y: 1 },
      });
      x += cellW + margin;
      rowH = Math.max(rowH, cellH);
    }
    this.contentHeight = y + rowH + margin;

    this.cursors = this.input.keyboard?.createCursorKeys() ?? null;
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.scrollBy(dy));
    const hint = document.getElementById('hint');
    if (hint) hint.textContent = '↑/↓ or wheel: scroll';
  }

  override update(_time: number, delta: number): void {
    if (!this.cursors) return;
    const speed = 1.2 * delta;
    if (this.cursors.down.isDown) this.scrollBy(speed);
    if (this.cursors.up.isDown) this.scrollBy(-speed);
  }

  private scrollBy(dy: number): void {
    const cam = this.cameras.main;
    cam.scrollY = Phaser.Math.Clamp(cam.scrollY + dy, 0, Math.max(0, this.contentHeight - cam.height));
  }
}
