import type { LevelDefinition } from '../../sim/level';
import type { Vec2 } from '../../sim/math';

/**
 * Level 3 — Iron Sleet. A five-minute score attack: supply convoys stream south down two highways
 * and off the bottom of the map. Let more than twelve vehicles through and the line breaks; hold
 * until the clock runs out and the mission ends on the spot. Convoys grow (tanks, then mobile
 * triple-A) as the clock runs, triple-A nests sit on both roads, and a SAM covers the east one.
 * It is all about routing and chains: the score is the point.
 */

// Highways, north edge → south edge (vehicles that reach the last point have escaped).
const WEST_HIGHWAY: Vec2[] = [
  { x: 1500, y: -80 },
  { x: 1650, y: 700 },
  { x: 1350, y: 1500 },
  { x: 1500, y: 2400 },
  { x: 1200, y: 3300 },
  { x: 1400, y: 4100 },
  { x: 1250, y: 4880 },
];
const EAST_HIGHWAY: Vec2[] = [
  { x: 4500, y: -80 },
  { x: 4350, y: 800 },
  { x: 4700, y: 1600 },
  { x: 4550, y: 2500 },
  { x: 4850, y: 3300 },
  { x: 4600, y: 4100 },
  { x: 4750, y: 4880 },
];

export const ironSleet: LevelDefinition = {
  id: 'iron-sleet',
  name: 'Iron Sleet',
  tagline: 'Two highways, five minutes. Nothing gets through.',
  width: 6000,
  height: 4800,
  seed: 3031,
  endOnResolve: true,
  gradeScale: 1.2,
  // The mission always runs the full clock, so there is no time bonus.
  parTime: 300,
  player: { spawn: { x: 3000, y: 4150 }, headingDeg: -90 },
  homeBaseRefId: 'homeBase',

  terrain: {
    biome: 'winter',
    rivers: [],
    roads: [
      { surface: 'paved', width: 44, points: WEST_HIGHWAY },
      { surface: 'paved', width: 44, points: EAST_HIGHWAY },
      // Lateral road between the highways (useful landmark for crossing over).
      {
        surface: 'dirt',
        width: 24,
        points: [
          { x: 1500, y: 2400 },
          { x: 2300, y: 2250 },
          { x: 3100, y: 2450 },
          { x: 3900, y: 2350 },
          { x: 4550, y: 2500 },
        ],
      },
      // Airstrip access.
      {
        surface: 'paved',
        width: 30,
        points: [
          { x: 1400, y: 4100 },
          { x: 2200, y: 4300 },
          { x: 3000, y: 4400 },
        ],
      },
    ],
    forests: [
      { center: { x: 600, y: 900 }, radius: 420, density: 0.85 },
      { center: { x: 2500, y: 1100 }, radius: 380, density: 0.8 },
      { center: { x: 3500, y: 1500 }, radius: 420, density: 0.75 },
      { center: { x: 5400, y: 1100 }, radius: 400, density: 0.85 },
      { center: { x: 2300, y: 3300 }, radius: 360, density: 0.7 },
      { center: { x: 3800, y: 3400 }, radius: 380, density: 0.75 },
      { center: { x: 500, y: 3600 }, radius: 360, density: 0.8 },
      { center: { x: 5600, y: 3700 }, radius: 360, density: 0.8 },
    ],
    hills: [
      { center: { x: 3000, y: 700 }, radius: 460, height: 0.8 },
      { center: { x: 800, y: 2300 }, radius: 420, height: 0.7 },
      { center: { x: 5300, y: 2400 }, radius: 440, height: 0.8 },
      { center: { x: 3000, y: 3000 }, radius: 360, height: 0.5 },
    ],
    fields: [
      { center: { x: 2600, y: 1900 }, width: 420, height: 260, rotationDeg: 10, crop: 'plowed' },
      { center: { x: 3600, y: 2850 }, width: 400, height: 240, rotationDeg: -8, crop: 'plowed' },
      { center: { x: 2200, y: 4000 }, width: 380, height: 220, rotationDeg: 6, crop: 'plowed' },
    ],
    villages: [
      { center: { x: 1900, y: 1600 }, radius: 160, buildings: 6 },
      { center: { x: 4100, y: 3000 }, radius: 160, buildings: 6 },
      { center: { x: 3000, y: 2350 }, radius: 140, buildings: 5 },
    ],
  },

  paths: {
    west: WEST_HIGHWAY,
    east: EAST_HIGHWAY,
  },

  entities: [
    // Friendly
    { refId: 'homeBase', kind: 'homeBase', pos: { x: 3000, y: 4400 }, headingDeg: 0 },

    // West highway: triple-A nest at the bend.
    { kind: 'aaGun', pos: { x: 1080, y: 1450 }, headingDeg: 90 },
    { kind: 'aaGun', pos: { x: 1620, y: 1650 }, headingDeg: 90 },

    // East highway: triple-A nest and the SAM that covers the road north of it.
    { refId: 'samEast', kind: 'samSite', pos: { x: 5050, y: 1500 }, headingDeg: 90 },
    { kind: 'aaGun', pos: { x: 4450, y: 1750 }, headingDeg: 90 },
    { kind: 'aaGun', pos: { x: 4950, y: 1850 }, headingDeg: 90 },

    // South gates: a lone gun on each highway, the last line before the edge.
    { kind: 'aaGun', pos: { x: 1650, y: 3750 }, headingDeg: 90 },
    { kind: 'aaGun', pos: { x: 4350, y: 3750 }, headingDeg: 90 },

    // Supply caches (overdrive and ammo).
    { refId: 'cacheWest', kind: 'cache', pos: { x: 900, y: 2900 }, headingDeg: 0 },
    { refId: 'cacheEast', kind: 'cache', pos: { x: 5250, y: 2900 }, headingDeg: 0 },
    { refId: 'cacheNorth', kind: 'cache', pos: { x: 3000, y: 1200 }, headingDeg: 0 },

    // Fuel depot feeding both roads.
    { refId: 'fuelDepot', kind: 'ammoDump', pos: { x: 3000, y: 450 }, headingDeg: 0 },
    { kind: 'aaGun', pos: { x: 2750, y: 600 }, headingDeg: 90 },
    { kind: 'aaGun', pos: { x: 3250, y: 600 }, headingDeg: 90 },
  ],

  groups: [],

  convoys: [
    {
      id: 'west',
      pathId: 'west',
      firstAt: 4,
      interval: 36,
      speed: 52,
      spacing: 70,
      units: ['truck', 'truck'],
      escalation: [
        { at: 70, add: ['tank'] },
        { at: 140, add: ['mobileAa'] },
        { at: 210, add: ['truck'] },
      ],
      tags: ['convoy'],
    },
    {
      id: 'east',
      pathId: 'east',
      firstAt: 22,
      interval: 36,
      speed: 52,
      spacing: 70,
      units: ['truck', 'truck'],
      escalation: [
        { at: 70, add: ['tank'] },
        { at: 140, add: ['mobileAa'] },
        { at: 210, add: ['truck'] },
      ],
      tags: ['convoy'],
    },
  ],

  zones: [
    { id: 'westNest', name: 'West nest', center: { x: 1350, y: 1550 }, radius: 360 },
    { id: 'eastNest', name: 'East nest', center: { x: 4800, y: 1700 }, radius: 420 },
    { id: 'depotGuns', name: 'Depot guns', center: { x: 3000, y: 550 }, radius: 320 },
  ],

  objectives: [
    {
      id: 'interdict',
      kind: 'interdict',
      title: 'Stop the convoys',
      primary: true,
      convoyTag: 'convoy',
      maxEscapes: 12,
      timeLimit: 300,
    },
    { id: 'depot', kind: 'destroy', title: 'Destroy the fuel depot', primary: false, targetRefIds: ['fuelDepot'] },
    { id: 'sam', kind: 'destroy', title: 'Destroy the SAM site', primary: false, targetRefIds: ['samEast'] },
  ],

  radio: [
    {
      trigger: { kind: 'start' },
      speaker: 'OVERLORD',
      tone: 'urgent',
      text: 'Warthog 1-1, two supply highways, five minutes. Every truck that reaches the south edge feeds their front.',
    },
    {
      trigger: { kind: 'time', at: 8 },
      speaker: 'OVERLORD',
      tone: 'info',
      text: 'Twelve get through and the line breaks. Chain your kills and keep moving between the roads.',
    },
    {
      trigger: { kind: 'entitySpotted', refId: 'samEast' },
      speaker: 'OVERLORD',
      tone: 'urgent',
      text: 'SAM radar on the east highway! Stay low or kill it.',
    },
    {
      trigger: { kind: 'time', at: 60 },
      speaker: 'OVERLORD',
      tone: 'urgent',
      text: 'Tanks joining the convoys now. Gun or rockets, low and fast.',
    },
    {
      trigger: { kind: 'time', at: 120 },
      speaker: 'OVERLORD',
      tone: 'urgent',
      text: 'Mobile triple-A rolling with them. Watch for the laser.',
    },
    {
      trigger: { kind: 'time', at: 240 },
      speaker: 'OVERLORD',
      tone: 'urgent',
      text: 'One minute left! Hold the line!',
    },
    {
      trigger: { kind: 'objectiveResolved', objectiveId: 'depot', status: 'completed' },
      speaker: 'OVERLORD',
      tone: 'good',
      text: 'Fuel depot is burning! Good hit, Warthog.',
    },
    {
      trigger: { kind: 'objectiveResolved', objectiveId: 'interdict', status: 'completed' },
      speaker: 'OVERLORD',
      tone: 'good',
      text: 'Time! The highways are closed. Outstanding work, Warthog.',
    },
    {
      trigger: { kind: 'objectiveResolved', objectiveId: 'interdict', status: 'failed' },
      speaker: 'HQ',
      tone: 'bad',
      text: 'Too many got through. The line is broken.',
    },
  ],
};
