import type { EntityKind } from '../../sim/types';
import type { LevelDefinition, ObjectiveDefinition } from '../../sim/level';
import type { Vec2 } from '../../sim/math';
import { formatClock } from '../format';
import { compassDirection, compassWord, objectiveStartMarker } from '../model';

export interface BriefingObjective {
  id: string;
  number: number;
  primary: boolean;
  title: string;
  text: string;
  marker: Vec2 | null;
  defend: boolean;
}

export type IntelKind = 'sam' | 'aa' | 'armor';

export interface IntelItem {
  kind: IntelKind;
  text: string;
  /** Map positions to mark for this line (suspected sites, route starts). */
  positions: Vec2[];
  /** Expected route for armor groups, else null. */
  route: Vec2[] | null;
}

export interface Briefing {
  operation: string;
  tagline: string;
  objectives: BriefingObjective[];
  intel: IntelItem[];
}

/** Hand-written briefing lines per level and objective id. */
const OBJECTIVE_NOTES: Record<string, Record<string, string>> = {
  'river-crossing': {
    column:
      'An armor column is rolling down the river road toward the only bridge. Drop the bridge with bombs from MEDIUM or HIGH before they cross — or kill every vehicle.',
    bridgeIntact: 'Kill the column and keep the bridge: our armor will cross it for a counter-attack on the SAM nest. Drop the bridge only if you must.',
    outpost:
      'Outpost Bravo is under assault from the east, and a second wave is on its way. Break both waves and Bravo\'s pad becomes your forward rearm point.',
    sam: 'SAM site Tango and its laser AA nest cover the bridge. Clear the whole nest for a supply drop.',
    dump: 'Enemy ammo dump, far north-west. Blow it and every AA gun on the map fires at half rate.',
  },
  'three-roads': {
    hq: 'Their HQ is hardened: bombs only. A SAM on the Center road covers it. Push a road to its gate and our armor will shell it with you.',
    home: 'Waves come down all three roads every half minute and keep getting heavier. If our HQ falls, it is over.',
    westDepot: 'Feeds the West road. Blow it: their waves there lose a tank and ours gain one.',
    centerDepot: 'Feeds the Center road and hosts the SAM that guards their HQ. Blow it: their waves lose a tank, ours gain one.',
    eastDepot: 'Feeds the East road. Blow it: their waves there lose a tank and ours gain one.',
  },
  'iron-sleet': {
    interdict:
      'Supply convoys run south down both highways for five minutes, heavier as the clock runs. More than twelve vehicles off the south edge and the line breaks. Chain kills for score.',
    depot: 'The fuel depot north of the hills, ringed by triple-A. A long way from the roads: worth it only if you can spare the time.',
    sam: 'A SAM site covers the east highway. Kill it and the whole road is yours at any altitude.',
  },
};

function fallbackNote(def: ObjectiveDefinition): string {
  switch (def.kind) {
    case 'stopColumn':
      return 'Stop the column before it crosses the river: destroy the bridge or every vehicle.';
    case 'defend':
      return 'Protect the position until every attacker is destroyed.';
    case 'destroy':
      return 'Destroy the target.';
    case 'interdict':
      return `Convoys stream down the roads for ${Math.round(def.timeLimit / 60)} minutes. Stop them: if more than ${def.maxEscapes} vehicles get away, the line breaks.`;
  }
}

const LANDMARK_NAME: Partial<Record<EntityKind, string>> = {
  bridge: 'the bridge',
  outpost: 'the outpost',
  ammoDump: 'the ammo dump',
  homeBase: 'home base',
  samSite: 'the SAM site',
  enemyHq: 'the enemy HQ',
  friendlyHq: 'our HQ',
};

interface Landmark {
  pos: Vec2;
  name: string;
  refId: string;
}

function landmarks(level: LevelDefinition): Landmark[] {
  const out: Landmark[] = [];
  for (const e of level.entities) {
    const name = LANDMARK_NAME[e.kind];
    if (name && e.refId) out.push({ pos: e.pos, name, refId: e.refId });
  }
  return out;
}

function nearest(pos: Vec2, candidates: Landmark[]): Landmark | null {
  let best: Landmark | null = null;
  let bestD = Infinity;
  for (const c of candidates) {
    const d = Math.hypot(c.pos.x - pos.x, c.pos.y - pos.y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

function englishList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1] ?? ''}`;
}

/** Threat intel derived from level data: SAM sites, AA clusters, and timed armor groups. */
export function deriveIntel(level: LevelDefinition): IntelItem[] {
  const marks = landmarks(level);
  const intel: IntelItem[] = [];

  for (const sam of level.entities.filter((e) => e.kind === 'samSite')) {
    const anchor = nearest(sam.pos, marks.filter((m) => m.refId !== sam.refId && m.name !== 'the SAM site'));
    const where = anchor ? ` ${compassWord(compassDirection(anchor.pos, sam.pos))} of ${anchor.name}` : '';
    intel.push({
      kind: 'sam',
      text: `SAM site suspected${where}. Its radar reaches MEDIUM and HIGH — stay LOW inside the ring.`,
      positions: [{ ...sam.pos }],
      route: null,
    });
  }

  const aa = level.entities.filter((e) => e.kind === 'aaGun' || e.kind === 'mobileAa');
  if (aa.length > 0) {
    const near: string[] = [];
    for (const gun of aa) {
      const anchor = nearest(gun.pos, marks);
      if (anchor && !near.includes(anchor.name)) near.push(anchor.name);
    }
    intel.push({
      kind: 'aa',
      text: `Triple-A near ${englishList(near)}. Deadly at LOW, weaker at MEDIUM, can't reach HIGH.`,
      positions: aa.map((g) => ({ ...g.pos })),
      route: null,
    });
  }

  const centre = { x: level.width / 2, y: level.height / 2 };
  for (const group of level.groups) {
    if (group.trigger.kind !== 'time') continue;
    const path = level.paths[group.pathId];
    const start = path?.[0];
    if (!start) continue;
    const from = compassWord(compassDirection(centre, start));
    const when = `from the ${from} around ${formatClock(group.trigger.at)}`;
    // Attack helicopters are called out separately from ground vehicles.
    const helis = group.units.filter((u) => u.kind === 'helicopter').length;
    const vehicles = group.units.length - helis;
    const parts: string[] = [];
    if (vehicles > 0) parts.push(`${vehicles} vehicles expected ${when}.`);
    if (helis > 0) parts.push(`${helis === 1 ? 'An attack helicopter' : `${helis} attack helicopters`} expected ${when}.`);
    intel.push({
      kind: 'armor',
      text: parts.join(' '),
      positions: [{ ...start }],
      route: path ? briefingRoute(level, group.tags, path).map((p) => ({ ...p })) : null,
    });
  }
  for (const stream of level.convoys ?? []) {
    const path = level.paths[stream.pathId];
    const start = path?.[0];
    if (!path || !start) continue;
    const from = compassWord(compassDirection(centre, start));
    const heavier = stream.escalation.length > 0 ? ', growing heavier' : '';
    intel.push({
      kind: 'armor',
      text: `Convoys from the ${from} every ${Math.round(stream.interval)} s${heavier}.`,
      positions: [{ ...start }],
      route: path.map((p) => ({ ...p })),
    });
  }
  return intel;
}

/**
 * The part of a group's path worth drawing on the briefing map. A column that a stop-column
 * objective is about to intercept is drawn only to just past its crossing point.
 */
function briefingRoute(level: LevelDefinition, tags: readonly string[], path: readonly Vec2[]): readonly Vec2[] {
  for (const def of level.objectives) {
    if (def.kind === 'stopColumn' && tags.includes(def.columnTag)) return path.slice(0, def.crossedWaypoint + 2);
  }
  return path;
}

/** Everything the briefing screen shows for a level. */
export function briefingFor(level: LevelDefinition): Briefing {
  const notes = OBJECTIVE_NOTES[level.id] ?? {};
  return {
    operation: `OPERATION ${level.name.toUpperCase()}`,
    tagline: level.tagline,
    objectives: level.objectives.map((def, i) => ({
      id: def.id,
      number: i + 1,
      primary: def.primary,
      title: def.title,
      text: notes[def.id] ?? fallbackNote(def),
      marker: objectiveStartMarker(level, def.id),
      defend: def.kind === 'defend',
    })),
    intel: deriveIntel(level),
  };
}
