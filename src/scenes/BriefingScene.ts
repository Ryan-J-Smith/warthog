import Phaser from 'phaser';
import { MusicManager, audioSettingsFor } from '../audio';
import { ENTITY_STATS } from '../config';
import { getLevel } from '../content/levels';
import type { LevelDefinition } from '../sim/level';
import type { Vec2 } from '../sim/math';
import { briefingFor, controlsReminder, type Briefing, type IntelItem } from '../ui/copy';
import { objectiveShortLabel } from '../ui/model';
import { UI_SOUND_REGISTRY_KEY, resolveUiSound, type UiSoundPort } from '../ui/sound';
import { TACMAP_BRIEFING, bakeTacticalMap } from '../ui/tacmap';
import { COLOR, textStyle } from '../ui/theme';
import { TypewriterText, bindMenuKeys, blink, createBackdrop, drawPanel, drawRule, pulse } from '../ui/widgets';
import { SCENES, type BriefingSceneData, type GameSceneData } from './sceneKeys';

const MAP = { x: 64, y: 206, w: 1040, h: 780 } as const;
const TEXT = { x: 1150, y: 206, w: 710, h: 780 } as const;
const TYPE_CPS = 75;
const STEP_GAP = 0.28;
/** Map markers closer than this (px) are nudged apart. */
const MARKER_SPACING = 46;

/** A display object that can be shown and faded. */
type Showable = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible & Phaser.GameObjects.Components.AlphaSingle;

interface Step {
  /** Called when the step begins: reveal its map overlay. */
  reveal: () => void;
  writer: TypewriterText;
  body: string;
  /** Things that fade in with the step (header, title, badge). */
  show: Showable[];
}

interface Route {
  points: Vec2[];
  visible: boolean;
}

/**
 * Mission briefing: a tactical map with numbered objective markers that pop in while each
 * objective's briefing types out, then threat intel (SAM ring, AA sites, armor routes).
 * ENTER skips the animation, then launches the mission; ESC goes back to the title.
 */
export class BriefingScene extends Phaser.Scene {
  private levelId = '';
  private uiSound!: UiSoundPort;
  private steps: Step[] = [];
  private stepIndex = -1;
  private gap = 0;
  private complete = false;
  private leaving = false;
  private routes: Route[] = [];
  private routeGfx!: Phaser.GameObjects.Graphics;
  private markerPulse: Array<{ ring: Phaser.GameObjects.Arc; phase: number }> = [];
  private launchHint!: Phaser.GameObjects.Container;
  private launchBox!: Phaser.GameObjects.Graphics;
  /** Map overlay reveal functions, keyed by objective id or `intel-<index>`. */
  constructor() {
    super(SCENES.briefing);
  }

  create(data: BriefingSceneData): void {
    this.levelId = data.levelId;
    this.uiSound = resolveUiSound(this.registry.get(UI_SOUND_REGISTRY_KEY));
    const music = new MusicManager(this);
    music.playTitle();
    this.steps = [];
    this.stepIndex = -1;
    this.gap = 0.5;
    this.complete = false;
    this.leaving = false;
    this.routes = [];
    this.markerPulse = [];
    this.pendingReveals.clear();

    const level = getLevel(this.levelId);
    const briefing = briefingFor(level);
    createBackdrop(this, { grid: 60, scanlines: 0.25, vignette: 0.75 });

    this.buildHeader(briefing);
    this.buildMap(level, briefing);
    this.buildText(briefing);
    this.buildFooter();

    this.cameras.main.fadeIn(400, 0, 0, 0);
    bindMenuKeys(this, {
      confirm: () => this.advance(),
      back: () => this.back(),
      actions: { mute: () => audioSettingsFor(this.game).toggleAll() },
    });
  }

  override update(time: number, delta: number): void {
    const dt = Math.min(0.1, delta / 1000);
    this.drawRoutes(time);
    for (const m of this.markerPulse) {
      const p = (time / 1400 + m.phase) % 1;
      m.ring.setScale(1 + p * 1.4).setAlpha(m.ring.visible ? 0.7 * (1 - p) : 0);
    }
    this.launchHint.setAlpha(this.complete ? (blink(time, 1.4) ? 1 : 0.55) : 0.35);
    this.launchBox.setAlpha(this.complete ? 0.6 + 0.4 * pulse(time, 1.4) : 0.5);

    if (this.complete) return;
    const current = this.steps[this.stepIndex];
    if (current && !current.writer.done) {
      current.writer.update(dt);
      return;
    }
    this.gap -= dt;
    if (this.gap > 0) return;
    this.startStep(this.stepIndex + 1);
  }

  // --- Flow ----------------------------------------------------------------

  private startStep(index: number): void {
    const step = this.steps[index];
    if (!step) {
      this.complete = true;
      return;
    }
    this.stepIndex = index;
    this.gap = STEP_GAP;
    for (const o of step.show) this.fadeIn(o);
    step.reveal();
    this.uiSound.tick();
    step.writer.start(step.body);
  }

  /** ENTER: first finish the briefing, then launch. */
  private advance(): void {
    if (this.leaving) return;
    if (!this.complete) {
      for (let i = Math.max(0, this.stepIndex); i < this.steps.length; i++) {
        const step = this.steps[i];
        if (!step) continue;
        if (i > this.stepIndex) {
          for (const o of step.show) this.fadeIn(o);
          step.reveal();
          step.writer.start(step.body);
        }
        step.writer.finish();
      }
      this.stepIndex = this.steps.length;
      this.complete = true;
      this.uiSound.move();
      return;
    }
    this.leaving = true;
    this.uiSound.confirm();
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const next: GameSceneData = { levelId: this.levelId };
      this.scene.start(SCENES.game, next);
    });
  }

  private back(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.uiSound.back();
    this.scene.start(SCENES.title);
  }

  private fadeIn(o: Showable): void {
    o.setVisible(true);
    o.setAlpha(0);
    this.tweens.add({ targets: o, alpha: 1, duration: 260 });
  }

  // --- Layout --------------------------------------------------------------

  private buildHeader(briefing: Briefing): void {
    this.add.text(70, 40, 'MISSION BRIEFING  ·  WARTHOG 1-1  ·  CAS', textStyle({ size: 20, color: COLOR.greenDim, glow: false, letterSpacing: 3 }));
    this.add.text(66 - 14, 64 - 14, briefing.operation, textStyle({ size: 66, font: 'display', color: COLOR.green, glow: 14 }));
    this.add.text(TEXT.x + TEXT.w, 142, `“${briefing.tagline}”`, textStyle({ size: 22, color: COLOR.amber, glow: false })).setOrigin(1, 0);
  }

  private buildMap(level: LevelDefinition, briefing: Briefing): void {
    const frame = this.add.graphics();
    drawPanel(frame, MAP.x - 12, MAP.y - 12, MAP.w + 24, MAP.h + 24, { fillAlpha: 0.9 });
    const key = bakeTacticalMap(this, `tacmap-briefing-${level.id}`, level, MAP.w, MAP.h, TACMAP_BRIEFING);
    this.add.image(MAP.x, MAP.y, key).setOrigin(0);
    const s = MAP.w / level.width;
    const at = (p: Vec2): Vec2 => ({ x: MAP.x + p.x * s, y: MAP.y + p.y * s });

    this.routeGfx = this.add.graphics();

    // Home base and the flight's start point.
    const base = level.entities.find((e) => e.refId === level.homeBaseRefId);
    if (base) {
      const b = at(base.pos);
      this.add.text(b.x, b.y + 20, 'HOME BASE · REARM', textStyle({ size: 16, color: COLOR.blue, stroke: true })).setOrigin(0.5, 0);
    }
    const spawn = at(level.player.spawn);
    const heading = (level.player.headingDeg * Math.PI) / 180;
    const me = this.add.graphics({ x: spawn.x, y: spawn.y });
    me.fillStyle(COLOR.greenBright, 1);
    me.fillTriangle(12, 0, -8, 8, -8, -8);
    me.setRotation(heading);
    this.add.text(spawn.x + 16, spawn.y - 30, 'WARTHOG 1-1', textStyle({ size: 15, color: COLOR.greenBright, stroke: true }));

    // Objectives: numbered markers, revealed with their briefing step. Objectives on the same
    // spot (the column and the bridge) get their marker nudged aside with a leader line.
    const placed: Vec2[] = [];
    for (const o of briefing.objectives) {
      if (!o.marker) continue;
      const anchor = at(o.marker);
      const stacked = placed.filter((p) => Math.hypot(p.x - anchor.x, p.y - anchor.y) < MARKER_SPACING).length;
      const m = { x: anchor.x + stacked * MARKER_SPACING, y: anchor.y - stacked * 18 };
      placed.push(anchor);
      const color = o.defend ? COLOR.blue : COLOR.amber;
      const leader = this.add.graphics();
      if (stacked > 0) {
        leader.lineStyle(2, color, 0.8);
        leader.lineBetween(anchor.x + 14, anchor.y - 4, m.x - 18, m.y + 4);
      }
      const ring = this.add.circle(m.x, m.y, 20).setStrokeStyle(2, color, 1).setVisible(false);
      const disc = this.add.circle(m.x, m.y, 19, COLOR.panel, 0.9).setStrokeStyle(3, color, 1);
      const num = this.add.text(m.x, m.y, String(o.number), textStyle({ size: 24, color, glow: 8 })).setOrigin(0.5);
      const label = this.add
        .text(m.x, m.y + 26, stacked > 0 ? '' : objectiveShortLabel(level, o.id), textStyle({ size: 15, color, stroke: true }))
        .setOrigin(0.5, 0);
      const marker = this.add.container(0, 0, [leader, disc, num, label]).setVisible(false);
      this.markerPulse.push({ ring, phase: o.number * 0.23 });
      this.pendingReveals.set(o.id, () => {
        ring.setVisible(true);
        marker.setVisible(true).setAlpha(1);
        for (const part of [disc, num]) {
          part.setScale(2.2);
          this.tweens.add({ targets: part, scale: 1, duration: 320, ease: 'Back.easeOut' });
        }
        label.setAlpha(0);
        this.tweens.add({ targets: label, alpha: 1, duration: 300, delay: 150 });
      });
    }

    // Threat intel overlays.
    briefing.intel.forEach((item, i) => this.pendingReveals.set(`intel-${i}`, this.intelOverlay(item, at, s)));

    // Legend.
    const ly = MAP.y + MAP.h - 30;
    const legend = this.add.graphics();
    legend.fillStyle(COLOR.panel, 0.8);
    legend.fillRect(MAP.x + 8, ly - 8, 640, 32);
    const items: Array<[string, number]> = [
      ['◆ ATTACK', COLOR.amber],
      ['◆ DEFEND', COLOR.blue],
      ['▲ AA', COLOR.red],
      ['◯ SAM RANGE', COLOR.red],
      ['→ ARMOR ROUTE', COLOR.red],
    ];
    let lx = MAP.x + 20;
    for (const [text, color] of items) {
      const t = this.add.text(lx, ly, text, textStyle({ size: 16, color, glow: false }));
      lx += t.width + 26;
    }
  }

  /** Map overlay for one intel line (hidden until revealed); returns its reveal function. */
  private intelOverlay(item: IntelItem, at: (p: Vec2) => Vec2, s: number): () => void {
    const parts: Showable[] = [];
    let route: Route | null = null;
    if (item.kind === 'sam') {
      const range = (ENTITY_STATS.samSite.sam?.range ?? 1100) * s;
      for (const pos of item.positions) {
        const p = at(pos);
        const g = this.add.graphics();
        g.fillStyle(COLOR.red, 0.08);
        g.fillCircle(p.x, p.y, range);
        g.lineStyle(2, COLOR.red, 0.8);
        const dashes = 40;
        for (let i = 0; i < dashes; i++) {
          g.beginPath();
          g.arc(p.x, p.y, range, (i / dashes) * Math.PI * 2, ((i + 0.55) / dashes) * Math.PI * 2);
          g.strokePath();
        }
        const label = this.add.text(p.x, p.y - range - 6, 'SAM?', textStyle({ size: 18, color: COLOR.red, stroke: true })).setOrigin(0.5, 1);
        parts.push(g, label);
      }
    } else if (item.kind === 'aa') {
      const g = this.add.graphics();
      for (const pos of item.positions) {
        const p = at(pos);
        g.fillStyle(COLOR.red, 1);
        g.fillTriangle(p.x, p.y - 7, p.x + 7, p.y + 5, p.x - 7, p.y + 5);
        g.lineStyle(1, COLOR.black, 0.8);
        g.strokeTriangle(p.x, p.y - 7, p.x + 7, p.y + 5, p.x - 7, p.y + 5);
      }
      parts.push(g);
    } else if (item.route) {
      route = { points: item.route.map(at), visible: false };
      this.routes.push(route);
      const start = route.points[0];
      if (start) {
        const x = Phaser.Math.Clamp(start.x, MAP.x + 70, MAP.x + MAP.w - 70);
        const y = Phaser.Math.Clamp(start.y - 26, MAP.y + 12, MAP.y + MAP.h - 40);
        parts.push(this.add.text(x, y, 'ARMOR', textStyle({ size: 17, color: COLOR.red, stroke: true })).setOrigin(0.5, 0));
      }
    }
    for (const p of parts) p.setVisible(false);
    return () => {
      if (route) route.visible = true;
      for (const p of parts) this.fadeIn(p);
    };
  }

  private drawRoutes(time: number): void {
    const g = this.routeGfx;
    g.clear();
    const offset = (time / 40) % 24;
    for (const route of this.routes) {
      if (!route.visible) continue;
      g.lineStyle(3, COLOR.red, 0.85);
      dashedPolyline(g, route.points, 14, 10, offset);
      // Arrow head at the end.
      const n = route.points.length;
      const end = route.points[n - 1];
      const prev = route.points[n - 2];
      if (!end || !prev) continue;
      const a = Math.atan2(end.y - prev.y, end.x - prev.x);
      g.fillStyle(COLOR.red, 0.95);
      g.fillTriangle(
        end.x + Math.cos(a) * 12,
        end.y + Math.sin(a) * 12,
        end.x + Math.cos(a + 2.5) * 12,
        end.y + Math.sin(a + 2.5) * 12,
        end.x + Math.cos(a - 2.5) * 12,
        end.y + Math.sin(a - 2.5) * 12,
      );
    }
  }

  private readonly pendingReveals = new Map<string, () => void>();

  /** Largest body text size (and matching gap) at which the whole briefing fits its panel. */
  private fitTextSize(briefing: Briefing): { body: number; intel: number; gap: number } {
    const w = TEXT.w - 28;
    const probe = this.make.text({ x: 0, y: 0, text: '' }, false);
    try {
      for (const body of [19, 18, 17, 16, 15]) {
        const gap = body >= 18 ? 18 : 12;
        const intel = body - 1;
        let h = 50 + 54;
        probe.setStyle(textStyle({ size: body, glow: false, wrap: w - 42, lineSpacing: 3 }));
        for (const o of briefing.objectives) h += 34 + measure(probe, o.text) + gap;
        probe.setStyle(textStyle({ size: intel, glow: false, wrap: w - 32, lineSpacing: 2 }));
        for (const item of briefing.intel) h += measure(probe, item.text) + 12;
        if (h <= TEXT.h - 8) return { body, intel, gap };
      }
      return { body: 15, intel: 14, gap: 10 };
    } finally {
      probe.destroy();
    }
  }

  private buildText(briefing: Briefing): void {
    const g = this.add.graphics();
    drawPanel(g, TEXT.x - 12, TEXT.y - 12, TEXT.w + 24, TEXT.h + 24, { fillAlpha: 0.8 });
    let y = TEXT.y + 8;
    const x = TEXT.x + 14;
    const w = TEXT.w - 28;
    const size = this.fitTextSize(briefing);

    const objHeader = this.add.text(x, y, 'OBJECTIVES', textStyle({ size: 20, color: COLOR.greenDim, glow: false, letterSpacing: 2 }));
    drawRule(g, x, y + 32, w);
    y += 50;

    briefing.objectives.forEach((o, i) => {
      const color = o.defend ? COLOR.blue : COLOR.amber;
      const badge = this.add.circle(x + 15, y + 14, 15, COLOR.panel, 1).setStrokeStyle(2, color, 1);
      const num = this.add.text(x + 15, y + 14, String(o.number), textStyle({ size: 18, color, glow: false })).setOrigin(0.5);
      const title = this.add.text(x + 42, y + 1, o.title.toUpperCase(), textStyle({ size: 22, color: COLOR.white, glow: false }));
      const tag = this.add
        .text(x + w, y + 4, o.primary ? 'PRIMARY · TIMED' : 'OPTIONAL', textStyle({ size: 15, color: o.primary ? COLOR.green : COLOR.greenDim, glow: false }))
        .setOrigin(1, 0);
      const body = this.add.text(x + 42, y + 34, '', textStyle({ size: size.body, color: COLOR.green, glow: 3, wrap: w - 42, lineSpacing: 3 }));
      const height = measure(body, o.text);
      const show: Showable[] = [badge, num, title, tag];
      if (i === 0) show.unshift(objHeader);
      for (const o of show) o.setVisible(false);
      this.steps.push({
        reveal: this.pendingReveals.get(o.id) ?? (() => {}),
        writer: new TypewriterText(body, TYPE_CPS),
        body: o.text,
        show,
      });
      y += 34 + height + size.gap;
    });

    y += 6;
    const intelHeader = this.add.text(x, y, 'THREAT INTEL', textStyle({ size: 20, color: COLOR.greenDim, glow: false, letterSpacing: 2 }));
    const intelRule = this.add.graphics();
    drawRule(intelRule, x, y + 32, w, COLOR.red, 0.4);
    y += 48;
    briefing.intel.forEach((item, i) => {
      const bullet = this.add.text(x + 4, y, item.kind === 'sam' ? '◯' : item.kind === 'aa' ? '▲' : '→', textStyle({ size: 18, color: COLOR.red, glow: false }));
      const body = this.add.text(x + 32, y, '', textStyle({ size: size.intel, color: COLOR.white, glow: false, wrap: w - 32, lineSpacing: 2 }));
      const height = measure(body, item.text);
      const show: Showable[] = [bullet];
      if (i === 0) show.unshift(intelHeader, intelRule);
      for (const o of show) o.setVisible(false);
      this.steps.push({
        reveal: this.pendingReveals.get(`intel-${i}`) ?? (() => {}),
        writer: new TypewriterText(body, TYPE_CPS * 1.2),
        body: item.text,
        show,
      });
      y += height + 12;
    });
  }

  private buildFooter(): void {
    const { width, height } = this.scale;
    const y = height - 58;
    this.add.text(70, y, 'ESC  BACK', textStyle({ size: 18, color: COLOR.greenDim, glow: false }));
    this.add.text(width / 2 - 120, y, controlsReminder(), textStyle({ size: 18, color: COLOR.greenDim, glow: false })).setOrigin(0.5, 0);
    const label = this.add.text(0, 0, 'ENTER  LAUNCH ▶', textStyle({ size: 26, color: COLOR.greenBright, glow: 10 })).setOrigin(1, 0.5);
    this.launchBox = this.add.graphics();
    this.launchBox.fillStyle(COLOR.green, 0.14);
    this.launchBox.fillRect(-label.width - 24, -24, label.width + 40, 48);
    this.launchBox.lineStyle(2, COLOR.green, 0.9);
    this.launchBox.strokeRect(-label.width - 24, -24, label.width + 40, 48);
    this.launchHint = this.add.container(width - 76, y + 10, [this.launchBox, label]);
    this.launchHint.setAlpha(0.35);
  }
}

/** Height of `text` once `content` is set, then clear it. */
function measure(text: Phaser.GameObjects.Text, content: string): number {
  text.setText(content);
  const h = text.height;
  text.setText('');
  return h;
}

function dashedPolyline(g: Phaser.GameObjects.Graphics, points: readonly Vec2[], dash: number, gap: number, offset: number): void {
  let carry = -offset;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (!a || !b) continue;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-3) continue;
    const dx = (b.x - a.x) / len;
    const dy = (b.y - a.y) / len;
    let d = carry;
    while (d < len) {
      const s0 = Math.max(0, d);
      const s1 = Math.min(len, d + dash);
      if (s1 > s0) g.lineBetween(a.x + dx * s0, a.y + dy * s0, a.x + dx * s1, a.y + dy * s1);
      d += dash + gap;
    }
    carry = d - len;
  }
}
