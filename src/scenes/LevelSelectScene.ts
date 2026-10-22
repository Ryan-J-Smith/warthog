import Phaser from 'phaser';
import { MusicManager, audioSettingsFor } from '../audio';
import { LEVELS } from '../content/levels';
import { saveStoreFor } from '../meta/session';
import type { LevelDefinition } from '../sim/level';
import { formatClock, formatScore } from '../ui/format';
import { UI_SOUND_REGISTRY_KEY, resolveUiSound, type UiSoundPort } from '../ui/sound';
import { TACMAP_BRIEFING, bakeTacticalMap } from '../ui/tacmap';
import { COLOR, css, textStyle } from '../ui/theme';
import { RowList, bindMenuKeys, createBackdrop, createGradeBadge, drawPanel, drawRule, gradeColor } from '../ui/widgets';
import { SCENES, type BriefingSceneData } from './sceneKeys';

const LIST = { x: 96, y: 236, w: 820, row: 132, gap: 14, viewH: 724 } as const;
const PREVIEW = { x: 980, y: 236, w: 844, h: 724 } as const;
/** Preview map area inside the panel (the baked briefing map is 4:3). */
const MAP = { x: PREVIEW.x + 30, y: PREVIEW.y + 104, w: 784, h: 450 } as const;

/** The list remembers its selection for the session (back from a briefing lands on the same mission). */
let lastIndex = 0;

/**
 * Mission select: every level in `LEVELS`, all unlocked, with tagline and best grade/score; a
 * tactical-map preview of the selected one. ENTER opens its briefing, ESC goes back to the title.
 */
export class LevelSelectScene extends Phaser.Scene {
  private uiSound!: UiSoundPort;
  private list!: RowList;
  private previewMap!: Phaser.GameObjects.Image;
  private previewName!: Phaser.GameObjects.Text;
  private previewTagline!: Phaser.GameObjects.Text;
  private previewStats!: Phaser.GameObjects.Text;
  private previewBest!: Phaser.GameObjects.Text;
  private leaving = false;

  constructor() {
    super(SCENES.levelSelect);
  }

  create(): void {
    this.uiSound = resolveUiSound(this.registry.get(UI_SOUND_REGISTRY_KEY));
    new MusicManager(this).playTitle();
    this.leaving = false;
    const save = saveStoreFor(this.game);
    const { width, height } = this.scale;
    createBackdrop(this, { grid: 60, scanlines: 0.25, vignette: 0.8 });

    // Header.
    this.add.text(100, 52, 'OPERATIONS', textStyle({ size: 22, color: COLOR.greenDim, glow: false, letterSpacing: 6 }));
    this.add.text(92, 72, 'SELECT MISSION', textStyle({ size: 84, font: 'display', color: COLOR.green, glow: 16 }));
    this.add.text(width - 96, 70, 'CREDITS', textStyle({ size: 20, color: COLOR.greenDim, glow: false, letterSpacing: 4 })).setOrigin(1, 0);
    this.add.text(width - 96, 96, `${formatScore(save.credits)} CR`, textStyle({ size: 44, color: COLOR.amber, glow: 10 })).setOrigin(1, 0);
    this.add
      .text(width - 96, 156, `MISSIONS FLOWN ${save.missionsFlown}`, textStyle({ size: 18, color: COLOR.greenDim, glow: false }))
      .setOrigin(1, 0);
    const rule = this.add.graphics();
    drawRule(rule, 96, 204, width - 192);

    // Mission list.
    this.list = new RowList(
      this,
      LEVELS.length,
      {
        x: LIST.x,
        y: LIST.y,
        width: LIST.w,
        rowHeight: LIST.row,
        gap: LIST.gap,
        viewHeight: LIST.viewH,
        sound: this.uiSound,
        onConfirm: (i) => this.launch(i),
        onMove: (i) => this.showPreview(i),
      },
      (row, i) => this.buildRow(row, i),
    );

    // Preview panel.
    const g = this.add.graphics();
    drawPanel(g, PREVIEW.x, PREVIEW.y, PREVIEW.w, PREVIEW.h, { fillAlpha: 0.86, chamfer: 18, cornerLength: 26 });
    this.previewName = this.add.text(PREVIEW.x + 30, PREVIEW.y + 22, '', textStyle({ size: 46, font: 'display', color: COLOR.green, glow: 12 }));
    this.previewMap = this.add.image(MAP.x + MAP.w / 2, MAP.y + MAP.h / 2, '__DEFAULT');
    g.lineStyle(1.5, COLOR.green, 0.4);
    g.strokeRect(MAP.x, MAP.y, MAP.w, MAP.h);
    this.previewTagline = this.add.text(PREVIEW.x + 30, MAP.y + MAP.h + 22, '', textStyle({ size: 24, color: COLOR.white, glow: false, wrap: PREVIEW.w - 60 }));
    this.previewStats = this.add.text(PREVIEW.x + 30, MAP.y + MAP.h + 64, '', textStyle({ size: 20, color: COLOR.greenDim, glow: false }));
    this.previewBest = this.add.text(PREVIEW.x + 30, MAP.y + MAP.h + 100, '', textStyle({ size: 22, color: COLOR.green, glow: false }));

    this.add.text(100, height - 64, '↑↓  SELECT     ENTER  BRIEFING     ESC  BACK     M  MUTE ALL', textStyle({ size: 18, color: COLOR.greenDim, glow: false }));

    this.list.select(Math.min(lastIndex, Math.max(0, LEVELS.length - 1)), false);
    this.cameras.main.fadeIn(350, 0, 0, 0);
    bindMenuKeys(this, {
      up: () => this.list.move(-1),
      down: () => this.list.move(1),
      confirm: () => this.list.confirm(),
      back: () => this.back(),
      actions: { mute: () => audioSettingsFor(this.game).toggleAll() },
    });
  }

  private buildRow(row: Phaser.GameObjects.Container, i: number): (selected: boolean) => void {
    const level = LEVELS[i];
    if (!level) return () => {};
    const best = saveStoreFor(this.game).bestFor(level.id);
    const h = LIST.row;
    const number = this.add.text(30, h / 2, String(i + 1).padStart(2, '0'), textStyle({ size: 56, font: 'display', color: COLOR.greenFaint, glow: false })).setOrigin(0, 0.5);
    const name = this.add.text(128, 26, level.name.toUpperCase(), textStyle({ size: 34, color: COLOR.greenDim, glow: false }));
    const tagline = this.add.text(128, 74, level.tagline, textStyle({ size: 19, color: COLOR.grey, glow: false, wrap: LIST.w - 330 }));
    const badge = createGradeBadge(this, LIST.w - 66, h / 2, 76, best?.bestGrade ?? null);
    const bestText = this.add
      .text(LIST.w - 124, h / 2, best ? `BEST\n${formatScore(best.bestScore)}` : 'NOT\nFLOWN', textStyle({ size: 19, color: COLOR.greenDim, glow: false, align: 'right' }))
      .setOrigin(1, 0.5);
    row.add([number, name, tagline, badge, bestText]);
    return (selected) => {
      number.setColor(css(selected ? COLOR.green : COLOR.greenFaint));
      name.setColor(css(selected ? COLOR.greenBright : COLOR.greenDim));
      name.setShadow(0, 0, css(COLOR.green), selected ? 10 : 0, false, selected);
      tagline.setColor(css(selected ? COLOR.white : COLOR.grey));
    };
  }

  private showPreview(index: number): void {
    lastIndex = index;
    const level = LEVELS[index];
    if (!level) return;
    const key = bakeTacticalMap(this, `tacmap-briefing-${level.id}`, level, 1040, 780, TACMAP_BRIEFING);
    this.previewMap.setTexture(key);
    // Cover the map frame (crop the 4:3 map's top and bottom).
    const scale = Math.max(MAP.w / this.previewMap.width, MAP.h / this.previewMap.height);
    this.previewMap.setScale(scale);
    this.previewMap.setCrop(
      (this.previewMap.width - MAP.w / scale) / 2,
      (this.previewMap.height - MAP.h / scale) / 2,
      MAP.w / scale,
      MAP.h / scale,
    );
    this.previewName.setText(level.name.toUpperCase());
    this.previewTagline.setText(level.tagline);
    this.previewStats.setText(missionFacts(level));
    const best = saveStoreFor(this.game).bestFor(level.id);
    if (best) {
      this.previewBest.setText(`BEST  ${formatScore(best.bestScore)}  ·  GRADE ${best.bestGrade}`);
      const color = gradeColor(best.bestGrade);
      this.previewBest.setColor(css(color));
    } else {
      this.previewBest.setText('NOT FLOWN YET');
      this.previewBest.setColor(css(COLOR.greenDim));
    }
  }

  private launch(index: number): void {
    const level = LEVELS[index];
    if (!level || this.leaving) return;
    this.leaving = true;
    this.list.enabled = false;
    this.uiSound.confirm();
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const data: BriefingSceneData = { levelId: level.id };
      this.scene.start(SCENES.briefing, data);
    });
  }

  private back(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.uiSound.back();
    this.scene.start(SCENES.title);
  }
}

/** "PAR 7:00 · 2 PRIMARY + 3 OPTIONAL OBJECTIVES · 7.2 × 5.4 KM". */
function missionFacts(level: LevelDefinition): string {
  const primary = level.objectives.filter((o) => o.primary).length;
  const optional = level.objectives.length - primary;
  const objectives = optional > 0 ? `${primary} PRIMARY + ${optional} OPTIONAL` : `${primary} PRIMARY`;
  return `PAR ${formatClock(level.parTime)}   ·   ${objectives}   ·   ${level.width / 1000} × ${level.height / 1000} KM`;
}
