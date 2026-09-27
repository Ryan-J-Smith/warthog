import { P, r2, svg, lin, rad, rect, circle, ellipse, path, line, g, poly, rng, blobPath, rrect, cylDefs } from './lib.mjs';

// ---------------------------------------------------------------------------
// Projectiles (face east)
// ---------------------------------------------------------------------------
export function rocket() {
  const defs = cylDefs('bG', '#f2f2ec', '#cfcfc6', '#7c7c74') + cylDefs('wG', '#9aa070', '#6f7548', '#3f4428');
  const body = [
    path('M0.6,0.1 L3.2,1.2 L3.2,2.8 L0.6,3.9Z', { fill: '#8a8a82', stroke: P.ink, 'stroke-width': 0.25 }),
    rect(1.8, 1.25, 7.6, 1.5, { fill: 'url(#bG)', stroke: P.ink, 'stroke-width': 0.25 }),
    path('M9.3,1.2 L11.8,1.2 Q13.9,1.6 14,2 Q13.9,2.4 11.8,2.8 L9.3,2.8Z', { fill: 'url(#wG)', stroke: P.ink, 'stroke-width': 0.25 }),
    rect(0.9, 1.45, 1, 1.1, { fill: '#2a2a28' }),
  ].join('');
  return svg(14, 4, defs, body);
}

export function maverick() {
  const defs = cylDefs('bG', '#ffffff', '#dddcd4', '#8c8c84') + rad('sG', 0.35, 0.3, 0.8, [[0, '#9fd0ea'], [0.4, '#3d6a86'], [1, '#132533']]);
  const body = [
    path('M2,1.6 L3.2,0.1 L5.4,0.1 L5.8,1.6Z', { fill: '#c9c8c0', stroke: P.ink, 'stroke-width': 0.25 }),
    path('M2,4.4 L3.2,5.9 L5.4,5.9 L5.8,4.4Z', { fill: '#a3a29b', stroke: P.ink, 'stroke-width': 0.25 }),
    path('M8,1.5 L10.5,0 L14,0 L13.8,1.5Z', { fill: '#c9c8c0', stroke: P.ink, 'stroke-width': 0.25 }),
    path('M8,4.5 L10.5,6 L14,6 L13.8,4.5Z', { fill: '#a3a29b', stroke: P.ink, 'stroke-width': 0.25 }),
    rrect(1.4, 1.45, 18.6, 3.1, 1.2, { fill: 'url(#bG)', stroke: P.ink, 'stroke-width': 0.3 }),
    rect(16.6, 1.5, 0.9, 3, { fill: P.yellow }),
    ellipse(20.2, 3, 1.6, 1.5, { fill: 'url(#sG)', stroke: P.ink, 'stroke-width': 0.25 }),
    rect(0.6, 2.2, 0.9, 1.6, { fill: '#2a2a28' }),
  ].join('');
  return svg(22, 6, defs, body);
}

export function bomb() {
  const defs = cylDefs('bG', '#9aa070', '#61683f', '#343a22');
  const body = [
    path('M0.2,0.3 L3.6,1.6 L3.6,4.4 L0.2,5.7Z', { fill: '#565c38', stroke: P.ink, 'stroke-width': 0.3 }),
    line(0.2, 3, 3.6, 3, { stroke: P.ink, 'stroke-width': 0.3 }),
    path('M3,1.9 L4.8,1 L12,1 Q15.3,1.2 15.6,3 Q15.3,4.8 12,5 L4.8,5 L3,4.1Z', { fill: 'url(#bG)', stroke: P.ink, 'stroke-width': 0.35 }),
    rect(12.1, 1.05, 0.9, 3.9, { fill: P.yellow }),
    rect(15.3, 2.55, 0.7, 0.9, { fill: '#9a9a90' }),
  ].join('');
  return svg(16, 6, defs, body);
}

export function samMissile() {
  const defs = cylDefs('bG', '#ffffff', '#e8e7e0', '#96968e');
  const body = [
    path('M3,1.6 L4,0.1 L7,0.1 L7.3,1.6Z', { fill: '#cfcec7', stroke: P.ink, 'stroke-width': 0.25 }),
    path('M3,4.4 L4,5.9 L7,5.9 L7.3,4.4Z', { fill: '#a6a59e', stroke: P.ink, 'stroke-width': 0.25 }),
    path('M16.5,1.6 L17.3,0.7 L18.8,0.7 L19,1.6Z', { fill: '#cfcec7', stroke: P.ink, 'stroke-width': 0.2 }),
    path('M16.5,4.4 L17.3,5.3 L18.8,5.3 L19,4.4Z', { fill: '#a6a59e', stroke: P.ink, 'stroke-width': 0.2 }),
    path('M2.4,1.6 L21.5,1.6 Q25.4,2.3 26,3 Q25.4,3.7 21.5,4.4 L2.4,4.4Z', { fill: 'url(#bG)', stroke: P.ink, 'stroke-width': 0.3 }),
    rect(13.4, 1.62, 1.7, 2.76, { fill: P.red }),
    rect(1.6, 2.1, 0.9, 1.8, { fill: '#2a2a28' }),
  ].join('');
  return svg(26, 6, defs, body);
}

export function flare() {
  const defs = rad('fG', 0.5, 0.5, 0.5, [[0, '#ffffff', 1], [0.25, '#fffbe0', 1], [0.5, '#ffe27a', 0.75], [0.75, '#ffb040', 0.3], [1, '#ff8a20', 0]]);
  return svg(10, 10, defs, circle(5, 5, 5, { fill: 'url(#fG)' }));
}

// ---------------------------------------------------------------------------
// Decals
// ---------------------------------------------------------------------------
export function crater() {
  const rand = rng(7);
  const defs = [
    `<filter id="rough" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="3" seed="4"/><feDisplacementMap in="SourceGraphic" scale="7" xChannelSelector="R" yChannelSelector="G"/></filter>`,
    rad('ejG', 0.5, 0.5, 0.5, [[0, '#a38e64', 0.9], [0.6, '#9a8660', 0.7], [1, '#9a8660', 0]]),
    rad('sootG', 0.5, 0.5, 0.5, [[0, '#15120e', 0.7], [0.6, '#15120e', 0.45], [1, '#15120e', 0]]),
    lin('rimG', 0, 0, 1, 1, [[0, '#c3b087'], [0.5, '#9c8760'], [1, '#6b5a3d']]),
    lin('bowlG', 0, 0, 1, 1, [[0, '#15110c'], [0.55, '#2e271c'], [1, '#6a5838']]),
  ].join('');
  const clods = Array.from({ length: 26 }, () => {
    const a = rand.range(0, Math.PI * 2);
    const d = rand.range(19, 28);
    return circle(r2(30 + Math.cos(a) * d), r2(30 + Math.sin(a) * d), r2(rand.range(0.5, 1.4)), { fill: rand.pick(['#6b5a3d', '#4a3e2a', '#b09c72']) });
  }).join('');
  const body = [
    circle(30, 30, 29, { fill: 'url(#sootG)' }),
    g(circle(30, 30, 25, { fill: 'url(#ejG)' }), { filter: 'url(#rough)' }),
    clods,
    g(circle(30, 30, 17, { fill: 'url(#rimG)' }), { filter: 'url(#rough)' }),
    circle(30, 30, 13.5, { fill: 'url(#bowlG)' }),
    circle(31, 31, 6, { fill: '#0d0b08', opacity: 0.55 }),
  ].join('');
  return svg(60, 60, defs, body);
}

export function scorch() {
  const rand = rng(9);
  const defs = [
    `<filter id="rough" x="-15%" y="-15%" width="130%" height="130%"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="4" seed="11"/><feDisplacementMap in="SourceGraphic" scale="22" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="1.2"/></filter>`,
    rad('sG', 0.5, 0.5, 0.5, [[0, '#0c0a08', 0.92], [0.35, '#16120d', 0.75], [0.7, '#1e1811', 0.35], [1, '#1e1811', 0]]),
    rad('rayG', 0.5, 0.5, 0.5, [[0, '#120f0b', 0.55], [1, '#120f0b', 0]]),
  ].join('');
  const rays = Array.from({ length: 11 }, (_, i) => {
    const deg = (i / 11) * 360 + rand.range(-12, 12);
    const len = rand.range(26, 40);
    return ellipse(45 + len / 2, 45, len / 2, rand.range(2.5, 5), { fill: 'url(#rayG)', transform: `rotate(${r2(deg)} 45 45)` });
  }).join('');
  const body = g([rays, circle(45, 45, 34, { fill: 'url(#sG)' }), circle(44, 44, 12, { fill: '#0a0806', opacity: 0.5 })].join(''), { filter: 'url(#rough)' });
  return svg(90, 90, defs, body);
}

// ---------------------------------------------------------------------------
// Particles (white; tinted at runtime)
// ---------------------------------------------------------------------------
export function particleSoft() {
  const defs = rad('sG', 0.5, 0.5, 0.5, [[0, '#fff', 1], [0.2, '#fff', 0.85], [0.45, '#fff', 0.42], [0.7, '#fff', 0.13], [1, '#fff', 0]]);
  return svg(32, 32, defs, circle(16, 16, 16, { fill: 'url(#sG)' }));
}

export function particleSmoke() {
  const rand = rng(17);
  const defs = [
    rad('pG', 0.5, 0.5, 0.5, [[0, '#ffffff', 0.95], [0.45, '#f0f0f0', 0.8], [0.75, '#c8c8c8', 0.4], [1, '#b0b0b0', 0]], 0.38, 0.34),
    `<filter id="puff" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="3" seed="3"/><feDisplacementMap in="SourceGraphic" scale="7" xChannelSelector="R" yChannelSelector="G"/></filter>`,
  ].join('');
  const blobs = [
    [32, 32, 17],
    [23, 27, 12],
    [41, 25, 12],
    [42, 39, 12],
    [25, 41, 11],
    [33, 20, 10],
    [18, 34, 9],
  ];
  const body = g(blobs.map(([x, y, rr]) => circle(x + rand.range(-1, 1), y + rand.range(-1, 1), rr, { fill: 'url(#pG)' })).join(''), { filter: 'url(#puff)' });
  return svg(64, 64, defs, body);
}

export function particleSpark() {
  const defs = lin('sG', 0, 0, 1, 0, [[0, '#fff', 0], [0.55, '#fff', 0.55], [0.85, '#fff', 1], [1, '#fff', 1]]);
  return svg(10, 3, defs, ellipse(5.2, 1.5, 4.8, 1.3, { fill: 'url(#sG)' }) + ellipse(8.4, 1.5, 1.5, 0.9, { fill: '#fff' }));
}

export function particleDebris() {
  const body = [
    poly([[0.6, 2.2], [2.4, 0.5], [5.2, 1.2], [5.6, 3.8], [3.6, 5.6], [1.1, 4.6]], { fill: '#d6d6d6' }),
    poly([[0.6, 2.2], [2.4, 0.5], [5.2, 1.2], [3, 2.8]], { fill: '#ffffff' }),
    poly([[3, 2.8], [5.6, 3.8], [3.6, 5.6]], { fill: '#9a9a9a' }),
  ].join('');
  return svg(6, 6, '', body);
}

// ---------------------------------------------------------------------------
// Clouds (seen from above)
// ---------------------------------------------------------------------------
function cloud(w, h, seed, count, wispy = false) {
  const rand = rng(seed);
  const cx = w / 2;
  const cy = h / 2;
  // Soft mask: a cluster of radial-gradient blobs, densest in the middle.
  const blobs = [];
  for (let i = 0; i < count; i++) {
    const t = rand.range(-1, 1);
    const x = cx + t * (w / 2) * (wispy ? 0.62 : 0.55);
    const spread = (1 - Math.abs(t) * 0.6) * (h / 2) * 0.42;
    const y = cy + rand.range(-1, 1) * spread;
    const rr = (wispy ? rand.range(40, 70) : rand.range(55, 95)) * (1 - Math.abs(t) * 0.4) * (h / 260);
    blobs.push([x, y, rr]);
  }
  const f = wispy ? 0.022 : 0.018;
  // alpha = k2·noise + k3·mask + k4: the mask keeps the core solid, noise breaks up the edges.
  const k2 = wispy ? 1.5 : 1.35;
  const k3 = wispy ? 1.5 : 1.75;
  const k4 = wispy ? -1.45 : -1.38;
  const defs = [
    rad('m', 0.5, 0.5, 0.5, [[0, '#ffffff', 1], [0.55, '#ffffff', 0.85], [1, '#ffffff', 0]]),
    `<filter id="cl" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
      `<feTurbulence type="fractalNoise" baseFrequency="${f}" numOctaves="4" seed="${seed}" result="noise"/>` +
      `<feColorMatrix in="noise" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1 0 0 0 0" result="na"/>` +
      `<feComposite in="na" in2="SourceGraphic" operator="arithmetic" k1="0" k2="${k2}" k3="${k3}" k4="${k4}" result="shape0"/>` +
      `<feGaussianBlur in="shape0" stdDeviation="${wispy ? 3.5 : 2.4}" result="shape"/>` +
      `<feGaussianBlur in="shape" stdDeviation="3.5" result="height"/>` +
      `<feDiffuseLighting in="height" surfaceScale="${wispy ? 4.5 : 7.5}" diffuseConstant="1.3" lighting-color="#ffffff" result="lit">` +
      `<feDistantLight azimuth="45" elevation="58"/></feDiffuseLighting>` +
      `<feColorMatrix in="lit" type="matrix" values="0.7 0 0 0 0.28  0 0.74 0 0 0.26  0 0 0.76 0 0.28  0 0 0 1 0" result="tinted"/>` +
      `<feComposite in="tinted" in2="shape" operator="in"/>` +
      `</filter>`,
  ].join('');
  const mask = blobs.map(([x, y, rr]) => ellipse(r2(x), r2(y), r2(rr * 1.25), r2(rr), { fill: 'url(#m)' })).join('');
  return svg(w, h, defs, g(mask, { filter: 'url(#cl)' }));
}
export const cloud1 = () => cloud(420, 260, 101, 9);
export const cloud2 = () => cloud(360, 220, 202, 8);
export const cloud3 = () => cloud(520, 300, 303, 12);
export const cloud4 = () => cloud(300, 200, 404, 8, true);

// ---------------------------------------------------------------------------
// World-space UI (white, dark outline for legibility on sand)
// ---------------------------------------------------------------------------
const OUT = { stroke: '#000', 'stroke-opacity': 0.55, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
const WH = { stroke: '#fff', fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
const outlined = (shapeFn, wOut, wIn) => shapeFn({ ...OUT, 'stroke-width': wOut }) + shapeFn({ ...WH, 'stroke-width': wIn });

export function reticleGun() {
  const s = (a) =>
    circle(24, 24, 13, a) +
    line(24, 3, 24, 8.5, a) + line(24, 39.5, 24, 45, a) + line(3, 24, 8.5, 24, a) + line(39.5, 24, 45, 24, a);
  return svg(48, 48, '', outlined(s, 4.4, 2.2) + circle(24, 24, 2.6, { fill: '#000', opacity: 0.55 }) + circle(24, 24, 1.7, { fill: '#fff' }));
}

export function reticleBomb() {
  const s = (a) =>
    circle(28, 28, 22, a) +
    path('M28,15 L41,28 L28,41 L15,28Z', a) +
    line(28, 2, 28, 9, a) + line(28, 47, 28, 54, a) + line(2, 28, 9, 28, a) + line(47, 28, 54, 28, a);
  return svg(56, 56, '', outlined(s, 4, 2) + circle(28, 28, 2.6, { fill: '#000', opacity: 0.55 }) + circle(28, 28, 1.7, { fill: '#fff' }));
}

export function reticleRocket() {
  const s = (a) =>
    path('M14,6 L6,6 L6,14 M34,6 L42,6 L42,14 M42,34 L42,42 L34,42 M14,42 L6,42 L6,34', a) + line(24, 17, 24, 20, a) + line(24, 28, 24, 31, a);
  return svg(48, 48, '', outlined(s, 4.6, 2.4) + circle(24, 24, 2.6, { fill: '#000', opacity: 0.55 }) + circle(24, 24, 1.7, { fill: '#fff' }));
}

export function lockBracket() {
  const s = (a) => path('M4,20 L4,4 L20,4 M44,4 L60,4 L60,20 M60,44 L60,60 L44,60 M20,60 L4,60 L4,44', a);
  return svg(64, 64, '', outlined(s, 5.6, 3));
}

export function offscreenArrow() {
  const d = 'M7,4 L28,16 L7,28 L12,16Z';
  return svg(32, 32, '', path(d, { fill: '#fff', stroke: '#000', 'stroke-opacity': 0.6, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }));
}

const iconDefs = lin('iG', 0, 0, 0, 1, [[0, '#ffffff'], [0.6, '#e8e8e8'], [1, '#b8b8b8']]);
const IC = { fill: 'url(#iG)', stroke: '#000', 'stroke-opacity': 0.55, 'stroke-width': 1, 'stroke-linejoin': 'round' };

export function iconGun() {
  const body = [
    rrect(4, 7, 20, 18, 3, IC),
    line(9, 8, 9, 24, { stroke: '#000', 'stroke-opacity': 0.35 }),
    line(14, 8, 14, 24, { stroke: '#000', 'stroke-opacity': 0.35 }),
    line(19, 8, 19, 24, { stroke: '#000', 'stroke-opacity': 0.35 }),
    rect(24, 11, 5, 10, IC),
    rect(29, 10.5, 30, 3, IC),
    rect(29, 14.5, 30, 3, IC),
    rect(29, 18.5, 30, 3, IC),
    rect(40, 9, 3, 14, IC),
    rect(55, 9, 3, 14, IC),
  ].join('');
  return svg(64, 32, iconDefs, body);
}

export function iconRockets() {
  const body = [
    path('M52,11 L59,13 L59,15 L52,15Z', IC),
    path('M52,17 L59,17 L59,19 L52,21Z', IC),
    path('M8,8 L48,8 Q54,8 54,16 Q54,24 48,24 L8,24 Q4,24 4,16 Q4,8 8,8Z', IC),
    rect(16, 6, 3, 20, IC),
    rect(38, 6, 3, 20, IC),
  ].join('');
  return svg(64, 32, iconDefs, body);
}

export function iconMaverick() {
  const body = [
    path('M16,12 L22,4 L32,4 L34,12Z', IC),
    path('M16,20 L22,28 L32,28 L34,20Z', IC),
    path('M5,12 L7,7 L12,7 L13,12Z', IC),
    path('M5,20 L7,25 L12,25 L13,20Z', IC),
    path('M4,12 L52,12 Q60,12 60,16 Q60,20 52,20 L4,20Z', IC),
    ellipse(55.5, 16, 3, 3.5, { fill: '#000', opacity: 0.35 }),
  ].join('');
  return svg(64, 32, iconDefs, body);
}

export function iconBombs() {
  const body = [
    path('M3,6 L13,12 L13,20 L3,26Z', IC),
    path('M11,12 L18,9 L44,9 Q58,10 60,16 Q58,22 44,23 L18,23 L11,20Z', IC),
    rect(44, 9.3, 3, 13.4, { fill: '#000', opacity: 0.35 }),
  ].join('');
  return svg(64, 32, iconDefs, body);
}

export function iconFlare() {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    const r0 = 6;
    const r1 = i % 2 ? 11 : 14.5;
    return line(16 + Math.cos(a) * r0, 16 + Math.sin(a) * r0, 16 + Math.cos(a) * r1, 16 + Math.sin(a) * r1, { stroke: '#fff', 'stroke-width': 2, 'stroke-linecap': 'round' });
  }).join('');
  const raysOut = rays.replace(/stroke="#fff" stroke-width="2"/g, 'stroke="#000" stroke-opacity="0.5" stroke-width="3.8"');
  return svg(32, 32, '', raysOut + rays + circle(16, 16, 5, { fill: '#fff', stroke: '#000', 'stroke-opacity': 0.55, 'stroke-width': 1 }));
}
