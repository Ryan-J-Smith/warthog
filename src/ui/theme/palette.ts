/**
 * WARTHOG UI palette: military avionics. Phosphor green on dark translucent glass, amber for
 * caution, red for danger, blue for friendlies (matches the world-space objective markers).
 */
export const COLOR = {
  /** Primary HUD phosphor. Same hue as the in-world reticle. */
  green: 0x9dff7a,
  greenBright: 0xd4ffc4,
  greenDim: 0x5c9a4a,
  greenFaint: 0x2e5a2a,
  amber: 0xffb627,
  amberDim: 0x8a6420,
  red: 0xff3b30,
  redDim: 0x7a1f1a,
  blue: 0x5ab0ff,
  blueDim: 0x2a5578,
  white: 0xeaf6e4,
  grey: 0x7a857a,
  greyDim: 0x3c443c,
  /** Panel glass. */
  panel: 0x050d08,
  black: 0x000000,
} as const;

export type ColorName = keyof typeof COLOR;

/** `0x9dff7a` → `'#9dff7a'` for Phaser text styles. */
export function css(color: number): string {
  return `#${(color & 0xffffff).toString(16).padStart(6, '0')}`;
}

/** Panel glass opacity for HUD panels drawn over the game. */
export const PANEL_ALPHA = 0.62;
