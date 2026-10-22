import { SCORING } from '../../config';
import type { LevelDefinition } from '../../sim/level';
import type { Vec2 } from '../../sim/math';
import type { EntityKind, ObjectiveStatus, RadioTone } from '../../sim/types';
import type { ObjectiveState } from '../../sim/world';
import { formatScore } from '../format';

export type Urgency = 'none' | 'warn' | 'critical';

/** Seconds from an "ETA m:ss" detail string, or null. */
export function parseEta(detail: string): number | null {
  const match = /ETA (\d+):(\d{2})/.exec(detail);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** How urgently an active objective needs attention: low meter or a short ETA. */
export function objectiveUrgency(o: Pick<ObjectiveState, 'status' | 'meter' | 'detail'>): Urgency {
  if (o.status !== 'active') return 'none';
  let level: Urgency = 'none';
  if (o.meter !== null) {
    if (o.meter < 0.25) return 'critical';
    if (o.meter < 0.5) level = 'warn';
  }
  const eta = parseEta(o.detail);
  if (eta !== null) {
    if (eta < 30) return 'critical';
    if (eta < 60) level = 'warn';
  }
  return level;
}

export interface BannerSpec {
  headline: string;
  sub: string;
  tone: RadioTone;
}

const COMPLETED_HEADLINES: Record<string, string> = {
  'bridge down': 'BRIDGE DOWN',
  'column destroyed': 'COLUMN DESTROYED',
  'attack broken': 'ATTACK BROKEN',
};

/** Target name from a destroy objective title: "Destroy the ammo dump" → "AMMO DUMP". */
function targetName(title: string): string {
  return title
    .replace(/^destroy\s+/i, '')
    .replace(/^the\s+/i, '')
    .toUpperCase();
}

/**
 * The big sweep-in banner for an objective resolving. `defendedKind` is the kind of entity a
 * defend objective protects (so a defended bridge reads "BRIDGE SECURED", an outpost
 * "ATTACK BROKEN").
 */
export function objectiveBanner(
  o: Pick<ObjectiveState, 'title' | 'primary' | 'detail'>,
  status: ObjectiveStatus,
  defendedKind: EntityKind | null = null,
): BannerSpec {
  const kind = o.primary ? 'PRIMARY' : 'OPTIONAL';
  if (status === 'failed') {
    const detail = o.detail ? ` — ${o.detail.toUpperCase()}` : '';
    return { headline: 'OBJECTIVE FAILED', sub: `${o.title.toUpperCase()}${detail}`, tone: 'bad' };
  }
  if (status === 'completed') {
    const detail = o.detail.toLowerCase();
    const secured = defendedKind && defendedKind !== 'outpost' ? `${KIND_LABEL[defendedKind] ?? 'TARGET'} SECURED` : null;
    const headline =
      secured ?? COMPLETED_HEADLINES[detail] ?? (detail === 'destroyed' ? `${targetName(o.title)} DESTROYED` : 'OBJECTIVE COMPLETE');
    const points = o.primary ? SCORING.primaryObjective : SCORING.optionalObjective;
    return { headline, sub: `${kind} OBJECTIVE COMPLETE · +${formatScore(points)}`, tone: 'good' };
  }
  return { headline: o.title.toUpperCase(), sub: `${kind} OBJECTIVE`, tone: 'info' };
}

const KIND_LABEL: Partial<Record<EntityKind, string>> = {
  outpost: 'OUTPOST',
  homeBase: 'BASE',
  samSite: 'SAM SITE',
  ammoDump: 'AMMO DUMP',
  bridge: 'BRIDGE',
  aaGun: 'AA SITE',
  cache: 'CACHE',
  tank: 'ARMOR',
  truck: 'CONVOY',
  enemyHq: 'ENEMY HQ',
  friendlyHq: 'HQ',
};

function entityKindByRef(level: LevelDefinition, refId: string): EntityKind | null {
  return level.entities.find((e) => e.refId === refId)?.kind ?? null;
}

/** Short marker label for an objective (off-screen arrows, minimap): "BRIDGE", "OUTPOST", … */
export function objectiveShortLabel(level: LevelDefinition, objectiveId: string): string {
  const def = level.objectives.find((o) => o.id === objectiveId);
  if (!def) return 'TARGET';
  switch (def.kind) {
    case 'stopColumn':
      return 'BRIDGE';
    case 'defend': {
      const kind = entityKindByRef(level, def.targetRefId);
      return (kind && KIND_LABEL[kind]) ?? 'DEFEND';
    }
    case 'destroy': {
      const ref = def.targetRefIds[0];
      const kind = ref ? entityKindByRef(level, ref) : null;
      return (kind && KIND_LABEL[kind]) ?? 'TARGET';
    }
  }
}

/** Kind of entity a defend objective protects, or null for other objectives. */
export function defendedKind(level: LevelDefinition, objectiveId: string): EntityKind | null {
  const def = level.objectives.find((o) => o.id === objectiveId);
  return def?.kind === 'defend' ? entityKindByRef(level, def.targetRefId) : null;
}

/** Is this objective about protecting something (blue) rather than attacking (amber)? */
export function isDefendObjective(level: LevelDefinition, objectiveId: string): boolean {
  return level.objectives.find((o) => o.id === objectiveId)?.kind === 'defend';
}

/**
 * Indices of items whose position duplicates an earlier item's (within `radius`), so several
 * objectives on one spot (e.g. "stop the column" and "take the bridge intact") share one marker.
 */
export function duplicateMarkers(positions: ReadonlyArray<Vec2 | null>, radius: number): Set<number> {
  const out = new Set<number>();
  positions.forEach((p, i) => {
    if (!p) return;
    for (let j = 0; j < i; j++) {
      const q = positions[j];
      if (q && !out.has(j) && Math.hypot(p.x - q.x, p.y - q.y) <= radius) {
        out.add(i);
        return;
      }
    }
  });
  return out;
}

/** Where an objective's marker sits at mission start, from level data (briefing map). */
export function objectiveStartMarker(level: LevelDefinition, objectiveId: string): Vec2 | null {
  const def = level.objectives.find((o) => o.id === objectiveId);
  if (!def) return null;
  const ref = def.kind === 'stopColumn' ? def.bridgeRefId : def.kind === 'defend' ? def.targetRefId : def.targetRefIds[0];
  const spawn = ref ? level.entities.find((e) => e.refId === ref) : undefined;
  return spawn ? { ...spawn.pos } : null;
}
