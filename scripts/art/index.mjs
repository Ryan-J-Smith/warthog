// Writes every WARTHOG sprite SVG to public/assets/sprites/<key>.svg.
// Usage: node scripts/art/index.mjs [outDir]
//
// Art direction v1 (2026-09-26): bold outlined arcade units at ~2x scale (units.mjs) and a
// credible gunmetal A-10 (player.mjs) over the desert terrain. Structures, projectiles, decals,
// clouds and UI keep their v0 drawings (structures.mjs, misc.mjs), uniformly scaled (never
// stretched) to the native sizes in src/assets/spriteKeys.ts.
// Fun pass (2026-10-22): pickups + shield ring (pickups.mjs), attack helicopter + MLRS
// (units.mjs) and the lane-mission HQs (hq.mjs), all drawn natively in the v1 style.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as S from './structures.mjs';
import * as M from './misc.mjs';
import * as U from './units.mjs';
import * as PL from './player.mjs';
import * as PK from './pickups.mjs';
import * as HQ from './hq.mjs';
import { r2 } from './lib.mjs';

const OUT = process.argv[2] ?? fileURLToPath(new URL('../../public/assets/sprites', import.meta.url));
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
function fitTo(text, W, H, margin = 0) {
  const m = text.match(/^<svg[^>]*width="([\d.]+)" height="([\d.]+)"[^>]*>([\s\S]*)<\/svg>\s*$/);
  if (!m) throw new Error('fitTo: unexpected SVG header');
  const w0 = Number(m[1]);
  const h0 = Number(m[2]);
  if (w0 === W && h0 === H && margin === 0) return text;
  const s = Math.min((W - margin * 2) / w0, (H - margin * 2) / h0);
  const tx = (W - w0 * s) / 2;
  const ty = (H - h0 * s) / 2;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<g transform="translate(${r2(tx)},${r2(ty)}) scale(${Math.round(s * 10000) / 10000})">${m[3]}</g></svg>\n`
  );
}

/**
 * Give a v0 drawing the units' dark silhouette outline (a dilated-alpha ink layer under it), so
 * small fast things like missiles read as boldly as the units. Leaves `radius` of margin.
 */
function outlined(text, W, H, radius = 0.9) {
  const fitted = fitTo(text, W, H, radius + 0.2);
  const m = fitted.match(/^(<svg[^>]*>)([\s\S]*)<\/svg>\s*$/);
  if (!m) throw new Error('outlined: unexpected SVG');
  const filter =
    `<defs><filter id="inkOutline" x="-10%" y="-40%" width="120%" height="180%">` +
    `<feMorphology in="SourceAlpha" operator="dilate" radius="${radius}" result="grown"/>` +
    `<feFlood flood-color="#1b1522"/><feComposite in2="grown" operator="in" result="ink"/>` +
    `<feMerge><feMergeNode in="ink"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
  return `${m[1]}${filter}<g filter="url(#inkOutline)">${m[2]}</g></svg>\n`;
}

/** v0 drawings that get the bold outline treatment (projectiles). */
const OUTLINED = new Set(['rocket', 'maverick', 'bomb', 'samMissile']);

/** v1 sprites: the player aircraft and every ground unit (+ wrecks). */
const UNITS = {
  a10: PL.a10,
  tankWreck: U.tankWreck,
  truckWreck: U.truckWreck,
  aaWreck: U.aaWreck,
  samLauncher: U.samLauncher,
  tankHull: U.tankHullEnemy,
  tankTurret: U.tankTurretEnemy,
  truck: U.truck,
  infantry: U.mechEnemy,
  aaHull: U.aaHull,
  aaTurret: U.aaTurret,
  friendlyTankHull: U.tankHullFriendly,
  friendlyTankTurret: U.tankTurretFriendly,
  friendlyInfantry: U.mechFriendly,
  // Movement-cycle frames (2026-10-22): mech walk steps and tank tread phases.
  infantryWalk1: U.mechEnemyWalk(1),
  infantryWalk2: U.mechEnemyWalk(2),
  infantryWalk3: U.mechEnemyWalk(3),
  infantryWalk4: U.mechEnemyWalk(4),
  friendlyInfantryWalk1: U.mechFriendlyWalk(1),
  friendlyInfantryWalk2: U.mechFriendlyWalk(2),
  friendlyInfantryWalk3: U.mechFriendlyWalk(3),
  friendlyInfantryWalk4: U.mechFriendlyWalk(4),
  tankHullTread1: U.tankHullEnemyTread(1),
  tankHullTread2: U.tankHullEnemyTread(2),
  friendlyTankHullTread1: U.tankHullFriendlyTread(1),
  friendlyTankHullTread2: U.tankHullFriendlyTread(2),
};

/** Fun-pass v1 sprites (drawn at their native sizes, like UNITS). */
const FUNPASS = {
  pickupAmmo: PK.pickupAmmo,
  pickupRepair: PK.pickupRepair,
  pickupBoost: PK.pickupBoost,
  pickupOverdrive: PK.pickupOverdrive,
  shieldRing: PK.shieldRing,
  heliBody: U.heliBody,
  heliRotor: U.heliRotor,
  heliWreck: U.heliWreck,
  mlrs: U.mlrs,
  mlrsWreck: U.mlrsWreck,
  enemyHq: HQ.enemyHq,
  enemyHqDestroyed: HQ.enemyHqDestroyed,
  friendlyHq: HQ.friendlyHq,
  friendlyHqDestroyed: HQ.friendlyHqDestroyed,
};

/** v0 drawings (scaled to the new native sizes until restyled). */
const LEGACY = {
  samBase: S.samBase,
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

/**
 * v1 sprites whose keys are not in spriteKeys.ts yet (the lead wires them): the static AA
 * emplacement base + its wreck, so a static aaGun reads as "flak", not as a vehicle.
 * [draw, w, h] — sizes must match the SPRITES entry once it exists.
 */
const PENDING = {
  aaSite: [U.aaSite, 64, 64],
  aaSiteWreck: [U.aaSiteWreck, 64, 64],
};

const sizes = readSpecSizes();
const checkSize = (key, text) => {
  const spec = sizes[key];
  if (!spec) throw new Error(`No size for sprite key ${key} in spriteKeys.ts`);
  if (!text.includes(`viewBox="0 0 ${spec.w} ${spec.h}"`)) throw new Error(`${key}: viewBox does not match ${spec.w}×${spec.h}`);
  return text;
};

const missing = Object.keys(sizes).filter((k) => !(k in UNITS) && !(k in FUNPASS) && !(k in LEGACY) && !(k in PENDING));
if (missing.length) throw new Error(`No generator for sprite keys: ${missing.join(', ')}`);

mkdirSync(OUT, { recursive: true });
let total = 0;
let count = 0;
for (const [key, fn] of [...Object.entries(UNITS), ...Object.entries(FUNPASS)]) {
  const text = checkSize(key, fn());
  writeFileSync(join(OUT, `${key}.svg`), text);
  total += text.length;
  count++;
}
for (const [key, fn] of Object.entries(LEGACY)) {
  const spec = sizes[key];
  const text = checkSize(key, OUTLINED.has(key) ? outlined(fn(), spec.w, spec.h) : fitTo(fn(), spec.w, spec.h));
  writeFileSync(join(OUT, `${key}.svg`), text);
  total += text.length;
  count++;
}

const pendingKeys = [];
for (const [key, [fn, w, h]] of Object.entries(PENDING)) {
  const text = fn();
  if (!text.includes(`viewBox="0 0 ${w} ${h}"`)) throw new Error(`${key}: viewBox does not match ${w}×${h}`);
  if (sizes[key]) checkSize(key, text);
  else pendingKeys.push(key);
  writeFileSync(join(OUT, `${key}.svg`), text);
  total += text.length;
  count++;
}
console.log(`wrote ${count} sprites (${(total / 1024).toFixed(1)} KB) to ${OUT}`);
if (pendingKeys.length) console.log(`note: not in spriteKeys.ts yet (written, unused by the game): ${pendingKeys.join(', ')}`);
