import {
  P, r2, svg, lin, rad, rect, circle, ellipse, path, line, g, poly, polyline, rng, blobPath, rrect, lightDefs, cylDefs, sootDefs,
} from './lib.mjs';

// ---------------------------------------------------------------------------
// A-10 Warthog — 84 × 90, nose east, centreline y = 45
// ---------------------------------------------------------------------------
export function a10() {
  const W = 84;
  const H = 90;
  const cy = 45;
  const rand = rng(10);

  // Fuselage half-widths along x (tail → nose).
  const st = [
    [2.2, 1.7], [6, 2.4], [12, 3.0], [20, 3.6], [28, 4.2], [38, 5.0], [48, 5.5],
    [57, 5.8], [63, 5.6], [69, 5.0], [74, 4.2], [78, 3.3], [81, 2.3], [83.2, 1.1],
  ];
  const upper = st.map(([x, hw]) => [x, cy - hw]);
  const lower = st.slice().reverse().map(([x, hw]) => [x, cy + hw]);
  const fusD = (() => {
    let d = `M${upper[0][0]},${upper[0][1]}`;
    for (let i = 1; i < upper.length; i++) {
      const [x0, y0] = upper[i - 1];
      const [x1, y1] = upper[i];
      d += `Q${r2((x0 + x1) / 2)},${r2(Math.min(y0, y1) - 0.05)} ${x1},${y1}`;
    }
    d += `Q84.3,${cy} ${lower[0][0]},${lower[0][1]}`;
    for (let i = 1; i < lower.length; i++) {
      const [x0, y0] = lower[i - 1];
      const [x1, y1] = lower[i];
      d += `Q${r2((x0 + x1) / 2)},${r2(Math.max(y0, y1) + 0.05)} ${x1},${y1}`;
    }
    d += `Q1.2,${cy} ${upper[0][0]},${upper[0][1]}Z`;
    return d;
  })();

  const wingD =
    'M48.6,2.4 L50.8,29 L51.1,45 L50.8,61 L48.6,87.6 Q48.3,88.9 47.1,88.9 L42,88.9 Q40.8,88.9 40.6,87.7 ' +
    'L35.2,61 L34.8,45 L35.2,29 L40.6,2.3 Q40.8,1.1 42,1.1 L47.1,1.1 Q48.3,1.1 48.6,2.4Z';
  const tailD =
    'M3.2,29.2 L11.4,30.2 Q13.6,30.6 13.9,32.8 L14.2,45 L13.9,57.2 Q13.6,59.4 11.4,59.8 L3.2,60.8 Q1.1,61 1.1,59 L1.1,31 Q1.1,29 3.2,29.2Z';
  const nacD = (y) =>
    `M17.6,${y - 3.0} L33,${y - 3.8} C36,${y - 3.8} 37.2,${y - 2.2} 37.2,${y} C37.2,${y + 2.2} 36,${y + 3.8} 33,${y + 3.8} L17.6,${y + 3.0} Q16.6,${y} 17.6,${y - 3.0}Z`;
  const finD = (y) =>
    `M0.3,${y} Q4.5,${y - 1.55} 9.8,${y - 1.35} Q14.6,${y - 0.95} 15.6,${y} Q14.6,${y + 0.95} 9.8,${y + 1.35} Q4.5,${y + 1.55} 0.3,${y}Z`;

  const defs = [
    lightDefs('lit', 0.26, 0.32),
    lin('wingG', 0, 0, 1, 0, [[0, P.g], [0.75, P.gL], [0.93, P.gHi], [1, P.gL]]),
    cylDefs('fusG', P.gHi, P.g, P.gD),
    cylDefs('nacG', P.gHi, P.gL, P.gDD),
    lin('tailG', 0, 0, 1, 0, [[0, P.gD], [0.7, P.g], [1, P.gL]]),
    rad('glassG', 0.35, 0.3, 0.75, [[0, P.glassL], [0.35, '#3c607a'], [1, P.glass]]),
    rad('seekG', 0.35, 0.3, 0.8, [[0, '#8a9aa2'], [0.4, '#2c3438'], [1, '#111416']]),
    lin('mavG', 0, 0, 0, 1, [[0, '#ffffff'], [0.4, '#dcdcd4'], [1, '#8e908a']]),
    lin('bombG', 0, 0, 0, 1, [[0, '#8a9160'], [0.45, '#5d6440'], [1, '#3a3f28']]),
    lin('podG', 0, 0, 0, 1, [[0, '#e6e8e2'], [0.45, '#b9bdb5'], [1, '#6f746c']]),
    `<clipPath id="airClip"><path d="${wingD}"/><path d="${fusD}"/><path d="${tailD}"/><path d="${nacD(34.3)}"/><path d="${nacD(55.7)}"/></clipPath>`,
    `<clipPath id="tailClip"><path d="${tailD}"/><path d="${fusD}"/></clipPath>`,
    `<clipPath id="wingClip"><path d="${wingD}"/></clipPath>`,
  ].join('');

  // Underwing stores (drawn below the wing so only their noses show ahead of the leading edge).
  const store = (y) => {
    const s = [];
    // LAU-131 rocket pod (outboard)
    const py = y < cy ? 8.2 : 81.8;
    s.push(rrect(41, py - 1.9, 13, 3.8, 1.6, { fill: 'url(#podG)', stroke: P.gInk, 'stroke-width': 0.45 }));
    s.push(ellipse(53.6, py, 0.7, 1.7, { fill: '#3b3f3a' }));
    s.push(circle(53.9, py - 0.8, 0.45, { fill: '#d8d2b0' }), circle(53.9, py + 0.8, 0.45, { fill: '#d8d2b0' }));
    // Mk-82 (middle)
    const by = y < cy ? 15 : 75;
    s.push(path(`M39,${by - 1.9} L51.5,${by - 1.9} Q55,${by - 1.9} 55.6,${by} Q55,${by + 1.9} 51.5,${by + 1.9} L39,${by + 1.9}Z`, {
      fill: 'url(#bombG)', stroke: P.gInk, 'stroke-width': 0.45,
    }));
    s.push(rect(51.4, by - 1.85, 0.9, 3.7, { fill: P.yellow }));
    s.push(rect(55.4, by - 0.35, 1.1, 0.7, { fill: '#9a9a90' }));
    // AGM-65 Maverick (inboard)
    const my = y < cy ? 22 : 68;
    s.push(rrect(38, my - 1.7, 18.4, 3.4, 1.5, { fill: 'url(#mavG)', stroke: P.gInk, 'stroke-width': 0.45 }));
    s.push(rect(52.4, my - 1.65, 0.8, 3.3, { fill: P.yellow }));
    s.push(ellipse(56.6, my, 1.5, 1.45, { fill: 'url(#seekG)', stroke: P.gInk, 'stroke-width': 0.35 }));
    s.push(path(`M44,${my - 1.7} L47.5,${my - 3.3} L49,${my - 3.3} L48.5,${my - 1.7}Z`, { fill: '#c9cbc4', stroke: P.gInk, 'stroke-width': 0.3 }));
    s.push(path(`M44,${my + 1.7} L47.5,${my + 3.3} L49,${my + 3.3} L48.5,${my + 1.7}Z`, { fill: '#9fa29b', stroke: P.gInk, 'stroke-width': 0.3 }));
    return s.join('');
  };

  // Main landing-gear fairings poke ahead of the wing leading edge.
  const gearPods =
    ellipse(51.6, 31.6, 4.2, 2.4, { fill: P.gL, stroke: P.gInk, 'stroke-width': 0.5 }) +
    ellipse(51.6, 58.4, 4.2, 2.4, { fill: P.g, stroke: P.gInk, 'stroke-width': 0.5 });

  // Camouflage patches (dark grey) clipped to the airframe.
  const camo = [
    blobPath(43, 12, 5, 7, rand, 4, 0.25, 0.3),
    blobPath(40.5, 40, 4, 9, rand, 4, 0.25),
    blobPath(45, 70, 5, 8, rand, 4, 0.25, -0.4),
    blobPath(22, 50, 7, 3, rand, 3, 0.2),
    blobPath(66, 49, 7, 2.6, rand, 3, 0.2),
    blobPath(7, 36, 4, 5, rand, 3, 0.2),
    blobPath(9, 57, 3.5, 3, rand, 3, 0.2),
  ]
    .map((d) => path(d, { fill: P.gD, opacity: 0.55 }))
    .join('');

  // Panel lines & control surfaces.
  const panel = { stroke: P.gInk, 'stroke-width': 0.35, opacity: 0.55, fill: 'none' };
  const panels = [
    line(35.2, 29, 50.8, 29, panel),
    line(35.2, 61, 50.8, 61, panel),
    // ailerons (outer trailing edge)
    polyline([[41.6, 3.2], [38.3, 21.5]], panel),
    polyline([[41.6, 86.8], [38.3, 68.5]], panel),
    polyline([[38.3, 21.5], [40.9, 21.9]], panel),
    polyline([[38.3, 68.5], [40.9, 68.1]], panel),
    // flaps
    polyline([[38.6, 22.5], [38.5, 38.6]], panel),
    polyline([[38.6, 67.5], [38.5, 51.4]], panel),
    // leading-edge slats
    polyline([[48.7, 33.5], [48.8, 39.5]], panel),
    polyline([[48.7, 56.5], [48.8, 50.5]], panel),
    // elevators
    line(5.2, 30.4, 5.2, 59.6, panel),
    // fuselage panels
    line(30, cy - 4.3, 30, cy + 4.3, panel),
    line(58, cy - 5.7, 58, cy + 5.7, panel),
    line(74.2, cy - 4.1, 74.2, cy + 4.1, panel),
  ].join('');

  // Wing leading-edge highlight + trailing-edge shade for crispness.
  const edges =
    path('M48.7,3 L50.8,29 L51.1,45 L50.8,61 L48.7,87', { fill: 'none', stroke: '#ffffff', 'stroke-width': 0.6, opacity: 0.45 }) +
    path('M40.7,3 L35.3,29 L34.9,45 L35.3,61 L40.7,87', { fill: 'none', stroke: '#000000', 'stroke-width': 0.6, opacity: 0.25 });

  const nacelle = (y) =>
    g(
      [
        rect(21, y < cy ? y + 2.4 : y - 5.2, 10, 2.8, { fill: P.gDD }), // pylon
        path(nacD(y), { fill: 'url(#nacG)', stroke: P.gInk, 'stroke-width': 0.6 }),
        path(`M34.7,${y - 3.5} C36.1,${y - 3.3} 37.1,${y - 2} 37.1,${y} C37.1,${y + 2} 36.1,${y + 3.3} 34.7,${y + 3.5}`, {
          fill: 'none', stroke: P.gHi, 'stroke-width': 1.1, opacity: 0.8,
        }),
        path(`M17.7,${y - 2.9} Q16.7,${y} 17.7,${y + 2.9} L19.6,${y + 3.05} L19.6,${y - 3.05}Z`, { fill: '#2f3538' }),
        line(26.5, y - 3.4, 26.5, y + 3.4, panel),
        line(31.5, y - 3.6, 31.5, y + 3.6, panel),
      ].join(''),
    );

  const fin = (y) => path(finD(y), { fill: 'url(#tailG)', stroke: P.gInk, 'stroke-width': 0.55 });
  const finShadow = (y) => path(finD(y), { fill: '#000', opacity: 0.28, transform: 'translate(1.3,1.8)' });

  const canopy =
    path('M61.3,45 C61.8,42.1 64.9,41.5 68,41.8 C70.6,42.2 72,43.5 72,45 C72,46.5 70.6,47.8 68,48.2 C64.9,48.5 61.8,47.9 61.3,45Z', {
      fill: 'url(#glassG)', stroke: P.gInk, 'stroke-width': 0.6,
    }) +
    path('M63,43.4 C64.8,42.4 67.8,42.3 70,43', { fill: 'none', stroke: '#ffffff', 'stroke-width': 0.7, opacity: 0.7, 'stroke-linecap': 'round' }) +
    line(66.2, 41.9, 66.2, 48.1, { stroke: P.gDD, 'stroke-width': 0.6 }) +
    ellipse(63.4, 45, 1.2, 1.5, { fill: '#0f1a22', opacity: 0.8 });

  const nose =
    path(`M72.5,${cy - 3.5} Q76,${cy - 3} 78.2,${cy - 1.8} L78.2,${cy + 1.8} Q76,${cy + 3} 72.5,${cy + 3.5}Z`, { fill: P.gDD, opacity: 0.75 }) +
    rect(81.4, 43.1, 2.9, 1.9, { rx: 0.7, fill: '#2a2e30', stroke: '#111', 'stroke-width': 0.3 }) +
    circle(84.0, 44.05, 0.55, { fill: '#0a0a0a' }) +
    line(75.2, cy - 0.2, 77.2, cy - 0.2, { stroke: '#1d2226', 'stroke-width': 0.5 });

  // Low-vis insignia on the port (north) wing + small blue friendly bands on the tail.
  const insignia =
    circle(45, 10.5, 2.3, { fill: P.gDD, opacity: 0.6 }) +
    path('M45,8.9 L45.45,10.1 L46.7,10.1 L45.7,10.9 L46.1,12.1 L45,11.4 L43.9,12.1 L44.3,10.9 L43.3,10.1 L44.55,10.1Z', {
      fill: P.gL, opacity: 0.8,
    });
  const blueBands =
    rect(1.3, 31.3, 3.2, 2.2, { fill: P.blue, opacity: 0.9 }) + rect(1.3, 56.5, 3.2, 2.2, { fill: P.blue, opacity: 0.9 });

  const body = [
    store(0),
    store(90),
    gearPods,
    path(wingD, { fill: 'url(#wingG)', stroke: P.gInk, 'stroke-width': 0.7 }),
    path(tailD, { fill: 'url(#tailG)', stroke: P.gInk, 'stroke-width': 0.6 }),
    blueBands,
    path(fusD, { fill: 'url(#fusG)', stroke: P.gInk, 'stroke-width': 0.7 }),
    g(camo, { 'clip-path': 'url(#airClip)' }),
    g(panels + edges),
    insignia,
    nacelle(34.3),
    nacelle(55.7),
    g(finShadow(29.9) + finShadow(60.1), { 'clip-path': 'url(#tailClip)' }),
    fin(29.9),
    fin(60.1),
    canopy,
    nose,
    // spine highlight
    path(`M8,${cy - 1.2} Q40,${cy - 3.2} 60,${cy - 3}`, { fill: 'none', stroke: '#ffffff', 'stroke-width': 0.8, opacity: 0.22 }),
    rect(0, 0, W, H, { fill: 'url(#lit)', 'clip-path': 'url(#airClip)' }),
  ].join('');

  return svg(W, H, defs, body);
}

// ---------------------------------------------------------------------------
// Tracked hull helper (tanks, AA). Facing east.
// ---------------------------------------------------------------------------
function tracks(W, H, top, bottom, trackH, colors) {
  const { trk, trkL } = colors;
  let s = '';
  for (const y of [top, bottom]) {
    s += rrect(0.6, y, W - 1.2, trackH, trackH * 0.42, { fill: trk, stroke: P.ink, 'stroke-width': 0.5 });
    for (let x = 1.8; x < W - 1.4; x += 1.55) {
      s += line(x, y + 0.5, x, y + trackH - 0.5, { stroke: trkL, 'stroke-width': 0.55 });
    }
  }
  return s;
}

function tankHull(opts) {
  const W = 34;
  const H = 20;
  const { body, bodyL, bodyD, accent, friendly } = opts;
  const defs = [
    lin('hullG', 0, 0, 1, 1, [[0, bodyL], [0.5, body], [1, bodyD]]),
    lin('glacisG', 0, 0, 1, 1, [[0, P.white], [1, bodyL]]),
    lightDefs('lit', 0.18, 0.25),
  ].join('');
  const hullD = friendly
    ? 'M3,4.6 L29.4,4.6 L33.3,6.9 L33.3,13.1 L29.4,15.4 L3,15.4 Q1.8,15.4 1.8,14.2 L1.8,5.8 Q1.8,4.6 3,4.6Z'
    : 'M3.2,5 L28.4,5 L32.8,7.5 L32.8,12.5 L28.4,15 L3.2,15 Q2,15 2,13.8 L2,6.2 Q2,5 3.2,5Z';
  const glacis = friendly
    ? poly([[29.4, 4.6], [33.3, 6.9], [33.3, 13.1], [29.4, 15.4]], { fill: bodyL, stroke: P.ink, 'stroke-width': 0.45 })
    : poly([[28.4, 5], [32.8, 7.5], [32.8, 12.5], [28.4, 15]], { fill: bodyL, stroke: P.ink, 'stroke-width': 0.45 });

  let deck = '';
  if (friendly) {
    // Big rear exhaust grille + ID panel.
    for (let x = 2.6; x < 8.4; x += 0.8) deck += line(x, 6, x, 14, { stroke: bodyD, 'stroke-width': 0.4 });
    deck += rect(2.3, 5.6, 6.4, 8.8, { fill: 'none', stroke: P.ink, 'stroke-width': 0.35, opacity: 0.6 });
    deck += rect(26.2, 8.2, 2.2, 3.6, { rx: 0.6, fill: bodyD }); // driver hatch
    deck += rect(31.3, 5.3, 1.5, 1.4, { fill: P.trkHi }) + rect(31.3, 13.3, 1.5, 1.4, { fill: P.trkHi }); // light guards
  } else {
    // Rear drums, engine grille, splash board.
    for (let x = 6.2; x < 10.6; x += 0.75) deck += line(x, 6.4, x, 13.6, { stroke: bodyD, 'stroke-width': 0.38 });
    deck += circle(3.9, 7.4, 1.75, { fill: bodyD, stroke: P.ink, 'stroke-width': 0.4 }) + circle(3.9, 7.4, 0.9, { fill: 'none', stroke: bodyL, 'stroke-width': 0.35 });
    deck += circle(3.9, 12.6, 1.75, { fill: bodyD, stroke: P.ink, 'stroke-width': 0.4 }) + circle(3.9, 12.6, 0.9, { fill: 'none', stroke: bodyL, 'stroke-width': 0.35 });
    deck += polyline([[29, 6.3], [31.3, 10], [29, 13.7]], { stroke: bodyD, 'stroke-width': 0.5 });
    deck += circle(27, 10, 1.15, { fill: bodyD, stroke: P.ink, 'stroke-width': 0.3 });
  }

  const fenders = friendly
    ? rrect(1.4, 2.3, 31.2, 3.1, 0.6, { fill: body, stroke: P.ink, 'stroke-width': 0.45 }) +
      rrect(1.4, 14.6, 31.2, 3.1, 0.6, { fill: bodyD, stroke: P.ink, 'stroke-width': 0.45 }) +
      Array.from({ length: 6 }, (_, i) => circle(4 + i * 5.2, 3.8, 0.35, { fill: bodyD }) + circle(4 + i * 5.2, 16.2, 0.35, { fill: P.frDD })).join('')
    : rrect(1.6, 3.2, 30.8, 2.6, 0.5, { fill: bodyL, stroke: P.ink, 'stroke-width': 0.45 }) +
      rrect(1.6, 14.2, 30.8, 2.6, 0.5, { fill: body, stroke: P.ink, 'stroke-width': 0.45 }) +
      line(4, 4.4, 15, 4.4, { stroke: bodyD, 'stroke-width': 0.4 });

  const marks = friendly
    ? rect(5.5, 2.4, 3.2, 2.9, { fill: accent }) + rect(5.5, 14.7, 3.2, 2.9, { fill: accent }) + rect(24.5, 2.4, 1.6, 2.9, { fill: accent }) + rect(24.5, 14.7, 1.6, 2.9, { fill: accent })
    : rect(22.2, 3.25, 3.4, 2.5, { fill: accent }) + rect(22.2, 14.25, 3.4, 2.5, { fill: accent });

  const body_ = [
    tracks(W, H, 0.3, 15.3, 4.4, { trk: P.trk, trkL: P.trkL }),
    fenders,
    path(hullD, { fill: 'url(#hullG)', stroke: P.ink, 'stroke-width': 0.55 }),
    glacis,
    deck,
    marks,
    // turret ring shadow hint
    circle(17, 10, 5.2, { fill: 'none', stroke: bodyD, 'stroke-width': 0.6, opacity: 0.7 }),
    rect(0, 0, W, H, { fill: 'url(#lit)', 'clip-path': 'url(#hullClip)' }),
  ].join('');
  const clip = `<clipPath id="hullClip"><path d="${hullD}"/><rect x="0.6" y="0.3" width="32.8" height="19.4"/></clipPath>`;
  return svg(W, H, defs + clip, body_);
}

export const tankHullEnemy = () => tankHull({ body: P.ol, bodyL: P.olL, bodyD: P.olD, accent: P.red, friendly: false });
export const tankHullFriendly = () => tankHull({ body: P.fr, bodyL: P.frL, bodyD: P.frD, accent: P.blue, friendly: true });

// Enemy turret: rounded T-72-style dome. 30 × 12, pivot (10, 6).
export function tankTurretEnemy() {
  const W = 30;
  const H = 12;
  const defs = [
    rad('domeG', 0.38, 0.32, 0.7, [[0, P.olHi], [0.45, P.ol], [1, P.olDD]]),
    lin('barrelG', 0, 0, 0, 1, [[0, P.olL], [0.5, P.olD], [1, P.olDD]]),
  ].join('');
  const era = [];
  for (let i = -3; i <= 3; i++) {
    const a = (i / 3) * 1.05;
    const x = 10 + Math.cos(a) * 6.2;
    const y = 6 + Math.sin(a) * 4.7;
    if (Math.abs(i) === 0) continue;
    era.push(rect(-0.7, -0.9, 1.4, 1.8, { fill: P.olL, stroke: P.olDD, 'stroke-width': 0.25, transform: `translate(${r2(x)},${r2(y)}) rotate(${r2((a * 180) / Math.PI)})` }));
  }
  const body = [
    rect(15, 4.3, 3.4, 3.4, { rx: 0.6, fill: P.olD, stroke: P.ink, 'stroke-width': 0.4 }), // mantlet
    rect(16.8, 5.25, 12.4, 1.5, { fill: 'url(#barrelG)', stroke: P.ink, 'stroke-width': 0.35 }),
    rect(20.2, 5.05, 1.1, 1.9, { fill: P.olD, stroke: P.ink, 'stroke-width': 0.25 }),
    rect(24.2, 5.05, 1.1, 1.9, { fill: P.olD, stroke: P.ink, 'stroke-width': 0.25 }),
    rect(28.4, 4.95, 1.5, 2.1, { rx: 0.3, fill: P.olDD, stroke: P.ink, 'stroke-width': 0.3 }),
    ellipse(10, 6, 7.4, 5.6, { fill: 'url(#domeG)', stroke: P.ink, 'stroke-width': 0.6 }),
    ...era,
    circle(8.2, 3.5, 1.9, { fill: P.olD, stroke: P.ink, 'stroke-width': 0.4 }),
    circle(8.2, 3.5, 1.2, { fill: P.olL }),
    line(9.6, 2.6, 13.6, 2.4, { stroke: P.ink, 'stroke-width': 0.5 }),
    circle(8.6, 8.6, 1.35, { fill: P.olD, stroke: P.ink, 'stroke-width': 0.35 }),
    rect(12.4, 8.1, 2.2, 1.4, { rx: 0.4, fill: P.steelL, stroke: P.ink, 'stroke-width': 0.3 }), // searchlight
    poly([[3.4, 4.4], [6.3, 6], [3.4, 7.6]], { fill: P.red, stroke: P.redD, 'stroke-width': 0.3 }),
    path('M5,1.6 Q9,0.3 13.5,1.8', { fill: 'none', stroke: '#ffffff', 'stroke-width': 0.5, opacity: 0.35 }),
  ].join('');
  return svg(W, H, defs, body);
}

// Friendly turret: angular Abrams-style wedge. 30 × 12, pivot (10, 6).
export function tankTurretFriendly() {
  const W = 30;
  const H = 12;
  const defs = [
    lin('tG', 0, 0, 1, 1, [[0, P.frHi], [0.5, P.fr], [1, P.frDD]]),
    lin('barrelG', 0, 0, 0, 1, [[0, P.frL], [0.5, P.frD], [1, P.frDD]]),
  ].join('');
  const turretD = 'M1.1,2.5 L11,1.1 L15.5,2.3 L18.2,4.9 L18.2,7.1 L15.5,9.7 L11,10.9 L1.1,9.5Z';
  let bustle = '';
  for (let x = 1.6; x < 4.8; x += 0.8) bustle += line(x, 2.8, x, 9.2, { stroke: P.frDD, 'stroke-width': 0.3 });
  const body = [
    rect(17.6, 5.35, 11.6, 1.3, { fill: 'url(#barrelG)', stroke: P.ink, 'stroke-width': 0.3 }),
    rect(22, 5.0, 2.6, 2.0, { rx: 0.9, fill: P.frD, stroke: P.ink, 'stroke-width': 0.3 }),
    rect(29, 5.2, 1, 1.6, { fill: P.frDD }),
    path(turretD, { fill: 'url(#tG)', stroke: P.ink, 'stroke-width': 0.6 }),
    bustle,
    line(11, 1.3, 11, 10.7, { stroke: P.frDD, 'stroke-width': 0.3, opacity: 0.7 }),
    rect(4.3, 4.3, 3.2, 3.4, { fill: P.blue, stroke: P.blueD, 'stroke-width': 0.3 }),
    circle(9.4, 3.8, 1.7, { fill: P.frD, stroke: P.ink, 'stroke-width': 0.35 }),
    circle(9.4, 3.8, 1.05, { fill: P.frL }),
    line(10.6, 3.2, 14, 3.0, { stroke: P.ink, 'stroke-width': 0.5 }),
    rect(8.3, 7.4, 2.4, 2.2, { rx: 0.5, fill: P.frD, stroke: P.ink, 'stroke-width': 0.3 }),
    rect(13, 3.1, 1.8, 1.4, { fill: P.frDD }), // gunner sight
    path('M2,2.7 L10.8,1.5 L15.2,2.6', { fill: 'none', stroke: '#ffffff', 'stroke-width': 0.45, opacity: 0.4 }),
  ].join('');
  return svg(W, H, defs, body);
}

// ---------------------------------------------------------------------------
// Burnt tank wreck (hull + displaced turret).
// ---------------------------------------------------------------------------
export function tankWreck() {
  const W = 34;
  const H = 20;
  const rand = rng(77);
  const defs = [
    sootDefs('soot', '#0e0d0b', 0.55),
    lin('burntG', 0, 0, 1, 1, [[0, P.ash], [0.4, P.burntL], [1, P.burnt]]),
    rad('domeB', 0.4, 0.35, 0.7, [[0, P.ashL], [0.4, P.burntL], [1, '#141210']]),
  ].join('');
  let trackLinks = '';
  for (let x = 1.8; x < 32; x += 1.55) trackLinks += line(x, 0.8, x, 4.2, { stroke: '#3a3833', 'stroke-width': 0.5 });
  let trackLinks2 = '';
  for (let x = 2; x < 22; x += 1.55) trackLinks2 += line(x, 15.8, x, 19.2, { stroke: '#3a3833', 'stroke-width': 0.5 });
  const rust = [blobPath(9, 8, 3, 2, rand, 3, 0.3), blobPath(24, 12, 2.6, 1.6, rand, 3, 0.3)]
    .map((d) => path(d, { fill: P.rust, opacity: 0.7 }))
    .join('');
  const body = [
    ellipse(17, 10, 17, 10, { fill: 'url(#soot)' }),
    rrect(0.6, 0.4, 32.8, 4.2, 1.6, { fill: '#1d1c19', stroke: '#0b0b0a', 'stroke-width': 0.5 }),
    trackLinks,
    // thrown south track, broken and splayed
    rrect(0.8, 15.4, 22, 4.2, 1.6, { fill: '#1d1c19', stroke: '#0b0b0a', 'stroke-width': 0.5 }),
    trackLinks2,
    rrect(23.5, 16.2, 9.5, 3.4, 1.2, { fill: '#22211d', transform: 'rotate(12 28 18)' }),
    path('M3.2,5 L28.4,5 L32.8,7.5 L32.8,12.5 L28.4,15 L3.2,15 Q2,15 2,13.8 L2,6.2 Q2,5 3.2,5Z', {
      fill: 'url(#burntG)', stroke: '#0b0b0a', 'stroke-width': 0.55,
    }),
    rust,
    circle(3.9, 7.4, 1.6, { fill: '#1a1816' }),
    circle(3.9, 12.6, 1.6, { fill: P.rust, opacity: 0.8 }),
    // turret ring hole
    circle(17, 10, 4.6, { fill: '#0c0b0a', stroke: '#2a2622', 'stroke-width': 0.6 }),
    circle(17, 10, 2.4, { fill: P.rust, opacity: 0.35 }),
    // blown-off turret lying askew to the north-east
    g(
      [
        rect(14.5, 5.4, 10.5, 1.4, { fill: '#1b1a17', transform: 'rotate(-14 15 6)' }),
        ellipse(10, 6, 6.8, 5.2, { fill: 'url(#domeB)', stroke: '#0b0b0a', 'stroke-width': 0.55 }),
        circle(8.2, 3.6, 1.5, { fill: '#0b0a09' }),
        path(blobPath(10.5, 7, 2.5, 1.6, rand, 3, 0.3), { fill: P.rust, opacity: 0.6 }),
      ].join(''),
      { transform: 'translate(12.5,-1.2) rotate(38 10 6) scale(0.92)' },
    ),
    // ash highlights
    path('M5,6 Q14,5.2 26,6', { fill: 'none', stroke: P.ashL, 'stroke-width': 0.45, opacity: 0.5 }),
  ].join('');
  return svg(W, H, defs, body);
}

// ---------------------------------------------------------------------------
// Truck — 26 × 12, cab east.
// ---------------------------------------------------------------------------
export function truck() {
  const W = 26;
  const H = 12;
  const defs = [
    lin('canvasG', 0, 0, 0, 1, [[0, P.canvasD], [0.2, P.canvasL], [0.5, P.canvas], [1, P.canvasD]]),
    lin('cabG', 0, 0, 1, 1, [[0, P.olHi], [0.5, P.ol], [1, P.olD]]),
  ].join('');
  const wheels = [3.2, 7.6, 20.4]
    .map((x) => rrect(x, 0.2, 3.2, 1.6, 0.6, { fill: P.trk }) + rrect(x, 10.2, 3.2, 1.6, 0.6, { fill: P.trk }))
    .join('');
  let ribs = '';
  for (let x = 3.4; x < 17; x += 2.7) ribs += line(x, 1.3, x, 10.7, { stroke: P.canvasD, 'stroke-width': 0.5 });
  const body = [
    wheels,
    rrect(0.6, 1.1, 16.8, 9.8, 0.9, { fill: 'url(#canvasG)', stroke: P.ink, 'stroke-width': 0.5 }),
    ribs,
    line(1.2, 3.1, 16.8, 3.1, { stroke: '#ffffff', 'stroke-width': 0.4, opacity: 0.25 }),
    rect(17.3, 3.6, 0.9, 4.8, { fill: P.trk }),
    path('M18.1,1.9 L22.6,1.9 L23.4,2.6 L23.4,9.4 L22.6,10.1 L18.1,10.1Z', { fill: 'url(#cabG)', stroke: P.ink, 'stroke-width': 0.5 }),
    rect(22.2, 2.3, 1.15, 7.4, { fill: P.glass }),
    line(22.35, 2.8, 22.35, 5.2, { stroke: P.glassL, 'stroke-width': 0.4, opacity: 0.8 }),
    path('M23.4,2.7 L25.5,3.1 Q26,3.3 26,4 L26,8 Q26,8.7 25.5,8.9 L23.4,9.3Z', { fill: P.olD, stroke: P.ink, 'stroke-width': 0.45 }),
    line(24.7, 3.5, 24.7, 8.5, { stroke: P.olDD, 'stroke-width': 0.4 }),
    rect(19.2, 2.3, 1.4, 7.4, { fill: P.red, opacity: 0.95 }),
    rect(21.9, 0.9, 0.9, 0.8, { fill: P.ink }),
    rect(21.9, 10.3, 0.9, 0.8, { fill: P.ink }),
  ].join('');
  return svg(W, H, defs, body);
}

export function truckWreck() {
  const W = 26;
  const H = 12;
  const rand = rng(41);
  const defs = [sootDefs('soot', '#0e0d0b', 0.55), lin('bG', 0, 0, 1, 1, [[0, P.ash], [0.5, P.burntL], [1, P.burnt]])].join('');
  let ribs = '';
  for (let x = 3.4; x < 17; x += 2.7) {
    const bend = rand.range(-0.8, 0.8);
    ribs += path(`M${x},1.4 Q${r2(x + bend)},6 ${r2(x + rand.range(-0.4, 0.4))},10.6`, { fill: 'none', stroke: P.ashL, 'stroke-width': 0.55 });
  }
  const body = [
    ellipse(13, 6, 13, 6, { fill: 'url(#soot)' }),
    [3.2, 7.6, 20.4].map((x) => rrect(x, 0.3, 3.1, 1.5, 0.6, { fill: '#141311' }) + rrect(x, 10.2, 3.1, 1.5, 0.6, { fill: '#141311' })).join(''),
    rrect(0.8, 1.3, 16.4, 9.4, 0.6, { fill: '#1c1a17', stroke: '#0a0a09', 'stroke-width': 0.45 }),
    path(blobPath(8, 6, 5, 3, rand, 4, 0.3), { fill: P.ash, opacity: 0.55 }),
    ribs,
    path('M18.1,2 L22.4,2.4 L23.2,3 L23,9.4 L22.2,10 L18.1,9.8Z', { fill: 'url(#bG)', stroke: '#0a0a09', 'stroke-width': 0.45 }),
    rect(22, 2.8, 1, 6.4, { fill: '#0b0a09' }),
    path('M23.2,3 L25.4,3.6 L25.7,8.2 L23.1,9.2Z', { fill: P.rust, stroke: '#0a0a09', 'stroke-width': 0.4 }),
  ].join('');
  return svg(W, H, defs, body);
}

// ---------------------------------------------------------------------------
// Infantry squad — 18 × 18.
// ---------------------------------------------------------------------------
function infantry({ uniform, uniformD, helmet, accent, seed }) {
  const W = 18;
  const H = 18;
  const rand = rng(seed);
  const men = [
    [5, 5, 10],
    [12.2, 4.2, -15],
    [7, 12.3, 20],
    [13.6, 12.8, 0],
  ];
  const soldier = ([x, y, deg]) =>
    g(
      [
        ellipse(0.8, 0.9, 1.7, 2.3, { fill: '#000', opacity: 0.28 }),
        rect(-2.3, -1.2, 1.4, 2.4, { rx: 0.4, fill: uniformD, stroke: P.ink, 'stroke-width': 0.3 }), // pack
        ellipse(0, 0, 1.25, 2.05, { fill: uniform, stroke: P.ink, 'stroke-width': 0.35 }),
        line(0.3, 1.1, 3.7, 1.1, { stroke: '#1a1a16', 'stroke-width': 0.55 }), // rifle
        circle(0.25, -0.1, 1.05, { fill: helmet, stroke: P.ink, 'stroke-width': 0.3 }),
        circle(-0.05, -0.4, 0.42, { fill: accent }),
      ].join(''),
      { transform: `translate(${x + rand.range(-0.3, 0.3)},${y + rand.range(-0.3, 0.3)}) rotate(${deg})` },
    );
  return svg(W, H, '', men.map(soldier).join(''));
}
export const infantryEnemy = () => infantry({ uniform: P.olL, uniformD: P.olD, helmet: P.ol, accent: P.red, seed: 3 });
export const infantryFriendly = () => infantry({ uniform: '#a09f86', uniformD: '#77765f', helmet: P.frD, accent: P.blue, seed: 5 });

// ---------------------------------------------------------------------------
// Self-propelled AA (ZSU-23-4 style): hull 30 × 20, turret 18 × 16 (pivot centre).
// ---------------------------------------------------------------------------
export function aaHull() {
  const W = 30;
  const H = 20;
  const defs = [lin('hullG', 0, 0, 1, 1, [[0, P.olL], [0.5, P.ol], [1, P.olD]]), lightDefs('lit', 0.18, 0.22)].join('');
  let grille = '';
  for (let x = 2.8; x < 6.8; x += 0.7) grille += line(x, 6.2, x, 13.8, { stroke: P.olD, 'stroke-width': 0.35 });
  const hullD = 'M3,4 L25.4,4 L29,6.6 L29,13.4 L25.4,16 L3,16 Q1.8,16 1.8,14.8 L1.8,5.2 Q1.8,4 3,4Z';
  const body = [
    tracks(W, H, 0.4, 15.2, 4.4, { trk: P.trk, trkL: P.trkL }),
    rrect(1.4, 3, 27.4, 2.3, 0.5, { fill: P.olL, stroke: P.ink, 'stroke-width': 0.4 }),
    rrect(1.4, 14.7, 27.4, 2.3, 0.5, { fill: P.ol, stroke: P.ink, 'stroke-width': 0.4 }),
    path(hullD, { fill: 'url(#hullG)', stroke: P.ink, 'stroke-width': 0.55 }),
    poly([[25.4, 4], [29, 6.6], [29, 13.4], [25.4, 16]], { fill: P.olL, stroke: P.ink, 'stroke-width': 0.4 }),
    grille,
    circle(25.6, 7.2, 1.1, { fill: P.olD, stroke: P.ink, 'stroke-width': 0.3 }),
    rect(20.6, 3.05, 3, 2.2, { fill: P.red }),
    rect(20.6, 14.75, 3, 2.2, { fill: P.red }),
    rect(0, 0, W, H, { fill: 'url(#lit)', 'clip-path': 'url(#aClip)' }),
  ].join('');
  return svg(W, H, defs + `<clipPath id="aClip"><path d="${hullD}"/></clipPath>`, body);
}

export function aaTurret() {
  const W = 18;
  const H = 16;
  const defs = [
    lin('tG', 0, 0, 1, 1, [[0, P.olHi], [0.5, P.ol], [1, P.olDD]]),
    lin('dishG', 0, 0, 1, 0, [[0, P.steelD], [0.5, P.steelL], [1, P.steel]]),
  ].join('');
  const barrel = (y) =>
    rect(10.5, y - 0.45, 7, 0.9, { fill: '#2d2f2a', stroke: P.ink, 'stroke-width': 0.2 }) + rect(16.6, y - 0.6, 1.4, 1.2, { fill: '#1d1e1b' });
  const body = [
    barrel(4.1),
    barrel(5.9),
    barrel(10.1),
    barrel(11.9),
    rrect(9.4, 3.1, 3.2, 3.8, 0.6, { fill: P.olD, stroke: P.ink, 'stroke-width': 0.35 }),
    rrect(9.4, 9.1, 3.2, 3.8, 0.6, { fill: P.olD, stroke: P.ink, 'stroke-width': 0.35 }),
    path('M2.2,1.4 L10.8,1.4 L12.4,3 L12.4,13 L10.8,14.6 L2.2,14.6 Q1.2,14.6 1.2,13.6 L1.2,2.4 Q1.2,1.4 2.2,1.4Z', {
      fill: 'url(#tG)', stroke: P.ink, 'stroke-width': 0.55,
    }),
    circle(6.6, 4.9, 1.2, { fill: P.olD, stroke: P.ink, 'stroke-width': 0.3 }),
    circle(6.6, 11.1, 1.2, { fill: P.olD, stroke: P.ink, 'stroke-width': 0.3 }),
    poly([[7.6, 6.9], [9.9, 8], [7.6, 9.1]], { fill: P.red, stroke: P.redD, 'stroke-width': 0.25 }),
    ellipse(2.5, 8, 1.9, 5.1, { fill: 'url(#dishG)', stroke: P.ink, 'stroke-width': 0.45 }),
    line(2.5, 3.4, 2.5, 12.6, { stroke: P.steelD, 'stroke-width': 0.35 }),
    path('M2,1.9 L10.6,1.9', { stroke: '#ffffff', 'stroke-width': 0.45, opacity: 0.35 }),
  ].join('');
  return svg(W, H, defs, body);
}

export function aaWreck() {
  const W = 30;
  const H = 20;
  const rand = rng(12);
  const defs = [sootDefs('soot', '#0e0d0b', 0.55), lin('bG', 0, 0, 1, 1, [[0, P.ash], [0.4, P.burntL], [1, P.burnt]])].join('');
  let links = '';
  for (let x = 1.8; x < 28.5; x += 1.55) links += line(x, 0.9, x, 4.1, { stroke: '#383631', 'stroke-width': 0.5 }) + line(x, 15.9, x, 19.1, { stroke: '#383631', 'stroke-width': 0.5 });
  const body = [
    ellipse(15, 10, 15, 10, { fill: 'url(#soot)' }),
    rrect(0.6, 0.4, 28.8, 4.4, 1.6, { fill: '#1d1c19' }),
    rrect(0.6, 15.2, 28.8, 4.4, 1.6, { fill: '#1d1c19' }),
    links,
    path('M3,4 L25.4,4 L29,6.6 L29,13.4 L25.4,16 L3,16 Q1.8,16 1.8,14.8 L1.8,5.2 Q1.8,4 3,4Z', { fill: 'url(#bG)', stroke: '#0a0a09', 'stroke-width': 0.5 }),
    path(blobPath(12, 11, 4, 2.5, rand, 3, 0.3), { fill: P.rust, opacity: 0.65 }),
    circle(14, 10, 4, { fill: '#0c0b0a' }),
    g(
      [
        rect(10.5, 3.6, 6, 0.9, { fill: '#15140f', transform: 'rotate(-18 10.5 4)' }),
        rect(10.5, 5.4, 5, 0.9, { fill: '#15140f', transform: 'rotate(10 10.5 5.8)' }),
        path('M2.2,1.4 L10.8,1.4 L12.4,3 L12.4,13 L10.8,14.6 L2.2,14.6 Q1.2,14.6 1.2,13.6 L1.2,2.4 Q1.2,1.4 2.2,1.4Z', {
          fill: 'url(#bG)', stroke: '#0a0a09', 'stroke-width': 0.5,
        }),
        circle(6.6, 4.9, 1.1, { fill: '#0b0a09' }),
      ].join(''),
      { transform: 'translate(9.5,2.5) rotate(-24 7 8) scale(0.85)' },
    ),
    ellipse(4, 16.5, 1.6, 3.6, { fill: '#2b2a26', transform: 'rotate(55 4 16.5)' }),
  ].join('');
  return svg(W, H, defs, body);
}

// ---------------------------------------------------------------------------
// SAM launcher — 40 × 22, two missiles east, pivot centre.
// ---------------------------------------------------------------------------
export function samLauncher() {
  const W = 40;
  const H = 22;
  const defs = [
    cylDefs('mG', '#ffffff', '#e6e5de', '#9c9c94'),
    rad('baseG', 0.4, 0.35, 0.7, [[0, P.olL], [0.6, P.ol], [1, P.olDD]]),
  ].join('');
  const missile = (y) =>
    g(
      [
        path(`M5.5,${y - 1.7} L6.5,${y - 4.2} L9.8,${y - 4.2} L10.2,${y - 1.7}Z`, { fill: '#c8c7c0', stroke: P.ink, 'stroke-width': 0.3 }),
        path(`M5.5,${y + 1.7} L6.5,${y + 4.2} L9.8,${y + 4.2} L10.2,${y + 1.7}Z`, { fill: '#a9a8a1', stroke: P.ink, 'stroke-width': 0.3 }),
        path(`M17.5,${y - 1.7} L19,${y - 3.6} L21.8,${y - 3.6} L22.3,${y - 1.7}Z`, { fill: '#c8c7c0', stroke: P.ink, 'stroke-width': 0.3 }),
        path(`M17.5,${y + 1.7} L19,${y + 3.6} L21.8,${y + 3.6} L22.3,${y + 1.7}Z`, { fill: '#a9a8a1', stroke: P.ink, 'stroke-width': 0.3 }),
        rect(4.3, y - 1.3, 1.2, 2.6, { fill: '#2a2a28' }),
        path(`M5,${y - 1.75} L33,${y - 1.75} Q38.4,${y - 1.2} 39.4,${y} Q38.4,${y + 1.2} 33,${y + 1.75} L5,${y + 1.75}Z`, {
          fill: 'url(#mG)', stroke: P.ink, 'stroke-width': 0.4,
        }),
        rect(29, y - 1.72, 1.8, 3.44, { fill: P.red }),
        line(12, y - 1.75, 12, y + 1.75, { stroke: '#8a8a82', 'stroke-width': 0.3 }),
      ].join(''),
    );
  const body = [
    circle(20, 11, 7.6, { fill: 'url(#baseG)', stroke: P.ink, 'stroke-width': 0.55 }),
    circle(20, 11, 5.6, { fill: 'none', stroke: P.olD, 'stroke-width': 0.5 }),
    rect(7, 8.8, 24, 4.4, { rx: 0.6, fill: P.steelD, stroke: P.ink, 'stroke-width': 0.45 }),
    rect(12, 9.8, 10, 2.4, { fill: P.olD }),
    missile(5.3),
    missile(16.7),
    rect(24, 9.6, 3.6, 2.8, { rx: 0.4, fill: P.red, stroke: P.redD, 'stroke-width': 0.3 }),
  ].join('');
  return svg(W, H, defs, body);
}
