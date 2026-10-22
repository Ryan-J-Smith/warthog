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

// ---------------------------------------------------------------------------
// Forward airstrip — 480 × 340: runway E-W along the south, concrete apron + taxiway, the rearm
// pad at the sprite centre (240,170 = the entity position), hardened shelters east and west,
// control tower, fuel bladders, ops containers. Positions follow the v0 layout (scaled ×1.31).
// ---------------------------------------------------------------------------

/** Hardened aircraft shelter: arched steel-blue roof with ribs, door on the apron side. */
function shelter(id, x, y, w, h, doorEast) {
  const d = dRect(x, y, w, h, 10);
  let s = block(id, d, T.fL, T.fD, 3, 1.9);
  for (let i = 1; i < 8; i++) s += strokeD(`M${x + (w * i) / 8},${y + 3}V${y + h - 3}`, T.fD, 0.9, { opacity: 0.6 });
  const dx = doorEast ? x + w - 5 : x;
  s += fill(dRect(dx, y + 6, 5, h - 12, 1.2), T.steelD, { stroke: T.ink, 'stroke-width': 0.9 });
  s += fill(dRect(x + w / 2 - 8, y + 4, 16, 3.2, 0.8), T.blue);
  return s + glint(`M${x + 8},${y + 3} H${x + w * 0.6}`, 1.3, '#ffffff', 0.45);
}

export function homeBase() {
  const W = 480;
  const H = 340;
  const id = ids('hb');
  const rand = rng(971);
  const p = [];
  p.push(`<ellipse cx="243" cy="174" rx="236" ry="166" fill="#000" opacity="0.14"/>`);
  // Runway: dark asphalt strip with edge lines, centreline, threshold bars and touchdown marks.
  const ry = 236;
  const rh = 52;
  const runway = dRect(8, ry, 464, rh, 4);
  p.push(outline([runway], 1.8), fill(runway, '#4b4b47'), fill(dRect(8, ry + rh - 8, 464, 8, 0), '#000', { opacity: 0.18 }));
  p.push(strokeD(`M14,${ry + 3.5}H466 M14,${ry + rh - 3.5}H466`, '#ecebe2', 1.1));
  for (let x = 58; x < 420; x += 28) p.push(fill(dRect(x, ry + rh / 2 - 1.1, 16, 2.2, 0), '#ecebe2'));
  for (const x0 of [16, 446]) {
    for (let i = 0; i < 8; i++) {
      if (i === 3 || i === 4) continue;
      p.push(fill(dRect(x0, ry + 7 + i * 5.2, 18, 3, 0.4), '#ecebe2'));
    }
  }
  for (const x0 of [86, 372]) p.push(fill(dRect(x0, ry + 9, 22, 5, 0), '#ecebe2'), fill(dRect(x0, ry + rh - 14, 22, 5, 0), '#ecebe2'));
  for (let i = 0; i < 16; i++) {
    const x = rand.range(40, 150) + (i % 2 ? 290 : 0);
    p.push(fill(dRect(x, ry + rh / 2 + rand.range(-12, 12), rand.range(12, 32), 1.6, 0), '#1e1e1a', { opacity: 0.3 }));
  }
  for (let x = 20; x < 466; x += 21) {
    p.push(fill(dEllipse(x, ry - 2.4, 1.3), '#fff7d8', { stroke: T.ink, 'stroke-width': 0.5 }));
    p.push(fill(dEllipse(x, ry + rh + 2.4, 1.3), '#fff7d8', { stroke: T.ink, 'stroke-width': 0.5 }));
  }
  // Apron + taxiway down to the runway (concrete, panel seams, yellow taxi lines, blue edge lights).
  const apron = dRect(84, 78, 312, 80, 4);
  const taxi = dRect(222, 152, 36, 86, 2);
  p.push(outline([apron, taxi], 1.6), cel(id, apron, '#aeaba2', '#94918a', { s: 3 }), fill(taxi, '#aeaba2'));
  for (let x = 110; x < 396; x += 26) p.push(strokeD(`M${x},80V156`, '#8f8c83', 0.7, { opacity: 0.7 }));
  p.push(strokeD('M86,118H394', '#8f8c83', 0.7, { opacity: 0.7 }));
  p.push(strokeD('M240,236 L240,139 Q240,128 229,128 L92,128 M240,139 Q240,128 251,128 L388,128', '#e8c23a', 1.6));
  for (let x = 90; x < 394; x += 18) p.push(lamp(x, 160, 1.1, team.gid, team.glow, team.core, { halo: 1.6 }));
  for (let y = 166; y < 232; y += 13) p.push(lamp(219, y, 1.1, team.gid, team.glow, team.core, { halo: 1.6 }), lamp(261, y, 1.1, team.gid, team.glow, team.core, { halo: 1.6 }));
  // Rearm pad at the sprite centre: blue ring, white dashed inner ring, chevrons, blue cross.
  const pad = dEllipse(240, 170, 34);
  p.push(outline([pad], 1.6), cel(id, pad, '#c2bfb5', '#a19e95', { s: 2.4 }));
  p.push(strokeD(dEllipse(240, 170, 28.5), team.flag, 4.4), strokeD(dEllipse(240, 170, 18), '#f4f2ea', 1.6, { 'stroke-dasharray': '6 4' }));
  for (let k = 0; k < 4; k++) p.push(`<g transform="translate(240,170) rotate(${k * 90})">${strokeD('M-5,-34 L0,-40 L5,-34', team.flag, 3)}</g>`);
  p.push(fill('M237.6,159h4.8v8.6h8.6v4.8h-8.6v8.6h-4.8v-8.6h-8.6v-4.8h8.6Z', team.flag, { stroke: T.ink, 'stroke-width': 0.7 }));
  // Hardened shelters inside concrete blast walls (doors face the apron).
  p.push(shelter(id, 12, 82, 70, 64, true), shelter(id, 398, 82, 70, 64, false));
  for (const pts of [[[6, 74], [6, 154], [82, 154]], [[474, 74], [474, 154], [398, 154]]]) {
    const [wInk, wFill] = wallRun(pts, { color: CONC_L, colorD: CONC, cap: team.roofD });
    p.push(`<g fill="${T.ink}">${wInk}</g>`, wFill);
  }
  // Control tower (glass cab), flag, ops containers, fuel bladders in a revetment.
  p.push(block(id, dRect(262, 16, 30, 30, 2.4), CONC_L, CONC_D, 2.2, 1.8));
  p.push(fill(dRect(268, 22, 18, 18, 1.6), T.glassD, { stroke: T.ink, 'stroke-width': 1 }), glint('M270,24.5 H279', 1.3, T.glassHi, 0.8));
  p.push(lamp(289, 19, 1.5, team.gid, team.glow, team.core));
  p.push(flag(298, 58, team));
  for (const [x, w] of [[126, 40], [174, 36]]) {
    p.push(shed(id, x, 24, w, 22, x === 126 ? T.steelL : T.steel, T.steelD, false));
    p.push(fill(dRect(x + 1.5, 25.5, 3, 19, 0.6), T.blue));
  }
  const rev = dRect(316, 14, 108, 52, 7);
  p.push(outline([rev], 1.6), fill(rev, CONC), fill(dRect(322, 20, 96, 40, 5), '#8f8c83'));
  for (let i = 0; i < 3; i++) {
    const x = 326 + i * 31;
    p.push(block(id, dRect(x, 23, 26, 34, 10), '#3b3f36', '#25281f', 1.8, 1.4), glint(`M${x + 6},27 H${x + 18}`, 1.2, '#ffffff', 0.3));
  }
  // Munitions pallets + crates by the pad, a mast and a dish, and the windsock.
  p.push(crates(id, 280, 140, 3, 1, '#77827c', '#58625d'), crates(id, 172, 140, 3, 1, '#77827c', '#58625d'), drums(id, 112, 92, 4, 2));
  p.push(crates(id, 352, 92, 2, 2, '#77827c', '#58625d'));
  p.push(mast(id, 100, 34, 14, lamp(100, 34, 1.9, team.gid, team.glow, team.core), false), dish(id, 60, 40, 12, 15, 30, team.glow, false));
  p.push(strokeD('M444,206 V200', '#e8e6de', 1.2), fill('M444,199 L458,197 L458,202Z', '#e8742a', { stroke: T.ink, 'stroke-width': 0.7 }), fill(dRect(448.5, 197.8, 3, 3.6, 0), '#ffffff'));
  return svg(W, H, baseDefs(), p.join(''));
}
