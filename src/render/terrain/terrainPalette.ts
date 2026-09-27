/**
 * Colours for the lush green countryside biome (art direction v1, "chunky toy arcade").
 * Shared by the terrain model and painter.
 *
 * The ground sits in a calm, mid-value green band on purpose: dark crimson enemy armour and white
 * friendly armour both separate from it by VALUE (not just hue), so units pop at every zoom and
 * for colour-blind players too. Everything else (fields, roads, river) is bright and flat.
 */
export const TERRAIN_COLORS = {
  // Ground macro colour field endpoints (RGB). Only large, soft variation between these.
  grass: [104, 182, 72],
  grassLight: [118, 192, 80],
  grassDark: [92, 170, 66],
  /** Near water and woods: a touch deeper and cooler. */
  grassLush: [82, 166, 72],
  /** Hilltops: slightly warmer and lighter. */
  grassHigh: [134, 196, 84],
  /** Average ground colour (backdrop outside the map, camera background). */
  average: [104, 182, 72],

  forestFloor: 'rgba(34, 104, 44, 0.6)',
  /** Trampled ground around structures and in village yards. */
  worn: 'rgba(214, 206, 138, 0.62)',

  // Hill shading (the model's shade overlay): cool dark-green shadows, warm light tops.
  hillShadow: [22, 84, 34] as const,
  hillLight: [236, 255, 176] as const,
  contour: 'rgba(30, 100, 40, 0.16)',

  // Water.
  waterShallow: '#6fc6f2',
  water: '#3f9ee4',
  waterDeep: '#2d86d4',
  foam: 'rgba(255, 255, 255, 0.7)',
  flow: 'rgba(255, 255, 255, 0.32)',
  bank: '#ecdfa4',
  bankEdge: '#b79f5d',
  riparian: 'rgba(40, 136, 56, 0.32)',

  // Roads: light, flat, clean edges.
  dirtRoad: '#ecd69e',
  dirtRoadEdge: '#b69758',
  paved: '#aeb3ba',
  pavedEdge: '#6a707a',
  roadDash: 'rgba(255, 255, 255, 0.95)',
  track: '#e4d29e',
  trackEdge: '#bba26a',

  // Fields: [base, row stripe, inner edge highlight].
  wheat: ['#f2cf58', '#ddb640', '#fbe488'],
  green: ['#a4dc64', '#8cc852', '#c0ea88'],
  plowed: ['#bb8452', '#a26c40', '#d09a68'],
  hedge: '#2f8636',
  hedgeDark: '#1f5c27',

  // Lollipop trees: families of [outline, shade, base, highlight].
  canopies: [
    ['#1a4a22', '#2d7d36', '#3c9d42', '#78cf5c'],
    ['#194630', '#287447', '#359358', '#6fc684'],
    ['#284d1c', '#4a8a2c', '#5caa36', '#98d85a'],
  ],
  treeShadow: 'rgba(14, 58, 22, 0.5)',

  // Villages: cute red roofs.
  roofs: ['#e2573f', '#d8483c', '#ec6c44', '#cc4636', '#ea7a4c'],
  roofEdge: '#4a1c1a',
  chimney: '#8a8f9a',
  garden: '#8fd462',
  gardenRow: 'rgba(40, 120, 44, 0.5)',
  buildingShadow: 'rgba(14, 56, 22, 0.42)',

  // Battle scars.
  craterRim: '#caa86c',
  crater: '#8c6640',
  craterDark: '#5e4128',
  trackMark: 'rgba(58, 120, 44, 0.35)',
} as const;

/** out = a + (b - a) * t, per RGB channel. */
export function mixRgb(a: ArrayLike<number>, b: ArrayLike<number>, t: number, out: number[]): void {
  for (let i = 0; i < 3; i++) {
    const av = a[i] ?? 0;
    out[i] = av + ((b[i] ?? 0) - av) * t;
  }
}
