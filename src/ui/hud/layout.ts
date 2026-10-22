/** HUD layout on the 1920 × 1080 canvas. */
export const SCREEN = { width: 1920, height: 1080 } as const;
export const MARGIN = 28;

export const LAYOUT = {
  objectives: { x: MARGIN, y: MARGIN, w: 540 },
  strip: { cx: SCREEN.width / 2, y: MARGIN, w: 470, h: 74 },
  rtb: { cy: 136 },
  warnings: { cy: 196 },
  banner: { cy: 340 },
  center: { cy: 470 },
  rearm: { cy: 770 },
  minimap: { w: 384, h: 288, x: SCREEN.width - MARGIN - 384, y: MARGIN },
  ladder: { x: MARGIN, y: 372, w: 300, h: 400 },
  armor: { x: MARGIN, y: SCREEN.height - MARGIN - 168, w: 400, h: 168 },
  combo: { x: SCREEN.width - MARGIN - 486, y: SCREEN.height - MARGIN - 134 - 18 - 92, w: 486, h: 92 },
  weapons: { cy: SCREEN.height - MARGIN - 50, slotW: 176, flareW: 124, h: 100, gap: 8 },
  toast: { cy: SCREEN.height - MARGIN - 100 - 34 },
  radio: { w: 486, h: 134, x: SCREEN.width - MARGIN - 486, y: SCREEN.height - MARGIN - 134 },
  /** Off-screen arrows ride an ellipse set low enough to clear the warnings and the ladder. */
  arrows: { cx: SCREEN.width / 2, cy: 580, rx: 600, ry: 300, margin: 60 },
} as const;
