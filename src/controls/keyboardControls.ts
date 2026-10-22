import Phaser from 'phaser';
import { KEYS, type KeyAction } from '../config';
import type { ControlInput } from '../sim/input';

type KeyMap = Record<KeyAction, Phaser.Input.Keyboard.Key[]>;

/**
 * Reads the keyboard into a `ControlInput` each frame.
 * Held actions poll key state; edge actions (climb, weapon select, …) are buffered from
 * keydown events so a tap shorter than a frame is never lost.
 */
export class KeyboardControls {
  private readonly keys: KeyMap;
  private readonly actionsByCode = new Map<number, KeyAction[]>();
  private readonly presses = new Set<KeyAction>();
  private readonly keyboard: Phaser.Input.Keyboard.KeyboardPlugin;
  private readonly game: Phaser.Game;
  /**
   * Release everything when the window loses focus (otherwise a key released in another window
   * stays "down"). We register our own listener because Phaser's KeyboardPlugin removes all scenes'
   * blur handlers when any one scene's keyboard shuts down (e.g. the Pause scene on resume).
   */
  private readonly onBlur = (): void => this.reset();
  private readonly handled = new WeakSet<KeyboardEvent>();
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat || this.handled.has(event)) return;
    this.handled.add(event);
    for (const action of this.actionsByCode.get(event.keyCode) ?? []) this.presses.add(action);
  };

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input is unavailable');
    this.keyboard = keyboard;
    const codes = Phaser.Input.Keyboard.KeyCodes as unknown as Record<string, number>;
    const map = {} as KeyMap;
    for (const action of Object.keys(KEYS) as KeyAction[]) {
      map[action] = KEYS[action].map((name) => {
        const code = codes[name];
        if (code === undefined) throw new Error(`Unknown key ${name}`);
        this.actionsByCode.set(code, [...(this.actionsByCode.get(code) ?? []), action]);
        return keyboard.addKey(code, true, false);
      });
    }
    this.keys = map;
    keyboard.on(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.onKeyDown);
    this.game = scene.game;
    this.game.events.on(Phaser.Core.Events.BLUR, this.onBlur);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  read(): ControlInput {
    const turn = (this.down('turnRight') ? 1 : 0) - (this.down('turnLeft') ? 1 : 0);
    const input: ControlInput = {
      turn,
      fire: this.down('fire'),
      boost: this.down('boost'),
      brake: this.down('brake'),
      climb: this.pressed('climb'),
      dive: this.pressed('dive'),
      flare: this.pressed('flare'),
      select: null,
      ready: this.pressed('ready'),
    };
    if (this.pressed('weaponGun')) input.select = 'gun';
    if (this.pressed('weaponRockets')) input.select = 'rockets';
    if (this.pressed('weaponMaverick')) input.select = 'maverick';
    if (this.pressed('weaponBombs')) input.select = 'bombs';
    return input;
  }

  /** Was this action pressed since it was last checked? Consumes the press. */
  pressed(action: KeyAction): boolean {
    const was = this.presses.has(action);
    this.presses.delete(action);
    return was;
  }

  down(action: KeyAction): boolean {
    return this.keys[action].some((k) => k.isDown);
  }

  /** Forget buffered presses and release all keys (e.g. after un-pausing). */
  reset(): void {
    this.presses.clear();
    for (const keys of Object.values(this.keys)) for (const k of keys) k.reset();
  }

  destroy(): void {
    this.keyboard.off(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.onKeyDown);
    this.game.events.off(Phaser.Core.Events.BLUR, this.onBlur);
  }
}
