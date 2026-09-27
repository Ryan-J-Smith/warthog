import { describe, expect, it } from 'vitest';
import { weaponBlock, weaponSlotStatus, weaponToast } from '../../src/ui/model';

describe('weapon availability', () => {
  it('follows the band table', () => {
    expect(weaponBlock('gun', 'low', 100)).toBeNull();
    expect(weaponBlock('gun', 'medium', 100)).toBeNull();
    expect(weaponBlock('gun', 'high', 100)).toBe('tooHigh');
    expect(weaponBlock('rockets', 'high', 3)).toBe('tooHigh');
    expect(weaponBlock('maverick', 'low', 4)).toBe('tooLow');
    expect(weaponBlock('maverick', 'medium', 4)).toBeNull();
    expect(weaponBlock('maverick', 'high', 4)).toBe('tooHigh');
    expect(weaponBlock('bombs', 'low', 6)).toBe('tooLow');
    expect(weaponBlock('bombs', 'high', 6)).toBeNull();
  });

  it('reports empty before band problems', () => {
    expect(weaponBlock('bombs', 'low', 0)).toBe('noAmmo');
    expect(weaponSlotStatus('bombs', 'low', 0).reason).toBe('EMPTY · REARM');
  });

  it('gives short slot reasons', () => {
    expect(weaponSlotStatus('gun', 'low', 10)).toEqual({ usable: true, block: null, reason: null });
    expect(weaponSlotStatus('bombs', 'low', 6).reason).toBe('TOO LOW ▲');
    expect(weaponSlotStatus('gun', 'high', 6).reason).toBe('TOO HIGH ▼');
    expect(weaponSlotStatus('maverick', 'high', 4).reason).toBe('MED ONLY');
  });

  it('builds actionable toasts', () => {
    expect(weaponToast('bombs', 'tooLow')).toBe('BOMBS: TOO LOW — CLIMB [W]');
    expect(weaponToast('gun', 'tooHigh')).toBe('GUN: OUT OF RANGE — DIVE [S]');
    expect(weaponToast('maverick', 'tooLow')).toContain('CLIMB TO MEDIUM');
    expect(weaponToast('maverick', 'noTarget')).toContain('NO LOCK');
    expect(weaponToast('rockets', 'noAmmo')).toBe('ROCKETS: EMPTY — REARM AT BASE');
  });
});
