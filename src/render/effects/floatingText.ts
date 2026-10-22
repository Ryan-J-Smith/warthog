import type Phaser from 'phaser';

interface Floater {
  text: Phaser.GameObjects.Text;
  x: number;
  y: number;
  age: number;
  life: number;
  /** Size multiplier (bonus banners are bigger than per-kill points). */
  scale: number;
  active: boolean;
}

const STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'Impact, "Arial Black", "Helvetica Neue", sans-serif',
  fontSize: '28px',
  color: '#ffe36e',
  stroke: '#2a1804',
  strokeThickness: 6,
};

/**
 * Pooled world-space score popups ("+300") that pop, drift upward and fade.
 * Counter-scaled by camera zoom so they stay readable at every altitude.
 */
export class FloatingTexts {
  private readonly items: Floater[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth: number,
    private readonly max = 14,
  ) {}

  spawn(x: number, y: number, label: string, positive: boolean, scale = 1): void {
    let f = this.items.find((i) => !i.active);
    if (!f) {
      if (this.items.length < this.max) {
        const text = this.scene.add.text(0, 0, '', STYLE).setOrigin(0.5).setDepth(this.depth);
        f = { text, x: 0, y: 0, age: 0, life: 1.4, scale: 1, active: false };
        this.items.push(f);
      } else {
        // Recycle the oldest.
        f = this.items.reduce((a, b) => (a.age > b.age ? a : b));
      }
    }
    f.x = x;
    f.y = y;
    f.age = 0;
    f.scale = scale;
    f.life = scale > 1 ? 1.9 : 1.4;
    f.active = true;
    f.text.setText(label).setColor(positive ? '#ffe36e' : '#ff6a55').setVisible(true);
  }

  update(dt: number): void {
    const zoom = this.scene.cameras.main.zoom || 1;
    for (const f of this.items) {
      if (!f.active) continue;
      f.age += dt;
      const t = f.age / f.life;
      if (t >= 1) {
        f.active = false;
        f.text.setVisible(false);
        continue;
      }
      const pop = t < 0.1 ? 1.35 - (t / 0.1) * 0.35 : 1;
      const rise = (1 - Math.pow(1 - t, 2)) * 56;
      f.text.setPosition(f.x, f.y - rise / zoom);
      f.text.setScale((pop * f.scale) / zoom);
      f.text.setAlpha(t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45);
    }
  }

  destroy(): void {
    for (const f of this.items) f.text.destroy();
    this.items.length = 0;
  }
}
