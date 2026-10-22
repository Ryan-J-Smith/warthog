import type { LevelDefinition } from '../../sim/level';

/**
 * Level 1 — River Crossing.
 * Map 7200 × 5400, north-up. River runs west→east across the middle; the bridge is the
 * column's only crossing. Friendly airstrip in the south-west, Outpost Bravo in the south-east,
 * SAM site Tango covering the bridge from the north-east, ammo dump in the far north-west.
 */
export const riverCrossing: LevelDefinition = {
  id: 'river-crossing',
  name: 'River Crossing',
  tagline: 'Hold the river. Save Bravo. Pick your fights.',
  width: 7200,
  height: 5400,
  seed: 1011,
  parTime: 420,
  player: { spawn: { x: 1050, y: 4450 }, headingDeg: -60 },
  homeBaseRefId: 'homeBase',

  terrain: {
    biome: 'steppe',
    rivers: [
      {
        width: 130,
        points: [
          { x: -150, y: 2700 },
          { x: 900, y: 2550 },
          { x: 1800, y: 2760 },
          { x: 2600, y: 2600 },
          { x: 3000, y: 2645 },
          { x: 3500, y: 2720 },
          { x: 4300, y: 2860 },
          { x: 5200, y: 2660 },
          { x: 6200, y: 2800 },
          { x: 7350, y: 2700 },
        ],
      },
    ],
    roads: [
      // River road (column route) → bridge → south to the crossroads.
      {
        surface: 'dirt',
        width: 34,
        points: [
          { x: -50, y: 1200 },
          { x: 800, y: 1300 },
          { x: 1600, y: 1700 },
          { x: 2300, y: 1900 },
          { x: 2800, y: 2200 },
          { x: 3000, y: 2420 },
          { x: 3000, y: 2880 },
          { x: 3100, y: 3400 },
          { x: 3400, y: 3800 },
        ],
      },
      // Supply road: airstrip → crossroads → Outpost Bravo.
      {
        surface: 'paved',
        width: 40,
        points: [
          { x: 900, y: 4650 },
          { x: 2000, y: 4300 },
          { x: 3400, y: 3800 },
          { x: 4500, y: 3850 },
          { x: 5200, y: 3900 },
        ],
      },
      // East road (wave 2 route).
      {
        surface: 'dirt',
        width: 30,
        points: [
          { x: 7300, y: 3500 },
          { x: 6400, y: 3700 },
          { x: 5700, y: 3900 },
          { x: 5200, y: 3900 },
        ],
      },
      // Track from the ammo dump down to the river road.
      {
        surface: 'dirt',
        width: 26,
        points: [
          { x: 900, y: 700 },
          { x: 1300, y: 1100 },
          { x: 1600, y: 1700 },
        ],
      },
      // Service track to SAM site Tango.
      {
        surface: 'dirt',
        width: 24,
        points: [
          { x: 2300, y: 1900 },
          { x: 3000, y: 1750 },
          { x: 3700, y: 1900 },
        ],
      },
    ],
    forests: [
      { center: { x: 1800, y: 3500 }, radius: 300, density: 0.8 },
      { center: { x: 3800, y: 4400 }, radius: 420, density: 0.7 },
      { center: { x: 6300, y: 3100 }, radius: 260, density: 0.75 },
      { center: { x: 2450, y: 700 }, radius: 360, density: 0.85 },
      { center: { x: 5600, y: 900 }, radius: 420, density: 0.8 },
      { center: { x: 5000, y: 2150 }, radius: 250, density: 0.6 },
      { center: { x: 700, y: 3200 }, radius: 280, density: 0.65 },
      { center: { x: 6700, y: 4900 }, radius: 300, density: 0.7 },
    ],
    hills: [
      { center: { x: 1800, y: 1000 }, radius: 450, height: 0.7 },
      { center: { x: 4600, y: 1450 }, radius: 520, height: 0.9 },
      { center: { x: 6300, y: 4550 }, radius: 400, height: 0.6 },
      { center: { x: 2500, y: 4000 }, radius: 340, height: 0.5 },
      { center: { x: 6600, y: 1700 }, radius: 380, height: 0.7 },
    ],
    fields: [
      { center: { x: 2600, y: 3300 }, width: 500, height: 300, rotationDeg: 10, crop: 'wheat' },
      { center: { x: 4200, y: 3450 }, width: 420, height: 260, rotationDeg: -5, crop: 'green' },
      { center: { x: 1450, y: 3950 }, width: 320, height: 300, rotationDeg: 20, crop: 'plowed' },
      { center: { x: 1200, y: 1850 }, width: 420, height: 260, rotationDeg: -12, crop: 'wheat' },
      { center: { x: 4750, y: 4550 }, width: 380, height: 240, rotationDeg: 8, crop: 'plowed' },
      { center: { x: 3600, y: 1150 }, width: 360, height: 240, rotationDeg: 25, crop: 'green' },
    ],
    villages: [
      { center: { x: 4650, y: 3300 }, radius: 180, buildings: 9 },
      { center: { x: 1500, y: 2150 }, radius: 150, buildings: 6 },
      { center: { x: 2250, y: 3150 }, radius: 120, buildings: 5 },
    ],
  },

  paths: {
    column: [
      { x: -50, y: 1200 },
      { x: 800, y: 1300 },
      { x: 1600, y: 1700 },
      { x: 2300, y: 1900 },
      { x: 2800, y: 2200 },
      { x: 3000, y: 2420 }, // 5: north-bank approach (halt here if the bridge is down)
      { x: 3000, y: 2645 }, // 6: bridge span
      { x: 3000, y: 2880 }, // 7: south bank — crossed!
      { x: 3100, y: 3400 },
      { x: 3400, y: 3800 },
      { x: 2000, y: 4300 },
      { x: 950, y: 4600 },
    ],
    columnDivert: [
      { x: 3100, y: 3400 },
      { x: 3400, y: 3800 },
      { x: 4500, y: 3850 },
      { x: 4950, y: 3900 },
    ],
    // Friendly counter-attack once the bridge is taken intact: across the span, north to the SAM nest.
    counterattack: [
      { x: 3400, y: 3800 },
      { x: 3100, y: 3400 },
      { x: 3000, y: 2880 },
      { x: 3000, y: 2645 },
      { x: 3000, y: 2420 },
      { x: 3250, y: 2250 },
      { x: 3500, y: 2080 },
      { x: 3620, y: 1990 },
    ],
    eastRoad: [
      { x: 7300, y: 3500 },
      { x: 6400, y: 3700 },
      { x: 5700, y: 3900 },
      { x: 5350, y: 3900 },
    ],
    // Attack helicopters: the wave-2 pair flies in from the east and circles over Bravo's attackers
    // (an open route: flown once, then they loiter at its end); one gunship patrols the ammo dump
    // (a closed route: looped).
    hindsInbound: [
      { x: 7450, y: 3050 },
      { x: 6500, y: 3300 },
      { x: 5750, y: 3600 },
    ],
    dumpPatrol: [
      { x: 1300, y: 450 },
      { x: 1500, y: 1000 },
      { x: 950, y: 1300 },
      { x: 450, y: 1000 },
      { x: 500, y: 420 },
      { x: 1250, y: 430 },
    ],
  },

  entities: [
    // Friendly
    { refId: 'homeBase', kind: 'homeBase', pos: { x: 900, y: 4700 }, headingDeg: 0 },
    { refId: 'outpost', kind: 'outpost', pos: { x: 5200, y: 3900 }, headingDeg: 0 },
    { kind: 'friendlyTank', pos: { x: 5130, y: 3960 }, headingDeg: 0 },
    { kind: 'friendlyInfantry', pos: { x: 5260, y: 3840 } },
    { kind: 'friendlyInfantry', pos: { x: 5110, y: 3830 } },

    // Wave 1 — already assaulting Bravo from the east and north-east.
    { kind: 'tank', pos: { x: 5520, y: 3700 }, headingDeg: 150, tags: ['assault', 'waveA'] },
    { kind: 'tank', pos: { x: 5600, y: 3960 }, headingDeg: 180, tags: ['assault', 'waveA'] },
    { kind: 'tank', pos: { x: 5480, y: 4210 }, headingDeg: 210, tags: ['assault', 'waveA'] },
    { kind: 'infantry', pos: { x: 5420, y: 3790 }, tags: ['assault', 'waveA'] },
    { kind: 'infantry', pos: { x: 5400, y: 4060 }, tags: ['assault', 'waveA'] },
    { kind: 'aaGun', pos: { x: 5780, y: 3820 }, headingDeg: 180 },

    // The bridge and its guard.
    { refId: 'bridge', kind: 'bridge', pos: { x: 3000, y: 2645 }, headingDeg: 90 },
    { kind: 'aaGun', pos: { x: 3230, y: 2360 }, headingDeg: 200 },

    // SAM site Tango covers the bridge; ringed by AA.
    { refId: 'samTango', kind: 'samSite', pos: { x: 3700, y: 1900 }, headingDeg: 200 },
    { kind: 'aaGun', pos: { x: 3480, y: 2060 }, headingDeg: 200 },
    { kind: 'aaGun', pos: { x: 3930, y: 2100 }, headingDeg: 200 },
    { kind: 'aaGun', pos: { x: 3680, y: 1680 }, headingDeg: 200 },

    // Ammo dump deep in the north-west, lightly guarded.
    { refId: 'ammoDump', kind: 'ammoDump', pos: { x: 900, y: 700 }, headingDeg: 0 },
    { kind: 'aaGun', pos: { x: 1120, y: 860 }, headingDeg: 135 },
    { kind: 'truck', pos: { x: 1020, y: 600 }, headingDeg: 90 },
    { kind: 'truck', pos: { x: 760, y: 820 }, headingDeg: 30 },
    { refId: 'hindDump', kind: 'helicopter', pos: { x: 1300, y: 450 }, headingDeg: 70, pathId: 'dumpPatrol', tags: ['hinds'] },

    // Hidden caches (Xevious nod) — revealed by overflying at Low.
    { refId: 'cache1', kind: 'cache', pos: { x: 1950, y: 3620 }, hidden: true },
    { refId: 'cache2', kind: 'cache', pos: { x: 4380, y: 1250 }, hidden: true },
    { refId: 'cache3', kind: 'cache', pos: { x: 6520, y: 1560 }, hidden: true },
  ],

  groups: [
    {
      id: 'column',
      trigger: { kind: 'time', at: 55 },
      pathId: 'column',
      spacing: 80,
      speed: 28,
      tags: ['column'],
      units: [
        { kind: 'tank' },
        { kind: 'tank' },
        { kind: 'mobileAa' },
        { kind: 'truck' },
        { kind: 'truck' },
        { kind: 'tank' },
        { kind: 'truck' },
        { kind: 'truck' },
        { kind: 'tank' },
      ],
    },
    {
      id: 'waveB',
      trigger: { kind: 'time', at: 120 },
      pathId: 'eastRoad',
      spacing: 85,
      speed: 34,
      tags: ['assault', 'waveB'],
      units: [{ kind: 'tank' }, { kind: 'truck' }, { kind: 'tank' }, { kind: 'truck' }],
    },
    {
      id: 'hinds',
      trigger: { kind: 'time', at: 120 },
      pathId: 'hindsInbound',
      spacing: 150,
      speed: 0,
      tags: ['hinds'],
      units: [{ kind: 'helicopter' }, { kind: 'helicopter' }],
    },
    {
      // Reward for taking the bridge intact: friendly armour crosses and assaults the Tango nest.
      id: 'counterattack',
      trigger: { kind: 'objectiveResolved', objectiveId: 'bridgeIntact', status: 'completed' },
      pathId: 'counterattack',
      spacing: 90,
      speed: 34,
      tags: ['counterattack'],
      units: [{ kind: 'friendlyTank' }, { kind: 'friendlyTank' }, { kind: 'friendlyTank' }, { kind: 'friendlyTank' }],
    },
  ],

  objectives: [
    {
      id: 'column',
      kind: 'stopColumn',
      title: 'Stop the armor column',
      primary: true,
      columnTag: 'column',
      bridgeRefId: 'bridge',
      haltWaypoint: 5,
      crossedWaypoint: 7,
      divertPathId: 'columnDivert',
      divertTags: ['assault'],
    },
    {
      id: 'bridgeIntact',
      kind: 'defend',
      title: 'Take the bridge intact',
      primary: false,
      targetRefId: 'bridge',
      attackerTags: ['column'],
      failsWith: 'column',
    },
    {
      id: 'outpost',
      kind: 'defend',
      title: 'Defend Outpost Bravo',
      primary: true,
      targetRefId: 'outpost',
      attackerTags: ['assault'],
      effect: 'forwardRearm',
    },
    {
      id: 'sam',
      kind: 'destroy',
      title: 'Destroy SAM site Tango',
      primary: false,
      targetRefIds: ['samTango'],
    },
    {
      id: 'dump',
      kind: 'destroy',
      title: 'Destroy the ammo dump',
      primary: false,
      targetRefIds: ['ammoDump'],
      effect: 'aaFireRateHalved',
    },
  ],

  zones: [
    { id: 'tangoNest', name: 'Tango Nest', center: { x: 3700, y: 1900 }, radius: 420 },
    { id: 'dumpGuard', name: 'Dump Guard', center: { x: 1000, y: 760 }, radius: 320 },
    { id: 'bridgeGun', name: 'Bridge Battery', center: { x: 3230, y: 2360 }, radius: 120 },
  ],

  radio: [
    {
      trigger: { kind: 'start' },
      speaker: 'BRAVO',
      tone: 'urgent',
      text: 'Any station, Outpost Bravo! Armor hitting us from the east — requesting immediate CAS!',
    },
    {
      trigger: { kind: 'time', at: 5 },
      speaker: 'OVERLORD',
      tone: 'info',
      text: 'Warthog 1-1, Overlord. Bravo needs you. Expect triple-A along the river.',
    },
    {
      trigger: { kind: 'time', at: 55 },
      speaker: 'OVERLORD',
      tone: 'urgent',
      text: 'Armor column rolling on the river road from the west. If it crosses, Bravo is finished. Drop that bridge!',
    },
    {
      trigger: { kind: 'time', at: 62 },
      speaker: 'OVERLORD',
      tone: 'info',
      text: 'HQ wants that bridge for the counter-attack. Kill the column if you can. Drop the bridge if you must.',
    },
    {
      trigger: { kind: 'entitySpotted', refId: 'samTango' },
      speaker: 'OVERLORD',
      tone: 'urgent',
      text: 'SAM radar north of the river! Stay on the deck near the bridge, or kill it.',
    },
    {
      trigger: { kind: 'time', at: 110 },
      speaker: 'BRAVO',
      tone: 'urgent',
      text: 'More armor on the east road, one minute out!',
    },
    {
      trigger: { kind: 'time', at: 121 },
      speaker: 'OVERLORD',
      tone: 'urgent',
      text: 'Hinds inbound from the east! When a gunship lines up on you, break across its nose.',
    },
    {
      trigger: { kind: 'entitySpotted', refId: 'hindDump' },
      speaker: 'OVERLORD',
      tone: 'urgent',
      text: 'Gunship patrolling the ammo dump! Gun it down — it carries a boost pickup.',
    },
    {
      trigger: { kind: 'objectiveResolved', objectiveId: 'column', status: 'completed' },
      speaker: 'OVERLORD',
      tone: 'good',
      text: 'Column stopped! Good work, Warthog.',
    },
    {
      trigger: { kind: 'objectiveResolved', objectiveId: 'bridgeIntact', status: 'completed' },
      speaker: 'OVERLORD',
      text: 'Bridge is ours! Second Armored is rolling across to hit the SAM nest. Cover them, Warthog!',
      tone: 'good',
    },
    {
      trigger: { kind: 'objectiveResolved', objectiveId: 'column', status: 'failed' },
      speaker: 'OVERLORD',
      tone: 'bad',
      text: 'The column is across the river — they are turning toward Bravo!',
    },
    {
      trigger: { kind: 'objectiveResolved', objectiveId: 'outpost', status: 'completed' },
      speaker: 'BRAVO',
      tone: 'good',
      text: 'Attack broken! First round is on us, Warthog.',
    },
    {
      trigger: { kind: 'objectiveResolved', objectiveId: 'outpost', status: 'failed' },
      speaker: 'BRAVO',
      tone: 'bad',
      text: "We're overrun — Bravo is falling back!",
    },
    {
      trigger: { kind: 'objectiveResolved', objectiveId: 'dump', status: 'completed' },
      speaker: 'OVERLORD',
      tone: 'good',
      text: 'Massive secondaries! Their triple-A will be short on ammo now.',
    },
    {
      trigger: { kind: 'objectiveResolved', objectiveId: 'sam', status: 'completed' },
      speaker: 'OVERLORD',
      tone: 'good',
      text: 'SAM site Tango is down. The northern sky is yours.',
    },
    {
      trigger: { kind: 'allPrimariesResolved' },
      speaker: 'OVERLORD',
      tone: 'info',
      text: 'Primary tasks resolved. Warthog 1-1, RTB.',
    },
  ],
};
