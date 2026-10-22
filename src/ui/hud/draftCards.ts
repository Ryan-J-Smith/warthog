import type Phaser from 'phaser';
import { PERKS, type PerkId } from '../../sim/defense';
import { COLOR, textStyle } from '../theme';
import { drawPanel } from '../widgets';
import { HudWidget, type HudFrame } from './hudWidget';
import { SCREEN } from './layout';

const CARD = { w: 330, h: 190, gap: 30, y: 330 } as const;

/**
 * Base defence: after a wave, three draft cards across the middle of the screen. Press 1-3 to
 * take one (the sim applies it); they stay up until you do.
 */
export class DraftCards extends HudWidget {
  private readonly container: Phaser.GameObjects.Container;
  private readonly cards: Array<{ key: Phaser.GameObjects.Text; name: Phaser.GameObjects.Text; blurb: Phaser.GameObjects.Text }> = [];
  private readonly title: Phaser.GameObjects.Text;
  private shown: string | null = null;
  private appear = 0;

  constructor(scene: Phaser.Scene) {
    super();
    const total = CARD.w * 3 + CARD.gap * 2;
    const x0 = (SCREEN.width - total) / 2;
    const children: Phaser.GameObjects.GameObject[] = [];
    this.title = scene.add
      .text(SCREEN.width / 2, CARD.y - 56, 'PICK ONE · 1 / 2 / 3', textStyle({ size: 30, font: 'display', color: COLOR.amber, glow: 10 }))
      .setOrigin(0.5, 0);
    children.push(this.title);
    for (let i = 0; i < 3; i++) {
      const x = x0 + i * (CARD.w + CARD.gap);
      const g = scene.add.graphics();
      drawPanel(g, x, CARD.y, CARD.w, CARD.h);
      const key = scene.add.text(x + 18, CARD.y + 14, `[${i + 1}]`, textStyle({ size: 28, color: COLOR.amber }));
      const name = scene.add.text(x + 18, CARD.y + 58, '', textStyle({ size: 26, font: 'display', color: COLOR.green, glow: 8, wrap: CARD.w - 36 }));
      const blurb = scene.add.text(x + 18, CARD.y + 112, '', textStyle({ size: 20, color: COLOR.white, glow: false, wrap: CARD.w - 36 }));
      children.push(g, key, name, blurb);
      this.cards.push({ key, name, blurb });
    }
    this.container = scene.add.container(0, 0, children).setVisible(false);
  }

  update({ view, dt }: HudFrame): void {
    const offer: readonly PerkId[] | null = view.defense?.phase === 'build' ? view.defense.offer : null;
    const id = offer ? offer.join(',') : null;
    if (id !== this.shown) {
      this.shown = id;
      this.appear = 0;
      if (offer) {
        this.cards.forEach((card, i) => {
          const perk = offer[i];
          card.key.setVisible(perk !== undefined);
          card.name.setText(perk ? PERKS[perk].name : '');
          card.blurb.setText(perk ? PERKS[perk].blurb : '');
        });
      }
    }
    this.container.setVisible(offer !== null);
    if (offer) {
      this.appear = Math.min(1, this.appear + dt * 5);
      this.container.setAlpha(this.appear).setY((1 - this.appear) * 30);
    }
  }

  destroy(): void {
    this.container.destroy();
  }
}
