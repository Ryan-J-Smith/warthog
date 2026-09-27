import { describe, expect, it } from 'vitest';
import { riverCrossing } from '../../src/content/levels';
import {
  defendedKind,
  duplicateMarkers,
  isDefendObjective,
  objectiveBanner,
  objectiveShortLabel,
  objectiveStartMarker,
  objectiveUrgency,
  parseEta,
} from '../../src/ui/model';

describe('objective urgency', () => {
  it('parses ETA details', () => {
    expect(parseEta('ETA 1:42')).toBe(102);
    expect(parseEta('Column inbound')).toBeNull();
  });

  it('escalates on a low meter or a short ETA', () => {
    expect(objectiveUrgency({ status: 'active', meter: 0.9, detail: '90%' })).toBe('none');
    expect(objectiveUrgency({ status: 'active', meter: 0.4, detail: '40%' })).toBe('warn');
    expect(objectiveUrgency({ status: 'active', meter: 0.2, detail: '20%' })).toBe('critical');
    expect(objectiveUrgency({ status: 'active', meter: null, detail: 'ETA 0:50' })).toBe('warn');
    expect(objectiveUrgency({ status: 'active', meter: null, detail: 'ETA 0:20' })).toBe('critical');
    expect(objectiveUrgency({ status: 'failed', meter: 0, detail: 'Overrun' })).toBe('none');
  });
});

describe('objective banners', () => {
  it('names what happened', () => {
    const column = { title: 'Stop the armor column', primary: true, detail: 'Bridge down' };
    expect(objectiveBanner(column, 'completed')).toEqual({
      headline: 'BRIDGE DOWN',
      sub: 'PRIMARY OBJECTIVE COMPLETE · +5,000',
      tone: 'good',
    });
    const dump = { title: 'Destroy the ammo dump', primary: false, detail: 'Destroyed' };
    expect(objectiveBanner(dump, 'completed').headline).toBe('AMMO DUMP DESTROYED');
    expect(objectiveBanner(dump, 'completed').sub).toContain('+2,500');
  });

  it('names a defended bridge as secured', () => {
    const b = objectiveBanner({ title: 'Take the bridge intact', primary: false, detail: 'Attack broken' }, 'completed', 'bridge');
    expect(b.headline).toBe('BRIDGE SECURED');
    expect(objectiveBanner({ title: 'Defend Outpost Bravo', primary: true, detail: 'Attack broken' }, 'completed', 'outpost').headline).toBe('ATTACK BROKEN');
  });

  it('flags failures', () => {
    const b = objectiveBanner({ title: 'Stop the armor column', primary: true, detail: 'Column crossed' }, 'failed');
    expect(b.headline).toBe('OBJECTIVE FAILED');
    expect(b.sub).toBe('STOP THE ARMOR COLUMN — COLUMN CROSSED');
    expect(b.tone).toBe('bad');
  });
});

describe('objective labels and markers from level data', () => {
  it('labels River Crossing objectives', () => {
    expect(objectiveShortLabel(riverCrossing, 'column')).toBe('BRIDGE');
    expect(objectiveShortLabel(riverCrossing, 'outpost')).toBe('OUTPOST');
    expect(objectiveShortLabel(riverCrossing, 'sam')).toBe('SAM SITE');
    expect(objectiveShortLabel(riverCrossing, 'dump')).toBe('AMMO DUMP');
    expect(objectiveShortLabel(riverCrossing, 'nope')).toBe('TARGET');
    expect(isDefendObjective(riverCrossing, 'outpost')).toBe(true);
    expect(objectiveShortLabel(riverCrossing, 'bridgeIntact')).toBe('BRIDGE');
    expect(defendedKind(riverCrossing, 'bridgeIntact')).toBe('bridge');
    expect(defendedKind(riverCrossing, 'column')).toBeNull();
    expect(isDefendObjective(riverCrossing, 'column')).toBe(false);
  });

  it('finds start markers', () => {
    expect(objectiveStartMarker(riverCrossing, 'column')).toEqual({ x: 3000, y: 2645 });
    expect(objectiveStartMarker(riverCrossing, 'outpost')).toEqual({ x: 5200, y: 3900 });
  });
});

describe('duplicateMarkers', () => {
  it('flags later markers on the same spot', () => {
    const dupes = duplicateMarkers([{ x: 0, y: 0 }, { x: 10, y: 5 }, null, { x: 500, y: 0 }, { x: 0, y: 1 }], 50);
    expect([...dupes].sort()).toEqual([1, 4]);
  });
});
