import Phaser from 'phaser';
import { PLAYER } from '../../config';
import { COLOR, textStyle } from '../theme';
import { UI_TEX, blink, pulse } from '../widgets';
import { HudWidget, type HudFrame } from './hudWidget';
import { LAYOUT, SCREEN } from './layout';

/** Dark pill behind warning hints so they read over any terrain. */
const HINT_BG = 'rgba(5, 13, 8, 0.8)';

/** Red screen-edge vignette: missile launch (strong), low armor (gentle), hits (flash). */
export class ScreenVignette extends HudWidget {
  private readonly image: Phaser.GameObjects.Image;
  private hit = 0;

  constructor(scene: Phaser.Scene) {
    super();
    this.image = scene.add
      .image(SCREEN.width / 2, SCREEN.height / 2, UI_TEX.vignette)
      .setDisplaySize(SCREEN.width, SCREEN.height)
      .setTint(COLOR.red)
      .setAlpha(0);
  }

  update({ view, events, dt, now }: HudFrame): void {
    const p = view.player;
    for (const e of events) if (e.type === 'playerHit') this.hit = Math.min(1, this.hit + 0.35 + e.damage / 60);
    this.hit = Math.max(0, this.hit - dt * 2.2);
    let base = 0;
    if (p.alive && p.missilesTracking > 0) base = 0.3 + 0.3 * pulse(now, 3);
    else if (p.alive && p.hp <= PLAYER.lowHp) base = 0.12 + 0.12 * pulse(now, 1);
    this.image.setAlpha(Math.min(0.9, base + this.hit * 0.5));
  }

  destroy(): void {
    this.image.destroy();
  }
}

/** RWR warnings: MISSILE LOCK (amber) while a SAM builds a lock, MISSILE LAUNCH (red) while tracked. */
export class ThreatWarnings extends HudWidget {
  private readonly lock: Phaser.GameObjects.Container;
  private readonly lockBox: Phaser.GameObjects.Container;
  private readonly launch: Phaser.GameObjects.Container;
  private readonly launchBox: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    super();
    const cx = SCREEN.width / 2;
    const cy = LAYOUT.warnings.cy;

    const lockText = scene.add.text(0, 0, 'MISSILE LOCK', textStyle({ size: 40, color: COLOR.amber, glow: 14 })).setOrigin(0.5);
    const lw = lockText.width + 60;
    const lockG = scene.add.graphics();
    lockG.fillStyle(COLOR.black, 0.6);
    lockG.fillRect(-lw / 2, -34, lw, 68);
    lockG.fillStyle(COLOR.amber, 0.14);
    lockG.fillRect(-lw / 2, -34, lw, 68);
    lockG.lineStyle(3, COLOR.amber, 1);
    lockG.strokeRect(-lw / 2, -34, lw, 68);
    this.lockBox = scene.add.container(0, 0, [lockG, lockText]);
    const lockHint = scene.add
      .text(0, 56, 'DIVE TO LOW ▼ TO BREAK LOCK', textStyle({ size: 20, color: COLOR.amber, glow: false }))
      .setOrigin(0.5)
      .setPadding(12, 4, 12, 4)
      .setBackgroundColor(HINT_BG);
    this.lock = scene.add.container(cx, cy, [this.lockBox, lockHint]).setVisible(false);

    const launchText = scene.add.text(0, 0, 'MISSILE LAUNCH', textStyle({ size: 66, font: 'display', color: COLOR.red, glow: 18 })).setOrigin(0.5);
    const w = launchText.width + 80;
    const launchG = scene.add.graphics();
    launchG.fillStyle(COLOR.black, 0.65);
    launchG.fillRect(-w / 2, -50, w, 100);
    launchG.fillStyle(COLOR.red, 0.2);
    launchG.fillRect(-w / 2, -50, w, 100);
    launchG.lineStyle(4, COLOR.red, 1);
    launchG.strokeRect(-w / 2, -50, w, 100);
    // Hazard ticks either side.
    launchG.fillStyle(COLOR.red, 1);
    for (let i = 0; i < 3; i++) {
      launchG.fillRect(-w / 2 - 30 - i * 18, -24, 8, 48);
      launchG.fillRect(w / 2 + 22 + i * 18, -24, 8, 48);
    }
    this.launchBox = scene.add.container(0, 0, [launchG, launchText]);
    const launchHint = scene.add
      .text(0, 80, 'FLARES [Q]   ·   DIVE TO LOW [S]', textStyle({ size: 24, color: COLOR.red, glow: false }))
      .setOrigin(0.5)
      .setPadding(14, 5, 14, 5)
      .setBackgroundColor(HINT_BG);
    this.launch = scene.add.container(cx, cy + 10, [this.launchBox, launchHint]).setVisible(false);
  }

  update({ view, now }: HudFrame): void {
    const p = view.player;
    const launching = p.alive && p.missilesTracking > 0;
    const locking = p.alive && !launching && p.radarLocks > 0;
    this.launch.setVisible(launching);
    if (launching) this.launchBox.setAlpha(blink(now, 4) ? 1 : 0.55);
    this.lock.setVisible(locking);
    if (locking) this.lockBox.setAlpha(blink(now, 2.5) ? 1 : 0.4);
  }

  destroy(): void {
    this.lock.destroy();
    this.launch.destroy();
  }
}
