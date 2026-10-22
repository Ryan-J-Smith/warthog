import type { LevelDefinition, TerrainDefinition } from '../../sim/level';

const BIOMES: ReadonlyArray<TerrainDefinition['biome']> = ['steppe', 'winter'];

/** The biome requested with `?biome=steppe|winter`, or null to keep the level's own. */
export function requestedBiome(): TerrainDefinition['biome'] | null {
  const value = new URLSearchParams(window.location.search).get('biome');
  return BIOMES.find((b) => b === value) ?? null;
}

/** `level` repainted in the `?biome=` biome (same layout), so any biome can be previewed on any map. */
export function withGalleryBiome(level: LevelDefinition): LevelDefinition {
  const biome = requestedBiome();
  if (!biome || biome === level.terrain.biome) return level;
  return { ...level, terrain: { ...level.terrain, biome } };
}
