import type { TerrainDefinition } from '../../sim/level';

export type TerrainBiome = TerrainDefinition['biome'];

type Rgb = readonly [number, number, number];
/** [base, stripe, edge] */
type FieldColors = readonly [string, string, string];
/** Gradient stops [inner, mid, outer]. */
type Ramp3 = readonly [string, string, string];

/** Winter-only colours; their presence switches the painter's snow/ice branches on. */
export interface FrostColors {
  /** Snow lying on roofs, rocks and shrubs (lit / shaded). */
  snow: string;
  snowShade: string;
  /** Snow dusting on conifer canopies. */
  canopySnow: string;
  /** Frozen river: open-water lead, cracks (dark + lit lip), wind-blown snow on the ice. */
  openWater: string;
  iceCrack: string;
  iceCrackLit: string;
  iceSnow: string;
  /** Fence posts / rails around snow-covered fields and gardens. */
  fence: string;
  /** Ploughed snowbank along roads (lit side). */
  snowbank: string;
}

/**
 * Every colour the terrain model and painter use, per biome. Field names follow the steppe roles
 * (e.g. `sand` is the base ground tone; in winter it is the base snow tone).
 */
export interface TerrainPalette {
  // ground (macro colour field endpoints)
  sand: Rgb;
  sandLight: Rgb;
  dryGrass: Rgb;
  steppe: Rgb;
  greenSteppe: Rgb;
  rocky: Rgb;
  /** Average ground colour (backdrop outside the map, camera background). */
  average: Rgb;

  // hill shading: sunlit / shadowed tints and their alpha caps (0..255)
  shadeLight: Rgb;
  shadeLightMax: number;
  shadeDark: Rgb;
  shadeDarkMax: number;
  /** Ground texture strength: wind streaks, medium grain, fine grain (near LOD). */
  textureAlpha: readonly [number, number, number];
  forestFloor: Ramp3;
  /** Worn ground around structures / villages. */
  footprintWear: Ramp3;
  villageWear: readonly [string, string];
  contourShadow: string;
  contourLight: string;
  washBank: string;
  washBed: string;
  washLine: string;

  // water
  waterShallow: string;
  waterMid: string;
  waterDeep: string;
  waterCore: string;
  bankWet: string;
  bankSand: string;
  riparian: string;
  floodplain: string;
  bankShadow: string;
  shoreline: string;
  flowLight: string;
  flowDark: string;
  glint: string;
  reeds: string;

  // roads
  dirtRoad: string;
  dirtRoadEdge: string;
  dirtRut: string;
  dirtCentre: string;
  verge: string;
  villageTrackEdge: string;
  villageTrack: string;
  asphalt: string;
  asphaltEdge: string;
  asphaltSheen: string;
  roadLine: string;
  roadDash: string;

  // fields
  wheat: FieldColors;
  green: FieldColors;
  plowed: FieldColors;
  hedge: string;
  fieldEdge: string;

  // trees: canopy families [dark, mid, light]
  canopies: readonly FieldColors[];
  treeShadow: string;
  /** Opaque silhouette colour of the tree shadow sprites (drawn at reduced alpha). */
  treeShadowSprite: string;

  // villages
  roofs: readonly string[];
  garden: string;
  gardenRows: string;
  gardenEdge: string;
  buildingShadow: string;
  roofLit: string;
  roofShade: string;
  roofRidge: string;
  roofOutline: string;
  roofTiles: string;

  // decor
  rockLight: string;
  rock: string;
  rockDark: string;
  rockShadow: string;
  scrub: string;
  scrubDark: string;
  scrubHi: string;
  tufts: string;
  /** Scatter density multipliers, and the rock highlight (or snow cap) as [offset, rx, ry] × rock radius. */
  scatter: { scrubDensity: number; rockDensity: number; rockCap: readonly [number, number, number] };

  // battle scars
  trackMark: string;
  craterHalo: readonly [string, string];
  craterEjecta: string;
  craterBowl: readonly [string, string];

  /** Snow and ice extras (winter only). */
  frost: FrostColors | null;
}

/** Colours for the desert-steppe biome. Shared by the terrain model and painter. */
export const TERRAIN_COLORS: TerrainPalette = {
  // ground (macro colour field endpoints)
  sand: [196, 178, 132],
  sandLight: [210, 194, 150],
  dryGrass: [170, 158, 104],
  steppe: [150, 148, 92],
  greenSteppe: [128, 136, 80],
  rocky: [184, 170, 138],
  average: [174, 160, 112],

  shadeLight: [255, 244, 214],
  shadeLightMax: 190,
  shadeDark: [92, 74, 50],
  shadeDarkMax: 95,
  textureAlpha: [0.24, 0.4, 0.28],
  forestFloor: ['rgba(70, 76, 38, 0.62)', 'rgba(80, 86, 44, 0.38)', 'rgba(80, 86, 44, 0)'],
  footprintWear: ['rgba(190, 172, 128, 0.7)', 'rgba(186, 168, 124, 0.45)', 'rgba(186, 168, 124, 0)'],
  villageWear: ['rgba(192, 174, 130, 0.65)', 'rgba(192, 174, 130, 0)'],
  contourShadow: 'rgba(92, 72, 44, 0.26)',
  contourLight: 'rgba(255, 244, 214, 0.2)',
  washBank: 'rgba(96, 82, 52, 0.3)',
  washBed: 'rgba(222, 208, 170, 0.55)',
  washLine: 'rgba(150, 132, 92, 0.35)',

  // water
  waterShallow: '#6b9690',
  waterMid: '#4f8084',
  waterDeep: '#3d6d77',
  waterCore: '#335f6c',
  bankWet: '#857553',
  bankSand: '#b7a57b',
  riparian: 'rgba(104, 116, 58, 0.55)',
  floodplain: 'rgba(98, 112, 56, 0.16)',
  bankShadow: 'rgba(18, 38, 42, 0.32)',
  shoreline: 'rgba(214, 232, 220, 0.38)',
  flowLight: 'rgba(220, 238, 230, 0.26)',
  flowDark: 'rgba(30, 60, 66, 0.2)',
  glint: 'rgba(240, 250, 244, 0.55)',
  reeds: 'rgba(78, 92, 44, 0.8)',

  // roads
  dirtRoad: '#bfab80',
  dirtRoadEdge: '#9a8660',
  dirtRut: 'rgba(118, 100, 66, 0.5)',
  dirtCentre: 'rgba(120, 118, 70, 0.22)',
  verge: 'rgba(96, 86, 52, 0.22)',
  villageTrackEdge: 'rgba(160, 140, 100, 0.55)',
  villageTrack: 'rgba(196, 178, 136, 0.7)',
  asphalt: '#5b5a55',
  asphaltEdge: '#a39a80',
  asphaltSheen: 'rgba(255, 255, 255, 0.05)',
  roadLine: 'rgba(222, 216, 196, 0.62)',
  roadDash: 'rgba(226, 206, 130, 0.85)',

  // fields: [base, stripe, edge]
  wheat: ['#c6ad62', '#a98f47', '#d8c17a'],
  green: ['#86954c', '#6c7c3a', '#99a85c'],
  plowed: ['#7f6446', '#634c34', '#8e7352'],
  hedge: 'rgba(92, 102, 52, 0.55)',
  fieldEdge: 'rgba(70, 60, 36, 0.45)',

  // trees: canopy families [dark, mid, light]
  canopies: [
    ['#34431f', '#4f6128', '#7c8c42'],
    ['#2f3d22', '#465a2c', '#6f8545'],
    ['#3f4820', '#5f6a2a', '#8e9346'],
  ],
  treeShadow: 'rgba(38, 32, 14, 0.42)',
  treeShadowSprite: 'rgb(38, 32, 14)',

  // villages
  roofs: ['#a4583c', '#b0674a', '#8c7c6a', '#7a756c', '#9c8f7a', '#b58d5c'],
  garden: '#7e8c46',
  gardenRows: 'rgba(60, 70, 30, 0.6)',
  gardenEdge: 'rgba(214, 200, 166, 0.7)',
  buildingShadow: 'rgba(34, 28, 12, 0.45)',
  roofLit: 'rgba(255, 240, 210, 0.22)',
  roofShade: 'rgba(30, 20, 10, 0.22)',
  roofRidge: 'rgba(40, 26, 16, 0.55)',
  roofOutline: 'rgba(30, 22, 14, 0.75)',
  roofTiles: 'rgba(40, 26, 16, 0.18)',

  // decor
  rockLight: '#c4b594',
  rock: '#9a8b6c',
  rockDark: '#6f6552',
  rockShadow: 'rgba(40, 32, 18, 0.35)',
  scrub: '#5d6634',
  scrubDark: '#46502a',
  scrubHi: 'rgba(150, 156, 90, 0.5)',
  tufts: 'rgba(92, 96, 50, 0.45)',
  scatter: { scrubDensity: 1, rockDensity: 1, rockCap: [0.25, 0.55, 0.42] },

  // battle scars
  trackMark: 'rgba(70, 58, 36, 0.28)',
  craterHalo: ['rgba(46, 38, 26, 0.35)', 'rgba(46, 38, 26, 0)'],
  craterEjecta: 'rgba(206, 190, 150, 0.6)',
  craterBowl: ['rgba(60, 48, 32, 0.95)', 'rgba(150, 128, 92, 0.9)'],

  frost: null,
};

/**
 * Colours for the winter biome: an overcast, blue-grey snowfield (never pure white, so units,
 * threat rings and white SAM smoke still read), dark snow-dusted conifers, a frozen river, slushy
 * ploughed roads and snowed-over fields. Shadows are cool blue instead of warm brown.
 */
export const WINTER_COLORS: TerrainPalette = {
  sand: [170, 176, 184],
  sandLight: [182, 187, 194],
  dryGrass: [160, 166, 175],
  steppe: [150, 154, 158],
  greenSteppe: [155, 163, 173],
  rocky: [144, 142, 137],
  average: [166, 171, 179],

  shadeLight: [246, 250, 255],
  shadeLightMax: 70,
  shadeDark: [64, 80, 110],
  shadeDarkMax: 120,
  textureAlpha: [0.14, 0.26, 0.2],
  forestFloor: ['rgba(92, 102, 104, 0.6)', 'rgba(116, 126, 132, 0.36)', 'rgba(116, 126, 132, 0)'],
  footprintWear: ['rgba(150, 148, 140, 0.62)', 'rgba(160, 160, 156, 0.4)', 'rgba(160, 160, 156, 0)'],
  villageWear: ['rgba(164, 164, 160, 0.5)', 'rgba(164, 164, 160, 0)'],
  contourShadow: 'rgba(72, 88, 118, 0.26)',
  contourLight: 'rgba(250, 252, 255, 0.32)',
  washBank: 'rgba(80, 96, 124, 0.28)',
  washBed: 'rgba(222, 228, 234, 0.6)',
  washLine: 'rgba(124, 140, 162, 0.35)',

  // water (frozen: pale ice, darker clear ice toward the channel)
  waterShallow: '#b9c7cf',
  waterMid: '#a8bac5',
  waterDeep: '#95abb9',
  waterCore: '#839dad',
  bankWet: '#7f8a92',
  bankSand: '#c9ced2',
  riparian: 'rgba(96, 98, 92, 0.42)',
  floodplain: 'rgba(130, 150, 172, 0.12)',
  bankShadow: 'rgba(40, 60, 86, 0.3)',
  shoreline: 'rgba(240, 246, 250, 0.55)',
  flowLight: 'rgba(236, 244, 250, 0.4)',
  flowDark: 'rgba(60, 84, 104, 0.3)',
  glint: 'rgba(250, 252, 255, 0.6)',
  reeds: 'rgba(104, 92, 70, 0.8)',

  // roads (dark slush between ploughed snowbanks)
  dirtRoad: '#857e70',
  dirtRoadEdge: '#736c5e',
  dirtRut: 'rgba(66, 58, 48, 0.38)',
  dirtCentre: 'rgba(150, 146, 136, 0.3)',
  verge: 'rgba(236, 240, 244, 0.6)',
  villageTrackEdge: 'rgba(128, 128, 124, 0.5)',
  villageTrack: 'rgba(170, 170, 166, 0.65)',
  // Ploughed highways: wet dark asphalt with dirty slush shoulders, so convoy routes stand out on snow.
  asphalt: '#2f3234',
  asphaltEdge: '#58544c',
  asphaltSheen: 'rgba(255, 255, 255, 0.06)',
  roadLine: 'rgba(206, 210, 212, 0.4)',
  roadDash: 'rgba(196, 180, 112, 0.55)',

  // fields under snow: stubble / winter crop rows / frozen ploughed earth showing through
  wheat: ['#cfd1cf', '#a8a69a', '#dcdedd'],
  green: ['#c4cac8', '#98a39a', '#d4d8d6'],
  plowed: ['#a29d94', '#6e675c', '#bdbab3'],
  hedge: 'rgba(78, 78, 70, 0.42)',
  fieldEdge: 'rgba(70, 70, 66, 0.45)',

  // conifers: spruce, fir, pine
  canopies: [
    ['#18241f', '#273a31', '#3f5548'],
    ['#1b2722', '#2c4036', '#47604f'],
    ['#222a20', '#34432f', '#526248'],
  ],
  treeShadow: 'rgba(40, 54, 84, 0.42)',
  treeShadowSprite: 'rgb(36, 48, 76)',

  // villages
  roofs: ['#6e3a2c', '#7a4432', '#5a5048', '#4f4c47', '#64574a', '#6f5538'],
  garden: '#c2c6c4',
  gardenRows: 'rgba(96, 92, 80, 0.45)',
  gardenEdge: 'rgba(86, 78, 66, 0.75)',
  buildingShadow: 'rgba(36, 48, 76, 0.45)',
  roofLit: 'rgba(255, 255, 255, 0.18)',
  roofShade: 'rgba(40, 56, 88, 0.2)',
  roofRidge: 'rgba(60, 64, 74, 0.5)',
  roofOutline: 'rgba(30, 26, 24, 0.8)',
  roofTiles: 'rgba(90, 100, 116, 0.14)',

  // decor: dark rock and bare shrubs poking through the snow
  rockLight: '#c6ccd3',
  rock: '#6e6f72',
  rockDark: '#57544f',
  rockShadow: 'rgba(44, 58, 88, 0.35)',
  scrub: 'rgba(86, 80, 70, 0.75)',
  scrubDark: 'rgba(70, 66, 60, 0.75)',
  // No lit cap on winter shrubs: a round highlight made them read as pebbles.
  scrubHi: 'rgba(0, 0, 0, 0)',
  tufts: 'rgba(122, 112, 90, 0.42)',
  // Fewer shrubs and boulders, the boulders mostly snowed over (a dark crescent on the shaded side).
  scatter: { scrubDensity: 0.6, rockDensity: 0.5, rockCap: [0.16, 0.86, 0.72] },

  // battle scars: churned earth reads dark on snow
  trackMark: 'rgba(84, 88, 94, 0.36)',
  craterHalo: ['rgba(58, 52, 46, 0.4)', 'rgba(58, 52, 46, 0)'],
  craterEjecta: 'rgba(118, 108, 94, 0.55)',
  craterBowl: ['rgba(46, 42, 38, 0.95)', 'rgba(116, 108, 98, 0.9)'],

  frost: {
    snow: '#dce1e6',
    snowShade: '#a9b5c2',
    canopySnow: 'rgba(228, 234, 240, 0.92)',
    openWater: '#3e5a68',
    iceCrack: 'rgba(56, 80, 100, 0.5)',
    iceCrackLit: 'rgba(240, 246, 252, 0.55)',
    iceSnow: 'rgba(222, 228, 234, 0.6)',
    fence: 'rgba(66, 58, 48, 0.8)',
    snowbank: 'rgba(240, 243, 246, 0.6)',
  },
};

const PALETTES: Record<TerrainBiome, TerrainPalette> = { steppe: TERRAIN_COLORS, winter: WINTER_COLORS };

/** The palette for a level's biome. */
export function terrainPalette(biome: TerrainBiome): TerrainPalette {
  return PALETTES[biome];
}

/** out = a + (b - a) * t, per RGB channel. */
export function mixRgb(a: ArrayLike<number>, b: ArrayLike<number>, t: number, out: number[]): void {
  for (let i = 0; i < 3; i++) {
    const av = a[i] ?? 0;
    out[i] = av + ((b[i] ?? 0) - av) * t;
  }
}
