import Phaser from 'phaser';
import type { SpriteKey } from '../../assets';
import { FLARES, KEYS, WEAPON_AMMO, WEAPON_BANDS, WEAPON_NAMES } from '../../config';
import { ALTITUDE_BANDS, WEAPON_ORDER, type AltitudeBand, type WeaponId } from '../../sim/types';
import { keyLabel } from '../copy';
import { weaponSlotStatus } from '../model';
import { COLOR, css, textStyle } from '../theme';
import { UI_TEX, artOr, fillChamfer } from '../widgets';
import { HudWidget, type HudFrame } from './hudWidget';
import { LAYOUT, SCREEN } from './layout';

const ICON: Record<WeaponId, { art: SpriteKey; fallback: string }> = {
  gun: { art: 'iconGun', fallback: UI_TEX.iconGun },
  rockets: { art: 'iconRockets', fallback: UI_TEX.iconRockets },
  maverick: { art: 'iconMaverick', fallback: UI_TEX.iconMaverick },
  bombs: { art: 'iconBombs', fallback: UI_TEX.iconBombs },
};

const SELECT_KEY: Record<WeaponId, 'weaponGun' | 'weaponRockets' | 'weaponMaverick' | 'weaponBombs'> = {
  gun: 'weaponGun',
  rockets: 'weaponRockets',
  maverick: 'weaponMaverick',
  bombs: 'weaponBombs',
};

const BAND_LETTER: Record<AltitudeBand, string> = { low: 'L', medium: 'M', high: 'H' };

interface Slot {
  weapon: WeaponId;
  bg: Phaser.GameObjects.Graphics;
  keycap: Phaser.GameObjects.Text;
  name: Phaser.GameObjects.Text;
  icon: Phaser.GameObjects.Image;
  ammo: Phaser.GameObjects.Text;
  reason: Phaser.GameObjects.Text;
  pips: Phaser.GameObjects.Text[];
  bar: Phaser.GameObjects.Rectangle;
  barBack: Phaser.GameObjects.Rectangle;
  state: string;
  ammoShown: number;
}

/**
 * Weapons 1–4 plus flares. The selected slot is lit; slots that can't fire at the current band
 * (or are empty) grey out with the reason. L/M/H pips show where each weapon works.
 */
export class WeaponBar extends HudWidget {
  private readonly container: Phaser.GameObjects.Container;
  private readonly slots: Slot[];
  private readonly flareBg: Phaser.GameObjects.Graphics;
  private readonly flareCount: Phaser.GameObjects.Text;
  private readonly flareIcon: Phaser.GameObjects.Image;
  private readonly flareBar: Phaser.GameObjects.Rectangle;
  private flaresShown = -1;
  private flareFlash = 0;

  constructor(private readonly scene: Phaser.Scene) {
    super();
    const { slotW, flareW, h, gap, cy } = LAYOUT.weapons;
    const total = slotW * 4 + flareW + gap * 4;
    const x0 = SCREEN.width / 2 - total / 2;
    this.slots = WEAPON_ORDER.map((weapon, i) => this.createSlot(weapon, i * (slotW + gap), slotW, h));

    const fx = 4 * (slotW + gap);
    this.flareBg = scene.add.graphics();
    this.drawSlotBg(this.flareBg, fx, flareW, h, 'idle');
    const flareKey = scene.add.text(fx + 10, 10, keyLabel(KEYS.flare[0] ?? 'Q'), textStyle({ size: 16, color: COLOR.panel, glow: false })).setPadding(5, 1, 5, 1);
    flareKey.setBackgroundColor(css(COLOR.greenDim));
    const flareName = scene.add.text(fx + 40, 10, 'FLARE', textStyle({ size: 17, color: COLOR.green, glow: false }));
    this.flareIcon = scene.add
      .image(fx + 34, 56, artOr(scene, 'iconFlare', UI_TEX.iconFlare))
      .setDisplaySize(36, 36)
      .setTint(COLOR.green);
    this.flareCount = scene.add.text(fx + flareW - 12, 56, '', textStyle({ size: 32, color: COLOR.green })).setOrigin(1, 0.5);
    const flareBack = scene.add.rectangle(fx + 10, h - 12, flareW - 20, 4, COLOR.greenFaint, 0.8).setOrigin(0, 0.5);
    this.flareBar = scene.add.rectangle(fx + 10, h - 12, flareW - 20, 4, COLOR.green, 0.9).setOrigin(0, 0.5);

    this.container = scene.add.container(x0, cy - h / 2, [
      ...this.slots.flatMap((s) => [s.bg, s.keycap, s.name, s.icon, s.ammo, s.reason, ...s.pips, s.barBack, s.bar]),
      this.flareBg,
      flareKey,
      flareName,
      this.flareIcon,
      this.flareCount,
      flareBack,
      this.flareBar,
    ]);
  }

  update({ view, events, dt }: HudFrame): void {
    const p = view.player;
    for (const slot of this.slots) {
      const selected = p.selectedWeapon === slot.weapon;
      const status = weaponSlotStatus(slot.weapon, p.band, p.ammo[slot.weapon]);
      const reason = selected && view.reticle.blockedReason ? view.reticle.blockedReason : status.reason;
      const usable = status.usable && (!selected || view.reticle.blockedReason === null);
      const state = `${selected}|${usable}|${reason ?? ''}|${p.band}|${p.alive}`;
      if (state !== slot.state) {
        slot.state = state;
        this.applyState(slot, selected, usable && p.alive, reason, p.band);
      }
      const ammo = p.ammo[slot.weapon];
      if (ammo !== slot.ammoShown) {
        slot.ammoShown = ammo;
        slot.ammo.setText(String(ammo));
        slot.bar.width = (LAYOUT.weapons.slotW - 20) * Math.max(0, Math.min(1, ammo / WEAPON_AMMO[slot.weapon]));
      }
    }

    if (p.flares !== this.flaresShown) {
      if (p.flares < this.flaresShown) this.flareFlash = 1;
      this.flaresShown = p.flares;
      this.flareCount.setText(String(p.flares));
      this.flareCount.setColor(css(p.flares > 0 ? COLOR.green : COLOR.grey));
      this.flareBar.width = (LAYOUT.weapons.flareW - 20) * (p.flares / FLARES.count);
    }
    if (events.some((e) => e.type === 'flareDeployed')) this.flareFlash = 1;
    if (this.flareFlash > 0) {
      this.flareFlash = Math.max(0, this.flareFlash - dt * 3);
      const size = 36 * (1 + this.flareFlash * 0.5);
      this.flareIcon.setDisplaySize(size, size);
      this.flareIcon.setTint(this.flareFlash > 0.05 ? COLOR.white : COLOR.green);
    }
  }

  destroy(): void {
    this.container.destroy();
  }

  private createSlot(weapon: WeaponId, x: number, w: number, h: number): Slot {
    const s = this.scene;
    const bg = s.add.graphics();
    const keycap = s.add.text(x + 10, 10, keyLabel(KEYS[SELECT_KEY[weapon]][0] ?? ''), textStyle({ size: 16, color: COLOR.panel, glow: false })).setPadding(5, 1, 5, 1);
    const name = s.add.text(x + 40, 10, WEAPON_NAMES[weapon], textStyle({ size: 17, color: COLOR.green, glow: false }));
    const icon = s.add.image(x + 46, 58, artOr(s, ICON[weapon].art, ICON[weapon].fallback)).setDisplaySize(64, 32);
    const ammo = s.add.text(x + w - 12, 56, '', textStyle({ size: 32, color: COLOR.green })).setOrigin(1, 0.5);
    const reason = s.add.text(x + w / 2, h - 13, '', textStyle({ size: 15, color: COLOR.amber, glow: false })).setOrigin(0.5);
    const pips = ALTITUDE_BANDS.map((band, i) =>
      s.add.text(x + w - 50 + i * 15, 10, BAND_LETTER[band], textStyle({ size: 16, color: COLOR.greenDim, glow: false })),
    );
    const barBack = s.add.rectangle(x + 10, h - 12, w - 20, 4, COLOR.greenFaint, 0.8).setOrigin(0, 0.5);
    const bar = s.add.rectangle(x + 10, h - 12, w - 20, 4, COLOR.green, 0.9).setOrigin(0, 0.5);
    return { weapon, bg, keycap, name, icon, ammo, reason, pips, bar, barBack, state: '', ammoShown: -1 };
  }

  private applyState(slot: Slot, selected: boolean, usable: boolean, reason: string | null, band: AltitudeBand): void {
    const i = WEAPON_ORDER.indexOf(slot.weapon);
    const { slotW, gap, h } = LAYOUT.weapons;
    const x = i * (slotW + gap);
    const mode = selected ? (usable ? 'selected' : 'selectedBlocked') : usable ? 'idle' : 'blocked';
    slot.bg.clear();
    this.drawSlotBg(slot.bg, x, slotW, h, mode);

    const main = usable ? (selected ? COLOR.greenBright : COLOR.green) : COLOR.grey;
    slot.name.setColor(css(usable ? (selected ? COLOR.greenBright : COLOR.green) : COLOR.grey));
    slot.ammo.setColor(css(main));
    slot.ammo.setShadowColor(css(main));
    slot.ammo.setShadowBlur(usable ? 10 : 0);
    slot.icon.setTint(usable ? main : COLOR.greyDim);
    slot.keycap.setBackgroundColor(css(selected ? (usable ? COLOR.green : COLOR.amber) : COLOR.greenDim));
    slot.reason.setText(usable ? '' : (reason ?? ''));
    slot.reason.setColor(css(selected ? COLOR.amber : COLOR.amberDim));
    slot.bar.setVisible(usable);
    slot.barBack.setVisible(usable);
    ALTITUDE_BANDS.forEach((b, k) => {
      const pip = slot.pips[k];
      if (!pip) return;
      const allowed = WEAPON_BANDS[slot.weapon].includes(b);
      pip.setColor(css(!allowed ? COLOR.greyDim : b === band ? COLOR.greenBright : COLOR.green));
      pip.setAlpha(!allowed ? 0.7 : b === band ? 1 : 0.75);
    });
  }

  private drawSlotBg(g: Phaser.GameObjects.Graphics, x: number, w: number, h: number, mode: 'idle' | 'blocked' | 'selected' | 'selectedBlocked'): void {
    const accent = mode === 'selected' ? COLOR.green : mode === 'selectedBlocked' ? COLOR.amber : COLOR.green;
    g.fillStyle(COLOR.panel, 0.66);
    fillChamfer(g, x, 0, w, h, 10);
    if (mode === 'selected' || mode === 'selectedBlocked') {
      g.fillStyle(accent, 0.13);
      fillChamfer(g, x, 0, w, h, 10);
      g.lineStyle(2.5, accent, 1);
      strokeChamfer(g, x, 0, w, h, 10);
      g.fillStyle(accent, 1);
      g.fillRect(x + 14, -5, w - 28, 3);
    } else {
      g.lineStyle(1.5, mode === 'blocked' ? COLOR.greyDim : COLOR.green, mode === 'blocked' ? 0.6 : 0.3);
      strokeChamfer(g, x, 0, w, h, 10);
    }
  }
}

function strokeChamfer(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, c: number): void {
  g.strokePoints(
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
