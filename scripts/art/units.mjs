// Ground unit sprites (art direction v1: bold outlined arcade units): tanks, mechs, AA, truck.
// The player aircraft live in player.mjs.
// Everything faces EAST at rotation 0; viewBoxes match src/assets/spriteKeys.ts exactly.
import { svg, r2, rng } from './lib.mjs';
import {
  T, IW, dRect, dEllipse, dRound, mirrorY, ids, fill, strokeD, outline, cel, glint, contactShadow, glowDefs, lamp, stripLight,
} from './style.mjs';

/** Team colour sets. `sec` = secondary armour (running gear housings, pods, cockpit). */
const ENEMY = {
  friendly: false,
  hi: T.eHi, l: T.eL, base: T.e, d: T.eD, dd: T.eDD,
  sec: T.ch, secL: T.chL, secD: T.chD,
  accent: T.glow, accentD: T.eDD,
  glow: T.glow, core: T.glowHi, gid: 'gE',
};
const FRIEND = {
  friendly: true,
  hi: T.fHi, l: T.fL, base: T.f, d: T.fD, dd: T.fDD,
  sec: T.steel, secL: T.steelL, secD: T.steelD,
  accent: T.blue, accentD: T.blueD,
  glow: T.cyan, core: T.cyanHi, gid: 'gF',
};

const glowFor = (c) => glowDefs(c.gid, c.core, c.glow);

/** Track run with chunky tread bars, clipped to the track shape. */
function trackRun(id, d, x0, x1, y0, h, step = 4.6) {
  const cid = id();
  let bars = '';
  for (let x = x0 + 2; x < x1 - 1; x += step) bars += fill(dRect(x, y0 - 1, 2.1, h + 2, 0.6), T.trkL);
  return (
    fill(d, T.trk) +
    `<clipPath id="${cid}"><path d="${d}"/></clipPath><g clip-path="url(#${cid})">${bars}` +
    fill(dRect(x0 - 2, y0 + h - 2.2, x1 - x0 + 4, 3, 0), '#000', { opacity: 0.28 }) +
    `</g>` +
    strokeD(d, T.ink, IW)
  );
}

/** Horizontal slats (engine grille) inside a rounded box. */
function grille(x, y, w, h, color, slat, n = 4, horizontal = false) {
  let s = fill(dRect(x, y, w, h, 2), color, { stroke: T.ink, 'stroke-width': IW });
  for (let i = 1; i <= n; i++) {
    if (horizontal) {
      const yy = y + (h * i) / (n + 1);
      s += strokeD(`M${r2(x + 1.8)},${r2(yy)}H${r2(x + w - 1.8)}`, slat, 1.1);
    } else {
      const xx = x + (w * i) / (n + 1);
      s += strokeD(`M${r2(xx)},${r2(y + 1.8)}V${r2(y + h - 1.8)}`, slat, 1.1);
    }
  }
  return s;
}

// ---------------------------------------------------------------------------
// Tanks — hull 76 × 50 (turret ring at the sprite centre 38,25); turret 68 × 30, pivot (24,15).
// The hull is drawn slightly rearward in its box so the ONE long gun reaches well past the bow:
// that long barrel is the tank's signature silhouette (the AA has short stubby barrels).
// ---------------------------------------------------------------------------
function tankHull(c) {
  const W = 76;
  const H = 50;
  const id = ids('th');
  const trackT = dRect(2, 2.5, 66, 12.5, 5.5);
  const trackB = dRect(2, 35, 66, 12.5, 5.5);
  const hullPts = c.friendly
    ? [[8, 10], [58, 10], [67.5, 16], [67.5, 34], [58, 40], [8, 40], [3.5, 35.5], [3.5, 14.5]]
    : [[8, 10.5], [55, 10.5], [66.5, 18], [66.5, 32], [55, 39.5], [8, 39.5], [4, 34.5], [4, 15.5]];
  const hull = dRound(hullPts, c.friendly ? 2.2 : 4);
  const glacis = c.friendly
    ? dRound([[56, 11.5], [66, 17], [66, 33], [56, 38.5]], 1.5)
    : dRound([[53.5, 12], [65, 19], [65, 31], [53.5, 38]], 2.5);

  const parts = [];
  parts.push(contactShadow(id, [trackT, trackB, hull]));
  parts.push(outline([trackT, trackB, hull]));
  parts.push(trackRun(id, trackT, 2, 68, 2.5, 12.5));
  parts.push(trackRun(id, trackB, 2, 68, 35, 12.5));
  parts.push(cel(id, hull, c.base, c.d, { s: 3 }));
  parts.push(cel(id, glacis, c.l, c.base, { s: 1.6 }));

  if (c.friendly) {
    // Blue side stripes, steel engine grille, cyan headlights.
    parts.push(fill(dRect(11, 10.6, 41, 3.2, 1.2), c.accent), fill(dRect(11, 36.2, 41, 3.2, 1.2), c.accentD));
    parts.push(grille(6.5, 15, 11, 20, c.sec, c.secL, 3));
    parts.push(lamp(64.2, 19.5, 1.9, c.gid, c.glow, c.core), lamp(64.2, 30.5, 1.9, c.gid, c.glow, c.core));
  } else {
    // Charcoal engine deck, glowing exhaust vents, crimson skirts with bolts, orange headlights.
    parts.push(grille(7, 14.5, 12, 21, c.sec, c.secL, 3));
    parts.push(stripLight(2.4, 17, 2.6, 5.2, c.gid, c.glow, c.core), stripLight(2.4, 27.8, 2.6, 5.2, c.gid, c.glow, c.core));
    parts.push(strokeD('M11,13.2H52', c.dd, 1.1, { opacity: 0.6 }), strokeD('M11,36.8H52', c.dd, 1.1, { opacity: 0.6 }));
    for (const x of [22, 34, 46]) parts.push(fill(dEllipse(x, 13.2, 0.9), c.dd), fill(dEllipse(x, 36.8, 0.9), c.dd));
    parts.push(lamp(62.4, 20.3, 2, c.gid, c.glow, c.core), lamp(62.4, 29.7, 2, c.gid, c.glow, c.core));
  }
  // Turret ring (mostly hidden by the turret) + top-left gloss.
  parts.push(fill(dEllipse(38, 25, 12.5, 12), c.d, { stroke: T.ink, 'stroke-width': IW, opacity: 0.9 }));
  parts.push(glint(`M${hullPts[0][0] + 3},12.6 L${hullPts[1][0] - 4},12.6`, 1.3, '#ffffff', 0.5));
  return svg(W, H, glowFor(c), parts.join(''));
}

function tankTurret(c) {
  const W = 68;
  const H = 30;
  const id = ids('tt');
  const body = c.friendly
    ? dRound([[9, 4.5], [29, 4], [41, 10.5], [41, 19.5], [29, 26], [9, 25.5], [4.5, 21.5], [4.5, 8.5]], [3, 3, 2.5, 2.5, 3, 3, 3, 3])
    : dRound([[11, 4], [30, 4], [39, 9.5], [39, 20.5], [30, 26], [11, 26], [6, 21.5], [6, 8.5]], 5);
  const bustle = c.friendly ? dRect(1.2, 8.5, 7.5, 13, 2.5) : dRect(2, 8.5, 8, 13, 3);
  const mantlet = c.friendly ? dRect(37.5, 10, 6, 10, 2.2) : dRect(35, 9.5, 7, 11, 3);
  // One long, slim gun: barrel, fume extractor, muzzle brake.
  const barrel = c.friendly ? dRect(40, 12.4, 21, 5.2, 2) : dRect(40, 12, 22, 6, 2);
  const extractor = c.friendly ? dRect(48, 11.3, 6, 7.4, 2.4) : dRect(47, 11, 6.5, 8, 2.6);
  const muzzle = c.friendly ? dRect(59.5, 11, 8, 8, 2.2) : dRect(60, 10.6, 7.5, 8.8, 2.4);

  const p = [];
  p.push(contactShadow(id, [body, barrel, muzzle], { blur: 1.8, opacity: 0.42, dx: 1.4, dy: 2, grow: 1 }));
  p.push(outline([bustle, barrel, extractor, muzzle, mantlet, body]));
  p.push(cel(id, bustle, c.sec, c.secD, { s: 1.6 }));
  p.push(cel(id, barrel, T.gunL, T.gunD, { s: 1.6, sx: 0 }));
  p.push(cel(id, extractor, T.gunL, T.gunD, { s: 1.8, sx: 0 }));
  p.push(cel(id, muzzle, T.gun, T.gunD, { s: 1.8, sx: 0 }));
  p.push(strokeD(`M63.2,${c.friendly ? 11.8 : 11.4}V${c.friendly ? 18.2 : 18.6}`, T.gunD, 1.1));
  p.push(glint('M41.5,13.4H59', 1.1, '#ffffff', 0.45));
  p.push(cel(id, mantlet, c.d, c.dd, { s: 1.5 }));
  p.push(cel(id, body, c.base, c.d, { s: 3 }));
  if (c.friendly) {
    // Blue roof band, cyan optic, hatch.
    const cid = id();
    p.push(`<clipPath id="${cid}"><path d="${body}"/></clipPath><g clip-path="url(#${cid})">${fill(dRect(13, 0, 6, 30, 0), c.accent)}${fill(dRect(13, 16, 6, 14, 0), c.accentD)}</g>`);
    p.push(strokeD(body, T.ink, IW));
    p.push(stripLight(32, 6.4, 5.5, 3, c.gid, c.glow, c.core));
    p.push(cel(id, dEllipse(25, 19, 4.2, 4), c.d, c.dd, { s: 1.2 }));
    p.push(glint('M9.5,7 L27,6.2', 1.4, '#ffffff', 0.8));
  } else {
    // Commander cupola, hatch, glowing orange optic "eye".
    p.push(cel(id, dEllipse(19, 10.8, 4.8, 4.6), c.sec, c.secD, { s: 1.3 }));
    p.push(fill(dEllipse(18.5, 10.3, 2.2), c.secL));
    p.push(cel(id, dEllipse(17, 20.5, 3.2), c.d, c.dd, { s: 1 }));
    p.push(stripLight(30.5, 17.6, 5.2, 3.2, c.gid, c.glow, c.core));
    p.push(glint('M13,6.6 Q22,5.4 29,6.4', 1.5, '#ffffff', 0.55));
  }
  return svg(W, H, glowFor(c), p.join(''));
}

export const tankHullEnemy = () => tankHull(ENEMY);
export const tankHullFriendly = () => tankHull(FRIEND);
export const tankTurretEnemy = () => tankTurret(ENEMY);
export const tankTurretFriendly = () => tankTurret(FRIEND);

// ---------------------------------------------------------------------------
// Mech walker (replaces infantry) — 52 × 52, facing east, mid-stride.
// ---------------------------------------------------------------------------
function mech(c) {
  const W = 52;
  const H = 52;
  const id = ids('m');
  // Short torso so the feet stick well out fore and aft: the north foot is planted forward, the
  // south foot trails behind (mid-stride), which is what makes it read as a walker from above.
  const footF = dRound([[31, 13.5], [45.5, 13.5], [50, 16.5], [50, 23.5], [45.5, 26.5], [31, 26.5]], 2.8);
  const footB = dRound([[2, 25.5], [16.5, 25.5], [21, 28.5], [21, 35.5], [16.5, 38.5], [2, 38.5]], 2.8);
  const torso = c.friendly
    ? dRound([[18, 14], [31, 14], [37.5, 20], [37.5, 32], [31, 38], [18, 38], [14.5, 33.5], [14.5, 18.5]], 5)
    : dRound([[18.5, 13.5], [31, 13.5], [37.5, 19.5], [37.5, 32.5], [31, 38.5], [18.5, 38.5], [14.5, 34], [14.5, 18]], 3.5);
  const shoulderPts = [[16.5, 2.6], [30, 2.6], [33.5, 6], [33.5, 13.5], [30, 16.5], [16.5, 16.5], [13.5, 13.5], [13.5, 5.5]];
  const shoulderN = c.friendly ? dEllipse(23.5, 9.6, 10.2, 7.2) : dRound(shoulderPts, 3);
  const shoulderS = c.friendly ? dEllipse(23.5, 42.4, 10.2, 7.2) : dRound(mirrorY(shoulderPts, 26), 3);
  const gunN = dRect(29, 6.6, 20, 5.8, 2.4);
  const gunS = dRect(29, 39.6, 20, 5.8, 2.4);
  const dome = dEllipse(27, 26, 7.6, 8);

  const p = [];
  p.push(contactShadow(id, [footF, footB, torso, shoulderN, shoulderS], { blur: 2, opacity: 0.42 }));
  p.push(outline([footF, footB, torso, gunN, gunS, shoulderN, shoulderS]));
  // Feet: big armoured pads with toe splits, a toe cap and an ankle joint.
  for (const [foot, x0, y0] of [[footF, 31, 13.5], [footB, 2, 25.5]]) {
    p.push(cel(id, foot, c.sec, c.secD, { s: 2 }));
    p.push(fill(dRect(x0 + 13, y0 + 1.6, 4.4, 9.8, 2), c.secL, { opacity: 0.9 }));
    p.push(strokeD(`M${x0 + 12},${y0 + 4.6}H${x0 + 18.5} M${x0 + 12},${y0 + 8.4}H${x0 + 18.5}`, T.ink, 0.9, { opacity: 0.75 }));
    p.push(cel(id, dEllipse(x0 + 5, y0 + 6.5, 3.6), c.secL, c.sec, { s: 1 }));
  }
  p.push(cel(id, torso, c.base, c.d, { s: 3 }));
  p.push(stripLight(13.6, 20.4, 2.4, 4, c.gid, c.glow, c.core), stripLight(13.6, 27.6, 2.4, 4, c.gid, c.glow, c.core));
  p.push(cel(id, dome, c.friendly ? c.d : c.sec, c.friendly ? c.dd : c.secD, { s: 2 }));
  // Visor: glowing curved slit at the front of the cockpit dome.
  p.push(`<ellipse cx="33" cy="26" rx="6" ry="9" fill="url(#${c.gid})"/>`);
  p.push(fill('M30.2,20.4 Q35.2,26 30.2,31.6 L32.4,31.6 Q37,26 32.4,20.4Z', c.glow, { stroke: T.ink, 'stroke-width': 0.8 }));
  p.push(strokeD('M31.8,22.6 Q34,26 31.8,29.4', c.core, 0.9));
  // Arm guns + shoulders.
  for (const [gun, y] of [[gunN, 6.6], [gunS, 39.6]]) {
    p.push(cel(id, gun, T.gunL, T.gunD, { s: 1.6, sx: 0 }));
    p.push(strokeD(`M44,${y + 0.9}V${y + 4.9}`, T.gunD, 1.1));
    p.push(lamp(48.3, y + 2.9, 1.5, c.gid, c.glow, c.core, { halo: 2.2 }));
  }
  p.push(cel(id, shoulderN, c.l, c.base, { s: 2.2 }));
  p.push(cel(id, shoulderS, c.base, c.d, { s: 2.2 }));
  if (c.friendly) {
    p.push(fill(dEllipse(21.5, 8.8, 4.4, 3), c.accent, { stroke: T.ink, 'stroke-width': 0.7 }));
    p.push(fill(dEllipse(21.5, 41.6, 4.4, 3), c.accentD, { stroke: T.ink, 'stroke-width': 0.7 }));
  } else {
    p.push(fill(dRect(18, 5.4, 8, 2.4, 1), c.accent, { opacity: 0.95 }));
    p.push(fill(dRect(18, 44.2, 8, 2.4, 1), c.accent, { opacity: 0.95 }));
  }
  p.push(glint('M17.5,5.2 L28,4.8', 1.3, '#ffffff', 0.6), glint('M19,16 L30,15.6', 1.3, '#ffffff', 0.45));
  return svg(W, H, glowFor(c), p.join(''));
}

export const mechEnemy = () => mech(ENEMY);
export const mechFriendly = () => mech(FRIEND);

// ---------------------------------------------------------------------------
// Anti-air — built to be told apart from a tank by silhouette alone, at every zoom:
//   hull: short, boxy, 8-WHEELED (tyres bulge out of the sides, no tracks), orange/yellow hazard
//         bands (the one enemy that shoots the player; orange matches its IFF triangle);
//   turret: open tub with QUAD short stubby cannons and a big pale radar dish at the back.
// Mobile AA = aaHull (58 × 40) + aaTurret (36 × 32, pivot centre).
// Static AA = aaSite emplacement (64 × 64 sandbag ring + pad) + the same aaTurret.
// ---------------------------------------------------------------------------

/** Diagonal orange/black hazard stripes clipped to `d`. */
function hazard(id, d, x, y, w, h, step = 4.2) {
  const cid = id();
  let bands = '';
  for (let k = -h; k < w + h; k += step * 2) {
    bands += `M${r2(x + k)},${r2(y + h)} L${r2(x + k + h)},${r2(y)} L${r2(x + k + h + step)},${r2(y)} L${r2(x + k + step)},${r2(y + h)}Z`;
  }
  return (
    `<clipPath id="${cid}"><path d="${d}"/></clipPath><g clip-path="url(#${cid})">` +
    fill(d, T.hazard) +
    fill(bands, T.ink, { opacity: 0.85 }) +
    `</g>` +
    strokeD(d, T.ink, 0.8)
  );
}

export function aaHull() {
  const c = ENEMY;
  const W = 58;
  const H = 40;
  const id = ids('ah');
  // Four big, clearly separate tyres per side (never reads as a track).
  const wheelX = [9, 21, 37, 49];
  const wheels = wheelX.flatMap((x) => [dRect(x - 4.3, 0.4, 8.6, 7.4, 3.6), dRect(x - 4.3, 32.2, 8.6, 7.4, 3.6)]);
  const hull = dRound([[6, 5.5], [46, 5.5], [55, 10.5], [55, 29.5], [46, 34.5], [6, 34.5], [3, 31.5], [3, 8.5]], 2.2);
  const nose = dRound([[45, 7], [53.6, 11.4], [53.6, 28.6], [45, 33]], 1.4);
  const tail = dRect(4.4, 7, 5.2, 26, 1.4);
  const p = [];
  p.push(contactShadow(id, [...wheels, hull]));
  p.push(outline([...wheels, hull]));
  for (const w of wheels) {
    p.push(cel(id, w, T.trkL, T.trk, { s: 1.4, line: 0.8 }));
  }
  for (const x of wheelX) {
    for (const y of [2.2, 34]) p.push(fill(dRect(x - 1.8, y, 3.6, 3.8, 1.2), T.gunL, { stroke: T.ink, 'stroke-width': 0.5 }));
  }
  // Boxy charcoal chassis with crimson side panels.
  p.push(cel(id, hull, c.sec, c.secD, { s: 2.4 }));
  p.push(fill(dRect(12, 6.6, 30, 4, 1.4), c.base, { stroke: T.ink, 'stroke-width': 0.8 }));
  p.push(fill(dRect(12, 29.4, 30, 4, 1.4), c.d, { stroke: T.ink, 'stroke-width': 0.8 }));
  // Hazard bands front and rear.
  p.push(hazard(id, nose, 44, 6, 11, 28, 3.4));
  p.push(hazard(id, tail, 4, 6, 6, 28, 3.4));
  p.push(lamp(52.6, 13, 1.4, c.gid, c.glow, c.core, { halo: 2.2 }), lamp(52.6, 27, 1.4, c.gid, c.glow, c.core, { halo: 2.2 }));
  // Turret ring + a whip antenna stub.
  p.push(fill(dEllipse(29, 20, 10.5, 10), c.secD, { stroke: T.ink, 'stroke-width': IW }));
  p.push(glint('M10,8.2 L42,8.2', 1.1, '#ffffff', 0.35));
  return svg(W, H, glowFor(c), p.join(''));
}

export function aaTurret() {
  const c = ENEMY;
  const W = 36;
  const H = 32;
  const id = ids('at');
  const podN = dRect(14, 1.6, 11, 8.8, 2.6);
  const podS = dRect(14, 21.6, 11, 8.8, 2.6);
  // Quad SHORT stubby cannons with fat flash hiders.
  const ys = [2.6, 6.2, 22.6, 26.2];
  const barrels = ys.map((y) => dRect(23, y, 8, 3.2, 1.2));
  const hiders = ys.map((y) => dRect(30, y - 0.5, 4, 4.2, 1.4));
  const tub = dRound([[8.5, 7], [22.5, 7], [27, 11], [27, 21], [22.5, 25], [8.5, 25], [6, 22], [6, 10]], 3);
  const well = dRound([[11.5, 10.5], [21, 10.5], [23.5, 13], [23.5, 19], [21, 21.5], [11.5, 21.5], [10, 19], [10, 13]], 2);
  const dish = dEllipse(5.2, 16, 4.6, 11.2);
  const p = [];
  p.push(contactShadow(id, [podN, podS, tub, dish], { blur: 1.6, opacity: 0.42, dx: 1.2, dy: 1.8, grow: 0.8 }));
  p.push(outline([...barrels, ...hiders, podN, podS, tub, dish], 1.8));
  for (const b of barrels) p.push(cel(id, b, T.gunL, T.gunD, { s: 1, sx: 0, line: 0.6 }));
  for (const h of hiders) p.push(cel(id, h, T.gun, T.gunD, { s: 1, sx: 0, line: 0.6 }));
  for (const y of ys) p.push(lamp(33.8, y + 1.6, 0.9, c.gid, c.glow, c.core, { halo: 2.6, line: 0.4 }));
  p.push(hazard(id, podN, 13, 1, 13, 10, 2.6), hazard(id, podS, 13, 21, 13, 10, 2.6));
  // Open crew tub: crimson armour, dark well with ammo boxes.
  p.push(cel(id, tub, c.base, c.d, { s: 2.2 }));
  p.push(fill(well, T.ink, { opacity: 0.85 }));
  p.push(fill(dRect(12.5, 12, 4, 3.2, 0.8), c.secL), fill(dRect(12.5, 16.8, 4, 3.2, 0.8), c.secL), fill(dRect(18, 13.5, 3.6, 5, 1), c.sec));
  p.push(stripLight(22.4, 14.4, 2.6, 3.2, c.gid, c.glow, c.core));
  // Big pale radar dish at the rear: concentric rings, orange feed horn.
  p.push(cel(id, dish, T.dish, T.dishD, { s: 1.4 }));
  p.push(strokeD(dEllipse(5.2, 16, 3, 7.6), T.dishD, 0.8), strokeD('M5.2,5.4V26.6', T.dishD, 0.7));
  p.push(lamp(6.4, 16, 1.2, c.gid, c.glow, c.core, { halo: 2.4 }));
  p.push(glint('M10,8.8 L21,8.6', 1.1, '#ffffff', 0.5));
  return svg(W, H, glowFor(c), p.join(''));
}

/** Static AA emplacement base (the aaTurret sits on it): sandbag ring, concrete pad, ammo. */
export function aaSite() {
  const W = 64;
  const H = 64;
  const cx = 32;
  const cy = 32;
  const id = ids('as');
  const pad = dEllipse(cx, cy, 19.5);
  const p = [];
  p.push(contactShadow(id, [dEllipse(cx, cy, 29)], { blur: 2.4, opacity: 0.38 }));
  // Sandbag ring (gap at the rear for the crew).
  const bags = [];
  const n = 22;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    if (Math.cos(a) < -0.93) continue;
    const x = cx + Math.cos(a) * 25;
    const y = cy + Math.sin(a) * 25;
    const deg = (a * 180) / Math.PI + 90;
    bags.push({ x, y, deg });
  }
  const bag = (b, grow = 0) =>
    `<path d="${dRect(-4.3 - grow, -3.4 - grow, 8.6 + grow * 2, 6.8 + grow * 2, 2.6 + grow)}" transform="translate(${r2(b.x)},${r2(b.y)}) rotate(${r2(b.deg)})"`;
  p.push(bags.map((b) => `${bag(b, 1.8)} fill="${T.ink}"/>`).join(''));
  p.push(bags.map((b, i) => `${bag(b)} fill="${i % 3 === 0 ? T.bagD : T.bag}"/>`).join(''));
  p.push(bags.map((b) => `<path d="M-3,-1.6 H3" transform="translate(${r2(b.x)},${r2(b.y)}) rotate(${r2(b.deg)})" stroke="${T.bagL}" stroke-width="1" stroke-linecap="round"/>`).join(''));
  // Concrete pad with hazard ring and ammo crates at the rear.
  p.push(outline([pad], 1.4));
  p.push(cel(id, pad, T.pad, T.padD, { s: 2 }));
  p.push(strokeD(dEllipse(cx, cy, 16.5), T.hazard, 2.4, { 'stroke-dasharray': '4 3' }));
  for (const [x, y] of [[8.5, 25], [8.5, 33.5]]) {
    const crate = dRect(x - 3.5, y - 3, 7, 6, 1);
    p.push(outline([crate], 1.2), cel(id, crate, T.crate, T.crateD, { s: 1 }), strokeD(`M${x - 3.5},${y}H${x + 3.5}`, T.crateD, 0.7));
  }
  return svg(W, H, '', p.join(''));
}

// ---------------------------------------------------------------------------
// Supply truck — 52 × 26, cab east.
// ---------------------------------------------------------------------------
export function truck() {
  const c = ENEMY;
  const W = 52;
  const H = 26;
  const id = ids('tr');
  const wheels = [5, 16.5, 36.5].flatMap((x) => [dRect(x, 0.8, 10, 5.4, 2.3), dRect(x, 19.8, 10, 5.4, 2.3)]);
  const bed = dRect(2.5, 3.4, 31.5, 19.2, 3);
  const cab = dRound([[35.5, 4], [45.5, 4], [50.5, 8.5], [50.5, 17.5], [45.5, 22], [35.5, 22]], 2.6);
  const p = [];
  p.push(contactShadow(id, [...wheels, bed, cab], { blur: 1.8, opacity: 0.4 }));
  p.push(outline([...wheels, bed, cab]));
  for (const w of wheels) p.push(cel(id, w, T.trkL, T.trk, { s: 1.2, line: 0.7 }));
  // Tarp-covered cargo bed with ribs.
  p.push(cel(id, bed, c.sec, c.secD, { s: 2.4 }));
  for (const x of [10.5, 18.5, 26.5]) p.push(strokeD(`M${x},4.6V21.4`, c.secD, 1.4), strokeD(`M${x + 1.2},4.8V12`, c.secL, 0.8, { opacity: 0.7 }));
  p.push(fill(dRect(3.6, 11.4, 29.5, 3.2, 1), c.accent, { opacity: 0.9 }));
  p.push(cel(id, cab, c.base, c.d, { s: 2 }));
  p.push(cel(id, dRect(37, 6.5, 6.8, 13, 2), c.l, c.base, { s: 1.2 }));
  p.push(fill(dRound([[44.2, 6.2], [46.4, 6.2], [48.8, 9], [48.8, 17], [46.4, 19.8], [44.2, 19.8]], 1), T.glassD, { stroke: T.ink, 'stroke-width': 0.7 }));
  p.push(strokeD('M45.6,8 L47.4,10.4', T.glassHi, 0.9));
  p.push(lamp(50, 7.2, 1.5, c.gid, c.glow, c.core, { halo: 2.2 }), lamp(50, 18.8, 1.5, c.gid, c.glow, c.core, { halo: 2.2 }));
  p.push(glint('M5,5.6 L31,5.6', 1.1, '#ffffff', 0.35));
  return svg(W, H, glowFor(c), p.join(''));
}

// ---------------------------------------------------------------------------
// Wrecks — the same silhouettes, burnt: soot halo, charred armour, rust, displaced parts.
// ---------------------------------------------------------------------------

/** Soft soot halo under a wreck (drawn first). */
function soot(id, cx, cy, rx, ry, opacity = 0.55) {
  const gid = id();
  return (
    `<radialGradient id="${gid}" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${T.soot}" stop-opacity="${opacity}"/>` +
    `<stop offset="0.6" stop-color="${T.soot}" stop-opacity="${r2(opacity * 0.5)}"/><stop offset="1" stop-color="${T.soot}" stop-opacity="0"/></radialGradient>` +
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${gid})"/>`
  );
}

/** Rust blotches clipped to a part. */
function rustOn(id, d, blobs) {
  const cid = id();
  return (
    `<clipPath id="${cid}"><path d="${d}"/></clipPath><g clip-path="url(#${cid})">` +
    blobs.map(([x, y, rx, ry, c]) => fill(dEllipse(x, y, rx, ry), c ?? T.rust, { opacity: 0.8 })).join('') +
    `</g>`
  );
}

export function tankWreck() {
  const W = 76;
  const H = 50;
  const id = ids('tw');
  const trackT = dRect(2, 2.5, 66, 12.5, 5.5);
  const trackB = dRect(2, 35, 44, 12.5, 5.5);
  const thrown = dRect(0, 0, 20, 10, 4);
  const hull = dRound([[8, 10.5], [55, 10.5], [66.5, 18], [66.5, 32], [55, 39.5], [8, 39.5], [4, 34.5], [4, 15.5]], 4);
  const turret = dRound([[11, 4], [30, 4], [39, 9.5], [39, 20.5], [30, 26], [11, 26], [6, 21.5], [6, 8.5]], 5);
  const barrel = dRect(38, 12.2, 8.5, 5.6, 2);
  const p = [];
  p.push(soot(id, 36, 26, 38, 25));
  p.push(outline([trackT, trackB, hull]));
  p.push(`<g transform="translate(47,38) rotate(14)">${outline([thrown])}${cel(id, thrown, T.bD, '#16120f', { s: 1 })}</g>`);
  p.push(trackRun(id, trackT, 2, 68, 2.5, 12.5).replaceAll(T.trkL, '#3a3530').replaceAll(T.trk, '#1c1916'));
  p.push(trackRun(id, trackB, 2, 46, 35, 12.5).replaceAll(T.trkL, '#3a3530').replaceAll(T.trk, '#1c1916'));
  p.push(cel(id, hull, T.b, T.bD, { s: 3 }));
  p.push(rustOn(id, hull, [[18, 30, 7, 4], [50, 16, 5, 3], [30, 20, 4, 2.5, T.rustL]]));
  p.push(strokeD('M11,13.2H52 M11,36.8H40', T.bD, 1.1, { opacity: 0.7 }));
  // Open turret ring, burnt out.
  p.push(fill(dEllipse(38, 25, 11.5, 11), '#0f0c0a', { stroke: T.ink, 'stroke-width': IW }));
  p.push(fill(dEllipse(39, 26, 6, 5.5), T.rust, { opacity: 0.45 }));
  // Blown-off turret (gun snapped short) lying askew on the front deck.
  p.push(
    `<g transform="translate(29,3) rotate(24 22 15)">` +
      outline([turret, barrel]) +
      cel(id, barrel, '#2d2926', '#171411', { s: 1.2, sx: 0 }) +
      cel(id, turret, T.bL, T.bD, { s: 2.6 }) +
      rustOn(id, turret, [[20, 18, 6, 4], [30, 9, 3, 2, T.rustL]]) +
      fill(dEllipse(19, 10.8, 4, 3.8), '#15110e') +
      `</g>`,
  );
  p.push(glint('M12,12.6 L50,12.6', 1.1, T.bHi, 0.5));
  return svg(W, H, '', p.join(''));
}

export function truckWreck() {
  const W = 52;
  const H = 26;
  const id = ids('rw');
  const wheels = [5, 16.5, 36.5].flatMap((x) => [dRect(x, 0.8, 10, 5.4, 2.3), dRect(x, 19.8, 10, 5.4, 2.3)]);
  const bed = dRect(2.5, 3.4, 31.5, 19.2, 3);
  const cab = dRound([[35.5, 5], [45, 4.5], [49.5, 9], [49, 17.5], [45.5, 21.5], [35.5, 21]], 2.6);
  const p = [];
  p.push(soot(id, 26, 13, 27, 14));
  p.push(outline([...wheels, bed, cab]));
  for (const w of wheels) p.push(cel(id, w, '#2a2622', '#141210', { s: 1, line: 0.7 }));
  // Burnt-out bed: floor visible through the charred frame.
  p.push(cel(id, bed, '#231e1b', '#120f0d', { s: 2 }));
  p.push(rustOn(id, bed, [[12, 12, 7, 4.5], [26, 8, 5, 3, T.rustL]]));
  for (const x of [5.5, 12.5, 19.5, 26.5, 33]) p.push(strokeD(`M${x},4.2 Q${x + 0.8},13 ${x - 0.4},21.8`, T.bL, 1.3));
  p.push(strokeD('M3.4,4.4 H33 M3.4,21.6 H33', T.bL, 1.2));
  p.push(cel(id, cab, T.b, T.bD, { s: 1.8 }));
  p.push(rustOn(id, cab, [[42, 16, 4, 3]]));
  p.push(fill(dRound([[44, 7], [46, 7], [48, 9.5], [47.6, 16.5], [45.8, 19], [44, 19]], 1), '#0d0b09', { stroke: T.ink, 'stroke-width': 0.6 }));
  return svg(W, H, '', p.join(''));
}

export function aaWreck() {
  const W = 58;
  const H = 40;
  const id = ids('aw');
  const wheelX = [9, 21, 37, 49];
  const wheels = wheelX.flatMap((x) => [dRect(x - 4.3, 0.4, 8.6, 7.4, 3.6), dRect(x - 4.3, 32.2, 8.6, 7.4, 3.6)]);
  const hull = dRound([[6, 5.5], [46, 5.5], [55, 10.5], [55, 29.5], [46, 34.5], [6, 34.5], [3, 31.5], [3, 8.5]], 2.2);
  const nose = dRound([[45, 7], [53.6, 11.4], [53.6, 28.6], [45, 33]], 1.4);
  const dish = dEllipse(0, 0, 4.2, 10);
  const p = [];
  p.push(soot(id, 29, 20, 30, 21));
  p.push(outline([...wheels, hull]));
  for (const w of wheels) p.push(cel(id, w, '#2a2622', '#141210', { s: 1.2, line: 0.8 }));
  p.push(cel(id, hull, T.b, T.bD, { s: 2.4 }));
  // Scorched hazard bands still (just) visible: the wreck of the thing that shot at you.
  p.push(hazard(id, nose, 44, 6, 11, 28, 3.4).replace(`fill="${T.hazard}"`, `fill="#8a5a22"`));
  p.push(rustOn(id, hull, [[20, 26, 7, 4], [36, 12, 5, 3, T.rustL]]));
  p.push(fill(dEllipse(29, 20, 9.5, 9), '#0f0c0a', { stroke: T.ink, 'stroke-width': IW }));
  // Broken stubby barrels and the fallen radar dish.
  p.push(`<g transform="translate(34,14) rotate(-24)">${outline([dRect(0, 0, 10, 3, 1.2), dRect(0, 5, 7, 3, 1.2)], 1.4)}${fill(dRect(0, 0, 10, 3, 1.2), '#26221f')}${fill(dRect(0, 5, 7, 3, 1.2), '#26221f')}</g>`);
  p.push(`<g transform="translate(14,23) rotate(58)">${outline([dish], 1.6)}${cel(id, dish, '#6b675f', '#433f39', { s: 1.2 })}${strokeD(dEllipse(0, 0, 2.6, 6.4), '#433f39', 0.7)}</g>`);
  return svg(W, H, '', p.join(''));
}

/** Static AA emplacement after a kill: scorched pad, scattered sandbags, debris. */
export function aaSiteWreck() {
  const W = 64;
  const H = 64;
  const cx = 32;
  const cy = 32;
  const id = ids('sw');
  const pad = dEllipse(cx, cy, 19.5);
  const rand = rng(29);
  const p = [];
  p.push(soot(id, cx, cy, 31, 31, 0.6));
  const bags = [];
  const n = 22;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    if (Math.cos(a) < -0.93 || rand.chance(0.22)) continue;
    const rr = 25 + rand.range(-1.5, 3.5);
    bags.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, deg: (a * 180) / Math.PI + 90 + rand.range(-25, 25) });
  }
  const bag = (b, grow = 0) =>
    `<path d="${dRect(-4.3 - grow, -3.4 - grow, 8.6 + grow * 2, 6.8 + grow * 2, 2.6 + grow)}" transform="translate(${r2(b.x)},${r2(b.y)}) rotate(${r2(b.deg)})"`;
  p.push(bags.map((b) => `${bag(b, 1.8)} fill="${T.ink}"/>`).join(''));
  p.push(bags.map((b, i) => `${bag(b)} fill="${i % 3 === 0 ? '#5e5238' : '#7a6c4c'}"/>`).join(''));
  p.push(outline([pad], 1.4));
  p.push(cel(id, pad, '#4a4640', '#34302b', { s: 2 }));
  p.push(fill(dEllipse(cx + 1, cy + 1, 12, 11), '#0f0c0a', { opacity: 0.85 }));
  p.push(fill(dEllipse(cx + 2, cy + 2, 6, 5), T.rust, { opacity: 0.5 }));
  // Twisted gun barrels and a crushed dish.
  p.push(`<g transform="translate(36,22) rotate(-35)">${outline([dRect(0, 0, 12, 3, 1.2), dRect(1, 5, 9, 3, 1.2)], 1.4)}${fill(dRect(0, 0, 12, 3, 1.2), '#26221f')}${fill(dRect(1, 5, 9, 3, 1.2), '#26221f')}</g>`);
  const dish = dEllipse(0, 0, 4, 9);
  p.push(`<g transform="translate(22,40) rotate(70)">${outline([dish], 1.6)}${cel(id, dish, '#6b675f', '#433f39', { s: 1.2 })}</g>`);
  return svg(W, H, '', p.join(''));
}

// ---------------------------------------------------------------------------
// SAM launcher — 70 × 38, two missiles pointing east, pivot centre (35,19).
// ---------------------------------------------------------------------------
export function samLauncher() {
  const c = ENEMY;
  const W = 70;
  const H = 38;
  const id = ids('sl');
  const base = dEllipse(35, 19, 11.5, 11);
  const arm = dRect(12, 14.5, 36, 9, 2.5);
  const missile = (y) =>
    `M7,${y - 3.1} L55,${y - 3.1} Q64,${y - 2.8} 67.2,${y} Q64,${y + 2.8} 55,${y + 3.1} L7,${y + 3.1} Q5.6,${y} 7,${y - 3.1}Z`;
  const finSet = (y) => [
    `M8,${y - 3} L11,${y - 7.4} L16,${y - 7.4} L17,${y - 3}Z`, `M8,${y + 3} L11,${y + 7.4} L16,${y + 7.4} L17,${y + 3}Z`,
    `M36,${y - 3} L38.5,${y - 5.8} L42.5,${y - 5.8} L43.5,${y - 3}Z`, `M36,${y + 3} L38.5,${y + 5.8} L42.5,${y + 5.8} L43.5,${y + 3}Z`,
  ];
  const ys = [9, 29];
  const p = [];
  p.push(contactShadow(id, [base, arm, ...ys.map(missile)], { blur: 1.8, opacity: 0.42, dx: 1.2, dy: 1.8, grow: 0.8 }));
  p.push(outline([base, arm, ...ys.flatMap((y) => [missile(y), ...finSet(y)])], 1.8));
  p.push(cel(id, base, c.sec, c.secD, { s: 2 }));
  p.push(cel(id, arm, c.base, c.d, { s: 2 }));
  p.push(strokeD('M16,19H44', c.dd, 1.2, { opacity: 0.7 }));
  for (const y of ys) {
    for (const f of finSet(y)) p.push(cel(id, f, '#c9c6bd', '#8f8c84', { s: 0.8, line: 0.6 }));
    p.push(cel(id, missile(y), '#f1efe8', '#b3b0a7', { s: 1.4, sx: 0 }));
    // Crimson warhead band, dark seeker tip, exhaust nozzle.
    const cid = id();
    p.push(`<clipPath id="${cid}"><path d="${missile(y)}"/></clipPath><g clip-path="url(#${cid})">${fill(dRect(48, y - 4, 4.5, 8, 0), c.base)}${fill(dRect(63.5, y - 4, 5, 8, 0), '#2a2430')}</g>`);
    p.push(strokeD(missile(y), T.ink, 0.8));
    p.push(fill(dRect(4.2, y - 2, 2.2, 4, 0.8), T.gunD));
    p.push(glint(`M10,${y - 1.6} L52,${y - 1.6}`, 1, '#ffffff', 0.7));
  }
  p.push(lamp(35, 19, 1.8, c.gid, c.glow, c.core));
  return svg(W, H, glowFor(c), p.join(''));
}
