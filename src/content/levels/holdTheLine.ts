import type { LevelDefinition } from '../../sim/level';
import type { Vec2 } from '../../sim/math';

/**
 * Prototype — Hold the Line. Base defence, Thronefall-style: between waves there is no clock;
 * fly over a pad beside a road and press 1–4 to build (barracks, tank depot, bunker, flak) or 1 to
 * upgrade, fly over the home base to buy aircraft upgrades, and press R to launch the next wave.
 * Every wave is shown before it launches. Waves drive down three roads at the base; your
 * structures' units fight them, and you fly close air support. Kills pay gold. Being shot down
 * costs time, not the mission: only losing the base does.
 */

// Roads, enemy direction (map edge → base).
const WEST_ROAD: Vec2[] = [
  { x: 300, y: 900 },
  { x: 700, y: 1300 },
  { x: 1200, y: 1900 },
  { x: 1700, y: 2350 },
  { x: 2080, y: 2560 },
];
const NORTH_ROAD: Vec2[] = [
  { x: 2150, y: 300 },
  { x: 2050, y: 700 },
  { x: 2300, y: 1400 },
  { x: 2150, y: 2000 },
  { x: 2200, y: 2450 },
];
const EAST_ROAD: Vec2[] = [
  { x: 4100, y: 1100 },
  { x: 3700, y: 1350 },
  { x: 3150, y: 1900 },
  { x: 2650, y: 2350 },
  { x: 2320, y: 2560 },
];

export const holdTheLine: LevelDefinition = {
  id: 'hold-the-line',
  name: 'Hold the Line',
  tagline: 'Build between waves. Fly during them. Keep the base standing.',
  width: 4400,
  height: 3400,
  seed: 4401,
  gradeScale: 1.6,
  parTime: 900,
  player: { spawn: { x: 2200, y: 2860 }, headingDeg: -90 },
  homeBaseRefId: 'homeBase',

  terrain: {
    biome: 'steppe',
    rivers: [],
    roads: [
      { surface: 'dirt', width: 36, points: WEST_ROAD },
      { surface: 'dirt', width: 36, points: NORTH_ROAD },
      { surface: 'dirt', width: 36, points: EAST_ROAD },
    ],
    forests: [
      { center: { x: 1500, y: 900 }, radius: 320, density: 0.55 },
      { center: { x: 3100, y: 800 }, radius: 380, density: 0.5 },
      { center: { x: 700, y: 2600 }, radius: 360, density: 0.45 },
      { center: { x: 3700, y: 2600 }, radius: 340, density: 0.5 },
    ],
    hills: [
      { center: { x: 1200, y: 400 }, radius: 360, height: 0.5 },
      { center: { x: 3600, y: 500 }, radius: 420, height: 0.6 },
      { center: { x: 2800, y: 1500 }, radius: 260, height: 0.35 },
    ],
    fields: [
      { center: { x: 1450, y: 2900 }, width: 520, height: 320, rotationDeg: 8, crop: 'wheat' },
      { center: { x: 2950, y: 2950 }, width: 480, height: 300, rotationDeg: -6, crop: 'green' },
    ],
    villages: [],
  },

  paths: {
    westRoad: WEST_ROAD,
    northRoad: NORTH_ROAD,
    eastRoad: EAST_ROAD,
  },

  entities: [
    { refId: 'homeBase', kind: 'homeBase', pos: { x: 2200, y: 3080 }, headingDeg: 0 },
    { refId: 'base', kind: 'friendlyHq', pos: { x: 2200, y: 2620 }, headingDeg: -90 },
  ],
  groups: [],

  objectives: [
    {
      id: 'base',
      kind: 'defend',
      title: 'Hold the base',
      primary: true,
      targetRefId: 'base',
      attackerTags: ['defenseWave'],
      // Never completed by the objective rules: the defence system completes it after the last wave.
      until: 'lastWave',
    },
  ],

  radio: [
    {
      trigger: { kind: 'time', at: 1.5 },
      speaker: 'OVERLORD',
      tone: 'info',
      text: 'Fly over a pad and press 1-4 to build. Over the airstrip for upgrades. R launches the wave.',
    },
  ],

  defense: {
    baseRefId: 'base',
    startGold: 200,
    waveBonus: 60,
    waveBonusStep: 15,
    goldPerKillPoint: 0.1,
    respawnDelay: 8,
    waveSpeed: 34,
    lanes: [
      { id: 'west', name: 'WEST', pathId: 'westRoad' },
      { id: 'north', name: 'NORTH', pathId: 'northRoad' },
      { id: 'east', name: 'EAST', pathId: 'eastRoad' },
    ],
    pads: [
      { id: 'w1', laneId: 'west', pos: { x: 1070, y: 1500 } },
      { id: 'w2', laneId: 'west', pos: { x: 1960, y: 2320 } },
      { id: 'n1', laneId: 'north', pos: { x: 2340, y: 1000 } },
      { id: 'n2', laneId: 'north', pos: { x: 2370, y: 2110 } },
      { id: 'e1', laneId: 'east', pos: { x: 3320, y: 1520 } },
      { id: 'e2', laneId: 'east', pos: { x: 2570, y: 2600 } },
    ],
    waves: [
      { lanes: [{ laneId: 'north', units: ['infantry', 'infantry', 'infantry', 'infantry', 'infantry', 'infantry'] }, { laneId: 'west', units: ['infantry', 'infantry', 'infantry'] }] },
      { lanes: [{ laneId: 'west', units: ['tank', 'tank', 'infantry', 'infantry', 'infantry', 'infantry'] }, { laneId: 'east', units: ['infantry', 'infantry', 'infantry', 'infantry'] }] },
      { lanes: [{ laneId: 'east', units: ['tank', 'tank', 'tank', 'infantry', 'infantry', 'infantry'] }, { laneId: 'north', units: ['infantry', 'infantry', 'infantry', 'infantry', 'infantry', 'infantry'] }] },
      {
        lanes: [
          { laneId: 'north', units: ['tank', 'mobileAa', 'tank', 'infantry', 'infantry', 'infantry', 'infantry', 'infantry', 'infantry', 'helicopter'] },
          { laneId: 'west', units: ['infantry', 'infantry', 'infantry', 'infantry', 'infantry', 'infantry'] },
        ],
      },
      { lanes: [{ laneId: 'west', units: ['tank', 'mobileAa', 'tank', 'tank', 'tank'] }, { laneId: 'east', units: ['tank', 'tank', 'tank', 'tank'] }] },
      {
        lanes: [
          { laneId: 'north', units: ['tank', 'infantry', 'tank', 'infantry', 'infantry', 'infantry', 'infantry', 'infantry', 'infantry', 'infantry', 'infantry'] },
          { laneId: 'east', units: ['tank', 'mobileAa', 'tank', 'tank', 'helicopter'] },
          { laneId: 'west', units: ['infantry', 'infantry', 'infantry', 'infantry', 'infantry', 'infantry'] },
        ],
      },
      {
        lanes: [
          { laneId: 'west', units: ['tank', 'tank', 'tank', 'infantry', 'infantry', 'infantry', 'helicopter'] },
          { laneId: 'north', units: ['tank', 'mobileAa', 'tank', 'tank', 'infantry', 'infantry', 'infantry'] },
          { laneId: 'east', units: ['tank', 'tank', 'tank', 'infantry', 'infantry', 'infantry', 'helicopter'] },
        ],
      },
      {
        lanes: [
          { laneId: 'north', units: ['tank', 'mobileAa', 'tank', 'tank', 'mobileAa', 'tank', 'tank', 'infantry', 'infantry', 'infantry', 'infantry', 'infantry', 'infantry', 'helicopter', 'helicopter'] },
          { laneId: 'west', units: ['tank', 'tank', 'tank', 'tank', 'infantry', 'infantry', 'infantry', 'infantry', 'infantry', 'infantry'] },
          { laneId: 'east', units: ['tank', 'mobileAa', 'tank', 'tank', 'tank', 'infantry', 'infantry', 'infantry', 'infantry', 'infantry', 'infantry'] },
        ],
      },
    ],
  },
};
