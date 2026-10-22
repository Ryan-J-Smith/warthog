import Phaser from 'phaser';
import { PLAYER } from '../../config';
import { COLOR, css, textStyle } from '../theme';
import { UI_TEX, blink, drawPanel } from '../widgets';
import { HudWidget, type HudFrame } from './hudWidget';
import { LAYOUT } from './layout';

const SEGMENTS = 20;
const BAR_X = 16;
const BAR_W = 368;
const SHIELD_Y = 38;
const HULL_Y = 84;
const BOOST_Y = 122;
const BAR_H = 16;
const SHIELD_COLOR = 0x6fe0ff;
const BOOST_COLOR = 0x5ab0ff;

/**
 * Shield (regenerating), hull (persists until repaired), afterburner meter, lives, and the
 * low-hull warning. The shield bar shows its recharge delay so the player learns the rhythm.
 */
export class ArmorPanel extends HudWidget {
  private readonly container: Phaser.GameObjects.Container;
  private readonly bars: Phaser.GameObjects.Graphics;
  private readonly hullValue: Phaser.GameObjects.Text;
  private readonly shieldValue: Phaser.GameObjects.Text;
  private readonly boostLabel: Phaser.GameObjects.Text;
  private readonly lives: Phaser.GameObjects.Image[] = [];
  private readonly warning: Phaser.GameObjects.Text;
  private readonly repairHint: Phaser.GameObjects.Text;
  private readonly hitFlash: Phaser.GameObjects.Rectangle;
  private livesShown = -1;
  private flash = 0;
  private shieldFlash = 0;

  constructor(scene: Phaser.Scene) {
    super();
    const { x, y, w, h } = LAYOUT.armor;
    const g = scene.add.graphics();
    drawPanel(g, 0, 0, w, h);
    const small = (tx: number, ty: number, label: string, color: number): Phaser.GameObjects.Text =>
      scene.add.text(tx, ty, label, textStyle({ size: 16, color, glow: false }));
    const shieldLabel = small(16, 14, 'SHIELD', SHIELD_COLOR);
    const hullLabel = small(16, 60, 'HULL', COLOR.greenDim);
    this.boostLabel = small(16, 106 - 2, 'BOOST [SHIFT]  BRAKE [E]', BOOST_COLOR).setAlpha(0.85);
    this.shieldValue = scene.add.text(BAR_X + BAR_W, 10, '', textStyle({ size: 22, color: SHIELD_COLOR })).setOrigin(1, 0);
    this.hullValue = scene.add.text(BAR_X + BAR_W, 56, '', textStyle({ size: 22, color: COLOR.green })).setOrigin(1, 0);
    this.bars = scene.add.graphics();
    this.hitFlash = scene.add.rectangle(0, 0, w, h, COLOR.red, 0).setOrigin(0);
    const livesLabel = scene.add.text(16, 144, 'LIVES', textStyle({ size: 16, color: COLOR.greenDim, glow: false }));
    for (let i = 0; i < PLAYER.lives; i++) {
      this.lives.push(scene.add.image(96 + i * 30, 152, UI_TEX.a10).setDisplaySize(24, 24).setRotation(-Math.PI / 2).setTint(COLOR.green));
    }
    this.warning = scene.add
      .text(0, -38, 'HULL CRITICAL', textStyle({ size: 24, color: COLOR.red, stroke: true }))
      .setOrigin(0, 1)
      .setVisible(false);
    // How to fix it, while it matters: repair is otherwise only mentioned in the briefing.
    this.repairHint = scene.add
      .text(0, -12, 'REPAIR: HOLD LOW OVER HOME BASE · GRAB REPAIR PICKUPS', textStyle({ size: 20, color: COLOR.blue, stroke: true }))
      .setOrigin(0, 1)
      .setVisible(false);
    this.container = scene.add.container(x, y, [
      g,
      shieldLabel,
      hullLabel,
      this.boostLabel,
      this.shieldValue,
      this.hullValue,
      this.bars,
      livesLabel,
      ...this.lives,
      this.hitFlash,
      this.warning,
      this.repairHint,
    ]);
  }

  update({ view, events, dt, now }: HudFrame): void {
    const p = view.player;
    const hp = Math.max(0, Math.ceil(p.hp));
    const hullFraction = p.maxHp > 0 ? hp / p.maxHp : 0;
    const hullColor = this.colorFor(hullFraction, p.maxHp);
    this.hullValue.setText(String(hp)).setColor(css(hullColor)).setShadowColor(css(hullColor));
    const shield = Math.max(0, Math.ceil(p.shield));
    this.shieldValue.setText(p.shield > 0 ? String(shield) : p.shieldRegenIn > 0 ? 'DOWN' : '…').setAlpha(p.shield > 0 ? 1 : blink(now, 3) ? 1 : 0.4);

    for (const e of events) {
      if (e.type === 'playerHit') this.flash = 1;
      if (e.type === 'shieldHit') this.shieldFlash = Math.min(1, this.shieldFlash + (e.source === 'beam' ? 0.1 : 1));
    }
    this.flash = Math.max(0, this.flash - dt * 4);
    this.shieldFlash = Math.max(0, this.shieldFlash - dt * 4);
    this.hitFlash.setFillStyle(COLOR.red, this.flash * 0.35);

    this.drawBars(view, hullFraction, hullColor, now);

    if (p.lives !== this.livesShown) {
      this.livesShown = p.lives;
      this.lives.forEach((icon, i) => {
        const alive = i < p.lives;
        icon.setTint(alive ? COLOR.green : COLOR.greyDim).setAlpha(alive ? 1 : 0.45);
      });
    }
    const low = p.alive && p.hp <= PLAYER.lowHp;
    this.warning.setVisible(low);
    this.repairHint.setVisible(low);
    if (low) this.warning.setAlpha(blink(now, 2.5) ? 1 : 0.35);
  }

  destroy(): void {
    this.container.destroy();
  }

  private colorFor(fraction: number, maxHp: number): number {
    if (fraction > 0.6) return COLOR.green;
    if (fraction > PLAYER.lowHp / maxHp) return COLOR.amber;
    return COLOR.red;
  }

  private drawBars(view: HudFrame['view'], hullFraction: number, hullColor: number, now: number): void {
    const p = view.player;
    const g = this.bars;
    g.clear();
    const segW = BAR_W / SEGMENTS;

    // Shield: continuous fill (it regenerates smoothly), brightened on hits.
    const shieldFraction = p.maxShield > 0 ? p.shield / p.maxShield : 0;
    g.fillStyle(COLOR.blueDim, 0.45);
    g.fillRect(BAR_X, SHIELD_Y, BAR_W, BAR_H);
    g.fillStyle(this.shieldFlash > 0.05 ? 0xffffff : SHIELD_COLOR, 0.95);
    g.fillRect(BAR_X, SHIELD_Y, BAR_W * shieldFraction, BAR_H);
    if (p.shieldRegenIn > 0 && view.loadout.shieldRegenDelay > 0) {
      // Recharge delay: a thin countdown under the bar.
      const wait = p.shieldRegenIn / view.loadout.shieldRegenDelay;
      g.fillStyle(SHIELD_COLOR, 0.5);
      g.fillRect(BAR_X, SHIELD_Y + BAR_H + 2, BAR_W * wait, 3);
    }
    g.lineStyle(1, SHIELD_COLOR, 0.35);
    g.strokeRect(BAR_X - 2, SHIELD_Y - 3, BAR_W + 2, BAR_H + 6);

    // Hull: segmented, like v1 armour.
    const lit = Math.ceil(hullFraction * SEGMENTS - 1e-6);
    for (let i = 0; i < SEGMENTS; i++) {
      const on = i < lit;
      g.fillStyle(on ? hullColor : COLOR.greenFaint, on ? 0.95 : 0.45);
      g.fillRect(BAR_X + i * segW + 1, HULL_Y, segW - 3, BAR_H);
    }
    g.lineStyle(1, COLOR.green, 0.3);
    g.strokeRect(BAR_X - 2, HULL_Y - 3, BAR_W + 2, BAR_H + 6);

    // Afterburner meter (gold while a boost pickup makes it free).
    const free = p.boostFree > 0;
    const boostFraction = p.maxBoost > 0 ? p.boost / p.maxBoost : 0;
    const bx = BAR_X + 236;
    const bw = BAR_W - 236;
    g.fillStyle(COLOR.blueDim, 0.45);
    g.fillRect(bx, BOOST_Y + 4, bw, 10);
    g.fillStyle(free ? COLOR.amber : BOOST_COLOR, p.boosting && Math.floor(now / 80) % 2 === 0 ? 1 : 0.85);
    g.fillRect(bx, BOOST_Y + 4, bw * (free ? 1 : boostFraction), 10);
  }
}
