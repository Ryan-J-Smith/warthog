import Phaser from 'phaser';
import { MusicManager, audioSettingsFor } from '../audio';
import { SCORING } from '../config';
import { getLevel } from '../content/levels';
import { CHALLENGE_BOUNTY, type Challenge } from '../meta/challenges';
import type { MissionAward } from '../meta/save';
import { saveStoreFor } from '../meta/session';
import { DIFFICULTIES } from '../sim/difficulty';
import type { MissionResults } from '../sim/world';
import { GRADE_TITLE } from '../ui/copy';
import { formatClock, formatScore, formatSigned, shareLine } from '../ui/format';
import { countUpValue } from '../ui/model';
import { UI_SOUND_REGISTRY_KEY, resolveUiSound, type UiSoundPort } from '../ui/sound';
import { TACMAP_BRIEFING, bakeTacticalMap } from '../ui/tacmap';
import { COLOR, css, textStyle } from '../ui/theme';
import { MEDAL_COLOR, MenuList, bindMenuKeys, createBackdrop, drawPanel, drawRule, gradeColor } from '../ui/widgets';
import { SCENES, type GameSceneData, type HangarSceneData, type ResultsSceneData } from './sceneKeys';

const LEDGER = { x: 150, y: 262, w: 1060, row: 54 } as const;
/** The ledger panel's bottom edge stays above the share line; long ledgers get tighter rows. */
const LEDGER_MAX_H = 772;
/** Panel height besides the rows: header, rules, TOTAL, CREDITS EARNED, padding. */
const LEDGER_CHROME_H = 260;
const STAMP = { x: 1530, y: 440 } as const;
const TICK_MS = 55;

interface LedgerLine {
  container: Phaser.GameObjects.Container;
  value: Phaser.GameObjects.Text;
  target: number;
  /** Signed display (+1,000 / −1,000) rather than a plain total. */
  signed: boolean;
  /** Appended to the value (" CR"). */
  suffix?: string;
  duration: number;
}

/**
 * Debrief: MISSION COMPLETE / FAILED, a ledger that counts up line by line, the total and the
 * credits earned, a grade stamp slamming in, then RETRY / HANGAR / TITLE / COPY RESULT. ENTER
 * skips the count. The mission is paid (and its best recorded) once, on first entry; coming back
 * from the hangar shows the finished ledger without paying again.
 */
export class ResultsScene extends Phaser.Scene {
  private sceneData!: ResultsSceneData;
  private uiSound!: UiSoundPort;
  private lines: LedgerLine[] = [];
  private lineIndex = 0;
  private lineElapsed = 0;
  private delay = 0;
  private done = false;
  private lastTick = 0;
  private menu!: MenuList;
  private stamp!: Phaser.GameObjects.Container;
  private feedback!: Phaser.GameObjects.Text;
  private leaving = false;
  private row: number = LEDGER.row;

  constructor() {
    super(SCENES.results);
  }

  create(data: ResultsSceneData): void {
    this.sceneData = data;
    this.uiSound = resolveUiSound(this.registry.get(UI_SOUND_REGISTRY_KEY));
    this.lines = [];
    this.lineIndex = 0;
    this.lineElapsed = 0;
    this.delay = 0.8;
    this.done = false;
    this.leaving = false;

    const r = data.results;
    const level = getLevel(data.levelId);
    const save = saveStoreFor(this.game);
    const revisit = save.awardFor(r) !== null;
    const award = save.recordMission(level.id, r);
    const won = r.outcome === 'victory';
    const { width } = this.scale;

    const mapKey = bakeTacticalMap(this, `tacmap-briefing-${level.id}`, level, 1040, 780, TACMAP_BRIEFING);
    createBackdrop(this, { mapKey, mapAlpha: 0.22, grid: 60, scanlines: 0.3, vignette: 0.9 });

    // Outcome banner.
    const outcomeColor = won ? COLOR.green : COLOR.red;
    const banner = this.add
      .text(width / 2, 118, won ? 'MISSION COMPLETE' : 'MISSION FAILED', textStyle({ size: 112, font: 'display', color: outcomeColor, glow: 22 }))
      .setOrigin(0.5);
    this.add
      .text(
        width / 2,
        202,
        `OPERATION ${level.name.toUpperCase()}   ·   ${DIFFICULTIES[r.difficulty ?? 'regular'].label}   ·   MISSION TIME ${formatClock(r.time)}   ·   PAR ${formatClock(level.parTime)}`,
        textStyle({ size: 24, color: COLOR.greenDim, glow: false, letterSpacing: 2 }),
      )
      .setOrigin(0.5);
    banner.setScale(1.8).setAlpha(0);
    this.tweens.add({ targets: banner, scale: 1, alpha: 1, duration: 450, ease: 'Expo.easeOut', delay: 150 });
    this.time.delayedCall(420, () => this.cameras.main.shake(180, 0.005));

    // Ledger.
    const panel = this.add.graphics();
    const rows = r.objectives.length + 4 + (r.bonusPoints > 0 ? 1 : 0) + award.challenges.length;
    this.row = Math.min(LEDGER.row, Math.floor((LEDGER_MAX_H - LEDGER_CHROME_H) / rows));
    const panelH = rows * this.row + LEDGER_CHROME_H;
    drawPanel(panel, LEDGER.x - 30, LEDGER.y - 24, LEDGER.w + 60, panelH, { fillAlpha: 0.82 });
    this.add.text(LEDGER.x, LEDGER.y - 6, 'DEBRIEF', textStyle({ size: 20, color: COLOR.greenDim, glow: false, letterSpacing: 3 }));
    drawRule(panel, LEDGER.x, LEDGER.y + 26, LEDGER.w);
    let y = LEDGER.y + 44;
    for (const o of r.objectives) {
      const icon = o.status === 'completed' ? '✔' : o.status === 'failed' ? '✖' : '–';
      const iconColor = o.status === 'completed' ? COLOR.green : o.status === 'failed' ? COLOR.red : COLOR.grey;
      this.addLine(y, icon, iconColor, o.title.toUpperCase(), o.primary ? 'PRIMARY' : 'OPTIONAL', o.points, false);
      y += this.row;
    }
    drawRule(panel, LEDGER.x, y + 4, LEDGER.w, COLOR.green, 0.2);
    y += 16;
    const chain = r.feats && r.feats.bestChain > 1 ? `BEST CHAIN ×${r.feats.bestChain}` : '';
    this.addLine(y, '✕', COLOR.green, `ENEMY KILLS × ${r.kills}`, chain, r.killPoints, true);
    y += this.row;
    if (r.bonusPoints > 0) {
      this.addLine(y, '★', COLOR.green, 'BONUSES', featsNote(r), r.bonusPoints, true);
      y += this.row;
    }
    this.addLine(y, '◷', COLOR.green, 'TIME BONUS', `${formatClock(r.time)} / PAR ${formatClock(level.parTime)}`, r.timeBonus, true);
    y += this.row;
    const lives = Math.round(r.livesBonus / SCORING.lifeBonus);
    this.addLine(y, '✈', COLOR.green, 'LIVES BONUS', `${lives} × ${formatScore(SCORING.lifeBonus)}`, r.livesBonus, true);
    y += this.row;
    this.addLine(y, '⚠', COLOR.red, 'FRIENDLY FIRE', '', -r.friendlyFirePenalty, true);
    y += this.row;
    drawRule(panel, LEDGER.x, y + 6, LEDGER.w, COLOR.green, 0.5);
    y += 22;
    this.addTotal(y, r, award);
    y += 82;
    // Challenges completed for the first time: each pays its bounty into CREDITS EARNED below.
    for (const challenge of award.challenges) {
      this.addChallenge(y, challenge);
      y += this.row;
    }
    this.addCredits(y, award, r.grade);

    this.stamp = this.buildStamp(r);
    this.buildMenu(level.name, r);

    this.cameras.main.fadeIn(400, 0, 0, 0);
    bindMenuKeys(this, {
      up: () => this.menu.move(-1),
      down: () => this.menu.move(1),
      confirm: () => (this.done ? this.menu.confirm() : this.skip()),
      actions: { mute: () => audioSettingsFor(this.game).toggleAll() },
    });
    if (revisit) this.skip();
  }

  override update(time: number, delta: number): void {
    if (this.done) return;
    const dt = Math.min(0.1, delta / 1000);
    if (this.delay > 0) {
      this.delay -= dt;
      return;
    }
    const line = this.lines[this.lineIndex];
    if (!line) {
      this.finish(true);
      return;
    }
    if (this.lineElapsed === 0) this.showLine(line);
    this.lineElapsed += dt;
    this.setValue(line, countUpValue(line.target, this.lineElapsed, line.duration));
    if (line.target !== 0 && time - this.lastTick >= TICK_MS && this.lineElapsed < line.duration) {
      this.lastTick = time;
      this.uiSound.tick();
    }
    if (this.lineElapsed >= line.duration) {
      this.lineIndex++;
      this.lineElapsed = 0;
      this.delay = 0.1;
    }
  }

  // --- Ledger ----------------------------------------------------------------

  private addLine(y: number, icon: string, iconColor: number, label: string, note: string, points: number, signed: boolean): void {
    const iconText = this.add.text(0, 0, icon, textStyle({ size: 24, color: iconColor, glow: 6 })).setOrigin(0.5, 0);
    const labelText = this.add.text(34, 0, label, textStyle({ size: 25, color: COLOR.white, glow: false }));
    const noteText = this.add.text(LEDGER.w - 250, 3, note, textStyle({ size: 19, color: COLOR.greenDim, glow: false })).setOrigin(1, 0);
    const value = this.add.text(LEDGER.w, 0, '', textStyle({ size: 28, color: COLOR.green })).setOrigin(1, 0);
    const container = this.add.container(LEDGER.x + 12, y, [iconText, labelText, noteText, value]).setAlpha(0);
    const duration = points === 0 ? 0.15 : Math.min(0.7, 0.3 + Math.abs(points) / 20000);
    const line: LedgerLine = { container, value, target: points, signed, duration };
    this.setValue(line, 0);
    this.lines.push(line);
  }

  private addTotal(y: number, r: MissionResults, award: MissionAward): void {
    const label = this.add.text(-12, 2, 'TOTAL', textStyle({ size: 40, font: 'display', color: COLOR.greenBright, glow: 12 }));
    const value = this.add.text(LEDGER.w + 28, -14, '0', textStyle({ size: 56, color: COLOR.greenBright, glow: 16 })).setOrigin(1, 0);
    const parts: Phaser.GameObjects.GameObject[] = [label, value];
    // Beat a previous best on this level (the first run is trivially a best; say nothing).
    if (award.newBestScore && award.previous) {
      parts.push(this.add.text(170, 12, `NEW BEST  ·  WAS ${formatScore(award.previous.bestScore)}`, textStyle({ size: 20, color: COLOR.amber, glow: 6 })));
    }
    const container = this.add.container(LEDGER.x, y, parts).setAlpha(0);
    this.lines.push({ container, value, target: r.total, signed: false, duration: 1.1 });
  }

  /** "◆ CHALLENGE · CHAIN 10   Build a 10-kill chain   +600 CR". */
  private addChallenge(y: number, challenge: Challenge): void {
    const icon = this.add.text(0, 0, '◆', textStyle({ size: 24, color: MEDAL_COLOR, glow: 8 })).setOrigin(0.5, 0);
    const label = this.add.text(34, 0, `CHALLENGE · ${challenge.title}`, textStyle({ size: 25, color: MEDAL_COLOR, glow: 4 }));
    const note = this.add.text(LEDGER.w - 250, 3, challenge.description.toUpperCase(), textStyle({ size: 19, color: COLOR.amberDim, glow: false })).setOrigin(1, 0);
    const value = this.add.text(LEDGER.w, 0, '', textStyle({ size: 28, color: MEDAL_COLOR, glow: 8 })).setOrigin(1, 0);
    const container = this.add.container(LEDGER.x + 12, y, [icon, label, note, value]).setAlpha(0);
    const line: LedgerLine = { container, value, target: CHALLENGE_BOUNTY, signed: true, suffix: ' CR', duration: 0.4 };
    this.setValue(line, 0);
    this.lines.push(line);
  }

  /**
   * "CREDITS EARNED  SORTIE 150 · SCORE 2,200 · GRADE A 400   +3,350 CR". The value includes the
   * challenge bounties listed just above (the note has no room for them).
   */
  private addCredits(y: number, award: MissionAward, grade: string): void {
    const c = award.credits;
    const icon = this.add.text(0, 0, '◆', textStyle({ size: 24, color: COLOR.amber, glow: 6 })).setOrigin(0.5, 0);
    const label = this.add.text(34, 0, 'CREDITS EARNED', textStyle({ size: 25, color: COLOR.amber, glow: false }));
    const parts = [`SORTIE ${formatScore(c.sortie)}`, `SCORE ${formatScore(c.score)}`];
    if (c.grade > 0) parts.push(`GRADE ${grade} ${formatScore(c.grade)}`);
    const note = this.add.text(LEDGER.w - 250, 3, parts.join('  ·  '), textStyle({ size: 19, color: COLOR.amberDim, glow: false })).setOrigin(1, 0);
    const value = this.add.text(LEDGER.w, 0, '', textStyle({ size: 30, color: COLOR.amber, glow: 10 })).setOrigin(1, 0);
    const container = this.add.container(LEDGER.x + 12, y, [icon, label, note, value]).setAlpha(0);
    const line: LedgerLine = { container, value, target: award.totalCredits, signed: true, suffix: ' CR', duration: 0.6 };
    this.setValue(line, 0);
    this.lines.push(line);
  }

  private showLine(line: LedgerLine): void {
    const x = line.container.x;
    // Remembered so a skip mid-slide can put the line back in place.
    line.container.setData('homeX', x);
    line.container.setAlpha(0).setX(x - 30);
    this.tweens.add({ targets: line.container, alpha: 1, x, duration: 180, ease: 'Cubic.easeOut' });
  }

  private setValue(line: LedgerLine, value: number): void {
    const text = (line.signed ? formatSigned(value) : formatScore(value)) + (line.suffix ?? '');
    if (line.value.text === text) return;
    line.value.setText(text);
    if (line.signed && line.target < 0) line.value.setColor(css(COLOR.red)).setShadowColor(css(COLOR.red));
    else if (line.target === 0 && line.signed) line.value.setColor(css(COLOR.greenDim));
  }

  /** ENTER during the count: jump to the end. */
  private skip(): void {
    for (const line of this.lines) {
      this.tweens.killTweensOf(line.container);
      const homeX: unknown = line.container.getData('homeX');
      if (typeof homeX === 'number') line.container.setX(homeX);
      line.container.setAlpha(1);
      this.setValue(line, line.target);
    }
    this.finish(false);
  }

  private finish(animated: boolean): void {
    if (this.done) return;
    this.done = true;
    this.stampIn(animated);
    this.menu.container.setVisible(true);
    this.tweens.add({ targets: this.menu.container, alpha: 1, duration: 300, delay: animated ? 650 : 0 });
    this.time.delayedCall(animated ? 650 : 0, () => {
      this.menu.enabled = true;
    });
  }

  // --- Grade stamp -----------------------------------------------------------

  private buildStamp(r: MissionResults): Phaser.GameObjects.Container {
    const color = gradeColor(r.grade);
    const g = this.add.graphics();
    const size = 300;
    g.fillStyle(color, 0.1);
    g.fillRect(-size / 2, -size / 2, size, size);
    g.lineStyle(10, color, 1);
    g.strokeRect(-size / 2, -size / 2, size, size);
    g.lineStyle(3, color, 0.7);
    g.strokeRect(-size / 2 + 16, -size / 2 + 16, size - 32, size - 32);
    const letter = this.add.text(0, 6, r.grade, textStyle({ size: 250, font: 'display', color, glow: 24 })).setOrigin(0.5);
    const label = this.add.text(0, -size / 2 - 44, 'GRADE', textStyle({ size: 28, color: COLOR.greenDim, glow: false, letterSpacing: 8 })).setOrigin(0.5);
    const title = this.add.text(0, size / 2 + 24, GRADE_TITLE[r.grade] ?? '', textStyle({ size: 30, color, glow: 10 })).setOrigin(0.5, 0);
    const stamp = this.add.container(STAMP.x, STAMP.y, [g, letter]).setAlpha(0);
    const frame = this.add.container(STAMP.x, STAMP.y, [label, title]).setAlpha(0);
    stamp.setData('frame', frame);
    return stamp;
  }

  private stampIn(animated: boolean): void {
    const frame = this.stamp.getData('frame') as Phaser.GameObjects.Container;
    const rotation = Phaser.Math.DegToRad(-9);
    if (!animated) {
      this.stamp.setAlpha(1).setScale(1).setRotation(rotation);
      frame.setAlpha(1);
      return;
    }
    this.stamp.setScale(3.2).setRotation(rotation - 0.4);
    this.tweens.add({
      targets: this.stamp,
      scale: 1,
      alpha: 1,
      rotation,
      duration: 260,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.cameras.main.shake(260, 0.012);
        this.cameras.main.flash(160, 255, 255, 255);
        this.uiSound.confirm();
        this.tweens.add({ targets: frame, alpha: 1, duration: 300 });
      },
    });
  }

  // --- Menu --------------------------------------------------------------------

  private buildMenu(levelName: string, r: MissionResults): void {
    const line = shareLine(levelName, r);
    this.menu = new MenuList(this, ['RETRY', 'HANGAR', 'TITLE', 'COPY RESULT'], {
      x: 1320,
      y: 770,
      width: 440,
      spacing: 60,
      fontSize: 32,
      sound: this.uiSound,
      onConfirm: (i) => {
        if (i === 0) this.retry();
        else if (i === 1) this.toHangar();
        else if (i === 2) this.toTitle();
        else void this.copy(line);
      },
    });
    this.menu.enabled = false;
    this.menu.container.setAlpha(0);
    this.feedback = this.add.text(1320 + 28, 770 + 3 * 60 + 46, '', textStyle({ size: 20, color: COLOR.green })).setOrigin(0, 0.5);
    const { width, height } = this.scale;
    this.add.text(width / 2, height - 44, line, textStyle({ size: 20, color: COLOR.greenDim, glow: false })).setOrigin(0.5);
  }

  private async copy(line: string): Promise<void> {
    let ok = false;
    try {
      await navigator.clipboard.writeText(line);
      ok = true;
    } catch {
      ok = legacyCopy(line);
    }
    // The clipboard promise can resolve after the player has left this screen.
    if (!this.sys.isActive() || !this.feedback.active) return;
    this.feedback.setText(ok ? 'COPIED! ✔' : 'COPY BLOCKED — SEE BELOW');
    this.feedback.setColor(css(ok ? COLOR.green : COLOR.amber)).setShadowColor(css(ok ? COLOR.green : COLOR.amber));
    this.feedback.setAlpha(1);
    this.tweens.killTweensOf(this.feedback);
    this.tweens.add({ targets: this.feedback, alpha: 0, delay: 2200, duration: 500 });
  }

  private retry(): void {
    if (this.leaving) return;
    this.leaving = true;
    const next: GameSceneData = { levelId: this.sceneData.levelId };
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(SCENES.game, next));
  }

  private toHangar(): void {
    if (this.leaving) return;
    this.leaving = true;
    const next: HangarSceneData = { returnTo: this.sceneData };
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(SCENES.hangar, next));
  }

  private toTitle(): void {
    if (this.leaving) return;
    this.leaving = true;
    // The victory/defeat sting played on the results screen; the title theme starts on leaving.
    new MusicManager(this).playTitle();
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(SCENES.title));
  }
}

/** Clipboard fallback for browsers/contexts without the async Clipboard API. */
function legacyCopy(text: string): boolean {
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** "2 NESTS · 3 SAMS BEATEN" — what earned the bonus line. */
function featsNote(r: MissionResults): string {
  const f = r.feats;
  if (!f) return '';
  const parts: string[] = [];
  if (f.zonesCleared > 0) parts.push(`${f.zonesCleared} NEST${f.zonesCleared === 1 ? '' : 'S'}`);
  if (f.missilesDefeated > 0) parts.push(`${f.missilesDefeated} SAM${f.missilesDefeated === 1 ? '' : 'S'} BEATEN`);
  return parts.join(' · ');
}
