import Phaser from 'phaser';
import { SPRITE_RESOLUTION } from '../../assets';
import { ARMORY_RADIUS, PAD_RADIUS, STRUCTURES, type StructureId } from '../../sim/defense';
import { angleOf, distance, sub, type Vec2 } from '../../sim/math';
import type { SimEvent } from '../../sim/events';
import type { EntityKind } from '../../sim/types';
import type { WorldView } from '../../sim/world';
import { FONT_STACK } from '../../ui/fonts';
import { DEPTH } from '../layers';

const COLORS = {
  pad: 0xd4ffc4,
  built: 0x5ab0ff,
  active: 0xffb627,
  threat: 0xff3b30,
  flak: 0x5ab0ff,
  flakCore: 0xffffff,
} as const;

/** Seconds a flak burst ring lasts. */
const BURST_TIME = 0.35;

const SHORT: Partial<Record<EntityKind, string>> = { tank: 'TANK', infantry: 'INF', mobileAa: 'AA', truck: 'TRUCK', mlrs: 'MLRS', helicopter: 'GUNSHIP' };
const LEVEL_MARK = ['', 'I', 'II', 'III'] as const;
/** World units between the chevrons drawn along a road the next wave will use. */
const CHEVRON_STEP = 220;
/** Structure sprites by structure and level (drawn when the art is loaded; else just the pad ring). */
const STRUCTURE_SPRITE: Record<StructureId, readonly string[]> = {
  barracks: ['structBarracks', 'structBarracks2'],
  depot: ['structDepot', 'structDepot2'],
  bunker: ['structBunker', 'structBunker2'],
  flak: ['structFlak', 'structFlak2'],
};

/**
 * Base defence, in the world: build pads (empty, built, under the aircraft), the armory ring over
 * the airstrip, and during the build phase the next wave drawn on its roads (red chevrons toward
 * the base and a count at the road's entry), so the preview is on the map, not just in a panel.
 */
export class DefenseOverlay {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly padLabels = new Map<string, Phaser.GameObjects.Text>();
  private readonly laneLabels = new Map<string, Phaser.GameObjects.Text>();
  private readonly structures = new Map<string, Phaser.GameObjects.Image>();
  /** Flak shells in flight and bursts, in real (render) seconds. */
  private shells: Array<{ from: Vec2; to: Vec2; age: number; flight: number }> = [];
  private bursts: Array<{ pos: Vec2; age: number; hit: boolean }> = [];

  /** Flak fire is drawn here: blue shells with a white core, and a ring where they burst. */
  handleEvents(events: readonly SimEvent[]): void {
    for (const e of events) {
      if (e.type === 'flakFired') this.shells.push({ from: e.from, to: e.to, age: 0, flight: e.flightTime });
      else if (e.type === 'flakBurst') this.bursts.push({ pos: e.pos, age: 0, hit: e.hit });
    }
  }

  constructor(private readonly scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(DEPTH.groundFx + 2);
  }

  sync(view: WorldView, dt = 0): void {
    const g = this.g;
    g.clear();
    this.drawFlak(dt);
    const state = view.defense;
    const def = view.level.defense;
    if (!state || !def) return;
    const zoom = this.scene.cameras.main.zoom;
    const px = 1 / zoom;
    const building = state.phase === 'build';

    for (const pad of state.pads) {
      const active = building && state.activePad === pad.id;
      const built = pad.structure !== null;
      const color = active ? COLORS.active : built ? COLORS.built : COLORS.pad;
      g.fillStyle(color, built ? 0.16 : 0.07);
      g.fillCircle(pad.pos.x, pad.pos.y, PAD_RADIUS);
      g.lineStyle((active ? 5 : 2.5) * px, color, building || built ? 0.9 : 0.4);
      g.strokeCircle(pad.pos.x, pad.pos.y, PAD_RADIUS);
      if (!built) {
        const s = 26;
        g.lineStyle(3 * px, color, 0.8);
        g.lineBetween(pad.pos.x - s, pad.pos.y, pad.pos.x + s, pad.pos.y);
        g.lineBetween(pad.pos.x, pad.pos.y - s, pad.pos.x, pad.pos.y + s);
      }
      this.structure(pad.id, pad.structure, pad.level, pad.pos);
      const label = this.label(this.padLabels, pad.id);
      const name = pad.structure ? `${STRUCTURES[pad.structure].name} ${LEVEL_MARK[pad.level] ?? pad.level}` : building ? 'BUILD PAD' : '';
      label
        .setText(name)
        .setColor(active ? '#ffb627' : built ? '#5ab0ff' : '#d4ffc4')
        .setPosition(pad.pos.x, pad.pos.y + PAD_RADIUS + 8 * px)
        .setScale(px)
        .setVisible(name !== '');
    }

    if (building) {
      const home = view.rearmPoints()[0];
      if (home) {
        const active = state.activePad === 'armory';
        g.lineStyle((active ? 5 : 2.5) * px, COLORS.active, active ? 1 : 0.6);
        g.strokeCircle(home.x, home.y, ARMORY_RADIUS);
      }
    }

    const next = building ? def.waves[state.wave] : undefined;
    for (const lane of def.lanes) {
      const units = next?.lanes.find((l) => l.laneId === lane.id)?.units ?? [];
      const label = this.label(this.laneLabels, lane.id);
      const path = view.level.paths[lane.pathId];
      if (units.length === 0 || !path || path.length < 2) {
        label.setVisible(false);
        continue;
      }
      this.chevrons(path, px);
      const entry = path[0] as Vec2;
      label
        .setText(`NEXT: ${summarize(units)}`)
        .setColor('#ff6a5a')
        .setPosition(entry.x, entry.y + 60 * px)
        .setScale(px * 1.2)
        .setVisible(true);
    }
  }

  private drawFlak(dt: number): void {
    const g = this.g;
    const px = 1 / this.scene.cameras.main.zoom;
    this.shells = this.shells.filter((s) => (s.age += dt) < s.flight);
    for (const s of this.shells) {
      const t = s.age / s.flight;
      const x = s.from.x + (s.to.x - s.from.x) * t;
      const y = s.from.y + (s.to.y - s.from.y) * t;
      g.fillStyle(COLORS.flak, 0.45);
      g.fillCircle(x, y, 11 * px);
      g.fillStyle(COLORS.flakCore, 1);
      g.fillCircle(x, y, 5 * px);
    }
    this.bursts = this.bursts.filter((b) => (b.age += dt) < BURST_TIME);
    for (const b of this.bursts) {
      const t = b.age / BURST_TIME;
      g.lineStyle(4 * px, b.hit ? COLORS.flakCore : COLORS.flak, 1 - t);
      g.strokeCircle(b.pos.x, b.pos.y, (14 + 40 * t) * px);
    }
  }

  /** The built structure's sprite on its pad (level 2 art when it exists). */
  private structure(padId: string, id: StructureId | null, level: number, pos: Vec2): void {
    const keys = id ? STRUCTURE_SPRITE[id] : [];
    const key = [...keys.slice(0, level)].reverse().find((k) => this.scene.textures.exists(k));
    let img = this.structures.get(padId);
    if (!key) {
      img?.setVisible(false);
      return;
    }
    if (!img) {
      img = this.scene.add.image(pos.x, pos.y, key).setScale(1 / SPRITE_RESOLUTION).setDepth(DEPTH.ground - 1);
      this.structures.set(padId, img);
    }
    if (img.texture.key !== key) img.setTexture(key);
    img.setVisible(true);
  }

  private chevrons(path: readonly Vec2[], px: number): void {
    const g = this.g;
    g.lineStyle(4 * px, COLORS.threat, 0.75);
    let carry = CHEVRON_STEP / 2;
    for (let i = 0; i + 1 < path.length; i++) {
      const a = path[i] as Vec2;
      const b = path[i + 1] as Vec2;
      const len = distance(a, b);
      const ang = angleOf(sub(b, a));
      for (let d = carry; d < len; d += CHEVRON_STEP) {
        const t = d / len;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        const s = 26;
        const back = ang + Math.PI;
        g.lineBetween(x, y, x + Math.cos(back - 0.6) * s, y + Math.sin(back - 0.6) * s);
        g.lineBetween(x, y, x + Math.cos(back + 0.6) * s, y + Math.sin(back + 0.6) * s);
        carry = d + CHEVRON_STEP - len;
      }
      if (carry < 0 || carry >= CHEVRON_STEP) carry = Math.max(0, carry % CHEVRON_STEP);
    }
  }

  private label(pool: Map<string, Phaser.GameObjects.Text>, id: string): Phaser.GameObjects.Text {
    let t = pool.get(id);
    if (!t) {
      t = this.scene.add
        .text(0, 0, '', { fontFamily: FONT_STACK.mono, fontSize: '22px', color: '#d4ffc4', stroke: '#030805', strokeThickness: 4 })
        .setOrigin(0.5, 0)
        .setDepth(DEPTH.worldUi - 2);
      pool.set(id, t);
    }
    return t;
  }

  destroy(): void {
    this.g.destroy();
    for (const t of this.padLabels.values()) t.destroy();
    for (const t of this.laneLabels.values()) t.destroy();
    for (const img of this.structures.values()) img.destroy();
  }
}

/** "4 TANK · 6 INF · 1 AA" */
function summarize(units: readonly EntityKind[]): string {
  const counts = new Map<string, number>();
  for (const u of units) {
    const k = SHORT[u] ?? u.toUpperCase();
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts].map(([k, c]) => `${c} ${k}`).join(' · ');
}
