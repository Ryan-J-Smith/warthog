// Player aircraft: a credible, stylised A-10 Warthog (art direction v1 final).
// Gunmetal two-tone camo with panel lines, heavy-but-sleek silhouette (twin engine pods, straight
// wings, twin tails, the big GAU-8), outlined like the ground units. The only colour accent is a
// teal canopy glint and teal fin stripes, so the player never reads as an enemy.
import { svg, lin, rad, smoothClosed, blobPath, rng } from './lib.mjs';
import { dRect, dEllipse, dRound, mirrorY, ids, fill, strokeD, outline } from './style.mjs';

const C = {
  ink: '#16191e',
  hi: '#a3aeb6',
  l: '#86919a',
  base: '#6a757e',
  d: '#525c65',
  dd: '#3d454d',
  camo: '#4b555e',
  metal: '#2a3036',
  metalL: '#4a525a',
  intake: '#1c2024',
  teal: '#35e8d4',
  tealD: '#12948a',
  tealHi: '#d6fff9',
  glass: '#1c434b',
  glassL: '#3d8791',
  mav: '#c3c7c0',
  mavD: '#8c918a',
  bomb: '#6a6f47',
  bombD: '#484c2f',
  pod: '#8d949a',
  podD: '#5f666c',
  yellow: '#d9b53c',
};

/** 144 × 160, nose east, centreline y = 80. */
export function a10() {
  const W = 144;
  const H = 160;
  const cy = 80;
  const id = ids('w');
  const rand = rng(17);

  // --- Geometry ------------------------------------------------------------------------------
  const fusUpper = [
    [2, 77.8], [8, 76.5], [18, 75.1], [30, 74], [44, 73.1], [58, 72.4], [72, 71.9], [86, 71.3], [98, 70.6],
    [108, 70.3], [116, 70.8], [123, 71.9], [129, 73.4], [133.5, 75.3], [136.6, 77.2], [138.2, 79],
  ];
  const fuselage = smoothClosed([...fusUpper, [138.6, 80], ...mirrorY(fusUpper, cy).reverse(), [1.2, 80]]);
  const wing = dRound(
    [[62, 80], [69.5, 7.5], [72.5, 4], [89, 4], [92, 7.5], [95.5, 80], [92, 152.5], [89, 156], [72.5, 156], [69.5, 152.5]],
    [0, 2.2, 2.2, 2.2, 2.2, 0, 2.2, 2.2, 2.2, 2.2],
  );
  const stab = dRound([[8, 51], [22, 52], [26, 56], [26, 104], [22, 108], [8, 109], [4.5, 105], [4.5, 55]], 2);
  const fin = (y) => `M1.2,${y} Q5,${y - 3.2} 15,${y - 3.4} Q26,${y - 2.6} 30.5,${y} Q26,${y + 2.6} 15,${y + 3.4} Q5,${y + 3.2} 1.2,${y}Z`;
  const finN = fin(52);
  const finS = fin(108);
  const nacelle = (y) =>
    `M30,${y - 5.4} Q31,${y - 7.4} 36,${y - 7.7} L57,${y - 7.9} Q62.6,${y - 7.9} 63,${y} Q62.6,${y + 7.9} 57,${y + 7.9} L36,${y + 7.7} Q31,${y + 7.4} 30,${y + 5.4}Z`;
  const nacN = nacelle(63);
  const nacS = nacelle(97);
  const pylonN = dRect(38, 69, 16, 5, 1.5);
  const pylonS = dRect(38, 86, 16, 5, 1.5);
  const gun = dRect(131, 76.3, 12.6, 4.4, 1.6);
  const gearN = dEllipse(94, 57.5, 6.8, 3.4);
  const gearS = dEllipse(94, 102.5, 6.8, 3.4);

  // Underwing stores (drawn under the wing: only their noses poke out ahead of the leading edge).
  const stores = [];
  const storeParts = [];
  for (const sgn of [-1, 1]) {
    // Maverick (inboard).
    let y = cy + sgn * 31;
    let d = dRect(79, y - 2, 25, 4, 2);
    stores.push(d);
    storeParts.push(fill(d, C.mav, { stroke: C.ink, 'stroke-width': 0.7 }), fill(dEllipse(103.6, y, 1.9), '#20262a', { stroke: C.ink, 'stroke-width': 0.5 }));
    storeParts.push(fill(`M95,${y - 2} L97.5,${y - 4} L99,${y - 4} L99,${y - 2}Z M95,${y + 2} L97.5,${y + 4} L99,${y + 4} L99,${y + 2}Z`, C.mavD, { stroke: C.ink, 'stroke-width': 0.5 }));
    storeParts.push(fill(dRect(99.8, y - 1.9, 0.9, 3.8, 0), C.yellow));
    // Mk-82 bomb.
    y = cy + sgn * 43;
    d = `M79,${y - 2.5} L97,${y - 2.5} Q101.5,${y - 2.4} 102.4,${y} Q101.5,${y + 2.4} 97,${y + 2.5} L79,${y + 2.5}Z`;
    stores.push(d);
    storeParts.push(fill(d, C.bomb, { stroke: C.ink, 'stroke-width': 0.7 }), fill(dRect(97.4, y - 2.4, 1, 4.8, 0), C.yellow));
    storeParts.push(fill(dRect(102, y - 0.5, 1.6, 1, 0.3), '#9a9a90'));
    // LAU-131 rocket pod.
    y = cy + sgn * 54;
    d = dRect(82, y - 2.9, 18.5, 5.8, 2.4);
    stores.push(d);
    storeParts.push(fill(d, C.pod, { stroke: C.ink, 'stroke-width': 0.7 }));
    storeParts.push(fill(dEllipse(100, y, 1, 2.6), '#2a2f33'), fill(dEllipse(100.2, y - 1.1, 0.5), '#d8d2b0'), fill(dEllipse(100.2, y + 1.1, 0.5), '#d8d2b0'));
    // Second Mk-82 (outboard).
    y = cy + sgn * 64;
    d = `M80,${y - 2.3} L96.5,${y - 2.3} Q100.5,${y - 2.2} 101.3,${y} Q100.5,${y + 2.2} 96.5,${y + 2.3} L80,${y + 2.3}Z`;
    stores.push(d);
    storeParts.push(fill(d, C.bomb, { stroke: C.ink, 'stroke-width': 0.7 }), fill(dRect(96.8, y - 2.2, 1, 4.4, 0), C.yellow));
  }

  // --- Paint ----------------------------------------------------------------------------------
  const defs = [
    // Cylinder shading across the fuselage and pods: lit north side, dark south side.
    lin('fusG', 0, 0, 0, 1, [[0, C.d], [0.14, C.hi], [0.4, C.l], [0.72, C.base], [1, C.dd]]),
    lin('nacG', 0, 0, 0, 1, [[0, C.d], [0.18, C.hi], [0.45, C.l], [0.8, C.d], [1, C.dd]]),
    lin('wingG', 1, 0, 0, 0, [[0, C.l], [0.12, C.base], [0.7, C.base], [1, C.d]]),
    lin('stabG', 1, 0, 0, 0, [[0, C.l], [0.3, C.base], [1, C.d]]),
    lin('finG', 0, 0, 0, 1, [[0, C.hi], [0.45, C.l], [1, C.dd]]),
    rad('glassG', 0.35, 0.3, 0.8, [[0, C.glassL], [0.5, C.glass], [1, '#0e2126']]),
    lin('gunG', 0, 0, 0, 1, [[0, C.metalL], [0.4, '#3a4148'], [1, '#1a1e22']]),
    // Global top-left light.
    lin('lit', 0, 0, 1, 1, [[0, '#ffffff', 0.14], [0.45, '#ffffff', 0], [0.6, '#000000', 0], [1, '#000000', 0.2]]),
    `<clipPath id="air"><path d="${wing}"/><path d="${fuselage}"/><path d="${stab}"/><path d="${nacN}"/><path d="${nacS}"/></clipPath>`,
    `<clipPath id="wingC"><path d="${wing}"/></clipPath>`,
    `<clipPath id="fusC"><path d="${fuselage}"/></clipPath>`,
  ].join('');

  // Two-tone camo patches, clipped to the airframe.
  const camo = [
    blobPath(80, 20, 6, 10, rand, 4, 0.25, 0.3),
    blobPath(84, 48, 5, 7, rand, 4, 0.25),
    blobPath(78, 118, 6, 9, rand, 4, 0.25, -0.4),
    blobPath(82, 144, 5, 7, rand, 4, 0.25),
    blobPath(40, 78, 12, 3.4, rand, 3, 0.2),
    blobPath(100, 83, 8, 3, rand, 3, 0.2),
    blobPath(15, 66, 5, 7, rand, 3, 0.2),
    blobPath(14, 96, 5, 6, rand, 3, 0.2),
    blobPath(46, 97, 8, 4, rand, 3, 0.2),
  ]
    .map((d) => fill(d, C.camo, { opacity: 0.85 }))
    .join('');

  const panel = { opacity: 0.55 };
  const panels = [
    // Wing spar lines, flaps and ailerons.
    'M73,10 L92.3,10', 'M73,150 L92.3,150',
    'M67.5,26 L71,26 M71,8 L67.7,40', 'M67.5,134 L71,134 M71,152 L67.7,120',
    'M66.8,44 L63.5,72', 'M66.8,116 L63.5,88',
    'M92.8,30 L94.6,66', 'M92.8,130 L94.6,94',
    // Stabiliser elevators.
    'M9,56 V104',
    // Fuselage frames.
    'M30,74.6 V85.4', 'M60,73.2 V86.8', 'M100,72 V88', 'M123,73.1 V86.9',
  ].map((d) => strokeD(d, C.ink, 0.6, panel)).join('');

  const nacDetail = (y) =>
    [
      fill(nacelle(y), 'url(#nacG)', { stroke: C.ink, 'stroke-width': 0.9 }),
      // Big intake with a lit lip, fan face; exhaust nozzle at the rear.
      fill(dEllipse(61, y, 2.5, 6.6), C.intake, { stroke: C.ink, 'stroke-width': 0.6 }),
      strokeD(`M59.6,${y - 5.9} Q63,${y} 59.6,${y + 5.9}`, C.hi, 1, { opacity: 0.9 }),
      fill(dEllipse(61.4, y, 1.1, 3.4), '#3b4248'),
      fill(dEllipse(30.8, y, 1.4, 4.8), C.metal, { stroke: C.ink, 'stroke-width': 0.6 }),
      strokeD(`M41,${y - 7.6} V${y + 7.6} M52,${y - 7.8} V${y + 7.8}`, C.ink, 0.55, panel),
      strokeD(`M34,${y - 5.2} L56,${y - 5.8}`, '#ffffff', 1, { opacity: 0.35 }),
    ].join('');

  /** Fin with a teal player stripe across it and a rudder hinge line. */
  const finWithStripe = (d, y) => {
    const cid = id();
    return (
      fill(d, 'url(#finG)', { stroke: C.ink, 'stroke-width': 0.9 }) +
      `<clipPath id="${cid}"><path d="${d}"/></clipPath><g clip-path="url(#${cid})">` +
      fill(dRect(4, y - 4, 5, 8, 0), C.teal) +
      fill(dRect(4, y, 5, 4, 0), C.tealD, { opacity: 0.45 }) +
      `</g>` +
      strokeD(d, C.ink, 0.9) +
      strokeD(`M11,${y - 2.7} V${y + 2.7}`, C.ink, 0.6, panel) +
      strokeD(`M4,${y - 1.4} Q16,${y - 2.4} 28,${y - 0.8}`, '#ffffff', 0.8, { opacity: 0.4 })
    );
  };

  const canopy =
    fill(`M104,80 Q104.6,74.8 111,74.4 L118,74.7 Q123.4,75.8 124.2,80 Q123.4,84.2 118,85.3 L111,85.6 Q104.6,85.2 104,80Z`, 'url(#glassG)', {
      stroke: C.ink,
      'stroke-width': 1,
    }) +
    strokeD('M110.8,74.6 V85.4', C.dd, 1) +
    strokeD('M112.5,76.8 Q117.5,76 121.5,78', C.teal, 1.3, { opacity: 0.95 }) +
    strokeD('M113.6,77 L116.8,76.7', C.tealHi, 0.9);

  const nose =
    // Anti-glare panel ahead of the canopy, gun gas vents.
    fill(`M124.5,76.4 Q129,76.8 132.5,78 L132.5,82 Q129,83.2 124.5,83.6Z`, C.dd, { opacity: 0.8 }) +
    fill(gun, 'url(#gunG)', { stroke: C.ink, 'stroke-width': 0.8 }) +
    fill(dRect(140.4, 75.6, 3.4, 5.8, 1.4), C.metal, { stroke: C.ink, 'stroke-width': 0.7 }) +
    fill(dEllipse(142.6, 78.5, 0.9, 1.9), '#0b0d0f') +
    strokeD('M134.5,76.6 V80.4 M137.5,76.6 V80.4', '#1a1e22', 0.8);

  const lowVisStar = (x, y) =>
    fill(dEllipse(x, y, 3.4), C.dd, { opacity: 0.55 }) +
    fill('M0,-2.6 L0.7,-0.8 L2.5,-0.8 L1.1,0.4 L1.6,2.2 L0,1.1 L-1.6,2.2 L-1.1,0.4 L-2.5,-0.8 L-0.7,-0.8Z', C.l, {
      opacity: 0.75,
      transform: `translate(${x},${y}) rotate(90)`,
    });

  const body = [
    // Silhouette outline (the game draws the plane's ground shadow separately).
    outline([...stores, wing, stab, finN, finS, gearN, gearS, pylonN, pylonS, nacN, nacS, fuselage, gun], 2),
    ...storeParts,
    fill(gearN, C.base, { stroke: C.ink, 'stroke-width': 0.7 }),
    fill(gearS, C.d, { stroke: C.ink, 'stroke-width': 0.7 }),
    fill(wing, 'url(#wingG)', { stroke: C.ink, 'stroke-width': 1 }),
    fill(stab, 'url(#stabG)', { stroke: C.ink, 'stroke-width': 0.9 }),
    fill(fuselage, 'url(#fusG)', { stroke: C.ink, 'stroke-width': 1 }),
    `<g clip-path="url(#air)">${camo}</g>`,
    panels,
    // Leading-edge highlight and trailing-edge shade on the wing.
    strokeD('M91.6,8 L95,78 M95,82 L91.6,152', '#ffffff', 0.9, { opacity: 0.35 }),
    strokeD('M69.8,8 L62.6,78 M62.6,82 L69.8,152', '#000000', 0.9, { opacity: 0.25 }),
    lowVisStar(82, 22),
    // Pods cast a soft shadow on the fuselage/wing root, then pylons and pods.
    `<g clip-path="url(#air)" opacity="0.3">${fill(nacN, '#000', { transform: 'translate(1.6,2.2)' })}${fill(nacS, '#000', { transform: 'translate(1.6,2.2)' })}</g>`,
    fill(pylonN, C.d, { stroke: C.ink, 'stroke-width': 0.6 }),
    fill(pylonS, C.dd, { stroke: C.ink, 'stroke-width': 0.6 }),
    nacDetail(63),
    nacDetail(97),
    // Twin fins cast a small shadow on the stabiliser.
    `<g clip-path="url(#air)" opacity="0.3">${fill(finN, '#000', { transform: 'translate(1.4,2)' })}${fill(finS, '#000', { transform: 'translate(1.4,2)' })}</g>`,
    finWithStripe(finN, 52),
    finWithStripe(finS, 108),
    canopy,
    nose,
    // Spine highlight + global light.
    strokeD('M10,77.2 Q60,74.6 102,74.4', '#ffffff', 0.9, { opacity: 0.3 }),
    `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#lit)" clip-path="url(#air)"/>`,
  ].join('');

  return svg(W, H, defs, body);
}
