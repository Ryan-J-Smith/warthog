// Friendly bases restyled to art direction v1 (2026-10-22): outpost Bravo (+ overrun variant) and
// the forward airstrip, drawn natively at their spriteKeys sizes with the friendly HQ's building
// blocks (hq.mjs): ink outlines, cel shading, steel-blue roofs with white ID stripes, cyan lamps.
// Replaces the v0 drawings in structures.mjs (same keys and sizes, so it is a drop-in swap).
//
// Ground is neutral (grey concrete / gravel and a soft dark shadow, no tan desert apron), so the
// bases sit on both the steppe and the winter biome.
import { svg, r2, rad, rng } from './lib.mjs';
import { T, dRect, dEllipse, dRound, ids, fill, strokeD, outline, cel, glint, glowDefs, lamp } from './style.mjs';
import { FRIEND, CONC, CONC_D, CONC_L, block, wallRun, flag, shed, fuelTank, crates, drums, helipad, mast, dish, nest, bastion } from './hq.mjs';

const team = FRIEND;
const GRAVEL = '#a9a69d';
const GRAVEL_D = '#8f8c83';
const BURNT_FLOOR = '#4f4a42';

/** Soot + crater gradients (destroyed variants) and the friendly lamp glow. */
function baseDefs() {
  return (
    glowDefs(team.gid, team.core, team.glow) +
    rad('soot', 0.5, 0.5, 0.5, [[0, T.soot, 0.8], [0.55, T.soot, 0.45], [1, T.soot, 0]]) +
    rad('crater', 0.5, 0.5, 0.5, [[0, '#0f0d0a'], [0.5, '#2c261d'], [0.78, '#4a443d'], [1, '#4a443d', 0]])
  );
}

/** Soot patches, craters and scattered debris chips within a box. */
function wreckage(rand, box, craters, soots, chips = 70) {
  const [x0, y0, x1, y1] = box;
  let s = soots.map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#soot)"/>`).join('');
  s += craters.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#crater)"/>`).join('');
  for (let i = 0; i < chips; i++) {
    s += fill(dRect(0, 0, rand.range(1.5, 5), rand.range(1, 3), 0.4), rand.pick(['#1a1815', '#2c2925', T.rust, '#4d4841', '#6b6760', '#8a857b']), {
      transform: `translate(${r2(rand.range(x0, x1))},${r2(rand.range(y0, y1))}) rotate(${r2(rand.range(0, 180))})`,
    });
  }
  return s;
}

/** Command bunker: steel-blue roof, white ID stripes, blue panel with the white double chevron. */
function commandBunker(id, x, y, w, h, burnt) {
  const d = dRect(x, y, w, h, 3);
  if (burnt) {
    return (
      block(id, d, '#3a3530', '#25211d', 2.4, 1.9) +
      fill(dRound([[x + 8, y + 8], [x + w * 0.6, y + 4], [x + w - 6, y + h * 0.4], [x + w - 10, y + h - 6], [x + 10, y + h - 8]], 5), '#0d0b09') +
      strokeD(`M${x + 10},${y + 10} L${x + w * 0.6},${y + h - 10} M${x + w * 0.4},${y + 6} L${x + w - 8},${y + h * 0.7}`, '#4a443d', 1.2)
    );
  }
  const px = x + w / 2 - 13;
  const py = y + h / 2 - 11;
  return (
    block(id, d, team.roof, team.roofD, 2.6, 1.9) +
    fill(dRect(x + 4, y + 3.5, w - 8, 3, 0.8), T.blue, { opacity: 0.95 }) +
    outline([dRect(px, py, 26, 22, 2.5)], 1.2) +
    cel(id, dRect(px, py, 26, 22, 2.5), '#3f8ef0', '#1f5aa8', { s: 1.4 }) +
    strokeD(`M${px + 6},${py + 11} L${px + 13},${py + 5} L${px + 20},${py + 11} M${px + 6},${py + 17} L${px + 13},${py + 11} L${px + 20},${py + 17}`, '#ffffff', 2.8) +
    lamp(x + w - 4, y + 4, 1.5, team.gid, team.glow, team.core) +
    glint(`M${x + 5},${y + 2.2} H${x + w * 0.6}`, 1.2, '#ffffff', 0.45)
  );
}

// ---------------------------------------------------------------------------
// Outpost Bravo — 260 × 260: octagonal T-wall compound, gate + track on the WEST side, corner
// bastions, crew shelters, helipad, command bunker, water tank, MG nests on the east wall.
// ---------------------------------------------------------------------------
function outpostLayout(burnt) {
  const W = 260;
  const id = ids(burnt ? 'ox' : 'op');
  const rand = rng(burnt ? 962 : 961);
  const a = 26;
  const b = 234;
  const ch = 24;
  const p = [];
  p.push(`<ellipse cx="${W / 2 + 3}" cy="${W / 2 + 4}" rx="126" ry="126" fill="#000" opacity="0.16"/>`);
  // Track in from the west to the gate.
  p.push(fill('M0,124 C10,124 18,125 26,125 L26,137 C18,137 10,138 0,138Z', burnt ? '#3d3833' : GRAVEL_D, { opacity: 0.75 }));
  // Gravel floor inside the walls, with faint panel seams.
  const oct = [[a + ch, a], [b - ch, a], [b, a + ch], [b, b - ch], [b - ch, b], [a + ch, b], [a, b - ch], [a, a + ch]];
  const floor = dRound(oct, 4);
  p.push(fill(floor, burnt ? BURNT_FLOOR : GRAVEL));
  for (const k of [78, 130, 182]) {
    p.push(strokeD(`M${k},${a + 3}V${b - 3}`, burnt ? '#3d3833' : GRAVEL_D, 0.8, { opacity: 0.6 }));
    p.push(strokeD(`M${a + 3},${k}H${b - 3}`, burnt ? '#3d3833' : GRAVEL_D, 0.8, { opacity: 0.6 }));
  }
  // T-wall perimeter (pale concrete, blue caps); the gate gap is on the west wall (y 112..150).
  const runs = [
    [[a, 112], [a, a + ch], [a + ch, a], [b - ch, a], [b, a + ch], [b, b - ch], [b - ch, b], [a + ch, b], [a, b - ch], [a, 150]],
  ];
  for (const pts of runs) {
    const [wInk, wFill] = wallRun(pts, {
      color: burnt ? '#4a4640' : CONC_L,
      colorD: burnt ? '#34302b' : CONC,
      cap: burnt ? null : team.roofD,
      skip: (k) => burnt && (k % 9 === 4 || k % 13 === 7),
      rand: burnt ? rand : null,
    });
    p.push(`<g fill="${T.ink}">${wInk}</g>`, wFill);
  }
  for (const [x, y] of [[a + 8, a + 8], [b - 8, a + 8], [b - 8, b - 8], [a + 8, b - 8]]) p.push(bastion(id, x, y, team, burnt));
  // Gate posts with the white/blue boom.
  p.push(block(id, dRect(a - 6, 104, 12, 8, 1.4), burnt ? '#3a3530' : CONC, burnt ? '#25211d' : CONC_D, 1, 1.2));
  p.push(block(id, dRect(a - 6, 150, 12, 8, 1.4), burnt ? '#3a3530' : CONC, burnt ? '#25211d' : CONC_D, 1, 1.2));
  if (!burnt) {
    p.push(outline([dRect(a - 1.7, 112, 3.4, 38, 1.2)], 1) + fill(dRect(a - 1.7, 112, 3.4, 38, 1.2), '#f4f2ea'));
    for (const y of [116, 124, 132, 140]) p.push(fill(dRect(a - 1.7, y, 3.4, 4, 0), team.flag));
  }
  // Crew shelters (steel containers with blue bands), north-west.
  for (const [x, y, w, h, roof] of [[52, 50, 48, 22, T.steelL], [52, 80, 48, 22, T.steel], [118, 48, 40, 20, T.steelL]]) {
    p.push(shed(id, x, y, w, h, roof, T.steelD, burnt));
    if (!burnt) p.push(fill(dRect(x + 1.5, y + 1.5, 3, h - 3, 0.6), T.blue));
  }
  // Helipad (south-west), command bunker (south-east), water tank, crates, MG nests, flag, comms.
  p.push(helipad(id, 88, 180, 26, team.flag, burnt));
  p.push(commandBunker(id, 150, 152, 62, 46, burnt));
  p.push(fuelTank(id, 186, 100, 11, team.flag, burnt));
  if (!burnt) {
    p.push(crates(id, 132, 88, 2, 2, '#77827c', '#58625d'), drums(id, 168, 66, 3, 2));
    p.push(nest(212, 96, 0, false), nest(212, 168, 0, false), nest(118, 214, 90, false));
    p.push(flag(124, 128, team));
    p.push(mast(id, 202, 52, 12, lamp(202, 52, 1.8, team.gid, team.glow, team.core), false));
    p.push(lamp(a + 16, 108, 1.4, team.gid, team.glow, team.core), lamp(a + 16, 154, 1.4, team.gid, team.glow, team.core));
  } else {
    p.push(wreckage(rand, [30, 30, 230, 230], [[86, 180, 18], [158, 92, 13], [204, 52, 11], [60, 214, 10], [128, 132, 12]], [[110, 80, 54, 40], [182, 176, 44, 36], [88, 180, 30, 26]]));
  }
  return svg(W, W, baseDefs(), p.join(''));
}

export const outpost = () => outpostLayout(false);
export const outpostDestroyed = () => outpostLayout(true);
