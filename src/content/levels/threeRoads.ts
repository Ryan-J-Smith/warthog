import type { LevelDefinition } from '../../sim/level';
import type { Vec2 } from '../../sim/math';

/**
 * Level 2 — Three Roads. A lane war: the enemy HQ in the north and ours in the south are joined by
 * three roads. Every ~35 s each side sends a wave down every road; waves stop and fight where they
 * meet. Each enemy road is fed by a forward depot (guarded by triple-A, the Center one by a SAM
 * that also covers their HQ): blow it and that road's enemy waves shrink while ours grow.
 * Win by bombing their HQ (hardened; friendly armor that reaches it helps); lose if ours falls.
 * Waves escalate, so a player who only defends is slowly ground down.
 */

// Roads, enemy direction (enemy HQ gate → friendly HQ gate). Friendly waves drive them reversed.
const WEST_ROAD: Vec2[] = [
  { x: 3420, y: 700 },
  { x: 2350, y: 980 },
  { x: 1450, y: 1650 },
  { x: 1250, y: 2650 },
  { x: 1400, y: 3600 },
  { x: 2200, y: 4300 },
  { x: 3330, y: 4700 },
];
const CENTER_ROAD: Vec2[] = [
  { x: 3600, y: 720 },
  { x: 3460, y: 1350 },
  { x: 3720, y: 2050 },
  { x: 3500, y: 2750 },
  { x: 3720, y: 3450 },
  { x: 3560, y: 4100 },
  { x: 3600, y: 4640 },
];
const EAST_ROAD: Vec2[] = [
  { x: 3780, y: 700 },
  { x: 4850, y: 1000 },
  { x: 5750, y: 1700 },
  { x: 5950, y: 2700 },
  { x: 5800, y: 3600 },
  { x: 5000, y: 4300 },
  { x: 3870, y: 4700 },
];

export const threeRoads: LevelDefinition = {
  id: 'three-roads',
  name: 'Three Roads',
  tagline: 'Three roads, endless armor. Pick the fight that matters.',
  width: 7200,
  height: 5400,
  seed: 2027,
  parTime: 480,
  player: { spawn: { x: 1450, y: 4560 }, headingDeg: -70 },
  homeBaseRefId: 'homeBase',

  terrain: {
    biome: 'steppe',
    rivers: [],
    roads: [
      { surface: 'dirt', width: 36, points: WEST_ROAD },
      { surface: 'dirt', width: 36, points: CENTER_ROAD },
      { surface: 'dirt', width: 36, points: EAST_ROAD },
      // Supply road: airstrip → HQ.
      {
        surface: 'paved',
        width: 40,
        points: [
          { x: 1700, y: 4980 },
          { x: 2500, y: 4930 },
          { x: 3330, y: 4900 },
        ],
      },
      // Enemy HQ approach from the north edge.
      {
        surface: 'paved',
        width: 36,
        points: [
          { x: 3600, y: -60 },
          { x: 3600, y: 300 },
        ],
      },
      // Farm tracks between the roads.
      {
        surface: 'dirt',
        width: 22,
        points: [
          { x: 1250, y: 2650 },
          { x: 2100, y: 2800 },
          { x: 2900, y: 2600 },
          { x: 3500, y: 2750 },
        ],
      },
      {
        surface: 'dirt',
        width: 22,
        points: [
          { x: 3720, y: 3450 },
          { x: 4500, y: 3250 },
          { x: 5300, y: 3500 },
          { x: 5800, y: 3600 },
        ],
      },
    ],
    forests: [
      // Between the West and Center roads.
      { center: { x: 2450, y: 2050 }, radius: 420, density: 0.8 },
      { center: { x: 2350, y: 3500 }, radius: 360, density: 0.75 },
      { center: { x: 2900, y: 1450 }, radius: 220, density: 0.6 },
      // Between the Center and East roads.
      { center: { x: 4750, y: 2350 }, radius: 460, density: 0.8 },
      { center: { x: 4500, y: 3900 }, radius: 280, density: 0.65 },
      // Outside the flanks.
      { center: { x: 450, y: 1500 }, radius: 360, density: 0.85 },
      { center: { x: 550, y: 3900 }, radius: 320, density: 0.7 },
      { center: { x: 6800, y: 1500 }, radius: 340, density: 0.85 },
      { center: { x: 6700, y: 4300 }, radius: 360, density: 0.7 },
      // Enemy rear.
      { center: { x: 1500, y: 400 }, radius: 380, density: 0.8 },
      { center: { x: 5700, y: 450 }, radius: 360, density: 0.8 },
    ],
    hills: [
      { center: { x: 2650, y: 2650 }, radius: 380, height: 0.6 },
      { center: { x: 5150, y: 1500 }, radius: 420, height: 0.8 },
      { center: { x: 5000, y: 3150 }, radius: 360, height: 0.5 },
      { center: { x: 450, y: 2650 }, radius: 420, height: 0.7 },
      { center: { x: 6750, y: 2900 }, radius: 440, height: 0.8 },
      { center: { x: 2400, y: 600 }, radius: 340, height: 0.6 },
    ],
    fields: [
      { center: { x: 2550, y: 4700 }, width: 520, height: 260, rotationDeg: 8, crop: 'wheat' },
      { center: { x: 4700, y: 4700 }, width: 480, height: 280, rotationDeg: -6, crop: 'green' },
      { center: { x: 900, y: 4450 }, width: 360, height: 300, rotationDeg: 15, crop: 'plowed' },
      { center: { x: 3050, y: 3900 }, width: 380, height: 240, rotationDeg: -12, crop: 'green' },
      { center: { x: 4250, y: 2950 }, width: 360, height: 240, rotationDeg: 20, crop: 'wheat' },
      { center: { x: 1900, y: 1250 }, width: 340, height: 220, rotationDeg: -30, crop: 'plowed' },
      { center: { x: 5400, y: 1050 }, width: 360, height: 220, rotationDeg: 28, crop: 'plowed' },
      { center: { x: 6400, y: 3950 }, width: 360, height: 260, rotationDeg: -10, crop: 'wheat' },
    ],
    villages: [
      { center: { x: 1200, y: 3050 }, radius: 170, buildings: 7 },
      { center: { x: 3850, y: 2700 }, radius: 160, buildings: 6 },
      { center: { x: 6100, y: 2350 }, radius: 170, buildings: 7 },
      { center: { x: 2050, y: 4550 }, radius: 130, buildings: 5 },
    ],
  },

  paths: {
    west: WEST_ROAD,
    center: CENTER_ROAD,
    east: EAST_ROAD,
  },

  entities: [
    // Friendly
    { refId: 'homeBase', kind: 'homeBase', pos: { x: 1450, y: 4980 }, headingDeg: 0 },
    { refId: 'friendlyHq', kind: 'friendlyHq', pos: { x: 3600, y: 4900 }, headingDeg: -90 },

    // Enemy HQ and its close defenses.
    { refId: 'enemyHq', kind: 'enemyHq', pos: { x: 3600, y: 450 }, headingDeg: -90 },
    { kind: 'aaGun', pos: { x: 3260, y: 560 }, headingDeg: 90 },
    { kind: 'aaGun', pos: { x: 3940, y: 560 }, headingDeg: 90 },

    // West road: forward depot + triple-A.
    { refId: 'westDepot', kind: 'ammoDump', pos: { x: 1720, y: 1180 }, headingDeg: -35 },
    { kind: 'aaGun', pos: { x: 1450, y: 1350 }, headingDeg: 135 },
    { kind: 'aaGun', pos: { x: 1980, y: 1450 }, headingDeg: 135 },

    // Center road: forward depot, triple-A, and the SAM that also covers their HQ.
    { refId: 'centerDepot', kind: 'ammoDump', pos: { x: 3150, y: 1650 }, headingDeg: 80 },
    { refId: 'samCenter', kind: 'samSite', pos: { x: 3980, y: 1450 }, headingDeg: 90 },
    { kind: 'aaGun', pos: { x: 3330, y: 1880 }, headingDeg: 90 },
    { kind: 'aaGun', pos: { x: 3860, y: 1700 }, headingDeg: 90 },

    // East road: forward depot + triple-A.
    { refId: 'eastDepot', kind: 'ammoDump', pos: { x: 5480, y: 1180 }, headingDeg: 35 },
    { kind: 'aaGun', pos: { x: 5750, y: 1350 }, headingDeg: 45 },
    { kind: 'aaGun', pos: { x: 5220, y: 1450 }, headingDeg: 45 },
  ],

  groups: [],

  zones: [
    { id: 'westBattery', name: 'West battery', center: { x: 1720, y: 1300 }, radius: 420 },
    { id: 'centerBattery', name: 'Center battery', center: { x: 3600, y: 1650 }, radius: 520 },
    { id: 'eastBattery', name: 'East battery', center: { x: 5480, y: 1300 }, radius: 420 },
    { id: 'hqDefenses', name: 'HQ defenses', center: { x: 3600, y: 560 }, radius: 420 },
  ],

  laneWar: {
    enemyHqRefId: 'enemyHq',
    friendlyHqRefId: 'friendlyHq',
    lanes: [
      {
        id: 'west',
        name: 'West road',
        pathId: 'west',
        offset: 0,
        depotRefId: 'westDepot',
        depotBonus: ['tank'],
        brokenBonus: ['friendlyTank', 'friendlyTank'],
        objectiveId: 'westDepot',
      },
      {
        id: 'center',
        name: 'Center road',
        pathId: 'center',
        offset: 12,
        depotRefId: 'centerDepot',
        depotBonus: ['tank'],
        brokenBonus: ['friendlyTank', 'friendlyTank'],
        objectiveId: 'centerDepot',
      },
      {
        id: 'east',
        name: 'East road',
        pathId: 'east',
        offset: 24,
        depotRefId: 'eastDepot',
        depotBonus: ['tank'],
        brokenBonus: ['friendlyTank', 'friendlyTank'],
        objectiveId: 'eastDepot',
      },
    ],
    waves: [
      {
        team: 'enemy',
        firstAt: 8,
        interval: 36,
        speed: 40,
        spacing: 72,
        units: ['tank', 'infantry', 'infantry', 'truck'],
        escalation: [
          { at: 150, add: ['tank'] },
          { at: 240, add: ['mobileAa'] },
          { at: 330, add: ['tank'] },
          { at: 420, add: ['infantry', 'infantry'] },
          { at: 510, add: ['tank'] },
        ],
        laneCap: 14,
      },
      {
        team: 'friendly',
        firstAt: 8,
        interval: 36,
        speed: 40,
        spacing: 72,
        units: ['friendlyTank', 'friendlyInfantry', 'friendlyInfantry'],
        escalation: [{ at: 300, add: ['friendlyInfantry'] }],
        laneCap: 10,
      },
    ],
    surge: { every: 4, units: ['tank', 'tank'] },
  },

  objectives: [
    {
      id: 'hq',
      kind: 'destroy',
      title: 'Destroy the enemy HQ',
      primary: true,
      targetRefIds: ['enemyHq'],
    },
    {
      id: 'home',
      kind: 'defend',
      title: 'Hold our HQ',
      primary: true,
      targetRefId: 'friendlyHq',
      attackerTags: ['enemyWave'],
      until: 'hq',
    },
    { id: 'westDepot', kind: 'destroy', title: 'Destroy the West depot', primary: false, targetRefIds: ['westDepot'] },
    { id: 'centerDepot', kind: 'destroy', title: 'Destroy the Center depot', primary: false, targetRefIds: ['centerDepot'] },
    { id: 'eastDepot', kind: 'destroy', title: 'Destroy the East depot', primary: false, targetRefIds: ['eastDepot'] },
  ],

  radio: [
    {
      trigger: { kind: 'start' },
      speaker: 'HQ',
      tone: 'urgent',
      text: 'Warthog 1-1, Anvil HQ. Three roads, and they are coming down all of them. Keep the roads open!',
    },
    {
      trigger: { kind: 'time', at: 6 },
      speaker: 'OVERLORD',
      tone: 'info',
      text: 'Each enemy road is fed by a forward depot. Blow one and that road weakens, and our armor there gets reinforced.',
    },
    {
      trigger: { kind: 'time', at: 20 },
      speaker: 'OVERLORD',
      tone: 'info',
      text: 'Their HQ is hardened: bombs only. Push a road to its gate and our armor will shell it with you.',
    },
    {
      trigger: { kind: 'entitySpotted', refId: 'samCenter' },
      speaker: 'OVERLORD',
      tone: 'urgent',
      text: 'SAM radar on the Center road! It covers their HQ too. Stay low or kill it.',
    },
    {
      trigger: { kind: 'time', at: 150 },
      speaker: 'OVERLORD',
      tone: 'urgent',
      text: 'Enemy waves are getting heavier. More tanks on every road.',
    },
    {
      trigger: { kind: 'time', at: 240 },
      speaker: 'OVERLORD',
      tone: 'urgent',
      text: 'Mobile triple-A rolling with their waves now. Watch the roads.',
    },
    {
      trigger: { kind: 'time', at: 330 },
      speaker: 'HQ',
      tone: 'urgent',
      text: 'They are throwing everything at us. We cannot hold forever, Warthog. Take out that HQ!',
    },
    {
      trigger: { kind: 'objectiveResolved', objectiveId: 'hq', status: 'completed' },
      speaker: 'OVERLORD',
      tone: 'good',
      text: 'Enemy HQ destroyed! That is the war on this front, Warthog.',
    },
    {
      trigger: { kind: 'objectiveResolved', objectiveId: 'home', status: 'failed' },
      speaker: 'HQ',
      tone: 'bad',
      text: 'Anvil is overrun! All units, fall back!',
    },
    {
      trigger: { kind: 'allPrimariesResolved' },
      speaker: 'OVERLORD',
      tone: 'info',
      text: 'Warthog 1-1, RTB.',
    },
  ],
};
