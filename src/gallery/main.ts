import Phaser from 'phaser';
import {
  EffectsGalleryScene,
  GalleryPreloadScene,
  PadStructuresScene,
  SpriteSheetScene,
  TerrainGalleryScene,
  UnitMotionScene,
  UnitsLineupScene,
} from './scenes';

/**
 * Dev-only art gallery (served by Vite at /gallery.html; not part of the production build).
 * `?view=sprites|units|motion|pads|terrain|effects` picks the page (`units` = composed units at game scale,
 * `motion` = ground units driving through their walk / tread cycles, `pads` = build-pad structures);
 * `&biome=winter` repaints the terrain views in the winter biome.
 */
const VIEWS: Record<string, { key: string; scene: Phaser.Types.Scenes.SceneType }> = {
  sprites: { key: 'SpriteSheet', scene: SpriteSheetScene },
  terrain: { key: 'TerrainGallery', scene: TerrainGalleryScene },
  effects: { key: 'EffectsGallery', scene: EffectsGalleryScene },
  units: { key: 'UnitsLineup', scene: UnitsLineupScene },
  motion: { key: 'UnitMotion', scene: UnitMotionScene },
  pads: { key: 'PadStructures', scene: PadStructuresScene },
};

const params = new URLSearchParams(window.location.search);
const requested = params.get('view') ?? 'sprites';
const view = VIEWS[requested] ?? VIEWS['sprites'];
if (!view) throw new Error('No gallery views registered');
const winter = params.get('biome') === 'winter';

for (const link of document.querySelectorAll<HTMLAnchorElement>('#nav a[data-view]')) {
  link.classList.toggle('active', link.dataset['view'] === requested);
  link.href = `?view=${link.dataset['view'] ?? ''}${winter ? '&biome=winter' : ''}`;
}
const biomeLink = document.getElementById('biome');
if (biomeLink instanceof HTMLAnchorElement) {
  biomeLink.textContent = `Biome: ${winter ? 'winter' : 'steppe'}`;
  biomeLink.classList.toggle('active', winter);
  biomeLink.href = `?view=${requested}${winter ? '' : '&biome=winter'}`;
}

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  width: 1920,
  height: 1080,
  backgroundColor: '#0d0f0a',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true, roundPixels: false },
  scene: [new GalleryPreloadScene(view.key), view.scene],
});

// Handy for poking at the gallery from the browser console / Playwright.
(window as unknown as { galleryGame: Phaser.Game }).galleryGame = game;
