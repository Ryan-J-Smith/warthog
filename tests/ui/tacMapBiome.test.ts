import { describe, expect, it } from 'vitest';
import { TACMAP_BRIEFING, TACMAP_PHOSPHOR, TACMAP_TERRAIN, tacMapStyleForBiome } from '../../src/ui/tacmap';

describe('tacMapStyleForBiome', () => {
  it('leaves every style untouched for the steppe', () => {
    for (const style of [TACMAP_PHOSPHOR, TACMAP_BRIEFING, TACMAP_TERRAIN]) {
      expect(tacMapStyleForBiome(style, 'steppe')).toBe(style);
    }
  });

  it('keeps the phosphor displays biome-agnostic', () => {
    expect(tacMapStyleForBiome(TACMAP_PHOSPHOR, 'winter')).toBe(TACMAP_PHOSPHOR);
    expect(tacMapStyleForBiome(TACMAP_BRIEFING, 'winter')).toBe(TACMAP_BRIEFING);
  });

  it('recolours the natural-colour map for winter without touching the base style', () => {
    const groundBefore = TACMAP_TERRAIN.groundTop;
    const winter = tacMapStyleForBiome(TACMAP_TERRAIN, 'winter');
    expect(winter).not.toBe(TACMAP_TERRAIN);
    expect(winter.groundTop).not.toBe(groundBefore);
    expect(winter.river).not.toBe(TACMAP_TERRAIN.river);
    // Switches and sizes the override doesn't mention carry over.
    expect(winter.minRiverWidth).toBe(TACMAP_TERRAIN.minRiverWidth);
    expect(winter.friendly).toBe(TACMAP_TERRAIN.friendly);
    expect(TACMAP_TERRAIN.groundTop).toBe(groundBefore);
  });
});
