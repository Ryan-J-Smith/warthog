import type Phaser from 'phaser';
import { ARMORY, ARMORY_ORDER, STRUCTURES, STRUCTURE_ORDER, structureCost, type DefenseState } from '../../sim/defense';
import type { LevelDefinition } from '../../sim/level';
import type { EntityKind } from '../../sim/types';
import { COLOR, css, textStyle } from '../theme';
import { blink, drawPanel } from '../widgets';
import { HudWidget, type HudFrame } from './hudWidget';
import { LAYOUT, MARGIN, SCREEN } from './layout';

const W = LAYOUT.minimap.w;
const X = SCREEN.width - MARGIN - W;
const Y = LAYOUT.minimap.y + LAYOUT.minimap.h + 14;
const PAD = 16;
/** Seconds a build notice stays up. */
const NOTICE_TIME = 3;

const SHORT: Partial<Record<EntityKind, string>> = { tank: 'TANK', infantry: 'INF', mobileAa: 'AA', truck: 'TRUCK', mlrs: 'MLRS', helicopter: 'HELO' };

/**
 * Base defence: wave counter and gold, the phase ("PRESS R TO LAUNCH"), the next wave road by
 * road, and the build / armory menu for the pad under the aircraft.
 */
export class DefensePanel extends HudWidget {
  private readonly container: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly header: Phaser.GameObjects.Text;
  private readonly gold: Phaser.GameObjects.Text;
  private readonly phase: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly menu: Phaser.GameObjects.Text;
  private readonly notice: Phaser.GameObjects.Text;
  private drawnHeight = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly level: LevelDefinition,
  ) {
    super();
    this.bg = scene.add.graphics();
    this.header = scene.add.text(PAD, 12, '', textStyle({ size: 26, font: 'display', color: COLOR.green, glow: 8 }));
    this.gold = scene.add.text(W - PAD, 14, '', textStyle({ size: 24, color: COLOR.amber })).setOrigin(1, 0);
    this.phase = scene.add.text(PAD, 52, '', textStyle({ size: 19, color: COLOR.amber }));
    this.body = scene.add.text(PAD, 84, '', textStyle({ size: 18, color: COLOR.white, glow: false, wrap: W - PAD * 2 }));
    this.menu = scene.add.text(PAD, 0, '', textStyle({ size: 18, color: COLOR.greenBright, glow: false, wrap: W - PAD * 2 }));
    this.notice = scene.add.text(PAD, 0, '', textStyle({ size: 18, color: COLOR.green, glow: false, wrap: W - PAD * 2 }));
    this.container = scene.add.container(X, Y, [this.bg, this.header, this.gold, this.phase, this.body, this.menu, this.notice]);
    this.container.setVisible(level.defense !== undefined);
  }

  update({ view, now }: HudFrame): void {
    const state = view.defense;
    const def = this.level.defense;
    if (!state || !def) return;

    const wave = Math.min(state.wave + 1, state.totalWaves);
    this.header.setText(`WAVE ${wave} / ${state.totalWaves}`);
    this.gold.setText(`${state.gold} GOLD`);

    if (state.phase === 'build') {
      this.phase.setText(state.offer ? 'PICK A CARD · 1 / 2 / 3' : 'BUILD PHASE · PRESS R TO LAUNCH').setColor(css(COLOR.amber)).setAlpha(blink(now, 1.2) ? 1 : 0.55);
      const next = def.waves[state.wave];
      const lines = ['NEXT WAVE'];
      for (const lane of def.lanes) {
        const units = next?.lanes.find((l) => l.laneId === lane.id)?.units ?? [];
        lines.push(`  ${lane.name.padEnd(6)} ${units.length === 0 ? '—' : summarize(units)}`);
      }
      this.body.setText(lines.join('\n'));
    } else if (state.phase === 'wave') {
      this.phase.setText(`WAVE INBOUND · ${state.remaining} HOSTILE${state.remaining === 1 ? '' : 'S'} LEFT`).setColor(css(COLOR.red)).setAlpha(1);
      this.body.setText(view.player.alive ? '' : `SHOT DOWN · BACK IN ${Math.ceil(view.player.respawnIn)}s`);
    } else {
      this.phase.setText(state.phase === 'won' ? 'BASE HELD' : 'BASE LOST').setAlpha(1);
      this.body.setText('');
    }

    let y = this.body.y + (this.body.text ? this.body.height + 12 : 0);
    const menu = state.phase === 'build' && !state.offer ? menuLines(state) : '';
    this.menu.setText(menu).setY(y);
    if (menu) y += this.menu.height + 10;

    const n = state.notice;
    const showNotice = n !== null && view.time - n.at < NOTICE_TIME;
    this.notice.setText(showNotice && n ? n.text : '').setColor(css(n?.good ? COLOR.green : COLOR.red)).setY(y);
    if (showNotice) y += this.notice.height + 10;

    const h = Math.max(96, y + 6);
    if (h !== this.drawnHeight) {
      this.drawnHeight = h;
      this.bg.clear();
      drawPanel(this.bg, 0, 0, W, h);
    }
  }

  destroy(): void {
    this.container.destroy();
  }
}

/** "4 TANK · 6 INF · 1 AA" */
function summarize(units: readonly EntityKind[]): string {
  const counts = new Map<string, number>();
  for (const u of units) counts.set(SHORT[u] ?? u.toUpperCase(), (counts.get(SHORT[u] ?? u.toUpperCase()) ?? 0) + 1);
  return [...counts].map(([k, c]) => `${c} ${k}`).join(' · ');
}

/** The build / armory options for the pad under the aircraft. */
function menuLines(state: Readonly<DefenseState>): string {
  const id = state.activePad;
  if (id === null) return 'Fly over a pad to select it.\nOver the airstrip for upgrades.';
  if (id === 'armory') {
    const rows = ARMORY_ORDER.map((a, i) => {
      const item = ARMORY[a];
      const cost = item.costs[state.armory[a]];
      return `[${i + 1}] ${item.name} ${cost === undefined ? 'MAX' : cost}\n    ${item.blurb}`;
    });
    return ['ARMORY', ...rows].join('\n');
  }
  const pad = state.pads.find((p) => p.id === id);
  if (!pad) return '';
  if (pad.structure === null) {
    const rows = STRUCTURE_ORDER.map((s, i) => {
      const item = STRUCTURES[s];
      return `[${i + 1}] ${item.name} ${structureCost(state, s, 0) ?? ''}\n    ${item.blurb}`;
    });
    return [`PAD ${pad.id.toUpperCase()} · EMPTY`, ...rows].join('\n');
  }
  const item = STRUCTURES[pad.structure];
  const cost = structureCost(state, pad.structure, pad.level);
  const upgrade = cost === undefined ? 'FULLY UPGRADED' : `[1] UPGRADE TO LV ${pad.level + 1}  ${cost}`;
  return [`${item.name} · LV ${pad.level}`, `    ${item.blurb}`, upgrade].join('\n');
}
