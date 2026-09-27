// Shared helpers + palette for the WARTHOG SVG sprite generator.

export const P = {
  ink: '#1b1d16',
  inkSoft: 'rgba(20,22,16,0.55)',
  // enemy olive / tan
  olHi: '#9d9a5f',
  olL: '#858250',
  ol: '#6c6a3d',
  olD: '#51502c',
  olDD: '#3a3a20',
  tan: '#b29d6c',
  tanL: '#c9b686',
  tanD: '#8d7a52',
  canvas: '#8f8659',
  canvasL: '#a79e6c',
  canvasD: '#6f6843',
  red: '#d8392b',
  redL: '#ff6a4f',
  redD: '#8c2118',
  // friendly (slate / blue-grey) + blue
  frHi: '#aab4ae',
  frL: '#909b95',
  fr: '#77827c',
  frD: '#58625d',
  frDD: '#3f4743',
  blue: '#3f8ef0',
  blueL: '#7cc0ff',
  blueD: '#1f5aa8',
  // running gear / metal
  trk: '#2b2c28',
  trkL: '#45463f',
  trkHi: '#5c5d55',
  steel: '#6d7169',
  steelL: '#9ba095',
  steelD: '#474b44',
  // A-10 compass-ghost greys
  gHi: '#b3bcc2',
  gL: '#9aa4ab',
  g: '#7f8a91',
  gD: '#5f6a71',
  gDD: '#434c52',
  gInk: '#20262a',
  glass: '#1d3040',
  glassL: '#7fb0cc',
  // burnt
  burnt: '#24211d',
  burntL: '#3a352f',
  ash: '#5f5a52',
  ashL: '#7b756b',
  rust: '#6e3f24',
  rustL: '#8d5530',
  // ground-ish
  dirt: '#9c8a62',
  dirtL: '#b3a179',
  dirtD: '#7d6c4a',
  sand: '#c4b28a',
  sandbag: '#b7a47a',
  sandbagL: '#cdbb90',
  sandbagD: '#8f7d57',
  concrete: '#a19e93',
  concreteL: '#bdbab0',
  concreteD: '#7e7b72',
  asphalt: '#4f4f4a',
  asphaltL: '#5f5f59',
  white: '#f4f2ea',
  yellow: '#e2c24a',
  brass: '#c9a24a',
  grass: '#6f7a3e',
};

/** Round to 2 decimals for compact output. */
export const r2 = (n) => Math.round(n * 100) / 100;

export function svg(w, h, defs, body) {
  const d = defs ? `<defs>${defs}</defs>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${d}${body}</svg>\n`;
}

/** Linear gradient. `stops` = [[offset, color, opacity?], ...]; coords in objectBoundingBox units. */
export function lin(id, x1, y1, x2, y2, stops, units = 'objectBoundingBox') {
  const s = stops
    .map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a === undefined ? '' : ` stop-opacity="${a}"`}/>`)
    .join('');
  return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="${units}">${s}</linearGradient>`;
}

/** Radial gradient (objectBoundingBox by default). */
export function rad(id, cx, cy, r, stops, fx = cx, fy = cy, units = 'objectBoundingBox') {
  const s = stops
    .map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a === undefined ? '' : ` stop-opacity="${a}"`}/>`)
    .join('');
  return `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" fx="${fx}" fy="${fy}" gradientUnits="${units}">${s}</radialGradient>`;
}

export function attrs(a) {
  return Object.entries(a)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => `${k}="${typeof v === 'number' ? r2(v) : v}"`)
    .join(' ');
}

export const el = (tag, a, inner) => (inner === undefined ? `<${tag} ${attrs(a)}/>` : `<${tag} ${attrs(a)}>${inner}</${tag}>`);
export const rect = (x, y, w, h, a = {}) => el('rect', { x, y, width: w, height: h, ...a });
export const circle = (cx, cy, r, a = {}) => el('circle', { cx, cy, r, ...a });
export const ellipse = (cx, cy, rx, ry, a = {}) => el('ellipse', { cx, cy, rx, ry, ...a });
export const path = (d, a = {}) => el('path', { d, ...a });
export const line = (x1, y1, x2, y2, a = {}) => el('line', { x1, y1, x2, y2, ...a });
export const g = (inner, a = {}) => (Object.keys(a).length ? `<g ${attrs(a)}>${inner}</g>` : `<g>${inner}</g>`);
export const poly = (pts, a = {}) => el('polygon', { points: pts.map(([x, y]) => `${r2(x)},${r2(y)}`).join(' '), ...a });
export const polyline = (pts, a = {}) =>
  el('polyline', { points: pts.map(([x, y]) => `${r2(x)},${r2(y)}`).join(' '), fill: 'none', ...a });

/** Deterministic PRNG (mulberry32) so regenerated sprites are stable. */
export function rng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (a, b) => a + (b - a) * next(),
    int: (a, b) => Math.floor(a + (b - a + 1) * next()),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
  };
}

/** Closed blobby path around (cx, cy): radius varies smoothly with angle. */
export function blobPath(cx, cy, rx, ry, rand, bumps = 9, amp = 0.18, rot = 0) {
  const n = bumps * 4;
  const phases = Array.from({ length: 3 }, () => rand.range(0, Math.PI * 2));
  const freqs = [bumps, Math.max(2, Math.round(bumps / 2)), Math.max(1, Math.round(bumps / 3))];
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    let k = 1;
    for (let j = 0; j < 3; j++) k += (amp / (j + 1)) * Math.sin(a * freqs[j] + phases[j]);
    const x = Math.cos(a) * rx * k;
    const y = Math.sin(a) * ry * k;
    const cr = Math.cos(rot);
    const sr = Math.sin(rot);
    pts.push([cx + x * cr - y * sr, cy + x * sr + y * cr]);
  }
  return smoothClosed(pts);
}

/** Catmull-Rom → cubic Bézier for a closed polygon. */
export function smoothClosed(pts) {
  const n = pts.length;
  let d = `M${r2(pts[0][0])},${r2(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${r2(c1[0])},${r2(c1[1])} ${r2(c2[0])},${r2(c2[1])} ${r2(p2[0])},${r2(p2[1])}`;
  }
  return d + 'Z';
}

/** Catmull-Rom → cubic Bézier for an open polyline. */
export function smoothOpen(pts) {
  const n = pts.length;
  let d = `M${r2(pts[0][0])},${r2(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${r2(c1[0])},${r2(c1[1])} ${r2(c2[0])},${r2(c2[1])} ${r2(p2[0])},${r2(p2[1])}`;
  }
  return d;
}

/** Rounded-rect path helper. */
export function rrect(x, y, w, h, rr, a = {}) {
  return rect(x, y, w, h, { rx: rr, ry: rr, ...a });
}

/** Standard top-left light: a soft white→black overlay gradient for unified shading. */
export function lightDefs(id = 'lit', hi = 0.22, lo = 0.28) {
  return lin(id, 0, 0, 1, 1, [
    [0, '#ffffff', hi],
    [0.45, '#ffffff', 0],
    [0.6, '#000000', 0],
    [1, '#000000', lo],
  ]);
}

/** Vertical cylinder shading (for bodies lying along x): light on top (north), dark at bottom. */
export function cylDefs(id, light, mid, dark) {
  return lin(id, 0, 0, 0, 1, [
    [0, dark],
    [0.18, light],
    [0.45, mid],
    [0.85, dark],
    [1, dark],
  ]);
}

/** Sandbag ring: many little rounded bags around a circle. */
export function sandbagRing(cx, cy, radius, thickness, rand, opts = {}) {
  const { gapStart = null, gapEnd = null, colors = [P.sandbag, P.sandbagL, P.sandbagD], stroke = P.sandbagD } = opts;
  const circ = 2 * Math.PI * radius;
  const n = Math.max(8, Math.round(circ / (thickness * 1.25)));
  let out = '';
  for (let row = 0; row < 2; row++) {
    const rr = radius + (row === 0 ? -thickness * 0.24 : thickness * 0.24);
    for (let i = 0; i < n; i++) {
      const a = ((i + (row ? 0.5 : 0)) / n) * Math.PI * 2;
      if (gapStart !== null && inArc(a, gapStart, gapEnd)) continue;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      const bw = (circ / n) * 0.62;
      const bh = thickness * 0.5;
      const deg = (a * 180) / Math.PI + 90;
      const c = colors[rand.int(0, colors.length - 1)];
      out += rrect(-bw / 2, -bh / 2, bw, bh, bh * 0.45, {
        fill: c,
        stroke,
        'stroke-width': 0.35,
        transform: `translate(${r2(x)},${r2(y)}) rotate(${r2(deg)})`,
      });
    }
  }
  return out;
}

function inArc(a, s, e) {
  const tau = Math.PI * 2;
  const n = (v) => ((v % tau) + tau) % tau;
  const A = n(a);
  const S = n(s);
  const E = n(e);
  return S <= E ? A >= S && A <= E : A >= S || A <= E;
}

/** Straight line of sandbags from (x1,y1) to (x2,y2). */
export function sandbagLine(x1, y1, x2, y2, thickness, rand, opts = {}) {
  const { colors = [P.sandbag, P.sandbagL, P.sandbagD], stroke = P.sandbagD, rows = 2 } = opts;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const deg = (ang * 180) / Math.PI;
  const bw = thickness * 1.2;
  const n = Math.max(1, Math.round(len / bw));
  let out = '';
  for (let row = 0; row < rows; row++) {
    const off = (row - (rows - 1) / 2) * thickness * (0.5 / Math.max(1, rows - 1)) * 2 * 0.48;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5 + (row % 2 ? 0.5 : 0)) / n;
      if (t > 1) continue;
      const x = x1 + (x2 - x1) * t - Math.sin(ang) * off;
      const y = y1 + (y2 - y1) * t + Math.cos(ang) * off;
      const c = colors[rand.int(0, colors.length - 1)];
      out += rrect(-bw * 0.42, -thickness * 0.26, bw * 0.84, thickness * 0.52, thickness * 0.22, {
        fill: c,
        stroke,
        'stroke-width': 0.35,
        transform: `translate(${r2(x)},${r2(y)}) rotate(${r2(deg)})`,
      });
    }
  }
  return out;
}

/** Soft scorch blotch via radial gradients (for wreck sprites). */
export function sootDefs(id, color = '#15130f', a = 0.75) {
  return rad(id, 0.5, 0.5, 0.5, [
    [0, color, a],
    [0.55, color, a * 0.55],
    [1, color, 0],
  ]);
}
