import {
  P, r2, svg, lin, rad, rect, circle, ellipse, path, line, g, poly, polyline, rng, blobPath, rrect, sandbagRing, sandbagLine,
  sootDefs, smoothOpen,
} from './lib.mjs';

const apron = (id, color, a) => rad(id, 0.5, 0.5, 0.5, [[0, color, a], [0.7, color, a * 0.8], [1, color, 0]]);

// White SAM missile lying on the ground / rack (used in SAM site art).
function lyingMissile(x, y, len, deg = 0, burnt = false) {
  const body = burnt ? '#4a4640' : '#e9e8e1';
  const band = burnt ? '#5a2a1c' : P.red;
  return g(
    [
      path(`M0,-1.5 L${len - 4.5},-1.5 Q${len},-1 ${len},0 Q${len},1 ${len - 4.5},1.5 L0,1.5Z`, { fill: body, stroke: P.ink, 'stroke-width': 0.4 }),
      rect(len - 8, -1.48, 1.6, 2.96, { fill: band }),
      path('M0.4,-1.5 L1.4,-3.6 L4,-3.6 L4.3,-1.5Z', { fill: burnt ? '#3a3631' : '#c8c7c0', stroke: P.ink, 'stroke-width': 0.3 }),
      path('M0.4,1.5 L1.4,3.6 L4,3.6 L4.3,1.5Z', { fill: burnt ? '#3a3631' : '#aaa9a2', stroke: P.ink, 'stroke-width': 0.3 }),
    ].join(''),
    { transform: `translate(${x},${y}) rotate(${deg})` },
  );
}

// ---------------------------------------------------------------------------
// SAM site base — 70 × 70. Launcher sits at the centre (35, 35).
// ---------------------------------------------------------------------------
export function samBase() {
  const W = 70;
  const H = 70;
  const rand = rng(21);
  const cx = 35;
  const cy = 35;
  const defs = [
    apron('apron', P.dirt, 0.6),
    rad('floorG', 0.5, 0.5, 0.5, [[0, '#6f6146'], [0.35, '#8a7a58'], [1, P.dirt]]),
    lin('boxG', 0, 0, 1, 1, [[0, P.olL], [0.5, P.ol], [1, P.olD]]),
    rad('dishG', 0.4, 0.35, 0.65, [[0, '#f4f4ee'], [0.5, '#c9cac2'], [1, '#85877f']]),
  ].join('');
  const body = [
    circle(cx, cy, 35, { fill: 'url(#apron)' }),
    // earthen berm under the bags
    circle(cx, cy, 26.5, { fill: 'none', stroke: P.dirtD, 'stroke-width': 9, opacity: 0.55 }),
    circle(cx, cy, 22.5, { fill: 'url(#floorG)' }),
    // tyre tracks through the entrance
    path('M52,54 Q44,46 38,40', { fill: 'none', stroke: P.dirtD, 'stroke-width': 1.2, opacity: 0.6 }),
    path('M55,51 Q47,43 41,37', { fill: 'none', stroke: P.dirtD, 'stroke-width': 1.2, opacity: 0.6 }),
    // power / data cables snaking under the berm to the launcher
    path('M13,9 Q18,13 21,17 T27,24', { fill: 'none', stroke: '#2a2a24', 'stroke-width': 0.45, opacity: 0.6 }),
    path('M55,12 Q50,16 47,20 T42,26', { fill: 'none', stroke: '#2a2a24', 'stroke-width': 0.45, opacity: 0.6 }),
    sandbagRing(cx, cy, 26, 5.2, rand, { gapStart: 0.55, gapEnd: 1.0 }),
    // highlight on the lit (north-west) side of the ring
    path(`M${cx - 27},${cy} A27,27 0 0 1 ${cx},${cy - 27}`, { fill: 'none', stroke: '#fff', 'stroke-width': 1.1, opacity: 0.18 }),
    // generator + cable
    rrect(4, 5, 9, 6, 0.8, { fill: 'url(#boxG)', stroke: P.ink, 'stroke-width': 0.5 }),
    line(5.5, 6.5, 11.5, 6.5, { stroke: P.olDD, 'stroke-width': 0.4 }),
    // radar vehicle with dish
    g(
      [
        rrect(-8, -4, 16, 8, 1, { fill: 'url(#boxG)', stroke: P.ink, 'stroke-width': 0.55 }),
        rect(5, -3.4, 2.6, 6.8, { fill: P.glass }),
        rect(-6.5, -3.2, 3.2, 6.4, { fill: P.red, opacity: 0.9 }),
        ellipse(-1, 0, 6.2, 4.8, { fill: 'url(#dishG)', stroke: P.ink, 'stroke-width': 0.5 }),
        ellipse(-1, 0, 4, 3, { fill: 'none', stroke: '#9a9b94', 'stroke-width': 0.4 }),
        line(-1, 0, 3.4, -1.8, { stroke: P.ink, 'stroke-width': 0.5 }),
        circle(3.4, -1.8, 0.8, { fill: '#2a2a28' }),
      ].join(''),
      { transform: 'translate(60,9) rotate(-25)' },
    ),
    // red/white marker pole + spare missiles on a transloader
    circle(66, 22, 1.3, { fill: P.red, stroke: P.white, 'stroke-width': 0.6 }),
    rrect(2, 60, 22, 8.4, 1, { fill: P.olD, stroke: P.ink, 'stroke-width': 0.5 }),
    lyingMissile(3.5, 62.2, 20),
    lyingMissile(3.5, 66.2, 20),
  ].join('');
  return svg(W, H, defs, body);
}

export function samWreck() {
  const W = 70;
  const H = 70;
  const rand = rng(22);
  const cx = 35;
  const cy = 35;
  const defs = [apron('apron', '#3a342a', 0.55), sootDefs('soot', '#0d0c0a', 0.85)].join('');
  const debris = Array.from({ length: 16 }, () => {
    const a = rand.range(0, Math.PI * 2);
    const d = rand.range(6, 30);
    return rect(-1.4, -0.8, rand.range(1.5, 4), rand.range(1, 2.2), {
      fill: rand.pick(['#1a1815', '#2c2925', P.rust, '#4d4841']),
      transform: `translate(${r2(cx + Math.cos(a) * d)},${r2(cy + Math.sin(a) * d)}) rotate(${r2(rand.range(0, 180))})`,
    });
  }).join('');
  const body = [
    circle(cx, cy, 35, { fill: 'url(#apron)' }),
    circle(cx, cy, 26.5, { fill: 'none', stroke: '#4b4232', 'stroke-width': 9, opacity: 0.55 }),
    sandbagRing(cx, cy, 26, 5.2, rand, { gapStart: 0.55, gapEnd: 1.0, colors: ['#4a4236', '#5b5242', '#2e2a24', '#3a342b'], stroke: '#1d1a16' }),
    // blasted gaps in the berm
    circle(cx - 22, cy - 12, 5.5, { fill: '#2a251e', opacity: 0.9 }),
    circle(cx + 10, cy + 24, 5, { fill: '#2a251e', opacity: 0.9 }),
    circle(cx, cy, 24, { fill: 'url(#soot)' }),
    // twisted launcher remains
    circle(cx + 1, cy + 1, 6, { fill: '#1b1916', stroke: '#0b0a09', 'stroke-width': 0.6 }),
    path('M24,30 Q33,27 44,33 L46,31', { fill: 'none', stroke: '#26231f', 'stroke-width': 2.2 }),
    path('M26,40 Q35,43 42,38', { fill: 'none', stroke: '#26231f', 'stroke-width': 2 }),
    lyingMissile(40, 44, 16, 35, true),
    lyingMissile(18, 24, 12, -150, true),
    // toppled radar
    g(
      [
        rrect(-8, -4, 16, 8, 1, { fill: '#26231f', stroke: '#0b0a09', 'stroke-width': 0.5 }),
        ellipse(-3, 3, 6.2, 3.2, { fill: '#4b4640', stroke: '#0b0a09', 'stroke-width': 0.5, transform: 'rotate(30 -3 3)' }),
      ].join(''),
      { transform: 'translate(60,10) rotate(-5)' },
    ),
    debris,
  ].join('');
  return svg(W, H, defs, body);
}

// ---------------------------------------------------------------------------
// Bridge — 200 × 60, road runs along x. Steel through-truss, three spans.
// ---------------------------------------------------------------------------
const SPANS = [
  [10, 66],
  [74, 126],
  [134, 190],
];

function bridgeDefs() {
  return [
    lin('shadowG', 0, 0, 0, 1, [[0, '#0b1418', 0], [0.12, '#0b1418', 0.38], [0.5, '#0b1418', 0.2], [0.88, '#0b1418', 0.38], [1, '#0b1418', 0]]),
    lin('deckG', 0, 0, 0, 1, [[0, '#5f5e58'], [0.5, P.asphalt], [1, '#3f3f3b']]),
    lin('chordG', 0, 0, 0, 1, [[0, '#a5aa9c'], [0.45, '#747a6c'], [1, '#474b42']]),
    lin('concG', 0, 0, 1, 1, [[0, P.concreteL], [1, P.concreteD]]),
  ].join('');
}

function bridgeSpan([x0, x1], opts = {}) {
  const { skipDeck = false } = opts;
  const out = [];
  if (!skipDeck) {
    out.push(rect(x0 - 2, 16, x1 - x0 + 4, 28, { fill: 'url(#deckG)' }));
    out.push(rect(x0 - 2, 16, x1 - x0 + 4, 2, { fill: P.concrete }));
    out.push(rect(x0 - 2, 42, x1 - x0 + 4, 2, { fill: P.concreteD }));
    for (let x = x0 + 3; x < x1 - 4; x += 12) out.push(rect(x, 29.4, 6, 1.2, { fill: '#e8e4d0', opacity: 0.85 }));
  }
  // overhead lateral bracing + its shadow on the deck
  const n = Math.round((x1 - x0) / 14);
  const step = (x1 - x0) / n;
  const brace = [];
  const shadow = [];
  for (let i = 0; i < n; i++) {
    const a = x0 + i * step;
    const b = a + step;
    brace.push(line(a, 14.5, b, 45.5), line(a, 45.5, b, 14.5));
    shadow.push(line(a + 1.8, 17, b + 1.8, 48), line(a + 1.8, 48, b + 1.8, 17));
  }
  for (let i = 0; i <= n; i++) {
    const x = x0 + i * step;
    brace.push(line(x, 14, x, 46));
    shadow.push(line(x + 1.8, 17, x + 1.8, 48));
  }
  out.push(g(shadow.join(''), { stroke: '#000', 'stroke-width': 1.1, opacity: 0.28, 'clip-path': 'url(#deckClip)' }));
  // chords
  out.push(rect(x0, 11.5, x1 - x0, 4.2, { fill: 'url(#chordG)', stroke: P.ink, 'stroke-width': 0.5 }));
  out.push(rect(x0, 44.3, x1 - x0, 4.2, { fill: 'url(#chordG)', stroke: P.ink, 'stroke-width': 0.5 }));
  out.push(g(brace.join(''), { stroke: '#50554a', 'stroke-width': 0.9 }));
  // panel-point gussets
  for (let i = 0; i <= n; i++) {
    const x = x0 + i * step;
    out.push(rect(x - 1, 11.2, 2, 4.8, { fill: '#8d9285', stroke: P.ink, 'stroke-width': 0.3 }));
    out.push(rect(x - 1, 44, 2, 4.8, { fill: '#6d7266', stroke: P.ink, 'stroke-width': 0.3 }));
  }
  // portal beams at the span ends
  out.push(rect(x0 - 0.5, 12, 2.6, 36, { fill: '#6d7266', stroke: P.ink, 'stroke-width': 0.4 }));
  out.push(rect(x1 - 2.1, 12, 2.6, 36, { fill: '#6d7266', stroke: P.ink, 'stroke-width': 0.4 }));
  return out.join('');
}

function piersAndAbutments() {
  return [
    rect(0, 7, 200, 46, { fill: 'url(#shadowG)' }),
    // abutments
    path('M0,11 L11,13 L11,47 L0,49Z', { fill: 'url(#concG)', stroke: P.ink, 'stroke-width': 0.5 }),
    path('M200,11 L189,13 L189,47 L200,49Z', { fill: 'url(#concG)', stroke: P.ink, 'stroke-width': 0.5 }),
    rect(0, 16, 12, 28, { fill: '#6a6558' }),
    rect(188, 16, 12, 28, { fill: '#6a6558' }),
    // pier caps
    rrect(66.5, 5.5, 7, 49, 3.4, { fill: 'url(#concG)', stroke: P.ink, 'stroke-width': 0.5 }),
    rrect(126.5, 5.5, 7, 49, 3.4, { fill: 'url(#concG)', stroke: P.ink, 'stroke-width': 0.5 }),
    ellipse(70, 55, 5, 1.6, { fill: '#e6f0ee', opacity: 0.35 }),
    ellipse(130, 55, 5, 1.6, { fill: '#e6f0ee', opacity: 0.35 }),
  ].join('');
}

export function bridge() {
  const defs = bridgeDefs() + '<clipPath id="deckClip"><rect x="8" y="16" width="184" height="28"/></clipPath>';
  const body = [piersAndAbutments(), ...SPANS.map((s) => bridgeSpan(s))].join('');
  return svg(200, 60, defs, body);
}

export function bridgeDestroyed() {
  const rand = rng(88);
  const defs =
    bridgeDefs() +
    sootDefs('soot', '#0d0c0a', 0.7) +
    '<clipPath id="deckClip"><rect x="8" y="16" width="62" height="28"/><rect x="130" y="16" width="62" height="28"/></clipPath>';
  const jag = (x, dir) => {
    const pts = [];
    for (let y = 14; y <= 46; y += 4) pts.push([x + dir * rand.range(0, 5), y]);
    return pts;
  };
  const leftEnd = jag(78, 1);
  const rightEnd = jag(122, -1);
  const leftDeck = `M72,16 ${leftEnd.map(([x, y]) => `L${r2(x)},${y}`).join(' ')} L72,44Z`;
  const rightDeck = `M128,16 ${rightEnd.map(([x, y]) => `L${r2(x)},${y}`).join(' ')} L128,44Z`;
  const slabs = [
    [88, 24, 14, 10, 18],
    [104, 33, 12, 9, -24],
    [96, 40, 9, 6, 40],
    [112, 20, 8, 6, -10],
  ]
    .map(([x, y, w, h, deg]) =>
      g(
        [
          ellipse(0, 0, w * 0.75, h * 0.8, { fill: 'none', stroke: '#e8f2f0', 'stroke-width': 1.3, opacity: 0.45 }),
          rect(-w / 2, -h / 2, w, h, { fill: '#3e3d38', stroke: '#1b1b18', 'stroke-width': 0.5 }),
          rect(-w / 2, -h / 2, w, h * 0.4, { fill: '#5a5953', opacity: 0.8 }),
        ].join(''),
        { transform: `translate(${x},${y}) rotate(${deg})` },
      ),
    )
    .join('');
  const body = [
    piersAndAbutments(),
    bridgeSpan(SPANS[0]),
    bridgeSpan(SPANS[2]),
    // stubs of the fallen centre span
    path(leftDeck, { fill: 'url(#deckG)', stroke: '#1b1b18', 'stroke-width': 0.5 }),
    path(rightDeck, { fill: 'url(#deckG)', stroke: '#1b1b18', 'stroke-width': 0.5 }),
    // twisted chords sagging into the water
    path('M74,13.5 Q86,15 92,22 Q99,30 104,26', { fill: 'none', stroke: '#474b42', 'stroke-width': 3.2, opacity: 0.9 }),
    path('M126,46.5 Q114,44 108,38 Q100,31 95,36', { fill: 'none', stroke: '#474b42', 'stroke-width': 3.2, opacity: 0.85 }),
    path('M74,46.5 Q84,47 90,52', { fill: 'none', stroke: '#3a3d36', 'stroke-width': 2.6, opacity: 0.8 }),
    path('M126,13.5 Q118,12 112,8', { fill: 'none', stroke: '#3a3d36', 'stroke-width': 2.6, opacity: 0.8 }),
    slabs,
    ellipse(72, 30, 14, 16, { fill: 'url(#soot)' }),
    ellipse(128, 30, 12, 15, { fill: 'url(#soot)' }),
    ellipse(45, 26, 9, 7, { fill: 'url(#soot)', opacity: 0.7 }),
    rect(66.5, 5.5, 7, 6, { fill: P.concreteD, opacity: 0.9 }),
  ].join('');
  return svg(200, 60, defs, body);
}

// ---------------------------------------------------------------------------
// Ammo dump — 160 × 120.
// ---------------------------------------------------------------------------
function crateStack(x, y, cols, rows, rand, opts = {}) {
  const { burnt = false, redEvery = 0 } = opts;
  const cw = 8.2;
  const ch = 5.6;
  const out = [];
  out.push(rect(x + 1.5, y + 1.8, cols * cw, rows * ch, { fill: '#000', opacity: 0.3 }));
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const cx = x + i * cw;
      const cy = y + j * ch;
      const base = burnt ? rand.pick(['#1f1c18', '#2a2621', '#34302a']) : rand.pick(['#5d6838', '#66723e', '#56612f', '#707a45']);
      out.push(rect(cx, cy, cw - 0.4, ch - 0.4, { fill: base, stroke: burnt ? '#0b0a09' : '#2a2f18', 'stroke-width': 0.45 }));
      if (!burnt) {
        out.push(line(cx + cw / 2 - 0.2, cy + 0.4, cx + cw / 2 - 0.2, cy + ch - 0.8, { stroke: '#2e3419', 'stroke-width': 0.35 }));
        out.push(line(cx + 0.4, cy + 0.6, cx + cw - 0.9, cy + 0.6, { stroke: '#ffffff', 'stroke-width': 0.35, opacity: 0.3 }));
        if (redEvery && (i + j) % redEvery === 0) out.push(rect(cx + 1.2, cy + 1.6, 1.3, ch - 3.2, { fill: P.red }));
        else out.push(rect(cx + 1.2, cy + 2.2, 2, 0.5, { fill: P.yellow, opacity: 0.8 }));
      }
    }
  }
  return out.join('');
}

function drums(x, y, cols, rows, rand, burnt = false) {
  const out = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const cx = x + i * 5.2 + (j % 2 ? 2.6 : 0);
      const cy = y + j * 4.6;
      const c = burnt ? rand.pick(['#1d1b18', '#2b2723', P.rust]) : rand.pick([P.olD, P.ol, P.red, '#4d5230', P.rust]);
      out.push(circle(cx + 0.7, cy + 0.9, 2.4, { fill: '#000', opacity: 0.3 }));
      out.push(circle(cx, cy, 2.35, { fill: c, stroke: P.ink, 'stroke-width': 0.4 }));
      if (!burnt) out.push(circle(cx, cy, 1.5, { fill: 'none', stroke: '#ffffff', 'stroke-width': 0.3, opacity: 0.35 }), circle(cx - 0.8, cy - 0.6, 0.4, { fill: '#222' }));
    }
  }
  return out.join('');
}

function shells(x, y, n, rand) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const sx = x + (i % 6) * 2.2;
    const sy = y + Math.floor(i / 6) * 5.4 + rand.range(-0.3, 0.3);
    out.push(rrect(sx, sy, 1.8, 4.8, 0.8, { fill: P.brass, stroke: '#6b5520', 'stroke-width': 0.3 }));
    out.push(rect(sx, sy, 1.8, 1.2, { rx: 0.8, fill: '#8a8a80' }));
  }
  return out.join('');
}

function bermPath(rand) {
  // Irregular loop around the compound with an entrance gap at the south-east.
  const pts = [];
  const n = 26;
  for (let i = 0; i <= n; i++) {
    const a = -0.2 + (i / n) * (Math.PI * 2 - 0.95);
    const rx = 70 + rand.range(-2.5, 2.5);
    const ry = 50 + rand.range(-2.5, 2.5);
    pts.push([80 + Math.cos(a + 0.9) * rx, 60 + Math.sin(a + 0.9) * ry]);
  }
  return smoothOpen(pts);
}

function camoNet(cx, cy, rx, ry, rand, id) {
  const d = blobPath(cx, cy, rx, ry, rand, 6, 0.16);
  const blotches = Array.from({ length: 12 }, () =>
    path(blobPath(cx + rand.range(-rx, rx) * 0.8, cy + rand.range(-ry, ry) * 0.8, rand.range(3, 7), rand.range(2, 5), rand, 3, 0.3), {
      fill: rand.pick(['#4f5a2c', '#6f6a3c', '#3e4722', '#857a4c']),
      opacity: 0.85,
    }),
  ).join('');
  let net = '';
  for (let k = -rx - ry; k < rx + ry; k += 3) {
    net += line(cx + k, cy - ry - 4, cx + k + ry + 4, cy + ry + 4, { stroke: '#2d3218', 'stroke-width': 0.3 });
    net += line(cx + k, cy + ry + 4, cx + k + ry + 4, cy - ry - 4, { stroke: '#2d3218', 'stroke-width': 0.3 });
  }
  return [
    `<clipPath id="${id}"><path d="${d}"/></clipPath>`,
    path(d, { fill: '#000', opacity: 0.28, transform: 'translate(2,2.6)' }),
    path(d, { fill: '#5d6634', stroke: '#2d3218', 'stroke-width': 0.6 }),
    g(blotches + g(net, { opacity: 0.55 }), { 'clip-path': `url(#${id})` }),
  ].join('');
}

export function ammoDump() {
  const W = 160;
  const H = 120;
  const rand = rng(31);
  const defs = [apron('apron', P.dirt, 0.65)].join('');
  const berm = bermPath(rand);
  const body = [
    ellipse(80, 60, 80, 60, { fill: 'url(#apron)' }),
    path(blobPath(80, 60, 64, 45, rand, 5, 0.06), { fill: '#a39068', opacity: 0.85 }),
    // tyre tracks
    path('M150,112 Q128,92 104,80 Q82,70 60,62', { fill: 'none', stroke: P.dirtD, 'stroke-width': 1.3, opacity: 0.55 }),
    path('M146,116 Q124,96 100,84 Q78,74 56,66', { fill: 'none', stroke: P.dirtD, 'stroke-width': 1.3, opacity: 0.55 }),
    // berm (shadow, body, lit crest)
    path(berm, { fill: 'none', stroke: '#000', 'stroke-width': 9, opacity: 0.18, transform: 'translate(2,2.6)' }),
    path(berm, { fill: 'none', stroke: '#8c7a55', 'stroke-width': 8, 'stroke-linecap': 'round' }),
    path(berm, { fill: 'none', stroke: '#b4a17a', 'stroke-width': 3, 'stroke-linecap': 'round', transform: 'translate(-1,-1.2)' }),
    crateStack(22, 26, 4, 3, rand, { redEvery: 3 }),
    crateStack(66, 22, 3, 3, rand),
    crateStack(28, 66, 3, 2, rand, { redEvery: 2 }),
    crateStack(70, 70, 4, 2, rand),
    drums(114, 66, 4, 3, rand),
    drums(124, 26, 3, 3, rand),
    shells(56, 48, 12, rand),
    crateStack(92, 30, 3, 3, rand),
    camoNet(106, 44, 17, 14, rand, 'net1'),
    // tent
    g(
      [
        rect(1.6, 2, 24, 13, { fill: '#000', opacity: 0.28 }),
        rect(0, 0, 24, 6.5, { fill: '#7f7a4c', stroke: P.ink, 'stroke-width': 0.4 }),
        rect(0, 6.5, 24, 6.5, { fill: '#5e5a36', stroke: P.ink, 'stroke-width': 0.4 }),
        line(0, 6.5, 24, 6.5, { stroke: '#3a3822', 'stroke-width': 0.6 }),
      ].join(''),
      { transform: 'translate(14,90)' },
    ),
    // red warning flags at the entrance
    rect(136, 95, 3, 2.2, { fill: P.red, stroke: P.redD, 'stroke-width': 0.3 }),
    rect(148, 82, 3, 2.2, { fill: P.red, stroke: P.redD, 'stroke-width': 0.3 }),
  ].join('');
  return svg(W, H, defs, body);
}

export function ammoDumpWreck() {
  const W = 160;
  const H = 120;
  const rand = rng(32);
  const defs = [apron('apron', '#3d3529', 0.7), sootDefs('soot', '#0c0b09', 0.85), rad('craterG', 0.5, 0.5, 0.5, [[0, '#0f0d0a'], [0.55, '#2c261d'], [0.8, '#6d5d42'], [1, '#6d5d42', 0]])].join('');
  const berm = bermPath(rng(31));
  const craters = [
    [40, 38, 13],
    [84, 30, 11],
    [48, 76, 12],
    [104, 70, 15],
    [126, 36, 9],
  ]
    .map(([x, y, r]) => circle(x, y, r, { fill: 'url(#craterG)' }))
    .join('');
  const debris = Array.from({ length: 40 }, () =>
    rect(0, 0, rand.range(1.5, 5), rand.range(1, 3), {
      fill: rand.pick(['#1a1815', '#2c2925', P.rust, '#4d4841', '#5d6838']),
      transform: `translate(${r2(rand.range(12, 150))},${r2(rand.range(12, 108))}) rotate(${r2(rand.range(0, 180))})`,
    }),
  ).join('');
  const body = [
    ellipse(80, 60, 80, 60, { fill: 'url(#apron)' }),
    path(berm, { fill: 'none', stroke: '#3f3629', 'stroke-width': 8, 'stroke-linecap': 'round', 'stroke-dasharray': '26 9 40 12 30 7' }),
    path(berm, { fill: 'none', stroke: '#5d523f', 'stroke-width': 2.6, 'stroke-dasharray': '26 9 40 12 30 7', transform: 'translate(-1,-1.2)' }),
    ellipse(72, 55, 58, 42, { fill: 'url(#soot)' }),
    craters,
    crateStack(66, 22, 2, 2, rand, { burnt: true }),
    crateStack(70, 74, 3, 1, rand, { burnt: true }),
    drums(118, 70, 3, 2, rand, true),
    debris,
  ].join('');
  return svg(W, H, defs, body);
}

export function cache() {
  const rand = rng(51);
  const body = [
    rect(4, 16, 9, 7, { fill: '#5d6838', stroke: '#2a2f18', 'stroke-width': 0.4 }),
    rect(17, 5, 8, 6, { fill: '#66723e', stroke: '#2a2f18', 'stroke-width': 0.4 }),
    camoNet(15, 15, 12, 11, rand, 'cnet'),
    circle(24.5, 21, 1.8, { fill: P.olD, stroke: P.ink, 'stroke-width': 0.35 }),
    circle(22, 24.5, 1.8, { fill: P.rust, stroke: P.ink, 'stroke-width': 0.35 }),
  ].join('');
  return svg(30, 30, '', body);
}

// ---------------------------------------------------------------------------
// Outpost Bravo — 180 × 180. HESCO walls, bunkers, tents, blue flag.
// ---------------------------------------------------------------------------
function hescoRun(x1, y1, x2, y2, rand, burnt = false, skip = () => false) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.round(len / 6.2);
  const deg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  const out = [];
  for (let i = 0; i < n; i++) {
    if (skip(i, n)) continue;
    const t = (i + 0.5) / n;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    const fill = burnt ? rand.pick(['#3b352c', '#4a4336', '#2a2620']) : rand.pick([P.sandbag, '#bfae84', '#ab9870']);
    out.push(
      g(
        [
          rect(-2.6, -3.2, 6.2, 7.2, { fill: '#000', opacity: 0.25, transform: 'translate(1.2,1.4)' }),
          rect(-3, -3.1, 6, 6.2, { fill, stroke: burnt ? '#15130f' : '#6f6246', 'stroke-width': 0.5 }),
          circle(-1, -1, 0.5, { fill: burnt ? '#1a1814' : '#8d7d59' }),
          circle(1.2, 0.8, 0.45, { fill: burnt ? '#1a1814' : '#8d7d59' }),
        ].join(''),
        { transform: `translate(${r2(x)},${r2(y)}) rotate(${r2(deg)})` },
      ),
    );
  }
  return out.join('');
}

function tent(x, y, w, h, deg, colors, burnt = false) {
  const [lit, shade, ridge] = colors;
  if (burnt) {
    return g(
      [
        rect(0, 0, w, h, { fill: '#1b1916', stroke: '#0b0a09', 'stroke-width': 0.5 }),
        ...Array.from({ length: Math.floor(w / 5) }, (_, i) => line(3 + i * 5, 0.5, 3 + i * 5, h - 0.5, { stroke: '#4a453e', 'stroke-width': 0.6 })),
        rect(w * 0.2, h * 0.3, w * 0.5, h * 0.35, { fill: P.ash, opacity: 0.6 }),
      ].join(''),
      { transform: `translate(${x},${y}) rotate(${deg})` },
    );
  }
  return g(
    [
      rect(1.8, 2.4, w, h, { fill: '#000', opacity: 0.28 }),
      rect(0, 0, w, h / 2, { fill: lit, stroke: P.ink, 'stroke-width': 0.45 }),
      rect(0, h / 2, w, h / 2, { fill: shade, stroke: P.ink, 'stroke-width': 0.45 }),
      line(0, h / 2, w, h / 2, { stroke: ridge, 'stroke-width': 0.8 }),
      ...Array.from({ length: Math.floor(w / 6) }, (_, i) => line(3 + i * 6, 0.3, 3 + i * 6, h - 0.3, { stroke: ridge, 'stroke-width': 0.3, opacity: 0.5 })),
    ].join(''),
    { transform: `translate(${x},${y}) rotate(${deg})` },
  );
}

function bunker(x, y, rand, burnt = false) {
  if (burnt) {
    return g(
      [
        circle(0, 0, 11, { fill: '#2a251e' }),
        sandbagRing(0, 0, 8.5, 4, rand, { colors: ['#3b352c', '#4a4336', '#2a2620'], stroke: '#15130f' }),
        rect(-6, -5, 12, 10, { fill: '#171512', transform: 'rotate(18)' }),
      ].join(''),
      { transform: `translate(${x},${y})` },
    );
  }
  return g(
    [
      circle(1.4, 1.8, 11, { fill: '#000', opacity: 0.25 }),
      sandbagRing(0, 0, 8.5, 4, rand),
      rect(-6, -6, 12, 12, { fill: '#6f7069', stroke: P.ink, 'stroke-width': 0.5 }),
      ...Array.from({ length: 5 }, (_, i) => line(-6, -4.8 + i * 2.4, 6, -4.8 + i * 2.4, { stroke: '#8d8e86', 'stroke-width': 0.5 })),
      rect(-6, -6, 12, 2.2, { fill: P.blue, opacity: 0.9 }),
    ].join(''),
    { transform: `translate(${x},${y})` },
  );
}

function outpostLayout(burnt) {
  const rand = rng(burnt ? 62 : 61);
  const c = 16; // chamfer
  const a = 18;
  const b = 162;
  const gate = (i, n) => i >= Math.floor(n * 0.42) && i < Math.ceil(n * 0.58);
  const breach = (i, n) => burnt && (i === 3 || i === 4 || i === n - 5);
  const walls = [
    hescoRun(a + c, a, b - c, a, rand, burnt, breach),
    hescoRun(b - c, a, b, a + c, rand, burnt),
    hescoRun(b, a + c, b, b - c, rand, burnt, (i, n) => burnt && i > n / 2 - 2 && i < n / 2 + 2),
    hescoRun(b, b - c, b - c, b, rand, burnt),
    hescoRun(b - c, b, a + c, b, rand, burnt),
    hescoRun(a + c, b, a, b - c, rand, burnt),
    hescoRun(a, b - c, a, a + c, rand, burnt, gate),
    hescoRun(a, a + c, a + c, a, rand, burnt),
  ].join('');
  const tentColors = ['#8a8456', '#686440', '#3f3d25'];
  const floor = path(`M${a + c},${a} L${b - c},${a} L${b},${a + c} L${b},${b - c} L${b - c},${b} L${a + c},${b} L${a},${b - c} L${a},${a + c}Z`, {
    fill: burnt ? '#5a4f3d' : '#b09d74',
  });
  const out = [
    floor,
    path('M0,90 L60,92 Q90,94 120,112', { fill: 'none', stroke: burnt ? '#40382c' : P.dirtD, 'stroke-width': 1.4, opacity: 0.5 }),
    path('M0,96 L60,97 Q88,99 116,117', { fill: 'none', stroke: burnt ? '#40382c' : P.dirtD, 'stroke-width': 1.4, opacity: 0.5 }),
    walls,
    bunker(a + 5, a + 5, rand, burnt),
    bunker(b - 5, a + 5, rand, burnt),
    bunker(b - 5, b - 5, rand, burnt),
    bunker(a + 5, b - 5, rand, burnt),
    tent(36, 36, 32, 16, 0, tentColors, burnt),
    tent(36, 58, 32, 16, 0, tentColors, burnt),
    tent(84, 34, 26, 14, 0, tentColors, burnt),
  ];
  if (!burnt) {
    out.push(
      // helipad
      circle(62, 124, 19, { fill: '#a39374', stroke: '#e8e2cf', 'stroke-width': 1.6 }),
      rect(55, 116, 3, 16, { fill: '#ece6d2' }),
      rect(66, 116, 3, 16, { fill: '#ece6d2' }),
      rect(58, 122.5, 8, 3, { fill: '#ece6d2' }),
      // command bunker with blue ID panel
      rect(111.5, 111.5, 40, 30, { fill: '#000', opacity: 0.28 }),
      rect(108, 108, 40, 30, { fill: 'url(#concG)', stroke: P.ink, 'stroke-width': 0.6 }),
      sandbagLine(109, 109.5, 147, 109.5, 3.4, rand),
      rect(117, 116, 22, 14, { fill: P.blue, stroke: P.blueD, 'stroke-width': 0.6 }),
      path('M121,123 L128,118 L135,123 M121,127 L128,122 L135,127', { fill: 'none', stroke: '#e8f2ff', 'stroke-width': 1.3 }),
      // water tank + generator + crates
      circle(128.6, 71.8, 7, { fill: '#000', opacity: 0.25 }),
      circle(127, 70, 7, { fill: '#8f958d', stroke: P.ink, 'stroke-width': 0.5 }),
      circle(127, 70, 4.5, { fill: 'none', stroke: '#b5bab2', 'stroke-width': 0.6 }),
      rrect(120, 84, 12, 7, 1, { fill: P.frD, stroke: P.ink, 'stroke-width': 0.5 }),
      crateStack(96, 62, 2, 2, rand),
      // sandbag fighting positions along the east wall
      sandbagLine(146, 60, 146, 76, 3.2, rand),
      sandbagLine(146, 104, 146, 120, 3.2, rand),
      // flag pole + blue flag with its shadow
      path('M92,88 L106,86.6 L106,95.2 L92,96.4Z', { fill: '#000', opacity: 0.25, transform: 'translate(3,4)' }),
      circle(90, 90, 1.3, { fill: '#d8d4c8', stroke: P.ink, 'stroke-width': 0.4 }),
      path('M91,86 Q96,84.4 100,85.6 Q104,86.8 106,85.4 L106,94 Q103,95.6 99,94.4 Q95,93.2 91,94.8Z', { fill: P.blue, stroke: P.blueD, 'stroke-width': 0.5 }),
      path('M98.2,87.4 L99,89.2 L101,89.3 L99.5,90.5 L100,92.4 L98.2,91.3 L96.5,92.4 L97,90.5 L95.5,89.3 L97.4,89.2Z', { fill: '#ffffff' }),
    );
  } else {
    const rand2 = rng(63);
    out.push(
      rect(108, 108, 40, 30, { fill: '#26221c', stroke: '#0b0a09', 'stroke-width': 0.6, transform: 'rotate(4 128 123)' }),
      rect(116, 115, 20, 12, { fill: '#1d3048', opacity: 0.6 }),
      line(90, 90, 104, 104, { stroke: '#2a2622', 'stroke-width': 1.3 }),
      path('M103,103 L110,99 L112,106Z', { fill: '#1b3552', opacity: 0.85 }),
      circle(127, 70, 7, { fill: '#2a2926', stroke: '#0b0a09', 'stroke-width': 0.5 }),
      ...[
        [60, 120, 16],
        [110, 80, 12],
        [142, 45, 11],
        [50, 150, 10],
      ].map(([x, y, r]) => circle(x, y, r, { fill: 'url(#craterG)' })),
      ...Array.from({ length: 50 }, () =>
        rect(0, 0, rand2.range(1.5, 5), rand2.range(1, 3), {
          fill: rand2.pick(['#1a1815', '#2c2925', P.rust, '#4d4841', '#6b604a']),
          transform: `translate(${r2(rand2.range(20, 160))},${r2(rand2.range(20, 160))}) rotate(${r2(rand2.range(0, 180))})`,
        }),
      ),
    );
  }
  return out.join('');
}

export function outpost() {
  const defs = [apron('apron', P.dirt, 0.6), lin('concG', 0, 0, 1, 1, [[0, P.concreteL], [1, P.concreteD]])].join('');
  return svg(180, 180, defs, circle(90, 90, 92, { fill: 'url(#apron)' }) + outpostLayout(false));
}

export function outpostDestroyed() {
  const defs = [
    apron('apron', '#3d3529', 0.7),
    sootDefs('soot', '#0c0b09', 0.8),
    lin('concG', 0, 0, 1, 1, [[0, P.concreteL], [1, P.concreteD]]),
    rad('craterG', 0.5, 0.5, 0.5, [[0, '#0f0d0a'], [0.55, '#2c261d'], [0.8, '#6d5d42'], [1, '#6d5d42', 0]]),
  ].join('');
  return svg(
    180,
    180,
    defs,
    circle(90, 90, 92, { fill: 'url(#apron)' }) + outpostLayout(true) + ellipse(80, 70, 50, 40, { fill: 'url(#soot)' }) + ellipse(130, 120, 36, 30, { fill: 'url(#soot)' }),
  );
}

// ---------------------------------------------------------------------------
// Home base — 360 × 260. Runway E-W, apron, rearm pad (centre), shelters, fuel.
// ---------------------------------------------------------------------------
export function homeBase() {
  const W = 360;
  const H = 260;
  const rand = rng(71);
  const defs = [
    apron('apron', '#a8976c', 0.55),
    lin('rwyG', 0, 0, 0, 1, [[0, '#5a5a54'], [0.5, '#4d4d48'], [1, '#44443f']]),
    lin('concG', 0, 0, 1, 1, [[0, '#b3b0a6'], [1, '#8f8c83']]),
    lin('hasG', 0, 0, 0, 1, [[0, '#9ea08f'], [0.35, '#8a8c7b'], [0.7, '#626455'], [1, '#4a4c40']]),
    lin('bladderG', 0, 0, 1, 1, [[0, '#4d524c'], [0.5, '#2e322f'], [1, '#1d201e']]),
  ].join('');

  const out = [];
  out.push(ellipse(180, 130, 190, 140, { fill: 'url(#apron)' }));
  // perimeter fence
  out.push(rect(6, 8, 348, 238, { fill: 'none', stroke: '#5a5546', 'stroke-width': 0.8, 'stroke-dasharray': '4 3', opacity: 0.7 }));

  // runway
  const ry = 180;
  const rh = 40;
  out.push(rect(4, ry - 3, 352, rh + 6, { fill: '#9d9784' }));
  out.push(rect(6, ry, 348, rh, { fill: 'url(#rwyG)', stroke: P.ink, 'stroke-width': 0.6 }));
  for (let x = 40; x < 320; x += 22) out.push(rect(x, ry + rh / 2 - 0.8, 12, 1.6, { fill: '#ecebe2' }));
  out.push(line(8, ry + 2.5, 352, ry + 2.5, { stroke: '#ecebe2', 'stroke-width': 0.8 }));
  out.push(line(8, ry + rh - 2.5, 352, ry + rh - 2.5, { stroke: '#ecebe2', 'stroke-width': 0.8 }));
  for (const x0 of [12, 334]) {
    for (let i = 0; i < 8; i++) {
      const y = ry + 5 + i * 4.1;
      if (i === 3 || i === 4) continue;
      out.push(rect(x0, y, 14, 2.4, { fill: '#ecebe2' }));
    }
  }
  for (const x0 of [64, 282]) {
    out.push(rect(x0, ry + 7, 16, 4, { fill: '#ecebe2' }), rect(x0, ry + rh - 11, 16, 4, { fill: '#ecebe2' }));
  }
  for (let i = 0; i < 14; i++) {
    const x = rand.range(30, 110) + (i % 2 ? 220 : 0);
    const y = ry + rh / 2 + rand.range(-9, 9);
    out.push(rect(x, y, rand.range(10, 26), 1.3, { fill: '#26261f', opacity: 0.35 }));
  }

  // apron + taxiway
  out.push(rect(62, 60, 236, 60, { fill: 'url(#concG)', stroke: '#5f5c52', 'stroke-width': 0.6 }));
  for (let x = 82; x < 298; x += 20) out.push(line(x, 60, x, 120, { stroke: '#7d7a70', 'stroke-width': 0.4 }));
  out.push(line(62, 90, 298, 90, { stroke: '#7d7a70', 'stroke-width': 0.4 }));
  out.push(rect(166, 118, 28, 64, { fill: 'url(#concG)', stroke: '#5f5c52', 'stroke-width': 0.6 }));
  out.push(path('M180,180 L180,106 Q180,98 172,98 L70,98', { fill: 'none', stroke: P.yellow, 'stroke-width': 1.1 }));
  out.push(path('M180,106 Q180,98 188,98 L292,98', { fill: 'none', stroke: P.yellow, 'stroke-width': 1.1 }));

  // rearm pad at the sprite centre (entity position)
  out.push(circle(180, 130, 26, { fill: '#b8b5aa', stroke: '#5f5c52', 'stroke-width': 0.8 }));
  out.push(circle(180, 130, 22, { fill: 'none', stroke: P.blue, 'stroke-width': 3.4 }));
  out.push(circle(180, 130, 14, { fill: 'none', stroke: '#ecebe2', 'stroke-width': 1.2, 'stroke-dasharray': '5 3' }));
  for (let k = 0; k < 4; k++) {
    out.push(path('M-4,-26 L0,-31 L4,-26', { fill: 'none', stroke: P.blue, 'stroke-width': 2.2, transform: `translate(180,130) rotate(${k * 90})` }));
  }
  out.push(rect(178.6, 122, 2.8, 16, { fill: P.blue }), rect(172, 128.6, 16, 2.8, { fill: P.blue }));

  // hardened aircraft shelters (doors facing the apron)
  const has = (x, y, flip) =>
    g(
      [
        rect(3, 4, 54, 50, { fill: '#000', opacity: 0.3 }),
        rrect(0, 0, 54, 50, 6, { fill: 'url(#hasG)', stroke: P.ink, 'stroke-width': 0.6 }),
        ...Array.from({ length: 8 }, (_, i) => line(3 + i * 6.6, 1, 3 + i * 6.6, 49, { stroke: '#4d4f43', 'stroke-width': 0.5, opacity: 0.6 })),
        rect(flip ? 0 : 50, 4, 4, 42, { fill: '#3a3c33' }),
        rect(22, 3, 10, 3, { fill: P.blue, opacity: 0.9 }),
      ].join(''),
      { transform: `translate(${x},${y})` },
    );
  out.push(has(6, 62, false), has(300, 62, true));

  // control tower
  out.push(rect(204, 18, 20, 20, { fill: '#000', opacity: 0.3 }));
  out.push(rect(200, 14, 20, 20, { fill: 'url(#concG)', stroke: P.ink, 'stroke-width': 0.6 }));
  out.push(rect(204, 18, 12, 12, { fill: P.glass, stroke: P.ink, 'stroke-width': 0.5 }));
  out.push(line(205, 19.5, 210, 19.5, { stroke: P.glassL, 'stroke-width': 0.7 }));
  // flag
  out.push(circle(226, 40, 0.9, { fill: '#ddd' }), path('M226.6,36.6 L236,37.4 L236,42.4 L226.6,41.6Z', { fill: P.blue, stroke: P.blueD, 'stroke-width': 0.4 }));

  // fuel bladders in a berm
  out.push(rrect(240, 12, 80, 38, 5, { fill: 'none', stroke: '#8c7a55', 'stroke-width': 5 }));
  for (let i = 0; i < 3; i++) {
    out.push(rrect(246 + i * 24.5, 17, 20, 28, 8, { fill: 'url(#bladderG)', stroke: '#121412', 'stroke-width': 0.5 }));
    out.push(path(`M${250 + i * 24.5},22 Q${256 + i * 24.5},19.5 ${262 + i * 24.5},22`, { fill: 'none', stroke: '#7d847c', 'stroke-width': 0.8, opacity: 0.6 }));
  }
  // ops tents + bomb cart + fuel truck
  out.push(tent(96, 18, 30, 16, 0, ['#8a8456', '#686440', '#3f3d25']));
  out.push(tent(134, 18, 26, 16, 0, ['#8a8456', '#686440', '#3f3d25']));
  out.push(
    g(
      [
        rect(0, 0, 18, 9, { rx: 1, fill: '#d0a93c', stroke: P.ink, 'stroke-width': 0.4 }),
        ...[1.4, 4.5, 7.6].map((y) => rrect(1, y - 1.1, 15, 2.2, 1.1, { fill: '#5d6440', stroke: P.ink, 'stroke-width': 0.3 })),
      ].join(''),
      { transform: 'translate(112,70)' },
    ),
  );
  out.push(
    g(
      [
        rect(1.2, 1.6, 22, 9, { fill: '#000', opacity: 0.3 }),
        rrect(0, 0, 15, 9, 3, { fill: '#8f958d', stroke: P.ink, 'stroke-width': 0.4 }),
        rect(15.5, 0.8, 6, 7.4, { rx: 0.8, fill: P.frD, stroke: P.ink, 'stroke-width': 0.4 }),
        rect(20, 1.6, 1.2, 5.8, { fill: P.glass }),
      ].join(''),
      { transform: 'translate(244,70)' },
    ),
  );
  // Runway edge lights (white) and taxiway/apron edge lights (blue).
  for (let x = 16; x < 350; x += 16) {
    out.push(circle(x, ry - 1.6, 0.9, { fill: '#fff7d8', stroke: '#6b675c', 'stroke-width': 0.3 }));
    out.push(circle(x, ry + rh + 1.6, 0.9, { fill: '#fff7d8', stroke: '#6b675c', 'stroke-width': 0.3 }));
  }
  for (let y = 124; y < 176; y += 10) {
    out.push(circle(164.5, y, 0.95, { fill: P.blueL, stroke: P.blueD, 'stroke-width': 0.3 }));
    out.push(circle(195.5, y, 0.95, { fill: P.blueL, stroke: P.blueD, 'stroke-width': 0.3 }));
  }
  for (let x = 66; x < 298; x += 14) out.push(circle(x, 122, 0.95, { fill: P.blueL, stroke: P.blueD, 'stroke-width': 0.3 }));
  // Earth berms shielding the shelters.
  out.push(path('M4,58 L4,118 L62,118', { fill: 'none', stroke: '#8c7a55', 'stroke-width': 5, 'stroke-linejoin': 'round', opacity: 0.9 }));
  out.push(path('M356,58 L356,118 L298,118', { fill: 'none', stroke: '#8c7a55', 'stroke-width': 5, 'stroke-linejoin': 'round', opacity: 0.9 }));
  out.push(path('M5.5,60 L5.5,116.5 L60,116.5', { fill: 'none', stroke: '#b4a17a', 'stroke-width': 1.6, opacity: 0.8 }));
  out.push(path('M354.5,60 L354.5,116.5 L300,116.5', { fill: 'none', stroke: '#b4a17a', 'stroke-width': 1.6, opacity: 0.8 }));
  // Munitions pallets by the rearm pad.
  const pallet = (x, y, n, color) =>
    g(
      [
        rect(1.2, 1.6, 14, 9, { fill: '#000', opacity: 0.28 }),
        rect(0, 0, 14, 9, { fill: '#8a7650', stroke: P.ink, 'stroke-width': 0.4 }),
        ...Array.from({ length: n }, (_, i) => rrect(1, 1 + i * (7 / n), 12, 7 / n - 0.6, 1, { fill: color, stroke: P.ink, 'stroke-width': 0.3 })),
      ].join(''),
      { transform: `translate(${x},${y})` },
    );
  out.push(pallet(214, 104, 3, '#5d6440'), pallet(214, 146, 3, '#d9d9d0'), pallet(134, 146, 2, '#5d6440'));
  out.push(crateGroup(96, 100, rand), crateGroup(252, 102, rand));
  // Humvee-style utility vehicle + tow tractor.
  out.push(
    g(
      [
        rect(1.2, 1.6, 12, 7, { fill: '#000', opacity: 0.3 }),
        rrect(0, 0, 12, 7, 1.5, { fill: '#8e8a6c', stroke: P.ink, 'stroke-width': 0.4 }),
        rect(7.5, 0.8, 2.2, 5.4, { fill: P.glass }),
        rect(2, 1.2, 4.5, 4.6, { fill: '#7a7658' }),
      ].join(''),
      { transform: 'translate(150,62) rotate(15)' },
    ),
  );
  out.push(
    g([rrect(0, 0, 8, 5, 1, { fill: P.yellow, stroke: P.ink, 'stroke-width': 0.4 }), rect(5, 0.8, 2, 3.4, { fill: '#2a2a28' })].join(''), {
      transform: 'translate(226,128) rotate(-30)',
    }),
  );
  // Windsock.
  out.push(line(338, 152, 338, 156, { stroke: '#ddd', 'stroke-width': 0.8 }));
  out.push(path('M338,152 L348,150.6 L348,153.4Z', { fill: '#e8742a', stroke: '#8a3a10', 'stroke-width': 0.3 }));
  out.push(rect(341, 150.9, 2, 2.3, { fill: '#ffffff' }));
  return svg(W, H, defs, out.join(''));
}

function crateGroup(x, y, rand) {
  const out = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      out.push(rect(x + i * 6.2, y + j * 4.8, 5.8, 4.4, { fill: rand.pick(['#5d6838', '#66723e', '#707a45']), stroke: '#2a2f18', 'stroke-width': 0.35 }));
    }
  }
  return out.join('');
}
