import Phaser from 'phaser';
import { EffectsGalleryScene, GalleryPreloadScene, SpriteSheetScene, TerrainGalleryScene, UnitsLineupScene } from './scenes';

/**
 * Dev-only art gallery (served by Vite at /gallery.html; not part of the production build).
 * `?view=sprites|units|terrain|effects` picks the page (`units` = composed units at game scale).
 */
const VIEWS: Record<string, { key: string; scene: Phaser.Types.Scenes.SceneType }> = {
  sprites: { key: 'SpriteSheet', scene: SpriteSheetScene },
  terrain: { key: 'TerrainGallery', scene: TerrainGalleryScene },
  effects: { key: 'EffectsGallery', scene: EffectsGalleryScene },
  units: { key: 'UnitsLineup', scene: UnitsLineupScene },
};

const requested = new URLSearchParams(window.location.search).get('view') ?? 'sprites';
const view = VIEWS[requested] ?? VIEWS['sprites'];
if (!view) throw new Error('No gallery views registered');

for (const link of document.querySelectorAll<HTMLAnchorElement>('#nav a')) {
  link.classList.toggle('active', link.dataset['view'] === requested);
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
