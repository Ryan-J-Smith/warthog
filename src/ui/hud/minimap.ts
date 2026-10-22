import Phaser from 'phaser';
import type { Entity } from '../../sim/entities';
import type { LevelDefinition } from '../../sim/level';
import { duplicateMarkers, isDefendObjective } from '../model';
import { TACMAP_PHOSPHOR, bakeTacticalMap } from '../tacmap';
import { COLOR, textStyle } from '../theme';
import { drawPanel, pulse } from '../widgets';
import { HudWidget, type HudFrame } from './hudWidget';
import { LAYOUT } from './layout';

const STRUCTURES = new Set(['bridge', 'samSite', 'ammoDump', 'cache', 'enemyHq']);

/**
 * Minimap: the level's terrain prerendered once to a texture, with the game camera's view,
 * spotted threats (and faint SAM/AA rings), friendlies, objective markers and the player arrow.
 */
export class Minimap extends HudWidget {
  private readonly container: Phaser.GameObjects.Container;
  private readonly dynamic: Phaser.GameObjects.Graphics;
  private readonly sx: number;
  private readonly sy: number;
  private readonly defend: Set<string>;

  constructor(scene: Phaser.Scene, level: LevelDefinition) {
    super();
    const { x, y, w, h } = LAYOUT.minimap;
    const key = bakeTacticalMap(scene, `tacmap-minimap-${level.id}`, level, w, h, TACMAP_PHOSPHOR);
    this.sx = w / level.width;
    this.sy = h / level.height;
    this.defend = new Set(level.objectives.filter((o) => isDefendObjective(level, o.id)).map((o) => o.id));

    const frame = scene.add.graphics();
    drawPanel(frame, -8, -8, w + 16, h + 40, { fillAlpha: 0.75 });
    const map = scene.add.image(0, 0, key).setOrigin(0).setAlpha(0.95);
    this.dynamic = scene.add.graphics();
    const border = scene.add.graphics();
    border.lineStyle(1, COLOR.green, 0.45);
    border.strokeRect(0, 0, w, h);

    const north = scene.add.text(w - 10, 8, 'N▲', textStyle({ size: 16, color: COLOR.green, stroke: true })).setOrigin(1, 0);
    const label = scene.add.text(2, h + 8, 'TAC MAP', textStyle({ size: 15, color: COLOR.greenDim, glow: false }));
    // 1 km scale bar.
    const km = 1000 * this.sx;
    const scale = scene.add.graphics();
    scale.lineStyle(2, COLOR.green, 0.8);
    scale.lineBetween(w - km - 2, h + 20, w - 2, h + 20);
    scale.lineBetween(w - km - 2, h + 15, w - km - 2, h + 24);
    scale.lineBetween(w - 2, h + 15, w - 2, h + 24);
    const scaleText = scene.add.text(w - km - 10, h + 11, '1 KM', textStyle({ size: 14, color: COLOR.greenDim, glow: false })).setOrigin(1, 0);
    this.container = scene.add.container(x, y, [frame, map, this.dynamic, border, north, label, scale, scaleText]);
  }

  update({ view, camera, now }: HudFrame): void {
    const g = this.dynamic;
    const { w, h } = LAYOUT.minimap;
    const sx = this.sx;
    const sy = this.sy;
    g.clear();

    // Threat rings of spotted air defences.
    for (const e of view.entities) {
      if (!e.alive || !e.spotted || e.hidden) continue;
      if (e.sam) {
        g.fillStyle(COLOR.red, e.sam.locking ? 0.14 : 0.06);
        g.fillCircle(e.pos.x * sx, e.pos.y * sy, e.sam.range * sx);
        g.lineStyle(1, COLOR.red, e.sam.locking ? 0.9 : 0.45);
        g.strokeCircle(e.pos.x * sx, e.pos.y * sy, e.sam.range * sx);
      } else if (e.aa) {
        g.lineStyle(1, COLOR.amber, e.aa.engaging ? 0.7 : 0.3);
        g.strokeCircle(e.pos.x * sx, e.pos.y * sy, e.aa.range * sx);
      }
    }

    // Game camera view.
    const cx = Math.max(0, camera.x * sx);
    const cy = Math.max(0, camera.y * sy);
    const cr = Math.min(w, (camera.x + camera.width) * sx);
    const cb = Math.min(h, (camera.y + camera.height) * sy);
    g.fillStyle(COLOR.green, 0.06);
    g.fillRect(cx, cy, cr - cx, cb - cy);
    g.lineStyle(1.5, COLOR.green, 0.75);
    g.strokeRect(cx, cy, cr - cx, cb - cy);

    // Units.
    for (const e of view.entities) {
      if (!e.alive || e.hidden || e.kind === 'homeBase') continue;
      if (e.team === 'enemy' && !e.spotted) continue;
      this.drawEntity(g, e);
    }

    // Objective markers.
    const p = pulse(now, 1.6);
    const active = view.objectives.filter((o) => o.status === 'active' && o.marker);
    const shared = duplicateMarkers(active.map((o) => o.marker), 80);
    for (const [i, o] of active.entries()) {
      if (!o.marker || shared.has(i)) continue;
      const color = this.defend.has(o.id) ? COLOR.blue : COLOR.amber;
      const mx = o.marker.x * sx;
      const my = o.marker.y * sy;
      g.lineStyle(1.5, color, 0.8 - p * 0.6);
      g.strokeCircle(mx, my, 7 + p * 8);
      g.fillStyle(color, 1);
      g.lineStyle(1.5, COLOR.black, 0.8);
      const d = [
        { x: mx, y: my - 7 },
        { x: mx + 7, y: my },
        { x: mx, y: my + 7 },
        { x: mx - 7, y: my },
      ];
      g.fillPoints(d, true);
      g.strokePoints(d, true);
    }

    // Home base, pulsing when it's time to RTB.
    const base = view.entities.find((e) => e.refId === view.level.homeBaseRefId);
    if (base && view.rtb) {
      g.lineStyle(2, COLOR.blue, 0.9 - p * 0.6);
      g.strokeCircle(base.pos.x * sx, base.pos.y * sy, 8 + p * 10);
    }

    // Player.
    const pl = view.player;
    if (pl.alive) {
      const px = pl.pos.x * sx;
      const py = pl.pos.y * sy;
      const cos = Math.cos(pl.heading);
      const sin = Math.sin(pl.heading);
      const pt = (fx: number, fy: number): { x: number; y: number } => ({ x: px + fx * cos - fy * sin, y: py + fx * sin + fy * cos });
      const tri = [pt(11, 0), pt(-7, 7), pt(-3, 0), pt(-7, -7)];
      g.fillStyle(COLOR.black, 0.7);
      g.fillCircle(px, py, 9);
      g.fillStyle(COLOR.greenBright, 1);
      g.fillPoints(tri, true);
    }
  }

  destroy(): void {
    this.container.destroy();
  }

  private drawEntity(g: Phaser.GameObjects.Graphics, e: Entity): void {
    const x = e.pos.x * this.sx;
    const y = e.pos.y * this.sy;
    if (e.team === 'friendly') {
      g.fillStyle(COLOR.blue, 1);
      if (e.kind === 'outpost' || e.kind === 'friendlyHq') {
        g.fillRect(x - 5, y - 5, 10, 10);
        g.lineStyle(1, COLOR.white, 0.8);
        g.strokeRect(x - 5, y - 5, 10, 10);
      } else g.fillRect(x - 2, y - 2, 4, 4);
      return;
    }
    if (STRUCTURES.has(e.kind)) {
      g.fillStyle(e.kind === 'bridge' ? COLOR.amber : COLOR.red, 1);
      g.fillRect(x - 4, y - 4, 8, 8);
      g.lineStyle(1, COLOR.black, 0.8);
      g.strokeRect(x - 4, y - 4, 8, 8);
    } else if (e.heli) {
      // Helicopters: a red disc with a black keyline (they move fast; easy to pick out).
      g.fillStyle(COLOR.black, 0.8);
      g.fillCircle(x, y, 4.6);
      g.fillStyle(COLOR.red, 1);
      g.fillCircle(x, y, 3.4);
    } else if (e.mlrs) {
      // Rocket artillery: a bigger keylined red diamond (a priority target).
      const d = [
        { x, y: y - 5.5 },
        { x: x + 5.5, y },
        { x, y: y + 5.5 },
        { x: x - 5.5, y },
      ];
      g.fillStyle(COLOR.red, 1);
      g.lineStyle(1.5, COLOR.black, 0.9);
      g.fillPoints(d, true);
      g.strokePoints(d, true);
    } else if (e.aa) {
      g.fillStyle(COLOR.red, 1);
      g.fillTriangle(x, y - 4.5, x + 4.5, y + 3.5, x - 4.5, y + 3.5);
    } else {
      g.fillStyle(COLOR.red, 1);
      g.fillRect(x - 2.4, y - 2.4, 4.8, 4.8);
    }
  }
}
