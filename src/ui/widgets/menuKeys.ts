import Phaser from 'phaser';
import { KEYS, type KeyAction } from '../../config';

export interface MenuKeyHandlers {
  up?: () => void;
  down?: () => void;
  left?: () => void;
  right?: () => void;
  confirm?: () => void;
  back?: () => void;
  /** Extra actions by key binding, e.g. `{ pause: resume }`. */
  actions?: Partial<Record<KeyAction, () => void>>;
}

type MenuKey = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back';

const MENU_BINDINGS: Record<MenuKey, KeyAction> = {
  up: 'climb',
  down: 'dive',
  left: 'turnLeft',
  right: 'turnRight',
  confirm: 'confirm',
  back: 'back',
};

/**
 * Keyboard navigation for menus, driven by the keybinding config (↑/↓/W/S move, ENTER/SPACE
 * confirm, ESC back). Unbinds itself when the scene shuts down; returns an unbind function.
 */
export function bindMenuKeys(scene: Phaser.Scene, handlers: MenuKeyHandlers): () => void {
  const keyboard = scene.input.keyboard;
  if (!keyboard) return () => {};
  const codes = Phaser.Input.Keyboard.KeyCodes as unknown as Record<string, number>;
  const byCode = new Map<number, Array<() => void>>();
  const add = (action: KeyAction, fn: (() => void) | undefined): void => {
    if (!fn) return;
    for (const name of KEYS[action]) {
      const code = codes[name];
      if (code === undefined) continue;
      byCode.set(code, [...(byCode.get(code) ?? []), fn]);
    }
  };
  for (const key of Object.keys(MENU_BINDINGS) as MenuKey[]) add(MENU_BINDINGS[key], handlers[key]);
  for (const [action, fn] of Object.entries(handlers.actions ?? {}) as Array<[KeyAction, () => void]>) add(action, fn);

  // Phaser can re-dispatch the same DOM event when several keys land in one frame; handle each once.
  const handled = new WeakSet<KeyboardEvent>();
  const onKey = (event: KeyboardEvent): void => {
    if (event.repeat || handled.has(event)) return;
    handled.add(event);
    const fns = byCode.get(event.keyCode);
    if (!fns) return;
    // One logical action per key press, even if a key is bound twice (ESC = back + pause).
    fns[0]?.();
  };
  keyboard.on(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, onKey);
  const unbind = (): void => {
    keyboard.off(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, onKey);
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, unbind);
  return unbind;
}
