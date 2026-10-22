// Enemy ammo dump restyled to art direction v1 (2026-10-22), 240 × 180 (+ cook-off wreck), drawn
// natively with the HQ building blocks (hq.mjs): an earth-and-T-wall horseshoe open to the
// south-east, crate stacks with crimson hazard bands, drum rows, shell pallets, a camo net and a
// crimson-roofed guard hut. Replaces the v0 drawing in structures.mjs (same key and size).
// Neutral grey gravel and a soft dark shadow instead of the tan apron (winter-safe).
import { svg, r2, rad, rng } from './lib.mjs';
import { T, dRect, dEllipse, dRound, ids, fill, strokeD, outline, cel, glint, glowDefs, lamp } from './style.mjs';
import { ENEMY, CONC, CONC_D, block, wallRun, flag, shed, drums } from './hq.mjs';

const team = ENEMY;
const W = 240;
const H = 180;

function defs() {
  return (
    glowDefs(team.gid, team.core, team.glow) +
    rad('soot', 0.5, 0.5, 0.5, [[0, T.soot, 0.85], [0.55, T.soot, 0.45], [1, T.soot, 0]]) +
    rad('crater', 0.5, 0.5, 0.5, [[0, '#0f0d0a'], [0.5, '#2c261d'], [0.78, '#4a443d'], [1, '#4a443d', 0]])
  );
}

/** Ammo crate stack (cols × rows), every `redEvery`-th crate with a crimson hazard band. */
function ammoCrates(id, x, y, cols, rows, burnt, redEvery = 3) {
  let s = '';
  let k = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++, k++) {
      const d = dRect(x + c * 11, y + r * 8.4, 10, 7.6, 1);
      if (burnt) {
        s += block(id, d, k % 2 ? '#2e2a25' : '#3a352e', '#1d1a16', 1, 1.1);
        continue;
      }
      s += block(id, d, T.crate, T.crateD, 1, 1.1);
      s += strokeD(`M${x + c * 11 + 1.4},${y + r * 8.4 + 3.8}H${x + c * 11 + 8.6}`, T.crateD, 0.7);
      if (k % redEvery === 0) s += fill(dRect(x + c * 11 + 6.6, y + r * 8.4 + 0.6, 2.2, 6.4, 0), team.roof);
    }
  }
  return s;
}

/** Pallet of artillery shells (brass casings, grey tips). */
function shells(id, x, y, cols, rows) {
  let s = block(id, dRect(x - 2, y - 2, cols * 4.6 + 3, rows * 4.6 + 3, 1), '#6b5b3c', '#4c4029', 1, 1.1);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) s += fill(dEllipse(x + c * 4.6 + 1.6, y + r * 4.6 + 1.6, 1.8), '#c9a443', { stroke: T.ink, 'stroke-width': 0.5 }) + fill(dEllipse(x + c * 4.6 + 1.2, y + r * 4.6 + 1.2, 0.8), '#8a8a80');
  }
  return s;
}

/** Camo net over a stack: olive blob with blotches and a net grid, ink-outlined. */
function camoNet(id, cx, cy, rx, ry, rand) {
  const pts = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2;
    const k = rand.range(0.86, 1.08);
    return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
  });
  const d = dRound(pts, 6);
  const cid = id();
  let inner = '';
  for (let i = 0; i < 9; i++) inner += fill(dEllipse(cx + rand.range(-rx, rx) * 0.7, cy + rand.range(-ry, ry) * 0.7, rand.range(3, 7), rand.range(2, 5)), rand.pick(['#4f5a2c', '#6f6a3c', '#3e4722']), { opacity: 0.85 });
  for (let k = -rx - ry; k < rx + ry; k += 4) inner += strokeD(`M${r2(cx + k)},${cy - ry - 4} l${ry + 8},${ry * 2 + 8} M${r2(cx + k)},${cy + ry + 4} l${ry + 8},${-ry * 2 - 8}`, '#2d3218', 0.5, { opacity: 0.6 });
  return (
    fill(d, '#000', { opacity: 0.25, transform: 'translate(2.5,3.5)' }) +
    outline([d], 1.6) +
    cel(id, d, '#5d6634', '#454c25', { s: 2.4 }) +
    `<clipPath id="${cid}"><path d="${d}"/></clipPath><g clip-path="url(#${cid})">${inner}</g>`
  );
}

function ammoDumpLayout(burnt) {
  const id = ids(burnt ? 'ax' : 'ad');
  const rand = rng(burnt ? 532 : 531);
  const p = [];
  p.push(`<ellipse cx="${W / 2 + 3}" cy="${H / 2 + 4}" rx="116" ry="86" fill="#000" opacity="0.16"/>`);
  // Gravel yard + tyre tracks in from the south-east entrance.
  const yard = dRound([[40, 22], [196, 18], [222, 50], [222, 136], [196, 166], [40, 166], [16, 138], [16, 50]], 14);
  p.push(fill(yard, burnt ? '#4a453e' : '#9a968c'));
  for (const off of [0, 7]) p.push(strokeD(`M${232 - off},${178} Q${196 - off},${146} ${150 - off},${124} Q${116 - off},${108} ${84 - off},${98}`, burnt ? '#3a352f' : '#837f75', 2, { opacity: 0.6 }));
  // Perimeter: concrete T-walls with crimson caps, open to the south-east.
  const [wInk, wFill] = wallRun([[192, 166], [40, 166], [16, 138], [16, 50], [40, 22], [196, 18], [222, 50], [222, 116]], {
    color: burnt ? '#4a4640' : CONC,
    colorD: burnt ? '#34302b' : CONC_D,
    cap: burnt ? null : team.roofD,
    skip: (k) => burnt && (k % 7 === 3 || k % 11 === 5),
    rand: burnt ? rand : null,
  });
  p.push(`<g fill="${T.ink}">${wInk}</g>`, wFill);
  // Stacks (v0 layout ×1.5).
  p.push(ammoCrates(id, 33, 39, 4, 3, burnt, 3), ammoCrates(id, 99, 33, 3, 3, burnt, 4), ammoCrates(id, 42, 99, 3, 2, burnt, 2), ammoCrates(id, 105, 105, 4, 2, burnt, 3));
  if (burnt) {
    p.push(drums(id, 177, 102, 3, 2, '#2e2a25', '#3a352e'));
    const craters = [[60, 57, 19], [126, 45, 16], [72, 114, 18], [156, 105, 22], [189, 54, 13]];
    p.push(`<ellipse cx="108" cy="82" rx="88" ry="62" fill="url(#soot)"/>`);
    p.push(craters.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#crater)"/>`).join(''));
    for (let i = 0; i < 70; i++) {
      p.push(fill(dRect(0, 0, rand.range(1.5, 5), rand.range(1, 3), 0.4), rand.pick(['#1a1815', '#2c2925', T.rust, '#4d4841', '#5d6838', '#c9a443']), {
        transform: `translate(${r2(rand.range(20, 220))},${r2(rand.range(20, 160))}) rotate(${r2(rand.range(0, 180))})`,
      }));
    }
    return svg(W, H, defs(), p.join(''));
  }
  p.push(drums(id, 171, 99, 4, 3, '#6b2c2c', '#8c3a36'), drums(id, 186, 39, 3, 3));
  p.push(shells(id, 84, 72, 5, 3));
  p.push(ammoCrates(id, 138, 45, 3, 3, false, 5));
  p.push(camoNet(id, 159, 66, 26, 21, rand));
  // Guard hut (crimson roof), red warning flags at the entrance, orange lamps.
  p.push(shed(id, 24, 134, 36, 20, team.roof, team.roofD, false));
  p.push(flag(200, 140, team), flag(222, 124, team));
  p.push(lamp(36, 30, 1.6, team.gid, team.glow, team.core), lamp(210, 30, 1.6, team.gid, team.glow, team.core));
  p.push(glint('M44,24 H120', 1.2, '#ffffff', 0.25));
  return svg(W, H, defs(), p.join(''));
}

export const ammoDump = () => ammoDumpLayout(false);
export const ammoDumpWreck = () => ammoDumpLayout(true);
