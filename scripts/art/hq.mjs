// Lane-mission headquarters (art direction v1): enemy command bunker/depot and friendly
// fortified base, 300 × 260 each, plus destroyed variants drawn from the same layout.
//
// Muted ground detail (packed earth, concrete, sandbags) like the v0 structures, but every
// building, wall and mast gets the units' thick ink outline + cel shading so the HQs read as
// objectives from High zoom. Enemy: crimson roofs, red flags, radar mast, gate on the WEST side.
// Friendly: steel-blue roofs with white ID stripes, blue flags, comms dish, gate on the EAST side.
import { svg, r2, rad, rng } from './lib.mjs';
import { T, dRect, dEllipse, dRound, ids, fill, strokeD, outline, cel, glint, glowDefs, lamp } from './style.mjs';

const W = 300;
const H = 260;
/** Structure outline width (a touch under the units' 2.0: these are big, busy sprites). */
const SW = 1.7;

const ENEMY = { roof: T.e, roofL: T.eL, roofD: T.eD, flag: '#d8392b', flagD: '#8c2118', glow: T.glow, core: T.glowHi, gid: 'gE' };
export const FRIEND = { roof: T.f, roofL: T.fL, roofD: T.fD, flag: '#3f8ef0', flagD: '#1f5aa8', glow: T.cyan, core: T.cyanHi, gid: 'gF' };

export const CONC = '#a29f95';
export const CONC_D = '#7b786f';
export const CONC_L = '#bdbab0';

/** An outlined, cel-shaded block. */
export const block = (id, d, base, shade, s = 2.4, ow = SW) => outline([d], ow) + cel(id, d, base, shade, { s });

/** Soft ground apron + soot / crater gradients shared by both HQs. */
function groundDefs(burnt) {
  return (
    rad('apron', 0.5, 0.5, 0.5, burnt ? [[0, '#3d3529', 0.75], [0.7, '#4a4032', 0.6], [1, '#4a4032', 0]] : [[0, '#9c8a62', 0.65], [0.72, '#9c8a62', 0.5], [1, '#9c8a62', 0]]) +
    rad('soot', 0.5, 0.5, 0.5, [[0, T.soot, 0.8], [0.55, T.soot, 0.45], [1, T.soot, 0]]) +
    rad('crater', 0.5, 0.5, 0.5, [[0, '#0f0d0a'], [0.5, '#2c261d'], [0.78, '#6d5d42'], [1, '#6d5d42', 0]])
  );
}

/** Concrete T-wall slabs along a polyline; `skip(i)` leaves breaches/gates. Returns [ink, fills]. */
export function wallRun(pts, { thick = 5, slab = 7.2, color = CONC, colorD = CONC_D, cap = null, skip = () => false, rand = null } = {}) {
  let ink = '';
  let fills = '';
  let k = 0;
  for (let s = 0; s < pts.length - 1; s++) {
    const [x1, y1] = pts[s];
    const [x2, y2] = pts[s + 1];
    const len = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(1, Math.round(len / slab));
    const deg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    for (let i = 0; i < n; i++, k++) {
      if (skip(k)) continue;
      const t = (i + 0.5) / n;
      const jitter = rand ? rand.range(-14, 14) : 0;
      const tf = `translate(${r2(x1 + (x2 - x1) * t)},${r2(y1 + (y2 - y1) * t)}) rotate(${r2(deg + jitter)})`;
      const w = len / n - 0.8;
      ink += `<path d="${dRect(-w / 2 - SW, -thick / 2 - SW, w + SW * 2, thick + SW * 2, 1.4 + SW)}" transform="${tf}"/>`;
      fills +=
        `<g transform="${tf}">` +
        fill(dRect(-w / 2, -thick / 2, w, thick, 1.2), k % 4 === 0 ? colorD : color) +
        fill(dRect(-w / 2, thick / 2 - 1.4, w, 1.4, 0), '#000', { opacity: 0.22 }) +
        (cap ? fill(dRect(-w / 2, -thick / 2, w, 1.6, 0.6), cap) : '') +
        `</g>`;
    }
  }
  return [ink, fills];
}

/** Square guard tower: concrete base, coloured roof, a lamp. */
export function tower(id, x, y, team, burnt) {
  const base = dRect(x - 9, y - 9, 18, 18, 2);
  const roof = dRect(x - 6.4, y - 6.4, 12.8, 12.8, 1.6);
  if (burnt) return block(id, base, '#3a3530', '#25211d', 1.6) + fill(roof, '#120f0d') + strokeD(`M${x - 5},${y - 3} L${x + 4},${y + 5}`, T.bL, 1.2);
  return (
    block(id, base, CONC, CONC_D, 1.8) +
    cel(id, roof, team.roof, team.roofD, { s: 1.4 }) +
    lamp(x + 3.4, y - 3.4, 1.4, team.gid, team.glow, team.core, { halo: 2.2 })
  );
}

/** Flag on a pole, with its ground shadow. */
export function flag(x, y, team, flip = 1) {
  const f = (dx, dy) =>
    `M${x + 1 + dx},${y - 4 + dy} Q${x + 6 * flip + dx},${y - 5.8 + dy} ${x + 10 * flip + dx},${y - 4.4 + dy} Q${x + 14 * flip + dx},${y - 3 + dy} ${x + 16 * flip + dx},${y - 4.6 + dy}` +
    ` L${x + 16 * flip + dx},${y + 4.4 + dy} Q${x + 13 * flip + dx},${y + 6 + dy} ${x + 9 * flip + dx},${y + 4.6 + dy} Q${x + 5 * flip + dx},${y + 3.4 + dy} ${x + 1 + dx},${y + 5 + dy}Z`;
  return (
    fill(f(3, 4), '#000', { opacity: 0.25 }) +
    outline([f(0, 0)], 1) +
    fill(f(0, 0), team.flag) +
    fill(`M${x + 9 * flip},${y - 4.6} Q${x + 12 * flip},${y - 3.4} ${x + 16 * flip},${y - 4.6} L${x + 16 * flip},${y + 4.4} Q${x + 13 * flip},${y + 6} ${x + 9 * flip},${y + 4.6}Z`, team.flagD, { opacity: 0.6 }) +
    fill(dEllipse(x, y, 1.8), '#d8d4c8', { stroke: T.ink, 'stroke-width': 0.8 })
  );
}

/** Long shed with a corrugated roof. */
export function shed(id, x, y, w, h, roof, roofD, burnt) {
  const d = dRect(x, y, w, h, 2);
  if (burnt) {
    let s = block(id, d, '#2a2521', '#1a1714', 1.6);
    for (let i = 1; i < w / 6; i++) s += strokeD(`M${x + i * 6},${y + 1.5} L${x + i * 6 + (i % 2 ? 2 : -2)},${y + h - 1.5}`, T.bL, 1);
    return s + fill(dEllipse(x + w * 0.55, y + h * 0.5, w * 0.22, h * 0.32), '#0d0b09', { opacity: 0.8 });
  }
  let s = block(id, d, roof, roofD, 2);
  for (let i = 1; i < w / 4.5; i++) s += strokeD(`M${x + i * 4.5},${y + 1.2}V${y + h - 1.2}`, roofD, 0.7, { opacity: 0.55 });
  return s + glint(`M${x + 3},${y + 2.2} H${x + w * 0.6}`, 1.1, '#ffffff', 0.35);
}

/** Fuel tank (round, seen from above) with a coloured band. */
export function fuelTank(id, x, y, r, band, burnt) {
  const d = dEllipse(x, y, r);
  if (burnt) return block(id, d, '#2a2622', '#171411', 1.6) + fill(dEllipse(x + 1, y + 1, r * 0.6, r * 0.5), '#0b0908') + strokeD(`M${x - r * 0.6},${y - r * 0.2} L${x + r * 0.2},${y + r * 0.7}`, T.rust, 1.2);
  return (
    block(id, d, '#7d8370', '#565b4c', 2) +
    strokeD(dEllipse(x, y, r * 0.72), band, 2) +
    fill(dEllipse(x, y, r * 0.28), '#5d6252', { stroke: T.ink, 'stroke-width': 0.7 }) +
    glint(`M${x - r * 0.6},${y - r * 0.45} Q${x - r * 0.2},${y - r * 0.8} ${x + r * 0.2},${y - r * 0.75}`, 1.2, '#ffffff', 0.45)
  );
}

/** Crate stack (cols × rows). */
export function crates(id, x, y, cols, rows, base = T.crate, shade = T.crateD) {
  let s = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const d = dRect(x + c * 9, y + r * 7.4, 8.2, 6.6, 1);
      s += block(id, d, base, shade, 1, 1.1) + strokeD(`M${x + c * 9 + 1.2},${y + r * 7.4 + 3.3}H${x + c * 9 + 7}`, shade, 0.7);
    }
  }
  return s;
}

/** Fuel drums (cols × rows). */
export function drums(id, x, y, cols, rows, color = '#5f6a4a', top = '#7d8a5f') {
  let s = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = x + c * 5.6 + (r % 2 ? 2.8 : 0);
      const cy = y + r * 5;
      s += outline([dEllipse(cx, cy, 2.5)], 0.9) + fill(dEllipse(cx, cy, 2.5), color) + fill(dEllipse(cx - 0.5, cy - 0.5, 1.4), top);
    }
  }
  return s;
}

/** Helipad: concrete disc, team-coloured ring, white H. */
export function helipad(id, x, y, r, ring, burnt) {
  const d = dEllipse(x, y, r);
  if (burnt) return block(id, d, '#4a4640', '#34302b', 1.6) + fill(dEllipse(x + 3, y - 2, r * 0.45, r * 0.38), 'url(#crater)');
  return (
    block(id, d, CONC, CONC_D, 1.6, 1.4) +
    strokeD(dEllipse(x, y, r - 3), ring, 2.2) +
    fill(`M${x - 6},${y - 7}h3v5.6h6v-5.6h3v14h-3v-5.6h-6v5.6h-3Z`, '#f4f2ea', { stroke: T.ink, 'stroke-width': 0.6 })
  );
}

/** Lattice radio/radar mast (square base with X bracing). Fallen when burnt. */
export function mast(id, x, y, size, top, burnt) {
  const h = size / 2;
  if (burnt) {
    const len = size * 3.2;
    return (
      `<g transform="translate(${x},${y}) rotate(28)">` +
      outline([dRect(-2, -h * 0.6, len, h * 1.2, 1)], 1.2) +
      fill(dRect(-2, -h * 0.6, len, h * 1.2, 1), '#2e2a26') +
      Array.from({ length: Math.floor(len / 6) }, (_, i) => strokeD(`M${i * 6},${-h * 0.6} L${i * 6 + 6},${h * 0.6}`, '#4a443d', 0.8)).join('') +
      `</g>`
    );
  }
  const base = dRect(x - h, y - h, size, size, 1);
  return (
    fill(dRect(x - h + 4, y - h + 5, size, size, 1), '#000', { opacity: 0.22 }) +
    outline([base], 1.4) +
    fill(base, '#6d7169') +
    strokeD(`M${x - h},${y - h} L${x + h},${y + h} M${x + h},${y - h} L${x - h},${y + h} M${x - h * 0.5},${y - h * 0.5}h${size * 0.5}v${size * 0.5}h${-size * 0.5}Z`, '#b9bdb3', 1.1) +
    strokeD(base, T.ink, 0.8) +
    top
  );
}

/** Pale radar/comms dish at an angle. */
export function dish(id, x, y, rx, ry, deg, feed, burnt) {
  const d = dEllipse(0, 0, rx, ry);
  return (
    `<g transform="translate(${x},${y}) rotate(${deg})">` +
    outline([d], 1.5) +
    cel(id, d, burnt ? '#5a564f' : T.dish, burnt ? '#3a3631' : T.dishD, { s: 1.6 }) +
    strokeD(dEllipse(0, 0, rx * 0.62, ry * 0.62), burnt ? '#3a3631' : T.dishD, 0.8) +
    (burnt ? fill(dEllipse(rx * 0.2, ry * 0.1, rx * 0.4, ry * 0.3), '#15120f') : fill(dEllipse(rx * 0.25, 0, 1.6), feed, { stroke: T.ink, 'stroke-width': 0.6 })) +
    `</g>`
  );
}

/** Sandbag fighting position: an arc of bags facing `deg` around a dark pit with an MG. */
export function nest(x, y, deg, burnt) {
  let ink = '';
  let fills = '';
  for (let i = 0; i < 8; i++) {
    const a = ((deg - 105 + i * 30) * Math.PI) / 180;
    const bx = x + Math.cos(a) * 8.6;
    const by = y + Math.sin(a) * 8.6;
    const tf = `translate(${r2(bx)},${r2(by)}) rotate(${r2((a * 180) / Math.PI + 90)})`;
    ink += `<path d="${dRect(-4.4, -3.4, 8.8, 6.8, 2.8)}" transform="${tf}" fill="${T.ink}"/>`;
    fills += `<path d="${dRect(-3.2, -2.4, 6.4, 4.8, 2)}" transform="${tf}" fill="${burnt ? (i % 3 ? '#4a4336' : '#3b352c') : i % 3 ? T.bag : T.bagD}"/>`;
  }
  const pit = fill(dEllipse(x, y, 7), burnt ? '#15120f' : '#4a4232', { stroke: T.ink, 'stroke-width': 0.8 });
  const mg = burnt ? '' : `<g transform="translate(${x},${y}) rotate(${deg})">${fill(dRect(-1.5, -1.3, 8.5, 2.6, 0.8), T.gun, { stroke: T.ink, 'stroke-width': 0.6 })}</g>`;
  return pit + ink + fills + mg;
}

/** Scattered debris chips + craters + soot for destroyed variants. */
function ruin(rand, craters, soots) {
  let s = soots.map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#soot)"/>`).join('');
  s += craters.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#crater)"/>`).join('');
  for (let i = 0; i < 90; i++) {
    s += fill(dRect(0, 0, rand.range(1.5, 5), rand.range(1, 3), 0.4), rand.pick(['#1a1815', '#2c2925', T.rust, '#4d4841', '#6b604a', '#8a857b']), {
      transform: `translate(${r2(rand.range(26, 274))},${r2(rand.range(26, 234))}) rotate(${r2(rand.range(0, 180))})`,
    });
  }
  return s;
}

// ---------------------------------------------------------------------------
// Enemy HQ — command bunker in an earth berm, radar mast, fuel farm, vehicle sheds, helipad.
// Gate (and the dirt road in) on the west wall at y ≈ 130.
// ---------------------------------------------------------------------------
function enemyHqLayout(burnt) {
  const team = ENEMY;
  const id = ids(burnt ? 'ex' : 'eh');
  const rand = rng(burnt ? 812 : 811);
  const a = 24;
  const b = 276;
  const top = 24;
  const bot = 236;
  const ch = 22;
  const p = [];
  p.push(`<ellipse cx="150" cy="130" rx="150" ry="130" fill="url(#apron)"/>`);
  // Road in from the west.
  p.push(fill('M0,121 C30,120 60,122 104,124 L104,136 C60,138 30,140 0,139Z', burnt ? '#4a4032' : '#8f7c55', { opacity: 0.7 }));
  // Compound floor: packed earth inside the perimeter.
  const floorPts = [[a + ch, top], [b - ch, top], [b, top + ch], [b, bot - ch], [b - ch, bot], [a + ch, bot], [a, bot - ch], [a, top + ch]];
  p.push(fill(dRound(floorPts, 2), burnt ? '#55493a' : '#ad9a70'));
  // Perimeter T-walls, gate gap on the west wall; breaches when destroyed.
  const gateY = [112, 148];
  const wallPts = [[a, gateY[0]], [a, top + ch], [a + ch, top], [b - ch, top], [b, top + ch], [b, bot - ch], [b - ch, bot], [a + ch, bot], [a, bot - ch], [a, gateY[1]]];
  const breaches = new Set([9, 10, 31, 32, 33, 58, 59, 80, 81]);
  const [wInk, wFill] = wallRun(wallPts, {
    color: burnt ? '#4a4640' : '#8f8b81',
    colorD: burnt ? '#34302b' : '#77736a',
    cap: burnt ? null : team.roofD,
    skip: (k) => burnt && breaches.has(k),
    rand: burnt ? rand : null,
  });
  p.push(`<g fill="${T.ink}">${wInk}</g>`, wFill);
  for (const [x, y] of [[a + 8, top + 8], [b - 8, top + 8], [b - 8, bot - 8], [a + 8, bot - 8]]) p.push(tower(id, x, y, team, burnt));
  // Gate: guardhouse + a striped boom.
  p.push(block(id, dRect(30, 92, 14, 14, 1.6), burnt ? '#3a3530' : CONC, burnt ? '#25211d' : CONC_D, 1.4));
  if (!burnt) {
    p.push(cel(id, dRect(32.4, 94.4, 9.2, 9.2, 1.2), team.roof, team.roofD, { s: 1 }));
    p.push(outline([dRect(23, 111, 3.4, 28, 1.2)], 1) + fill(dRect(23, 111, 3.4, 28, 1.2), '#f4f2ea'));
    for (const y of [114, 120, 126, 132]) p.push(fill(dRect(23, y, 3.4, 3, 0), team.flag));
  }
  // Fuel farm in a berm (north-west).
  p.push(fill(dRound([[44, 36], [118, 36], [124, 42], [124, 72], [118, 78], [44, 78], [38, 72], [38, 42]], 6), burnt ? '#3d3529' : '#9c8a62', { stroke: burnt ? '#2a241c' : '#7d6c4a', 'stroke-width': 2.4 }));
  p.push(fuelTank(id, 62, 57, 13, team.roof, burnt), fuelTank(id, 98, 57, 13, team.roof, burnt));
  // Command bunker: earth berm, concrete block, crimson armoured roof, vents, emblem.
  p.push(fill(dRound([[108, 72], [214, 72], [226, 84], [226, 168], [214, 180], [108, 180], [96, 168], [96, 84]], 12), burnt ? '#4a4032' : '#b8a57a', { stroke: burnt ? '#2a241c' : '#8f7d57', 'stroke-width': 2 }));
  p.push(fill('M96,118 L112,118 L112,142 L96,142Z', burnt ? '#2a241c' : '#7d6c4a'));
  const bunker = dRound([[118, 84], [204, 84], [214, 94], [214, 158], [204, 168], [118, 168], [110, 160], [110, 92]], 3);
  if (burnt) {
    p.push(block(id, bunker, '#4a4640', '#34302b', 2.6, 2));
    p.push(fill(dRound([[128, 98], [170, 92], [196, 108], [192, 150], [150, 158], [124, 140]], 6), '#0d0b09'));
    for (const [x1, y1, x2, y2] of [[132, 104, 160, 128], [150, 96, 176, 132], [170, 110, 186, 146], [140, 146, 168, 120]]) p.push(strokeD(`M${x1},${y1} L${x2},${y2}`, '#5a5048', 1.2));
    p.push(fill(dEllipse(160, 124, 18, 14), T.rust, { opacity: 0.35 }));
  } else {
    p.push(block(id, bunker, CONC, CONC_D, 3, 2));
    const roof = dRound([[128, 94], [196, 94], [204, 102], [204, 150], [196, 158], [128, 158], [120, 150], [120, 102]], 3);
    p.push(cel(id, roof, team.roof, team.roofD, { s: 3 }));
    for (const x of [134, 150, 166, 182]) p.push(strokeD(`M${x},96 V156`, team.roofD, 1, { opacity: 0.6 }));
    // Vents (west), hatch, emblem (crimson diamond with dark core).
    for (const y of [104, 136]) {
      p.push(block(id, dRect(124, y, 12, 12, 1.6), T.ch, T.chD, 1.2, 1.1));
      p.push(strokeD(`M126,${y + 3}H134 M126,${y + 6}H134 M126,${y + 9}H134`, T.chL, 0.8));
    }
    p.push(outline([dRound([[164, 108], [182, 126], [164, 144], [146, 126]], 2)], 1.4));
    p.push(cel(id, dRound([[164, 108], [182, 126], [164, 144], [146, 126]], 2), T.eHi, T.eL, { s: 1.4 }));
    p.push(fill(dRound([[164, 117], [173, 126], [164, 135], [155, 126]], 1), T.eDD));
    p.push(cel(id, dEllipse(192, 140, 5), T.ch, T.chD, { s: 1 }));
    // Armoured door facing the gate.
    p.push(fill(dRect(108, 119, 5, 22, 1), T.ch, { stroke: T.ink, 'stroke-width': 0.9 }));
    p.push(lamp(114, 114, 1.6, team.gid, team.glow, team.core), lamp(114, 146, 1.6, team.gid, team.glow, team.core));
    p.push(glint('M124,92 H186', 1.4, '#ffffff', 0.4));
  }
  // Radar mast with a rotating crimson antenna bar (north-east).
  const antenna =
    `<g transform="translate(238,58) rotate(-24)">` +
    outline([dRect(-17, -2.6, 34, 5.2, 1.6)], 1.3) +
    cel(id, dRect(-17, -2.6, 34, 5.2, 1.6), team.roofL, team.roofD, { s: 1 }) +
    strokeD('M-14,0 H14', T.dish, 1) +
    `</g>` +
    lamp(238, 58, 1.8, team.gid, team.glow, team.core);
  p.push(mast(id, 238, 58, 20, antenna, burnt));
  p.push(dish(id, 250, 98, 7, 11, -30, team.glow, burnt));
  // Helipad (east), vehicle sheds (south), depot crates + drums.
  p.push(helipad(id, 248, 160, 20, team.roof, burnt));
  p.push(shed(id, 56, 190, 64, 30, team.roof, team.roofD, burnt), shed(id, 132, 194, 64, 28, team.roof, team.roofD, burnt));
  if (!burnt) {
    p.push(crates(id, 44, 152, 3, 2), crates(id, 210, 196, 2, 2), drums(id, 132, 40, 6, 3), drums(id, 62, 92, 4, 2));
    p.push(nest(52, 130, 180, false), nest(248, 214, 45, false));
    p.push(flag(98, 108, team, -1), flag(98, 150, team, -1), flag(150, 30, team));
  } else {
    p.push(drums(id, 132, 40, 3, 2, '#2c2925', '#3a3530'));
    p.push(nest(52, 130, 180, true));
    p.push(ruin(rand, [[70, 140, 14], [150, 216, 12], [232, 110, 11], [176, 50, 10], [262, 210, 9]], [[160, 126, 70, 56], [80, 58, 44, 26], [240, 160, 30, 26], [100, 206, 40, 20]]));
  }
  return p.join('');
}

export function enemyHq() {
  return svg(W, H, groundDefs(false) + glowDefs(ENEMY.gid, ENEMY.core, ENEMY.glow), enemyHqLayout(false));
}

export function enemyHqDestroyed() {
  return svg(W, H, groundDefs(true) + glowDefs(ENEMY.gid, ENEMY.core, ENEMY.glow), enemyHqLayout(true));
}

// ---------------------------------------------------------------------------
// Friendly HQ — rectangular concrete compound with round bastions, steel-blue command building
// with white ID stripes and chevron panel, comms dish + mast, barracks, motor pool, helipad.
// Gate (and the road out) on the east wall at y ≈ 130.
// ---------------------------------------------------------------------------
export function bastion(id, x, y, team, burnt) {
  const d = dEllipse(x, y, 15);
  if (burnt) return block(id, d, '#3b352c', '#2a2620', 1.6) + fill(dEllipse(x, y, 8), '#0f0c0a', { opacity: 0.85 });
  return (
    block(id, d, T.bag, T.bagD, 2) +
    strokeD(dEllipse(x, y, 11.5), T.bagD, 0.9, { 'stroke-dasharray': '3 2' }) +
    fill(dEllipse(x, y, 8), '#6f6a5c', { stroke: T.ink, 'stroke-width': 0.9 }) +
    cel(id, dEllipse(x, y, 5), team.roof, team.roofD, { s: 1 }) +
    lamp(x + 2.6, y - 2.6, 1.3, team.gid, team.glow, team.core, { halo: 2.2 })
  );
}

function friendlyHqLayout(burnt) {
  const team = FRIEND;
  const id = ids(burnt ? 'fx' : 'fh');
  const rand = rng(burnt ? 822 : 821);
  const a = 26;
  const b = 274;
  const top = 26;
  const bot = 234;
  const p = [];
  p.push(`<ellipse cx="150" cy="130" rx="150" ry="130" fill="url(#apron)"/>`);
  // Road out to the east.
  p.push(fill('M300,121 C270,120 240,122 214,124 L214,136 C240,138 270,140 300,139Z', burnt ? '#4a4032' : '#8f7c55', { opacity: 0.7 }));
  // Concrete hardstand inside the walls (paler than the enemy's packed earth).
  p.push(fill(dRect(a, top, b - a, bot - top, 4), burnt ? '#4f4a42' : '#b4ab92'));
  for (const x of [80, 140, 200]) p.push(strokeD(`M${x},${top + 2}V${bot - 2}`, burnt ? '#3d3833' : '#a29a82', 0.8, { opacity: 0.7 }));
  // Perimeter walls (pale concrete, blue caps), gate gap on the east wall.
  const gateY = [112, 148];
  const wallPts = [[b, gateY[0]], [b, top], [a, top], [a, bot], [b, bot], [b, gateY[1]]];
  const breaches = new Set([4, 5, 22, 23, 50, 51, 52, 70]);
  const [wInk, wFill] = wallRun(wallPts, {
    color: burnt ? '#4a4640' : CONC_L,
    colorD: burnt ? '#34302b' : CONC,
    cap: burnt ? null : team.roofD,
    skip: (k) => burnt && breaches.has(k),
    rand: burnt ? rand : null,
  });
  p.push(`<g fill="${T.ink}">${wInk}</g>`, wFill);
  for (const [x, y] of [[a, top], [b, top], [a, bot], [b, bot]]) p.push(bastion(id, x, y, team, burnt));
  // Gate guardhouse + white/blue boom.
  p.push(block(id, dRect(256, 154, 14, 14, 1.6), burnt ? '#3a3530' : CONC, burnt ? '#25211d' : CONC_D, 1.4));
  if (!burnt) {
    p.push(cel(id, dRect(258.4, 156.4, 9.2, 9.2, 1.2), team.roof, team.roofD, { s: 1 }));
    p.push(outline([dRect(273.6, 111, 3.4, 28, 1.2)], 1) + fill(dRect(273.6, 111, 3.4, 28, 1.2), '#f4f2ea'));
    for (const y of [114, 120, 126, 132]) p.push(fill(dRect(273.6, y, 3.4, 3, 0), team.flag));
  }
  // Command building: steel-blue roof, white ID stripes, blue panel with white double chevron.
  const hq = dRect(112, 78, 96, 92, 4);
  if (burnt) {
    p.push(block(id, hq, '#3a3530', '#25211d', 2.6, 2));
    p.push(fill(dRound([[124, 92], [170, 86], [198, 104], [194, 156], [150, 162], [120, 140]], 6), '#0d0b09'));
    for (const [x1, y1, x2, y2] of [[128, 100, 156, 126], [146, 92, 176, 132], [172, 108, 188, 150], [136, 150, 166, 118]]) p.push(strokeD(`M${x1},${y1} L${x2},${y2}`, '#4a443d', 1.3));
    p.push(fill(dEllipse(158, 124, 18, 14), T.rust, { opacity: 0.3 }));
  } else {
    p.push(block(id, hq, team.roof, team.roofD, 3, 2));
    for (const x of [124, 196]) p.push(fill(dRect(x - 2.5, 79.6, 5, 88.8, 0), T.blue, { opacity: 0.95 }));
    p.push(outline([dRect(138, 102, 44, 44, 3)], 1.3));
    p.push(cel(id, dRect(138, 102, 44, 44, 3), '#3f8ef0', '#1f5aa8', { s: 1.6 }));
    p.push(strokeD('M147,124 L160,113 L173,124 M147,136 L160,125 L173,136', '#ffffff', 4));
    for (const [x, y] of [[188, 86], [188, 156], [130, 156]]) p.push(block(id, dRect(x - 5, y - 4, 10, 8, 1.2), CONC_L, CONC_D, 1, 1.1));
    p.push(lamp(206, 84, 1.6, team.gid, team.glow, team.core), lamp(206, 164, 1.6, team.gid, team.glow, team.core));
    p.push(glint('M118,82 H200', 1.4, '#ffffff', 0.45));
  }
  // Comms: big pale dish (north-west) and a lattice mast with a cyan beacon (north-east).
  p.push(dish(id, 66, 62, 14, 18, 35, team.glow, burnt));
  p.push(mast(id, 236, 56, 16, lamp(236, 56, 2, team.gid, team.glow, team.core), burnt));
  // Helipad (west), barracks containers (south-west), motor-pool shed + bays (south-east).
  p.push(helipad(id, 64, 130, 21, team.flag, burnt));
  for (let i = 0; i < 4; i++) p.push(shed(id, 40 + i * 20, 176, 15, 44, i % 2 ? T.steel : T.steelL, T.steelD, burnt));
  p.push(shed(id, 132, 192, 70, 28, team.roof, team.roofD, burnt));
  if (!burnt) {
    for (let i = 0; i < 4; i++) p.push(fill(dRect(41.5 + i * 20, 177.5, 12, 3, 0.6), T.blue));
    for (const x of [214, 232, 250]) p.push(strokeD(`M${x},178 V222`, '#f4f2ea', 1.4, { opacity: 0.85 }));
    p.push(fill(dRect(214, 214, 36, 3, 0), team.flag, { opacity: 0.8 }));
    // Fuel bladders, crates, sandbag nests, blue flags flanking the HQ entrance.
    for (const [x, y] of [[126, 40], [160, 40]]) p.push(block(id, dRect(x, y, 28, 16, 7), '#3b3f36', '#25281f', 1.6) + glint(`M${x + 6},${y + 4} H${x + 18}`, 1.2, '#ffffff', 0.3));
    p.push(crates(id, 196, 38, 2, 2, '#77827c', '#58625d'), crates(id, 226, 92, 2, 1, '#77827c', '#58625d'));
    p.push(nest(250, 92, 0, false), nest(250, 196, 0, false));
    p.push(flag(216, 104, team), flag(216, 146, team));
  } else {
    p.push(ruin(rand, [[230, 130, 14], [90, 96, 12], [168, 210, 11], [140, 46, 10], [40, 60, 9]], [[160, 124, 68, 56], [64, 130, 34, 30], [80, 196, 44, 24], [236, 60, 26, 22]]));
  }
  return p.join('');
}

export function friendlyHq() {
  return svg(W, H, groundDefs(false) + glowDefs(FRIEND.gid, FRIEND.core, FRIEND.glow), friendlyHqLayout(false));
}

export function friendlyHqDestroyed() {
  return svg(W, H, groundDefs(true) + glowDefs(FRIEND.gid, FRIEND.core, FRIEND.glow), friendlyHqLayout(true));
}
