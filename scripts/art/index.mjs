// Writes every WARTHOG sprite SVG to public/assets/sprites/<key>.svg, plus gallery-only previews
// (art variants awaiting a decision) to src/gallery/preview/<name>.svg.
// Usage: node scripts/art/index.mjs [outDir]
//
// Art direction v1 (2026-09-26): chunky toy arcade. The units on the style board are redesigned in
// units.mjs; every other sprite is still the v0 drawing, uniformly scaled (never stretched) to the
// native size in src/assets/spriteKeys.ts until it gets restyled.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as V from './vehicles.mjs';
import * as S from './structures.mjs';
import * as M from './misc.mjs';
import * as U from './units.mjs';
import { r2 } from './lib.mjs';

const OUT = process.argv[2] ?? fileURLToPath(new URL('../../public/assets/sprites', import.meta.url));
const PREVIEW_OUT = fileURLToPath(new URL('../../src/gallery/preview', import.meta.url));
const SPEC_FILE = fileURLToPath(new URL('../../src/assets/spriteKeys.ts', import.meta.url));

/** Native sizes from the TypeScript sprite table (the single source of truth). */
function readSpecSizes() {
  const text = readFileSync(SPEC_FILE, 'utf8');
  const sizes = {};
  for (const m of text.matchAll(/^\s+(\w+): \{ w: (\d+(?:\.\d+)?), h: (\d+(?:\.\d+)?)/gm)) {
    sizes[m[1]] = { w: Number(m[2]), h: Number(m[3]) };
  }
  return sizes;
}

/**
 * Re-wrap an SVG drawn at another size into a W × H viewBox with a uniform scale (centred), so
 * a v0 drawing is never stretched when displayed at its new native size.
 */
function fitTo(text, W, H) {
  const m = text.match(/^<svg[^>]*width="([\d.]+)" height="([\d.]+)"[^>]*>([\s\S]*)<\/svg>\s*$/);
  if (!m) throw new Error('fitTo: unexpected SVG header');
  const w0 = Number(m[1]);
  const h0 = Number(m[2]);
  if (w0 === W && h0 === H) return text;
  const s = Math.min(W / w0, H / h0);
  const tx = (W - w0 * s) / 2;
  const ty = (H - h0 * s) / 2;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<g transform="translate(${r2(tx)},${r2(ty)}) scale(${Math.round(s * 10000) / 10000})">${m[3]}</g></svg>\n`
  );
}

/** Redesigned (toy style) sprites. */
const TOY = {
  a10: U.a10Toy,
  tankHull: U.tankHullEnemy,
  tankTurret: U.tankTurretEnemy,
  truck: U.truck,
  infantry: U.mechEnemy,
  aaHull: U.aaHull,
  aaTurret: U.aaTurret,
  friendlyTankHull: U.tankHullFriendly,
  friendlyTankTurret: U.tankTurretFriendly,
  friendlyInfantry: U.mechFriendly,
};

/** v0 drawings (scaled to the new native sizes until restyled). */
const LEGACY = {
  tankWreck: V.tankWreck,
  truckWreck: V.truckWreck,
  aaWreck: V.aaWreck,
  samBase: S.samBase,
  samLauncher: V.samLauncher,
  samWreck: S.samWreck,
  bridge: S.bridge,
  bridgeDestroyed: S.bridgeDestroyed,
  ammoDump: S.ammoDump,
  ammoDumpWreck: S.ammoDumpWreck,
  cache: S.cache,
  outpost: S.outpost,
  outpostDestroyed: S.outpostDestroyed,
  homeBase: S.homeBase,
  rocket: M.rocket,
  maverick: M.maverick,
  bomb: M.bomb,
  samMissile: M.samMissile,
  flare: M.flare,
  crater: M.crater,
  scorch: M.scorch,
  particleSoft: M.particleSoft,
  particleSmoke: M.particleSmoke,
  particleSpark: M.particleSpark,
  particleDebris: M.particleDebris,
  cloud1: M.cloud1,
  cloud2: M.cloud2,
  cloud3: M.cloud3,
  cloud4: M.cloud4,
  reticleGun: M.reticleGun,
  reticleBomb: M.reticleBomb,
  reticleRocket: M.reticleRocket,
  lockBracket: M.lockBracket,
  offscreenArrow: M.offscreenArrow,
  iconGun: M.iconGun,
  iconRockets: M.iconRockets,
  iconMaverick: M.iconMaverick,
  iconBombs: M.iconBombs,
  iconFlare: M.iconFlare,
};

/** Gallery-only previews (not game sprites): name → [draw, size-of-key]. */
const PREVIEWS = {
  a10B: [U.a10Future, 'a10'],
};

const sizes = readSpecSizes();
const checkSize = (key, text) => {
  const spec = sizes[key];
  if (!spec) throw new Error(`No size for sprite key ${key} in spriteKeys.ts`);
  if (!text.includes(`viewBox="0 0 ${spec.w} ${spec.h}"`)) throw new Error(`${key}: viewBox does not match ${spec.w}×${spec.h}`);
  return text;
};

const missing = Object.keys(sizes).filter((k) => !(k in TOY) && !(k in LEGACY));
if (missing.length) throw new Error(`No generator for sprite keys: ${missing.join(', ')}`);

mkdirSync(OUT, { recursive: true });
let total = 0;
let count = 0;
for (const [key, fn] of Object.entries(TOY)) {
  const text = checkSize(key, fn());
  writeFileSync(join(OUT, `${key}.svg`), text);
  total += text.length;
  count++;
}
for (const [key, fn] of Object.entries(LEGACY)) {
  const spec = sizes[key];
  const text = checkSize(key, fitTo(fn(), spec.w, spec.h));
  writeFileSync(join(OUT, `${key}.svg`), text);
  total += text.length;
  count++;
}
console.log(`wrote ${count} sprites (${(total / 1024).toFixed(1)} KB) to ${OUT}`);

mkdirSync(PREVIEW_OUT, { recursive: true });
for (const [name, [fn, sizeKey]] of Object.entries(PREVIEWS)) {
  writeFileSync(join(PREVIEW_OUT, `${name}.svg`), checkSize(sizeKey, fn()));
}
console.log(`wrote ${Object.keys(PREVIEWS).length} gallery previews to ${PREVIEW_OUT}`);
