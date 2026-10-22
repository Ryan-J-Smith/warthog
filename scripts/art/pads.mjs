// Hold-the-Line build-pad structures (art direction v1, 2026-10-22): friendly barracks, tank depot
// and bunker, each with a built-up level-2 variant. Drawn like the friendly HQ (hq.mjs): pale
// concrete, steel-blue roofs with white ID stripes, cyan lamps, thick ink outlines + cel shading.
//
// Level 1 is 220 × 220 (≈200 u footprint), level 2 is 250 × 250; both sit inside the 150 u pad
// circle. Structures never rotate. No tan apron: the ground under them is a neutral soft shadow,
// so they work on both the steppe and the winter biome.
import { svg } from './lib.mjs';
import { T, dRect, dEllipse, dRound, ids, fill, strokeD, outline, cel, glint, glowDefs, lamp } from './style.mjs';
import { FRIEND, CONC, CONC_D, CONC_L, block, wallRun, flag, shed, fuelTank, crates, drums, mast, dish, nest, bastion } from './hq.mjs';

const team = FRIEND;
const defs = () => glowDefs(team.gid, team.core, team.glow);

/** Neutral soft ground shadow + a chamfered concrete slab with seams and blue corner marks. */
function slab(id, c, r) {
  const pts = [[c - r * 0.62, c - r], [c + r * 0.62, c - r], [c + r, c - r * 0.62], [c + r, c + r * 0.62], [c + r * 0.62, c + r], [c - r * 0.62, c + r], [c - r, c + r * 0.62], [c - r, c - r * 0.62]];
  const d = dRound(pts, 6);
  let s = `<ellipse cx="${c + 3}" cy="${c + 4}" rx="${r + 10}" ry="${r + 10}" fill="#000" opacity="0.16"/>`;
  s += outline([d], 1.6) + cel(id, d, '#a9a69d', '#8d8a81', { s: 3 });
  for (let k = -2; k <= 2; k++) {
    s += strokeD(`M${c + k * r * 0.36},${c - r + 3}V${c + r - 3}`, '#8f8c83', 0.8, { opacity: 0.7 });
    s += strokeD(`M${c - r + 3},${c + k * r * 0.36}H${c + r - 3}`, '#8f8c83', 0.8, { opacity: 0.7 });
  }
  // Blue/white hazard chevrons on the four chamfers (the friendly build-pad marking).
  for (const [x, y, deg] of [[c - r * 0.83, c - r * 0.83, -45], [c + r * 0.83, c - r * 0.83, 45], [c + r * 0.83, c + r * 0.83, 135], [c - r * 0.83, c + r * 0.83, -135]]) {
    s += `<g transform="translate(${x},${y}) rotate(${deg})">${fill(dRect(-9, -2, 18, 4, 1), T.blue)}${fill(dRect(-3, -2, 6, 4, 0), team.flag)}</g>`;
  }
  return s;
}

/** Steel-blue roofed building with white ID stripes along its length and roof vents. */
function hall(id, x, y, w, h, { stripes = true, vents = 3 } = {}) {
  const d = dRect(x, y, w, h, 3);
  let s = block(id, d, team.roof, team.roofD, 2.6, 1.9);
  if (stripes) for (const yy of [y + 4, y + h - 7]) s += fill(dRect(x + 4, yy, w - 8, 3, 0.8), T.blue, { opacity: 0.95 });
  for (let i = 0; i < vents; i++) {
    const vx = x + ((i + 1) * w) / (vents + 1);
    s += block(id, dRect(vx - 4, y + h / 2 - 3.5, 8, 7, 1.2), CONC_L, CONC_D, 0.9, 1);
  }
  return s + glint(`M${x + 5},${y + 2.4} H${x + w * 0.6}`, 1.3, '#ffffff', 0.45);
}

/** Roller-door bay on a building's south face: dark opening with a white/blue threshold stripe. */
function bayDoor(x, y, w) {
  return (
    fill(dRect(x, y - 2, w, 6, 1), T.steelD, { stroke: T.ink, 'stroke-width': 0.9 }) +
    strokeD(`M${x + 2},${y}H${x + w - 2} M${x + 2},${y + 2}H${x + w - 2}`, T.steel, 0.7) +
    fill(dRect(x + 1, y + 5, w - 2, 2.2, 0), team.flag, { opacity: 0.85 })
  );
}

/** Painted walkway arrow on the slab (white chevrons pointing `deg`). */
function arrow(x, y, deg) {
  return `<g transform="translate(${x},${y}) rotate(${deg})">${strokeD('M-6,-6 L0,0 L-6,6 M2,-6 L8,0 L2,6', '#f4f2ea', 2.4, { opacity: 0.8 })}</g>`;
}

// ---------------------------------------------------------------------------
// Barracks: mech hangars (gantry bays the walkers march out of) + crew huts.
// ---------------------------------------------------------------------------
function barracks(level) {
  const S = level === 2 ? 250 : 220;
  const c = S / 2;
  const o = (S - 220) / 2;
  const id = ids(`pb${level}`);
  const p = [];
  p.push(slab(id, c, level === 2 ? 112 : 98));
  if (level === 2) {
    // Blast wall along the slab's flat north edge (inside the chamfers).
    const [wInk, wFill] = wallRun([[c - 64, o + 9], [c + 64, o + 9]], { color: CONC_L, colorD: CONC, cap: team.roofD });
    p.push(`<g fill="${T.ink}">${wInk}</g>`, wFill);
  }
  // Mech hangar: wide hall with two open gantry bays facing south.
  p.push(hall(id, o + 36, o + 34, 148, 62, { vents: 4 }));
  p.push(bayDoor(o + 52, o + 94, 40), bayDoor(o + 128, o + 94, 40));
  // Blue double chevron on the hangar roof (the friendly HQ's mark).
  p.push(outline([dRect(o + 95, o + 48, 30, 30, 2.5)], 1.2), cel(id, dRect(o + 95, o + 48, 30, 30, 2.5), '#3f8ef0', '#1f5aa8', { s: 1.4 }));
  p.push(strokeD(`M${o + 101},${o + 63} L${o + 110},${o + 55} L${o + 119},${o + 63} M${o + 101},${o + 72} L${o + 110},${o + 64} L${o + 119},${o + 72}`, '#ffffff', 3));
  // Walkway arrows out of the bays.
  for (const x of [o + 72, o + 148]) p.push(arrow(x, o + 120, 90), arrow(x, o + 138, 90));
  // Crew huts (steel containers with blue end bands).
  const huts = level === 2 ? 4 : 3;
  for (let i = 0; i < huts; i++) {
    const x = o + 30 + i * (level === 2 ? 26 : 24);
    p.push(shed(id, x, o + 152, 18, 40, i % 2 ? T.steel : T.steelL, T.steelD, false));
    p.push(fill(dRect(x + 1.5, o + 153.5, 15, 3, 0.6), T.blue));
  }
  // Supply corner: crates + drums, flag, lamps.
  p.push(crates(id, o + 150, o + 154, 3, 2, '#77827c', '#58625d'), drums(id, o + 156, o + 176, 4, 2));
  p.push(flag(o + 190, o + 120, team, -1));
  p.push(lamp(o + 40, o + 38, 1.6, team.gid, team.glow, team.core), lamp(o + 180, o + 38, 1.6, team.gid, team.glow, team.core));
  if (level === 2) {
    p.push(mast(id, S - 40, 72, 14, lamp(S - 40, 72, 2, team.gid, team.glow, team.core), false));
    p.push(dish(id, 40, 72, 10, 13, 35, team.glow, false));
    p.push(nest(o + 18, c + 40, 180, false), nest(S - o - 18, c + 40, 0, false));
  }
  return svg(S, S, defs(), p.join(''));
}

// ---------------------------------------------------------------------------
// Tank depot: vehicle shed with roller-door bays onto a hardstand, fuel and parts.
// ---------------------------------------------------------------------------
function depot(level) {
  const S = level === 2 ? 250 : 220;
  const c = S / 2;
  const o = (S - 220) / 2;
  const id = ids(`pd${level}`);
  const p = [];
  p.push(slab(id, c, level === 2 ? 112 : 98));
  // Vehicle shed: long hall, bay doors on the south face.
  const bays = level === 2 ? 4 : 3;
  const shedW = level === 2 ? 176 : 150;
  const sx = c - shedW / 2;
  p.push(hall(id, sx, o + 30, shedW, 66, { vents: bays }));
  const bw = (shedW - 16) / bays;
  for (let i = 0; i < bays; i++) p.push(bayDoor(sx + 8 + i * bw + 3, o + 94, bw - 6));
  // Hardstand: track marks rolling out of each bay.
  for (let i = 0; i < bays; i++) {
    const x = sx + 8 + i * bw + bw / 2;
    for (const dx of [-8, 8]) p.push(strokeD(`M${x + dx},${o + 104} V${o + 150}`, '#7c7970', 3.2, { opacity: 0.55, 'stroke-dasharray': '2.2 1.6' }));
  }
  // Fuel point (south-west) and parts / ammo (south-east).
  p.push(fuelTank(id, o + 46, o + 172, 15, team.flag, false));
  if (level === 2) p.push(fuelTank(id, o + 80, o + 178, 12, team.flag, false));
  p.push(crates(id, o + 140, o + 160, 3, 2, '#77827c', '#58625d'), drums(id, o + 150, o + 182, 5, 2));
  // Spare road wheels stacked by the shed.
  for (const [x, y] of [[o + 112, o + 166], [o + 122, o + 172], [o + 110, o + 180]]) {
    p.push(outline([dEllipse(x, y, 5)], 1), fill(dEllipse(x, y, 5), T.trk), fill(dEllipse(x, y, 2), T.trkL));
  }
  p.push(flag(o + 192, o + 160, team, -1));
  p.push(lamp(sx + 6, o + 34, 1.6, team.gid, team.glow, team.core), lamp(sx + shedW - 6, o + 34, 1.6, team.gid, team.glow, team.core));
  if (level === 2) {
    // Overhead gantry crane spanning the hardstand.
    const g = dRect(sx + 4, o + 118, shedW - 8, 7, 1.5);
    p.push(fill(dRect(sx + 7, o + 122, shedW - 8, 7, 1.5), '#000', { opacity: 0.2 }));
    p.push(block(id, g, '#e0b43a', '#a8841f', 1.2, 1.4));
    for (let x = sx + 12; x < sx + shedW - 8; x += 10) p.push(strokeD(`M${x},${o + 118.6} l6,5.8`, T.ink, 0.8, { opacity: 0.6 }));
    for (const x of [sx + 4, sx + shedW - 12]) p.push(block(id, dRect(x, o + 114, 8, 15, 1.2), T.steel, T.steelD, 1, 1.4));
  }
  return svg(S, S, defs(), p.join(''));
}

// ---------------------------------------------------------------------------
// Bunker: earth-and-sandbag strongpoint with hull-down tank slots around a concrete pillbox.
// ---------------------------------------------------------------------------

/** Dug-in tank slot: a U-shaped berm open to the rear (the tank sits in it, facing out along `deg`). */
function slot(id, x, y, deg) {
  const berm = dRound([[-30, -26], [24, -26], [34, -14], [34, 14], [24, 26], [-30, 26], [-30, 17], [20, 17], [24, 12], [24, -12], [20, -17], [-30, -17]], 4);
  const pit = dRect(-28, -16, 50, 32, 4);
  return (
    `<g transform="translate(${x},${y}) rotate(${deg})">` +
    fill(pit, '#6f6858', { opacity: 0.9 }) +
    fill(dRect(-24, -12, 42, 24, 3), '#5d5749', { opacity: 0.8 }) +
    outline([berm], 1.6) +
    cel(id, berm, T.bag, T.bagD, { s: 2.2 }) +
    strokeD('M24,-20 Q31,0 24,20', T.bagD, 0.9, { 'stroke-dasharray': '3 2' }) +
    `</g>`
  );
}

function bunker(level) {
  const S = level === 2 ? 250 : 220;
  const c = S / 2;
  const id = ids(`pk${level}`);
  const p = [];
  p.push(slab(id, c, level === 2 ? 112 : 98));
  // Outer sandbag ring, broken by the tank slots.
  p.push(strokeD(dEllipse(c, c, level === 2 ? 98 : 86), T.ink, 9) + strokeD(dEllipse(c, c, level === 2 ? 98 : 86), T.bag, 5.6));
  p.push(strokeD(dEllipse(c, c, level === 2 ? 98 : 86), T.bagD, 1, { 'stroke-dasharray': '4 3' }));
  // Hull-down slots: 3 at level 1, 5 at level 2, facing outward.
  const n = level === 2 ? 5 : 3;
  const rr = level === 2 ? 74 : 62;
  for (let i = 0; i < n; i++) {
    const deg = -90 + (360 / n) * i;
    const a = (deg * Math.PI) / 180;
    p.push(slot(id, c + Math.cos(a) * rr, c + Math.sin(a) * rr, deg));
  }
  // Central concrete pillbox: thick octagon with firing slits and a blue-roofed cupola.
  const R = level === 2 ? 30 : 26;
  const box = dRound(Array.from({ length: 8 }, (_, k) => [c + Math.cos((k * Math.PI) / 4 + Math.PI / 8) * R, c + Math.sin((k * Math.PI) / 4 + Math.PI / 8) * R]), 3);
  p.push(block(id, box, CONC_L, CONC_D, 3, 2));
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    p.push(`<g transform="translate(${c + Math.cos(a) * (R - 3)},${c + Math.sin(a) * (R - 3)}) rotate(${k * 45})">${fill(dRect(-1.2, -4, 2.4, 8, 0.8), T.ink)}</g>`);
  }
  p.push(cel(id, dEllipse(c, c, R * 0.52), team.roof, team.roofD, { s: 1.8 }));
  p.push(fill(dRect(c - R * 0.5, c - 1.6, R, 3.2, 0.8), T.blue, { opacity: 0.95 }));
  p.push(lamp(c + R * 0.26, c - R * 0.26, 1.8, team.gid, team.glow, team.core));
  p.push(glint(`M${c - R * 0.7},${c - R * 0.55} Q${c - R * 0.2},${c - R * 0.85} ${c + R * 0.3},${c - R * 0.78}`, 1.3, '#ffffff', 0.5));
  // Ammo crates by the pillbox; level 2 adds corner bastions, MG nests and a comms mast.
  p.push(crates(id, c + R + 4, c + R - 2, 2, 1, '#77827c', '#58625d'), crates(id, c - R - 22, c - R - 4, 2, 1, '#77827c', '#58625d'));
  if (level === 2) {
    for (const [x, y] of [[c - 80, c - 80], [c + 80, c - 80], [c - 80, c + 80], [c + 80, c + 80]]) p.push(bastion(id, x, y, team, false));
    p.push(nest(c, c + 100, 90, false));
    p.push(mast(id, c - R - 14, c + R + 10, 12, lamp(c - R - 14, c + R + 10, 1.8, team.gid, team.glow, team.core), false));
  }
  p.push(flag(c + 4, c + R + 14, team));
  return svg(S, S, defs(), p.join(''));
}

// ---------------------------------------------------------------------------
// Flak battery: twin-barrel AA mounts in sandbagged pits (shoots gunships only). The main mount is
// at the pad centre (where the shells leave from); barrels point north-east, unrotated.
// ---------------------------------------------------------------------------

/** Sandbagged gun pit: a ring of bags around a dark floor. */
function gunPit(id, x, y, r) {
  let ink = '';
  let fills = '';
  const n = Math.round((r * 2 * Math.PI) / 7.5);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const tf = `translate(${(x + Math.cos(a) * r).toFixed(2)},${(y + Math.sin(a) * r).toFixed(2)}) rotate(${((a * 180) / Math.PI + 90).toFixed(1)})`;
    ink += `<path d="${dRect(-5, -3.8, 10, 7.6, 3.2)}" transform="${tf}" fill="${T.ink}"/>`;
    fills += `<path d="${dRect(-3.8, -2.7, 7.6, 5.4, 2.4)}" transform="${tf}" fill="${i % 3 ? T.bag : T.bagD}"/>`;
  }
  return fill(dEllipse(x, y, r - 1), '#5d5749', { stroke: T.ink, 'stroke-width': 0.9 }) + ink + fills;
}

/** Twin-barrel AA mount: steel-blue turret with a white band, two long barrels toward `deg`. */
function flakMount(id, x, y, size, deg) {
  const k = size / 20;
  const body = dRound([[-12, -11], [6, -11], [11, -6], [11, 6], [6, 11], [-12, 11], [-15, 7], [-15, -7]].map(([u, v]) => [u * k, v * k]), 4 * k);
  const barrels = [-5, 5].map((v) => dRect(8 * k, (v - 1.8) * k, 26 * k, 3.6 * k, 1.2 * k));
  const brakes = [-5, 5].map((v) => dRect(30 * k, (v - 2.6) * k, 6 * k, 5.2 * k, 1.4 * k));
  return (
    `<g transform="translate(${x},${y}) rotate(${deg})">` +
    fill(body, '#000', { opacity: 0.28, transform: `translate(${2 * k},${3 * k})` }) +
    outline([...barrels, ...brakes, body], 1.8) +
    barrels.map((d) => cel(id, d, T.gunL, T.gunD, { s: 1.2, sx: 0 })).join('') +
    brakes.map((d) => cel(id, d, T.gun, T.gunD, { s: 1.2, sx: 0 })).join('') +
    cel(id, body, team.roof, team.roofD, { s: 2.4 }) +
    fill(dRect(-4 * k, -10.4 * k, 3.4 * k, 20.8 * k, 0.6), T.blue, { opacity: 0.95 }) +
    cel(id, dEllipse(-8 * k, 0, 4 * k), team.roofD, T.fDD, { s: 1 }) +
    lamp(4 * k, -6 * k, 1.5 * k, team.gid, team.glow, team.core) +
    glint(`M${-12 * k},${-8.6 * k} H${4 * k}`, 1.2, '#ffffff', 0.5) +
    `</g>`
  );
}

function flak(level) {
  const S = level === 2 ? 250 : 220;
  const c = S / 2;
  const id = ids(`pf${level}`);
  const p = [];
  p.push(slab(id, c, level === 2 ? 112 : 98));
  // Main twin mount at the pad centre.
  p.push(gunPit(id, c, c, level === 2 ? 38 : 37));
  p.push(flakMount(id, c, c, level === 2 ? 30 : 29, -45));
  // Ready-ammo crates, fire-control cabin with radar dish, flag.
  p.push(crates(id, c - 62, c + 40, 3, 2, '#77827c', '#58625d'), crates(id, c + 34, c + 46, 3, 1, '#77827c', '#58625d'));
  p.push(block(id, dRect(c - 70, c - 66, 34, 24, 2.4), CONC_L, CONC_D, 1.8, 1.6), cel(id, dRect(c - 66, c - 62, 26, 16, 1.6), team.roof, team.roofD, { s: 1.2 }));
  p.push(fill(dRect(c - 66, c - 56, 26, 3, 0), T.blue, { opacity: 0.95 }));
  p.push(dish(id, c - 26, c - 62, 11, 14, 40, team.glow, false));
  p.push(flag(c + 52, c - 70, team));
  if (level === 2) {
    // Two more twin mounts east and west, a radar mast and MG nests.
    for (const x of [c - 70, c + 70]) {
      p.push(gunPit(id, x, c + 8, 22), flakMount(id, x, c + 8, 15, -45));
    }
    p.push(mast(id, c + 70, c - 62, 14, lamp(c + 70, c - 62, 2, team.gid, team.glow, team.core), false));
    p.push(nest(c, c + 90, 90, false));
  } else {
    p.push(lamp(c + 60, c + 10, 1.6, team.gid, team.glow, team.core), lamp(c - 60, c + 10, 1.6, team.gid, team.glow, team.core));
  }
  return svg(S, S, defs(), p.join(''));
}

export const structFlak = () => flak(1);
export const structFlak2 = () => flak(2);
export const structBarracks = () => barracks(1);
export const structBarracks2 = () => barracks(2);
export const structDepot = () => depot(1);
export const structDepot2 = () => depot(2);
export const structBunker = () => bunker(1);
export const structBunker2 = () => bunker(2);
