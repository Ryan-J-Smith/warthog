import Phaser from 'phaser';
import { REGISTRY, type SpriteKey } from '../../assets';
// Direct module import (not the scenes barrel): scenes import the UI, so the barrel would cycle.

/** Generated UI textures (white, tinted at runtime). */
export const UI_TEX = {
  vignette: 'ui-vignette',
  scanlines: 'ui-scanlines',
  glow: 'ui-glow',
  chevron: 'ui-chevron',
  a10: 'ui-a10',
  iconGun: 'ui-icon-gun',
  iconRockets: 'ui-icon-rockets',
  iconMaverick: 'ui-icon-maverick',
  iconBombs: 'ui-icon-bombs',
  iconFlare: 'ui-icon-flare',
} as const;

/** Was a real sprite file loaded for this key (rather than a generated placeholder)? */
export function hasArt(scene: Phaser.Scene, key: SpriteKey): boolean {
  const available = scene.registry.get(REGISTRY.availableSprites) as SpriteKey[] | undefined;
  return available?.includes(key) ?? false;
}

/** The art sprite when it exists, else our generated fallback. */
export function artOr(scene: Phaser.Scene, key: SpriteKey, fallback: string): string {
  return hasArt(scene, key) ? key : fallback;
}

/** Create every generated UI texture once per game. */
export function ensureUiTextures(scene: Phaser.Scene): void {
  const textures = scene.textures;
  if (!textures.exists(UI_TEX.vignette)) canvasTexture(scene, UI_TEX.vignette, 480, 270, drawVignette);
  if (!textures.exists(UI_TEX.scanlines)) canvasTexture(scene, UI_TEX.scanlines, 4, 4, drawScanlines);
  if (!textures.exists(UI_TEX.glow)) canvasTexture(scene, UI_TEX.glow, 64, 64, drawGlow);
  graphicsTexture(scene, UI_TEX.chevron, 64, 64, drawChevron);
  graphicsTexture(scene, UI_TEX.a10, 128, 128, drawA10);
  graphicsTexture(scene, UI_TEX.iconGun, 128, 64, drawGunIcon);
  graphicsTexture(scene, UI_TEX.iconRockets, 128, 64, drawRocketIcon);
  graphicsTexture(scene, UI_TEX.iconMaverick, 128, 64, drawMaverickIcon);
  graphicsTexture(scene, UI_TEX.iconBombs, 128, 64, drawBombIcon);
  graphicsTexture(scene, UI_TEX.iconFlare, 64, 64, drawFlareIcon);
}

function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): void {
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  draw(tex.getContext(), w, h);
  tex.refresh();
}

function graphicsTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  ctx.scale(1, h / w);
  const g = ctx.createRadialGradient(w / 2, w / 2, w * 0.36, w / 2, w / 2, w * 0.66);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.22)');
  g.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, w);
  ctx.restore();
}

function drawScanlines(ctx: CanvasRenderingContext2D, w: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, w, 1);
}

function drawGlow(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Chevron pointing east. */
function drawChevron(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0x000000, 0.55);
  g.fillPoints(pts([12, 8, 54, 32, 12, 56, 22, 32]), true);
  g.fillStyle(0xffffff, 1);
  g.fillPoints(pts([10, 6, 52, 32, 10, 58, 20, 32]), true);
}

/** Top-down A-10 silhouette, nose east. */
function drawA10(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0xffffff, 1);
  // Wings (straight, slightly tapered).
  g.fillPoints(pts([82, 62, 78, 8, 66, 6, 60, 62, 60, 66, 66, 122, 78, 120, 82, 66]), true);
  // Fuselage + nose.
  g.fillRoundedRect(16, 57, 100, 14, 6);
  g.fillTriangle(112, 58, 126, 64, 112, 70);
  // Engine nacelles, high on the rear fuselage.
  g.fillRoundedRect(30, 44, 24, 12, 5);
  g.fillRoundedRect(30, 72, 24, 12, 5);
  // Horizontal tail with twin fins.
  g.fillRect(12, 34, 12, 60);
  g.fillRect(6, 30, 22, 7);
  g.fillRect(6, 91, 22, 7);
}

function drawGunIcon(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(6, 18, 34, 28, 4); // drum / housing
  g.fillRect(40, 22, 12, 20);
  for (let i = 0; i < 4; i++) g.fillRect(52, 23 + i * 5, 62, 3); // barrels
  g.fillRect(108, 20, 8, 24); // muzzle clamp
  g.fillRect(84, 21, 4, 22); // mid clamp
}

function drawRocketIcon(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(8, 14, 84, 36, 8); // pod
  g.fillStyle(0x000000, 1);
  for (let i = 0; i < 3; i++) g.fillCircle(88, 22 + i * 10, 3.5);
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(96, 22, 118, 32, 96, 42); // rocket leaving
  g.fillRect(92, 29, 6, 6);
}

function drawMaverickIcon(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(14, 25, 88, 14, 6);
  g.fillCircle(102, 32, 7);
  g.fillTriangle(106, 26, 120, 32, 106, 38);
  g.fillPoints(pts([40, 25, 54, 12, 62, 12, 58, 25]), true);
  g.fillPoints(pts([40, 39, 54, 52, 62, 52, 58, 39]), true);
  g.fillPoints(pts([10, 25, 18, 14, 24, 14, 24, 25]), true);
  g.fillPoints(pts([10, 39, 18, 50, 24, 50, 24, 39]), true);
}

function drawBombIcon(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0xffffff, 1);
  g.fillEllipse(70, 32, 84, 26);
  g.fillRect(24, 26, 20, 12);
  g.fillPoints(pts([8, 14, 28, 26, 28, 38, 8, 50, 16, 32]), true);
  g.fillStyle(0x000000, 1);
  g.fillRect(84, 20, 3, 24);
}

function drawFlareIcon(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0xffffff, 1);
  g.fillCircle(32, 32, 9);
  g.lineStyle(4, 0xffffff, 1);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r1 = 14;
    const r2 = i % 2 === 0 ? 29 : 23;
    g.lineBetween(32 + Math.cos(a) * r1, 32 + Math.sin(a) * r1, 32 + Math.cos(a) * r2, 32 + Math.sin(a) * r2);
  }
}

function pts(flat: number[]): Phaser.Types.Math.Vector2Like[] {
  const out: Phaser.Types.Math.Vector2Like[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push({ x: flat[i] ?? 0, y: flat[i + 1] ?? 0 });
  return out;
}
