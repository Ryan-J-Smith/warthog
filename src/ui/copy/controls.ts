import { KEYS, type KeyAction } from '../../config';

const KEY_GLYPH: Record<string, string> = {
  LEFT: '←',
  RIGHT: '→',
  UP: '↑',
  DOWN: '↓',
  SHIFT: 'SHIFT',
  ONE: '1',
  TWO: '2',
  THREE: '3',
  FOUR: '4',
};

/** Phaser key name → what's printed on the keycap ("LEFT" → "←", "ONE" → "1"). */
export function keyLabel(name: string): string {
  return KEY_GLYPH[name] ?? name;
}

/** All keys bound to an action: "ESC / P". */
export function actionKeys(action: KeyAction): string {
  return KEYS[action].map(keyLabel).join(' / ');
}

/** Two opposing actions, zipped by alternative: "A/D  ←/→". */
export function pairedKeys(a: KeyAction, b: KeyAction): string {
  const left = KEYS[a];
  const right = KEYS[b];
  const pairs: string[] = [];
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const l = left[i];
    const r = right[i];
    if (l !== undefined && r !== undefined) pairs.push(`${keyLabel(l)}/${keyLabel(r)}`);
  }
  return pairs.join('  ');
}

export interface ControlRow {
  keys: string;
  action: string;
}

/** The controls card, generated from the keybinding config so it never goes stale. */
export function controlRows(): ControlRow[] {
  const weaponKeys = (['weaponGun', 'weaponRockets', 'weaponMaverick', 'weaponBombs'] as const)
    .map((a) => KEYS[a].map(keyLabel).join('/'))
    .join(' ');
  return [
    { keys: pairedKeys('turnLeft', 'turnRight'), action: 'Turn' },
    { keys: pairedKeys('climb', 'dive'), action: 'Climb / dive one band' },
    { keys: `${actionKeys('fire')} (hold)`, action: 'Fire selected weapon' },
    { keys: `${actionKeys('boost')} (hold)`, action: 'Afterburner (meter)' },
    { keys: `${actionKeys('brake')} (hold)`, action: 'Air brake: slow, tight turns' },
    { keys: weaponKeys, action: 'Gun · Rockets · Maverick · Bombs' },
    { keys: actionKeys('flare'), action: 'Flares (decoy SAMs)' },
    { keys: actionKeys('pause'), action: 'Pause' },
    { keys: actionKeys('mute'), action: 'Mute all sound' },
  ];
}

/** One-line controls reminder for the briefing footer. */
export function controlsReminder(): string {
  return [
    `${pairedKeys('climb', 'dive').split('  ')[0] ?? ''} CLIMB/DIVE`,
    `${pairedKeys('turnLeft', 'turnRight').split('  ')[0] ?? ''} TURN`,
    `${actionKeys('fire')} FIRE`,
    `1-4 WEAPONS`,
    `${actionKeys('boost')} BOOST`,
    `${KEYS.brake[0] ?? 'E'} BRAKE`,
    `${actionKeys('flare')} FLARES`,
    `${KEYS.pause[0] ?? 'ESC'} PAUSE`,
  ].join('   ·   ');
}
