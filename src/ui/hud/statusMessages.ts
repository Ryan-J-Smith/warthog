import Phaser from 'phaser';
import { SCORING } from '../../config';
import { formatClock, formatPercent } from '../format';
import { weaponToast } from '../model';
import { COLOR, textStyle } from '../theme';
import { blink, drawPanel, pulse } from '../widgets';
import { HudWidget, type HudFrame } from './hudWidget';
import { LAYOUT, SCREEN } from './layout';

const TOAST_TIME = 1.9;

/**
 * Centre-screen status: WARTHOG DOWN / GAME OVER, the rearm progress bar, the RTB strip with the
 * auto-end countdown, and the weapon-unavailable toast.
 */
export class StatusMessages extends HudWidget {
  private readonly center: Phaser.GameObjects.Container;
  private readonly centerTitle: Phaser.GameObjects.Text;
  private readonly centerSub: Phaser.GameObjects.Text;
  private readonly rearm: Phaser.GameObjects.Container;
  private readonly rearmBar: Phaser.GameObjects.Rectangle;
  private readonly rearmPct: Phaser.GameObjects.Text;
  private readonly rearmLabel: Phaser.GameObjects.Text;
  private readonly rtb: Phaser.GameObjects.Container;
  private readonly rtbTimer: Phaser.GameObjects.Text;
  private readonly toast: Phaser.GameObjects.Text;
  private toastAge = 99;
  private centerShown = '';
  private rearmDone = 0;
  private rtbShown = '';

  constructor(scene: Phaser.Scene) {
    super();
    const cx = SCREEN.width / 2;

    this.centerTitle = scene.add.text(0, 0, '', textStyle({ size: 96, font: 'display', color: COLOR.red, glow: 12, stroke: true })).setOrigin(0.5);
    this.centerSub = scene.add.text(0, 76, '', textStyle({ size: 32, color: COLOR.white, stroke: true })).setOrigin(0.5);
    this.center = scene.add.container(cx, LAYOUT.center.cy, [this.centerTitle, this.centerSub]).setVisible(false);

    const rw = 480;
    const rg = scene.add.graphics();
    drawPanel(rg, -rw / 2, -40, rw, 80, { border: COLOR.blue, corner: COLOR.blue });
    this.rearmLabel = scene.add.text(-rw / 2 + 18, -30, 'REARMING · REPAIRING', textStyle({ size: 20, color: COLOR.blue }));
    this.rearmPct = scene.add.text(rw / 2 - 18, -30, '', textStyle({ size: 20, color: COLOR.blue })).setOrigin(1, 0);
    const back = scene.add.rectangle(-rw / 2 + 18, 16, rw - 36, 14, COLOR.blueDim, 0.6).setOrigin(0, 0.5);
    this.rearmBar = scene.add.rectangle(-rw / 2 + 18, 16, 0, 14, COLOR.blue, 1).setOrigin(0, 0.5);
    this.rearm = scene.add.container(cx, LAYOUT.rearm.cy, [rg, this.rearmLabel, this.rearmPct, back, this.rearmBar]).setVisible(false);

    const tw = 760;
    const tg = scene.add.graphics();
    tg.fillStyle(COLOR.panel, 0.78);
    tg.fillRect(-tw / 2, -22, tw, 44);
    tg.fillStyle(COLOR.blue, 0.12);
    tg.fillRect(-tw / 2, -22, tw, 44);
    tg.lineStyle(2, COLOR.blue, 0.9);
    tg.lineBetween(-tw / 2, -22, tw / 2, -22);
    tg.lineBetween(-tw / 2, 22, tw / 2, 22);
    const rtbText = scene.add
      .text(-tw / 2 + 20, 0, 'RTB — LAND LOW AT BASE TO FINISH', textStyle({ size: 21, color: COLOR.blue }))
      .setOrigin(0, 0.5);
    this.rtbTimer = scene.add.text(tw / 2 - 20, 0, '', textStyle({ size: 21, color: COLOR.white })).setOrigin(1, 0.5);
    this.rtb = scene.add.container(cx, LAYOUT.rtb.cy, [tg, rtbText, this.rtbTimer]).setVisible(false);

    this.toast = scene.add
      .text(cx, LAYOUT.toast.cy, '', textStyle({ size: 22, color: COLOR.amber, glow: 8 }))
      .setOrigin(0.5)
      .setPadding(18, 7, 18, 7)
      .setBackgroundColor('rgba(5, 13, 8, 0.8)')
      .setVisible(false);
  }

  update({ view, events, dt, now }: HudFrame): void {
    const p = view.player;

    // Dead / game over.
    let title = '';
    let sub = '';
    if (!p.alive && !view.ended) {
      if (p.lives > 0) {
        title = 'WARTHOG DOWN';
        sub = `RESPAWN IN ${Math.max(1, Math.ceil(p.respawnIn))}`;
      } else {
        title = 'GAME OVER';
        sub = 'NO AIRFRAMES LEFT';
      }
    }
    const key = `${title}|${sub}`;
    if (key !== this.centerShown) {
      const fresh = this.centerShown.split('|')[0] !== title;
      this.centerShown = key;
      this.center.setVisible(title !== '');
      this.centerTitle.setText(title);
      this.centerSub.setText(sub);
      if (fresh && title) {
        this.center.setScale(1.6).setAlpha(0);
        this.center.scene.tweens.add({ targets: this.center, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
      }
    }

    // Rearm.
    if (events.some((e) => e.type === 'rearmCompleted')) this.rearmDone = 1.6;
    this.rearmDone = Math.max(0, this.rearmDone - dt);
    const rearming = p.rearm > 0 && p.rearm < 1;
    this.rearm.setVisible(rearming || this.rearmDone > 0);
    if (rearming) {
      this.rearmBar.width = (480 - 36) * p.rearm;
      this.rearmPct.setText(formatPercent(p.rearm));
      this.rearmLabel.setText('REARMING · REPAIRING');
      this.rearm.setAlpha(1);
    } else if (this.rearmDone > 0) {
      this.rearmBar.width = 480 - 36;
      this.rearmPct.setText('100%');
      this.rearmLabel.setText('REARMED · FULL LOAD');
      this.rearm.setAlpha(Math.min(1, this.rearmDone / 0.4));
    }

    // RTB with the auto-end countdown (optionals can still be taken until then).
    const showRtb = view.rtb && !view.ended;
    this.rtb.setVisible(showRtb);
    if (showRtb) {
      const left = Math.max(0, SCORING.rtbGrace - (view.time - (view.rtbAt ?? view.time)));
      const text = `MISSION ENDS IN ${formatClock(Math.ceil(left))}`;
      if (text !== this.rtbShown) {
        this.rtbShown = text;
        this.rtbTimer.setText(text);
      }
      this.rtb.setAlpha(0.75 + 0.25 * pulse(now, 1.2));
    }

    // Weapon toast.
    for (const e of events) {
      if (e.type !== 'weaponUnavailable') continue;
      this.toast.setText(weaponToast(e.weapon, e.reason));
      this.toastAge = 0;
    }
    this.toastAge += dt;
    const showToast = this.toastAge < TOAST_TIME && p.alive;
    this.toast.setVisible(showToast);
    if (showToast) {
      const fade = this.toastAge > TOAST_TIME - 0.4 ? (TOAST_TIME - this.toastAge) / 0.4 : 1;
      this.toast.setAlpha(fade * (this.toastAge < 0.5 && !blink(now, 10) ? 0.6 : 1));
    }
  }

  destroy(): void {
    this.center.destroy();
    this.rearm.destroy();
    this.rtb.destroy();
    this.toast.destroy();
  }
}
