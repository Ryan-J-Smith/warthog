/**
 * Keyboard bindings, as Phaser key names (`Phaser.Input.Keyboard.KeyCodes` member names).
 * Every action may have several keys.
 */
export const KEYS = {
  turnLeft: ['A', 'LEFT'],
  turnRight: ['D', 'RIGHT'],
  climb: ['W', 'UP'],
  dive: ['S', 'DOWN'],
  fire: ['SPACE'],
  weaponGun: ['ONE'],
  weaponRockets: ['TWO'],
  weaponMaverick: ['THREE'],
  weaponBombs: ['FOUR'],
  flare: ['Q'],
  pause: ['ESC', 'P'],
  mute: ['M'],
  confirm: ['ENTER', 'SPACE'],
  back: ['ESC'],
} as const;

export type KeyAction = keyof typeof KEYS;
