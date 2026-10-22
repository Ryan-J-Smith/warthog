import { describe, expect, it } from 'vitest';
import { riverCrossing } from '../../src/content/levels';
import { bandPrimer, briefingFor, controlRows, controlsReminder, keyLabel, pairedKeys } from '../../src/ui/copy';

describe('controls copy', () => {
  it('prints keycaps', () => {
    expect(keyLabel('LEFT')).toBe('←');
    expect(keyLabel('ONE')).toBe('1');
    expect(keyLabel('Q')).toBe('Q');
    expect(pairedKeys('turnLeft', 'turnRight')).toBe('A/D  ←/→');
  });

  it('builds the controls card from the bindings', () => {
    const rows = controlRows();
    expect(rows[0]).toEqual({ keys: 'A/D  ←/→', action: 'Turn' });
    expect(rows.find((r) => r.action === 'Pause')?.keys).toBe('ESC / P');
    expect(rows.some((r) => r.keys === '1 2 3 4')).toBe(true);
    expect(controlsReminder()).toContain('W/S CLIMB/DIVE');
  });
});

describe('band primer', () => {
  it('lists bands top-down with weapons from the band table', () => {
    const rows = bandPrimer();
    expect(rows.map((r) => r.band)).toEqual(['high', 'medium', 'low']);
    expect(rows[0]?.weapons).toBe('BOMBS');
    expect(rows[2]?.weapons).toBe('GUN · ROCKETS');
    expect(rows[1]?.threats).toBe('AA + SAM');
  });
});

describe('briefing', () => {
  const briefing = briefingFor(riverCrossing);

  it('numbers every objective with a marker and text', () => {
    expect(briefing.operation).toBe('OPERATION RIVER CROSSING');
    expect(briefing.objectives.map((o) => o.number)).toEqual(briefing.objectives.map((_, i) => i + 1));
    expect(briefing.objectives.length).toBe(riverCrossing.objectives.length);
    expect(briefing.objectives.find((o) => o.id === 'bridgeIntact')?.text).toContain('counter-attack');
    expect(briefing.objectives.every((o) => o.marker !== null && o.text.length > 0)).toBe(true);
    expect(briefing.objectives.find((o) => o.id === 'outpost')?.defend).toBe(true);
  });

  it('derives threat intel from the level', () => {
    const sam = briefing.intel.find((i) => i.kind === 'sam');
    expect(sam?.text).toContain('north-east of the bridge');
    const aa = briefing.intel.find((i) => i.kind === 'aa');
    expect(aa?.positions.length).toBe(6);
    const armor = briefing.intel.filter((i) => i.kind === 'armor');
    expect(armor.every((a) => (a.route?.length ?? 0) > 1)).toBe(true);
    expect(sam?.route).toBeNull();
    // The column is drawn only to just past the far bank (crossedWaypoint 7 → 9 points).
    expect(armor[0]?.route?.length).toBe(9);
    expect(armor.map((a) => a.text)).toEqual([
      '9 vehicles expected from the west around 0:55.',
      '4 vehicles expected from the east around 2:00.',
      '2 attack helicopters expected from the east around 2:00.',
    ]);
  });
});
