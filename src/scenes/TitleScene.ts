import Phaser from 'phaser';
import { MusicManager } from '../audio';
import { CREDITS_TEXT } from '../content/credits';
import { LEVELS } from '../content/levels';
import { BAND_NAME, PLAY_TIPS, bandPrimer } from '../ui/copy';
import { UI_SOUND_REGISTRY_KEY, resolveUiSound, type UiSoundPort } from '../ui/sound';
import { TACMAP_TERRAIN, bakeTacticalMap } from '../ui/tacmap';
import { COLOR, css, textStyle } from '../ui/theme';
import {
  MenuList,
  UI_TEX,
  artOr,
  bindMenuKeys,
  blink,
  createControlsCard,
  drawPanel,
  drawRule,
  ensureUiTextures,
} from '../ui/widgets';
import { SCENES, type BriefingSceneData } from './sceneKeys';

/** Title backdrop map resolution (px) and on-screen scale. */
const MAP_W = 2304;
const MAP_H = 1728;
const MAP_SCALE = 1.35;
/** Screen-space shadow offset of the fly-by A-10 (it's high up). */
const SHADOW = { x: 110, y: 150 };

type Overlay = 'howto' | 'credits';

interface FlyBy {
  p0: Phaser.Math.Vector2;
  p1: Phaser.Math.Vector2;
  p2: Phaser.Math.Vector2;
  p3: Phaser.Math.Vector2;
  duration: number;
}

/** Fly-by paths across the right-hand side of the screen (cubic Béziers, screen px). */
const FLY_BYS: ReadonlyArray<readonly [number, number, number, number, number, number, number, number, number]> = [
  [1000, 1320, 1150, 700, 1700, 640, 2260, -180, 7],
  [2260, 980, 1500, 1020, 1100, 420, 1560, -280, 7.5],
  [1220, -280, 1120, 480, 1520, 900, 2280, 760, 7],
];

/**
 * Title screen: slowly drifting recon view of River Crossing, an A-10 banking across with its
 * shadow, the WARTHOG logo, and START MISSION / HOW TO PLAY / CREDITS.
 */
export class TitleScene extends Phaser.Scene {
  private uiSound!: UiSoundPort;
  private menu!: MenuList;
  private map!: Phaser.GameObjects.Image;
  private plane!: Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Image;
  private recTime!: Phaser.GameObjects.Text;
  private recDot!: Phaser.GameObjects.Arc;
  private overlay: Phaser.GameObjects.Container | null = null;
  private overlayKind: Overlay | null = null;
  private credits: { text: Phaser.GameObjects.Text; top: number; min: number } | null = null;
  private flyBy: FlyBy | null = null;
  private flyIndex = 0;
  private flyT = 0;
  private flyWait = 0.6;
  private lastHeading = 0;
  private bank = 0;
  private elapsed = 0;
  private leaving = false;

  constructor() {
    super(SCENES.title);
  }

  create(): void {
    this.uiSound = resolveUiSound(this.registry.get(UI_SOUND_REGISTRY_KEY));
    const music = new MusicManager(this);
    music.playTitle();
    this.leaving = false;
    this.overlay = null;
    this.overlayKind = null;
    this.credits = null;
    this.flyBy = null;
    this.flyIndex = 0;
    this.flyWait = 0.6;
    this.elapsed = 0;
    ensureUiTextures(this);
    const { width, height } = this.scale;
    const level = LEVELS[0];

    // Recon backdrop.
    this.add.rectangle(0, 0, width, height, 0x0a0f08, 1).setOrigin(0);
    if (level) {
      const key = bakeTacticalMap(this, `tacmap-title-${level.id}`, level, MAP_W, MAP_H, TACMAP_TERRAIN);
      this.map = this.add.image(width / 2, height / 2, key).setScale(MAP_SCALE);
    } else {
      this.map = this.add.image(width / 2, height / 2, UI_TEX.glow).setVisible(false);
    }
    this.add.rectangle(0, 0, width, height, 0x0b1408, 0.42).setOrigin(0);

    // The fly-by's shadow is on the ground, under the overlays.
    const planeKey = artOr(this, 'a10', UI_TEX.a10);
    this.shadow = this.add.image(-500, -500, planeKey).setTint(0x000000).setAlpha(0.35);

    // Tactical overlay: grid, darkening towards the menu side, vignette, scanlines.
    const grid = this.add.graphics();
    grid.lineStyle(1, COLOR.green, 0.07);
    for (let x = 0; x < width; x += 120) grid.lineBetween(x, 0, x, height);
    for (let y = 0; y < height; y += 120) grid.lineBetween(0, y, width, y);
    const shade = this.add.graphics();
    shade.fillGradientStyle(0x050905, 0x050905, 0x050905, 0x050905, 0.92, 0, 0.92, 0);
    shade.fillRect(0, 0, width * 0.62, height);
    this.add.image(width / 2, height / 2, UI_TEX.vignette).setDisplaySize(width, height).setTint(0x000000).setAlpha(0.9);
    // The aircraft flies above the darkening so it stays the hero of the shot.
    this.plane = this.add.image(-500, -500, planeKey);
    if (planeKey === UI_TEX.a10) this.plane.setTint(0xa9b3b0);
    this.add.tileSprite(0, 0, width, height, UI_TEX.scanlines).setOrigin(0).setAlpha(0.3);

    // Recon feed chrome.
    const chrome = this.add.graphics();
    chrome.lineStyle(2, COLOR.green, 0.55);
    const c = 36;
    for (const [x, y, sx, sy] of [
      [24, 24, 1, 1],
      [width - 24, 24, -1, 1],
      [24, height - 24, 1, -1],
      [width - 24, height - 24, -1, -1],
    ] as const) {
      chrome.lineBetween(x, y, x + c * sx, y);
      chrome.lineBetween(x, y, x, y + c * sy);
    }
    this.recDot = this.add.circle(width - 250, 58, 7, COLOR.red, 1);
    this.add.text(width - 234, 46, 'RECON FEED', textStyle({ size: 20, color: COLOR.green, glow: 6 }));
    this.recTime = this.add.text(width - 60, 76, '', textStyle({ size: 18, color: COLOR.greenDim, glow: false })).setOrigin(1, 0);
    if (level) {
      this.add
        .text(width - 60, height - 58, `SECTOR ${level.name.toUpperCase()}  ·  ${level.width / 1000}×${level.height / 1000} KM`, textStyle({ size: 18, color: COLOR.greenDim, glow: false }))
        .setOrigin(1, 0);
    }

    // Logo.
    const logoX = 132;
    const kicker = this.add.text(logoX + 6, 196, 'A-10 CLOSE AIR SUPPORT', textStyle({ size: 24, color: COLOR.green, glow: 8, letterSpacing: 8 }));
    const logo = this.add.text(logoX - 26, 222 - 26, 'WARTHOG', textStyle({ size: 196, font: 'display', color: 0xe9edd8, glow: 26 }));
    logo.setShadow(0, 0, css(COLOR.green), 30, false, true);
    const ruleG = this.add.graphics();
    drawRule(ruleG, logoX + 6, 452, 760, COLOR.green, 0.5);
    const tagline = this.add.text(logoX + 6, 470, 'THREE ALTITUDES  ·  TWO CLOCKS  ·  ONE WARTHOG', textStyle({ size: 22, color: COLOR.greenDim, glow: false, letterSpacing: 3 }));
    const shine = this.addShine(logo);

    this.menu = new MenuList(this, ['START MISSION', 'HOW TO PLAY', 'CREDITS'], {
      x: logoX,
      y: 620,
      width: 520,
      spacing: 76,
      fontSize: 38,
      sound: this.uiSound,
      onConfirm: (i) => this.choose(i),
    });
    const hint = this.add.text(logoX + 6, height - 70, '↑↓ / W S  SELECT     ENTER  CONFIRM', textStyle({ size: 18, color: COLOR.greenDim, glow: false }));
    this.add.text(logoX + 6, height - 44, 'v0.1 PROTOTYPE  ·  KEYBOARD', textStyle({ size: 15, color: COLOR.greenFaint, glow: false }));

    // Intro: logo slams in, the rest follows.
    logo.setScale(1.5).setAlpha(0);
    this.tweens.add({ targets: logo, scale: 1, alpha: 1, duration: 520, ease: 'Expo.easeOut', delay: 150 });
    this.time.delayedCall(420, () => this.cameras.main.shake(160, 0.004));
    for (const [i, o] of [kicker, tagline, ruleG, this.menu.container, hint].entries()) {
      const x = o.x;
      o.setAlpha(0);
      o.x = x - 40;
      this.tweens.add({ targets: o, alpha: 1, x, duration: 420, delay: 520 + i * 90, ease: 'Cubic.easeOut' });
    }
    this.time.addEvent({ delay: 5200, startAt: 3000, loop: true, callback: shine });
    this.cameras.main.fadeIn(500, 0, 0, 0);

    bindMenuKeys(this, {
      up: () => this.nav(-1),
      down: () => this.nav(1),
      confirm: () => (this.overlay ? this.closeOverlay() : this.menu.confirm()),
      back: () => this.closeOverlay(),
      actions: { mute: () => music.toggleMute() },
    });
  }

  override update(_time: number, delta: number): void {
    const dt = Math.min(0.1, delta / 1000);
    this.elapsed += dt;
    const { width, height } = this.scale;
    const t = this.elapsed;
    const spanX = (this.map.displayWidth - width) / 2 - 20;
    const spanY = (this.map.displayHeight - height) / 2 - 20;
    this.map.setPosition(width / 2 + Math.sin(t * 0.021) * spanX * 0.9, height / 2 + Math.sin(t * 0.017 + 0.4) * spanY * 0.7);
    this.recDot.setAlpha(blink(this.time.now, 1) ? 1 : 0.15);
    const s = Math.floor(t);
    this.recTime.setText(`${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}:${String(Math.floor((t % 1) * 30)).padStart(2, '0')}`);
    this.updateFlyBy(dt);
  }

  private nav(delta: number): void {
    if (this.overlayKind === 'credits' && this.credits) {
      const { text, top, min } = this.credits;
      text.y = Phaser.Math.Clamp(text.y - delta * 60, min, top);
      return;
    }
    if (!this.overlay) this.menu.move(delta);
  }

  private choose(index: number): void {
    if (this.leaving) return;
    if (index === 0) this.startMission();
    else if (index === 1) this.openOverlay('howto');
    else this.openOverlay('credits');
  }

  private startMission(): void {
    const level = LEVELS[0];
    if (!level) return;
    this.leaving = true;
    this.menu.enabled = false;
    this.cameras.main.fadeOut(450, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const data: BriefingSceneData = { levelId: level.id };
      this.scene.start(SCENES.briefing, data);
    });
  }

  // --- Overlays --------------------------------------------------------------

  private openOverlay(kind: Overlay): void {
    this.closeOverlay(false);
    this.menu.enabled = false;
    this.overlayKind = kind;
    this.overlay = kind === 'howto' ? this.buildHowTo() : this.buildCredits();
    this.overlay.setAlpha(0);
    this.tweens.add({ targets: this.overlay, alpha: 1, duration: 180 });
  }

  private closeOverlay(withSound = true): void {
    if (!this.overlay) return;
    if (withSound) this.uiSound.back();
    this.overlay.destroy();
    this.overlay = null;
    this.overlayKind = null;
    this.credits = null;
    this.menu.enabled = true;
  }

  private overlayFrame(w: number, h: number, title: string): { container: Phaser.GameObjects.Container; x: number; y: number } {
    const { width, height } = this.scale;
    const x = (width - w) / 2;
    const y = (height - h) / 2;
    const container = this.add.container(0, 0);
    container.add(this.add.rectangle(0, 0, width, height, 0x000000, 0.7).setOrigin(0).setInteractive());
    const g = this.add.graphics();
    drawPanel(g, x, y, w, h, { fillAlpha: 0.94, chamfer: 18, cornerLength: 28 });
    container.add(g);
    container.add(this.add.text(x + 48, y + 30, title, textStyle({ size: 52, font: 'display', color: COLOR.green, glow: 12 })));
    container.add(this.add.text(x + w - 48, y + h - 52, 'ESC / ENTER  BACK', textStyle({ size: 18, color: COLOR.greenDim, glow: false })).setOrigin(1, 0));
    return { container, x, y };
  }

  private buildHowTo(): Phaser.GameObjects.Container {
    const W = 1640;
    const H = 900;
    const { container, x, y } = this.overlayFrame(W, H, 'HOW TO PLAY');
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      container.add(o);
      return o;
    };
    const g = add(this.add.graphics());
    add(
      this.add.text(
        x + 50,
        y + 100,
        'Fly close air support for a ground war you can’t be everywhere in. Two timed primaries, optional targets, limited ammo.',
        textStyle({ size: 21, color: COLOR.white, glow: false, wrap: W - 100 }),
      ),
    );

    // Controls.
    add(this.add.text(x + 50, y + 170, 'CONTROLS', textStyle({ size: 22, color: COLOR.greenDim, glow: false })));
    drawRule(g, x + 50, y + 204, 600);
    add(createControlsCard(this, x + 50, y + 222, 220, 54, 21));

    // Altitude primer.
    const px = x + 730;
    add(this.add.text(px, y + 170, 'ALTITUDE BANDS', textStyle({ size: 22, color: COLOR.greenDim, glow: false })));
    add(this.add.text(x + W - 50, y + 172, 'W / S  CLIMB · DIVE', textStyle({ size: 18, color: COLOR.green, glow: false })).setOrigin(1, 0));
    drawRule(g, px, y + 204, W - 780);
    bandPrimer().forEach((row, i) => {
      const ry = y + 222 + i * 128;
      g.fillStyle(COLOR.green, row.band === 'low' ? 0.2 : 0.08);
      g.fillRect(px, ry, 128, 112);
      g.lineStyle(1.5, COLOR.green, 0.6);
      g.strokeRect(px, ry, 128, 112);
      add(this.add.text(px + 64, ry + 40, BAND_NAME[row.band], textStyle({ size: 24, color: COLOR.greenBright })).setOrigin(0.5));
      add(this.add.text(px + 64, ry + 78, row.speed, textStyle({ size: 17, color: COLOR.greenDim, glow: false })).setOrigin(0.5));
      add(this.add.text(px + 150, ry + 6, row.weapons, textStyle({ size: 21, color: COLOR.green, glow: 4 })));
      add(this.add.text(x + W - 50, ry + 6, `⚠ ${row.threats}`, textStyle({ size: 21, color: COLOR.amber, glow: false })).setOrigin(1, 0));
      add(this.add.text(px + 150, ry + 40, row.note, textStyle({ size: 19, color: COLOR.white, glow: false, wrap: W - 50 - (px + 150 - x) })));
    });

    // Tips.
    const ty = y + 222 + 3 * 128 + 16;
    add(this.add.text(px, ty, 'TIPS', textStyle({ size: 22, color: COLOR.greenDim, glow: false })));
    PLAY_TIPS.forEach((tip, i) => {
      add(this.add.text(px, ty + 36 + i * 32, `▸ ${tip}`, textStyle({ size: 19, color: COLOR.white, glow: false })));
    });
    return container;
  }

  private buildCredits(): Phaser.GameObjects.Container {
    const W = 1160;
    const H = 820;
    const { container, x, y } = this.overlayFrame(W, H, 'CREDITS');
    const top = y + 120;
    const viewH = H - 200;
    const text = this.add.text(x + W / 2, top, CREDITS_TEXT, textStyle({ size: 23, color: COLOR.white, glow: false, align: 'center', wrap: W - 120, lineSpacing: 8 })).setOrigin(0.5, 0);
    const maskShape = this.make.graphics({ x: 0, y: 0 }, false);
    maskShape.fillStyle(0xffffff, 1);
    maskShape.fillRect(x + 20, top, W - 40, viewH);
    text.setMask(maskShape.createGeometryMask());
    container.add(text);
    container.once(Phaser.GameObjects.Events.DESTROY, () => maskShape.destroy());
    const min = Math.min(top, top - (text.height - viewH));
    if (min < top) {
      container.add(this.add.text(x + 48, y + H - 52, '↑↓ SCROLL', textStyle({ size: 18, color: COLOR.greenDim, glow: false })));
    }
    this.credits = { text, top, min };
    return container;
  }

  // --- Decoration ------------------------------------------------------------

  /** A light sweep across the logo; returns a function that plays it once. */
  private addShine(logo: Phaser.GameObjects.Text): () => void {
    const shine = this.add
      .text(logo.x + 26, logo.y + 26, logo.text, textStyle({ size: 196, font: 'display', color: 0xffffff, glow: false }))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.85);
    const bar = this.make.graphics({ x: 0, y: 0 }, false);
    bar.fillStyle(0xffffff, 1);
    bar.fillPoints(
      [
        { x: 60, y: 0 },
        { x: 150, y: 0 },
        { x: 90, y: 300 },
        { x: 0, y: 300 },
      ],
      true,
    );
    bar.y = logo.y - 20;
    bar.x = -400;
    shine.setMask(bar.createGeometryMask());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => bar.destroy());
    return () => {
      bar.x = logo.x - 200;
      this.tweens.add({ targets: bar, x: logo.x + logo.width + 60, duration: 900, ease: 'Sine.easeInOut' });
    };
  }

  private updateFlyBy(dt: number): void {
    if (!this.flyBy) {
      this.flyWait -= dt;
      if (this.flyWait > 0) return;
      const spec = FLY_BYS[this.flyIndex % FLY_BYS.length];
      this.flyIndex++;
      if (!spec) return;
      const V = Phaser.Math.Vector2;
      this.flyBy = { p0: new V(spec[0], spec[1]), p1: new V(spec[2], spec[3]), p2: new V(spec[4], spec[5]), p3: new V(spec[6], spec[7]), duration: spec[8] };
      this.flyT = 0;
      this.lastHeading = Number.NaN;
      this.bank = 0;
    }
    const f = this.flyBy;
    this.flyT += dt / f.duration;
    if (this.flyT >= 1) {
      this.flyBy = null;
      this.flyWait = 2.5;
      this.plane.setPosition(-500, -500);
      this.shadow.setPosition(-500, -500);
      return;
    }
    const curve = new Phaser.Curves.CubicBezier(f.p0, f.p1, f.p2, f.p3);
    const pos = curve.getPoint(this.flyT);
    const tangent = curve.getTangent(this.flyT);
    const heading = Math.atan2(tangent.y, tangent.x);
    const turnRate = Number.isNaN(this.lastHeading) ? 0 : Phaser.Math.Angle.Wrap(heading - this.lastHeading) / Math.max(dt, 1e-3);
    this.lastHeading = heading;
    this.bank += (Phaser.Math.Clamp(turnRate * 1.6, -1, 1) - this.bank) * Math.min(1, dt * 4);
    // Fake roll: foreshorten the wings (the sprite's local y axis) as the aircraft banks.
    const scale = 1.05;
    const roll = 1 - 0.38 * Math.abs(this.bank);
    this.plane.setPosition(pos.x, pos.y).setRotation(heading).setScale(scale, scale * roll);
    this.shadow.setPosition(pos.x + SHADOW.x, pos.y + SHADOW.y).setRotation(heading).setScale(scale * 0.92, scale * 0.92 * roll);
  }
}
