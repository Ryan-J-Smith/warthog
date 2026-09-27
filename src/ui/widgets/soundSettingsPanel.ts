import Phaser from 'phaser';
import { AUDIO_CHANNELS, VOLUME_STEP, type AudioChannel, type AudioSettingsPort, type UiSoundPort } from '../sound';
import { COLOR, css, textStyle } from '../theme';
import { fillChamfer } from './panel';

export interface SoundSettingsPanelOptions {
  x: number;
  /** Centre of the first row. */
  y: number;
  width: number;
  rowHeight: number;
  fontSize: number;
  sound: UiSoundPort;
  /** A row asked for keyboard focus (pointer hover or click). */
  onFocusRequest?: (row: number) => void;
}

const LABEL: Record<AudioChannel, string> = { music: 'MUSIC', sfx: 'SOUND FX' };
const SEGMENTS = Math.round(1 / VOLUME_STEP);
const SPEAKER_X = 40;
const LABEL_X = 76;
const SEG_X = 200;
const SEG_W = 17;
const SEG_GAP = 4;
const SEG_H = 22;

interface Row {
  channel: AudioChannel;
  bar: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  segments: Phaser.GameObjects.Graphics;
  value: Phaser.GameObjects.Text;
}

/**
 * Sound settings rows (MUSIC, SOUND FX): a speaker button that toggles mute and a 10-step volume
 * bar. Click the speaker or label to mute, click a step to set the volume. Keyboard focus is
 * driven by the owning scene (see `MenuFocus`): ←/→ change the focused row's volume, ENTER mutes.
 */
export class SoundSettingsPanel {
  readonly container: Phaser.GameObjects.Container;
  private readonly rowsUi: Row[];
  private focused: number | null = null;

  constructor(
    scene: Phaser.Scene,
    private readonly settings: AudioSettingsPort,
    private readonly options: SoundSettingsPanelOptions,
  ) {
    const { width, rowHeight, fontSize } = options;
    const barH = rowHeight - 8;
    const children: Phaser.GameObjects.GameObject[] = [];

    this.rowsUi = AUDIO_CHANNELS.map((channel, i) => {
      const y = i * rowHeight;
      const bar = scene.add.graphics().setVisible(false);
      bar.fillStyle(COLOR.green, 0.16);
      fillChamfer(bar, 0, y - barH / 2, width, barH, 10);
      bar.fillStyle(COLOR.green, 0.95);
      bar.fillRect(0, y - barH / 2, 5, barH);
      const icon = scene.add.graphics();
      const label = scene.add.text(LABEL_X, y, LABEL[channel], textStyle({ size: fontSize, color: COLOR.greenDim, glow: false })).setOrigin(0, 0.5);
      const segments = scene.add.graphics();
      const value = scene.add.text(width - 14, y, '', textStyle({ size: Math.round(fontSize * 0.8), color: COLOR.greenDim, glow: false })).setOrigin(1, 0.5);
      children.push(bar, icon, label, segments, value);

      // Pointer: speaker + label toggle mute; each step sets the volume.
      const muteZone = scene.add.zone(8, y - barH / 2, SEG_X - 16, barH).setOrigin(0).setInteractive({ useHandCursor: true });
      muteZone.on(Phaser.Input.Events.POINTER_OVER, () => this.requestFocus(i));
      muteZone.on(Phaser.Input.Events.POINTER_DOWN, () => {
        this.requestFocus(i);
        this.toggle();
      });
      children.push(muteZone);
      for (let s = 0; s < SEGMENTS; s++) {
        const zone = scene.add
          .zone(SEG_X + s * (SEG_W + SEG_GAP) - SEG_GAP / 2, y - barH / 2, SEG_W + SEG_GAP, barH)
          .setOrigin(0)
          .setInteractive({ useHandCursor: true });
        zone.on(Phaser.Input.Events.POINTER_OVER, () => this.requestFocus(i));
        zone.on(Phaser.Input.Events.POINTER_DOWN, () => {
          this.requestFocus(i);
          this.settings.setMuted(channel, false);
          this.settings.setVolume(channel, (s + 1) * VOLUME_STEP);
          this.options.sound.move();
        });
        children.push(zone);
      }
      return { channel, bar, icon, label, segments, value };
    });

    this.container = scene.add.container(options.x, options.y, children);
    this.redraw();
    const unsubscribe = settings.subscribe(() => this.redraw());
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
  }

  get rows(): number {
    return this.rowsUi.length;
  }

  /** The row with keyboard focus, or null. */
  get focusedRow(): number | null {
    return this.focused;
  }

  focus(row: number | null, withSound = false): void {
    if (row === this.focused) return;
    this.focused = row;
    if (withSound && row !== null) this.options.sound.move();
    this.redraw();
  }

  /** Change the focused row's volume by `steps` (raising it also unmutes). */
  adjust(steps: number): void {
    const row = this.focused === null ? undefined : this.rowsUi[this.focused];
    if (!row) return;
    const { channel } = row;
    if (steps > 0) this.settings.setMuted(channel, false);
    this.settings.setVolume(channel, this.settings.volume(channel) + steps * VOLUME_STEP);
    this.options.sound.move();
  }

  /** Toggle mute on the focused row. */
  toggle(): void {
    const row = this.focused === null ? undefined : this.rowsUi[this.focused];
    if (!row) return;
    this.settings.setMuted(row.channel, !this.settings.muted(row.channel));
    this.options.sound.confirm();
  }

  private requestFocus(row: number): void {
    if (this.focused !== row) this.options.onFocusRequest?.(row);
  }

  private redraw(): void {
    const { rowHeight } = this.options;
    this.rowsUi.forEach((row, i) => {
      const y = i * rowHeight;
      const on = this.focused === i;
      const muted = this.settings.muted(row.channel);
      const volume = this.settings.volume(row.channel);
      const lit = Math.round(volume * SEGMENTS);
      const main = muted ? COLOR.greyDim : on ? COLOR.greenBright : COLOR.green;

      row.bar.setVisible(on);
      row.label.setColor(css(on ? COLOR.greenBright : COLOR.greenDim));
      row.value.setText(muted ? 'MUTED' : `${Math.round(volume * 100)}%`).setColor(css(muted ? COLOR.red : COLOR.greenDim));
      drawSpeaker(row.icon, SPEAKER_X, y, muted, main);

      const g = row.segments;
      g.clear();
      for (let s = 0; s < SEGMENTS; s++) {
        const x = SEG_X + s * (SEG_W + SEG_GAP);
        if (s < lit) {
          g.fillStyle(main, muted ? 0.6 : 0.95);
          g.fillRect(x, y - SEG_H / 2, SEG_W, SEG_H);
        } else {
          g.lineStyle(1.5, COLOR.greenFaint, 1);
          g.strokeRect(x + 0.75, y - SEG_H / 2 + 0.75, SEG_W - 1.5, SEG_H - 1.5);
        }
      }
    });
  }
}

/** A speaker glyph centred on (x, y): sound waves when on, a red X when muted. */
function drawSpeaker(g: Phaser.GameObjects.Graphics, x: number, y: number, muted: boolean, color: number): void {
  g.clear();
  g.fillStyle(color, 1);
  g.fillRect(x - 16, y - 6, 8, 12);
  g.fillPoints(
    [
      { x: x - 9, y: y - 6 },
      { x: x + 1, y: y - 14 },
      { x: x + 1, y: y + 14 },
      { x: x - 9, y: y + 6 },
    ],
    true,
  );
  if (muted) {
    g.lineStyle(3, COLOR.red, 1);
    g.lineBetween(x + 6, y - 7, x + 18, y + 7);
    g.lineBetween(x + 6, y + 7, x + 18, y - 7);
    return;
  }
  g.lineStyle(2.5, color, 1);
  for (const r of [8, 14]) {
    g.beginPath();
    g.arc(x + 1, y, r, -0.75, 0.75);
    g.strokePath();
  }
}
