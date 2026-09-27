/** Colours for the desert-steppe biome. Shared by the terrain model and painter. */
export const TERRAIN_COLORS = {
  // ground (macro colour field endpoints)
  sand: [196, 178, 132],
  sandLight: [210, 194, 150],
  dryGrass: [170, 158, 104],
  steppe: [150, 148, 92],
  greenSteppe: [128, 136, 80],
  rocky: [184, 170, 138],
  /** Average ground colour (backdrop outside the map, camera background). */
  average: [174, 160, 112],


  // water
  waterShallow: '#6b9690',
  waterMid: '#4f8084',
  waterDeep: '#3d6d77',
  waterCore: '#335f6c',
  bankWet: '#857553',
  bankSand: '#b7a57b',
  riparian: 'rgba(104, 116, 58, 0.55)',
  floodplain: 'rgba(98, 112, 56, 0.16)',

  // roads
  dirtRoad: '#bfab80',
  dirtRoadEdge: '#9a8660',
  dirtRut: 'rgba(118, 100, 66, 0.5)',
  verge: 'rgba(96, 86, 52, 0.22)',
  asphalt: '#5b5a55',
  asphaltEdge: '#a39a80',
  roadLine: 'rgba(222, 216, 196, 0.62)',
  roadDash: 'rgba(226, 206, 130, 0.85)',

  // fields: [base, stripe, edge]
  wheat: ['#c6ad62', '#a98f47', '#d8c17a'],
  green: ['#86954c', '#6c7c3a', '#99a85c'],
  plowed: ['#7f6446', '#634c34', '#8e7352'],
  hedge: 'rgba(92, 102, 52, 0.55)',

  // trees: canopy families [dark, mid, light]
  canopies: [
    ['#34431f', '#4f6128', '#7c8c42'],
    ['#2f3d22', '#465a2c', '#6f8545'],
    ['#3f4820', '#5f6a2a', '#8e9346'],
  ],
  treeShadow: 'rgba(38, 32, 14, 0.42)',

  // villages
  roofs: ['#a4583c', '#b0674a', '#8c7c6a', '#7a756c', '#9c8f7a', '#b58d5c'],
  garden: '#7e8c46',
  buildingShadow: 'rgba(34, 28, 12, 0.45)',

  // decor
  rockLight: '#c4b594',
  rock: '#9a8b6c',
  rockDark: '#6f6552',
  scrub: '#5d6634',
  scrubDark: '#46502a',
} as const;

/** out = a + (b - a) * t, per RGB channel. */
export function mixRgb(a: ArrayLike<number>, b: ArrayLike<number>, t: number, out: number[]): void {
  for (let i = 0; i < 3; i++) {
    const av = a[i] ?? 0;
    out[i] = av + ((b[i] ?? 0) - av) * t;
  }
}
