// Unit style helpers for the WARTHOG sprite generator (art direction v1, 2026-09-26): bold,
// outlined, saturated arcade units at ~2x scale that read instantly over the desert terrain.
//
// Recipe for every unit sprite:
//   1. soft contact shadow baked under ground units (blurred silhouette, slight down-right bias);
//   2. one thick dark silhouette outline around the union of all parts (≈4 px at the 2× raster);
//   3. flat saturated fills, each with ONE cel-shade crescent on the lower-right (light from the
//      upper-left, like the terrain) and a small glossy highlight;
//   4. thin interior lines only where parts overlap or for panel lines;
//   5. glowing team accents: red/orange for enemies, white/cyan on steel blue for friendlies.
import { r2, rad, lin } from './lib.mjs';

/** Outer outline width in world units (sprites are rasterised at 2×, so 2.0 → 4 px). */
export const OW = 2;
/** Interior line width in world units. */
export const IW = 0.9;

export const T = {
  ink: '#1b1522',
  inkSoft: 'rgba(27,21,34,0.55)',
  shadow: '#1a1206',

  // Enemy armour: dark crimson-maroon with charcoal running gear.
  eHi: '#c4545c',
  eL: '#a33a45',
  e: '#86283a',
  eD: '#5c1a2a',
  eDD: '#3e1220',
  ch: '#45404f',
  chL: '#625c6e',
  chD: '#2c2834',
  // Enemy glow accents.
  glow: '#ff5a1e',
  glowHi: '#ffd35a',

  // Friendly armour: steel blue (the complement of the tan desert, far from enemy crimson) with
  // white ID stripes and cyan lights.
  fHi: '#b9d0ec',
  fL: '#86a8d2',
  f: '#5f84b4',
  fD: '#44648e',
  fDD: '#304a6c',
  blue: '#eef4fb',
  blueL: '#ffffff',
  blueD: '#c4d2e2',
  cyan: '#4fe3ff',
  cyanHi: '#e2fdff',
  steel: '#4c5463',
  steelL: '#6c7586',
  steelD: '#323845',

  // Cab glass.
  glassD: '#17394f',
  glassHi: '#bfe6ff',

  // AA: hazard orange, pale radar dish, sandbags, concrete, crates.
  hazard: '#ffa11a',
  dish: '#c7ced6',
  dishD: '#8791a0',
  bag: '#b9a676',
  bagL: '#d4c497',
  bagD: '#96845a',
  pad: '#9a978d',
  padD: '#747167',
  crate: '#6f7a45',
  crateD: '#4c5530',

  // Burnt wrecks.
  bHi: '#6e645b',
  bL: '#544b44',
  b: '#3c3531',
  bD: '#28231f',
  rust: '#7c4426',
  rustL: '#9c5c34',
  soot: '#120e0b',

  // Running gear / metal.
  trk: '#2b2833',
  trkL: '#4a4656',
  gun: '#3a3744',
  gunL: '#5a5668',
  gunD: '#24212b',
};

// ---------------------------------------------------------------------------
// Geometry → path data
// ---------------------------------------------------------------------------

/** Rounded rectangle as path data. */
export function dRect(x, y, w, h, r = 0) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  if (rr === 0) return `M${r2(x)},${r2(y)}H${r2(x + w)}V${r2(y + h)}H${r2(x)}Z`;
  return (
    `M${r2(x + rr)},${r2(y)}H${r2(x + w - rr)}Q${r2(x + w)},${r2(y)} ${r2(x + w)},${r2(y + rr)}` +
    `V${r2(y + h - rr)}Q${r2(x + w)},${r2(y + h)} ${r2(x + w - rr)},${r2(y + h)}` +
    `H${r2(x + rr)}Q${r2(x)},${r2(y + h)} ${r2(x)},${r2(y + h - rr)}V${r2(y + rr)}Q${r2(x)},${r2(y)} ${r2(x + rr)},${r2(y)}Z`
  );
}

/** Ellipse as path data. */
export function dEllipse(cx, cy, rx, ry = rx) {
  return (
    `M${r2(cx - rx)},${r2(cy)}A${r2(rx)},${r2(ry)} 0 1 0 ${r2(cx + rx)},${r2(cy)}` +
    `A${r2(rx)},${r2(ry)} 0 1 0 ${r2(cx - rx)},${r2(cy)}Z`
  );
}

/** Polygon with every corner rounded by up to `r` (quadratic fillets). */
export function dRound(pts, r = 2) {
  const n = pts.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const l1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
    const l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1;
    const rr = Array.isArray(r) ? r[i] : r;
    const k1 = Math.min(rr, l1 / 2) / l1;
    const k2 = Math.min(rr, l2 / 2) / l2;
    const a = [p1[0] + (p0[0] - p1[0]) * k1, p1[1] + (p0[1] - p1[1]) * k1];
    const b = [p1[0] + (p2[0] - p1[0]) * k2, p1[1] + (p2[1] - p1[1]) * k2];
    d += `${i === 0 ? 'M' : 'L'}${r2(a[0])},${r2(a[1])}Q${r2(p1[0])},${r2(p1[1])} ${r2(b[0])},${r2(b[1])}`;
  }
  return d + 'Z';
}

/** Mirror a list of points across the horizontal line y = cy (for symmetric top-down shapes). */
export const mirrorY = (pts, cy) => pts.map(([x, y]) => [x, 2 * cy - y]);

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/** A small per-SVG id allocator (clip paths, filters and gradients need unique ids). */
export function ids(prefix = 'k') {
  let n = 0;
  return () => `${prefix}${n++}`;
}

const attr = (a) =>
  Object.entries(a)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => `${k}="${typeof v === 'number' ? r2(v) : v}"`)
    .join(' ');

/** Plain filled path. */
export const fill = (d, color, extra = {}) => `<path ${attr({ d, fill: color, ...extra })}/>`;

/** Stroked path (no fill). */
export const strokeD = (d, color, width, extra = {}) =>
  `<path ${attr({ d, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra })}/>`;

/**
 * The thick outer outline: every silhouette part drawn in ink with a stroke of 2 × `ow`, so the
 * union of the parts gets one uniform outline and overlaps inside it stay seamless.
 */
export function outline(ds, ow = OW, color = T.ink) {
  return ds
    .map((d) => `<path ${attr({ d, fill: color, stroke: color, 'stroke-width': ow * 2, 'stroke-linejoin': 'round' })}/>`)
    .join('');
}

/**
 * A cel-shaded part: base fill with one shade crescent on the lower-right, made by shifting the
 * base up-left inside a clip of the part itself. Optional thin interior outline.
 */
export function cel(id, d, base, shade, { s = 2.5, line = IW, lineColor = T.ink, sx = null, sy = null } = {}) {
  const cid = id();
  const dx = sx ?? s;
  const dy = sy ?? s;
  return (
    `<clipPath id="${cid}"><path d="${d}"/></clipPath>` +
    `<g clip-path="url(#${cid})">${fill(d, shade)}${fill(d, base, { transform: `translate(${r2(-dx)},${r2(-dy)})` })}</g>` +
    (line > 0 ? strokeD(d, lineColor, line) : '')
  );
}

/** A flat part with a thin outline (no shading). */
export const flat = (d, color, line = IW, lineColor = T.ink) => fill(d, color) + (line > 0 ? strokeD(d, lineColor, line) : '');

/** Glossy highlight streak (rounded stroke). */
export const glint = (d, width = 1.6, color = '#ffffff', opacity = 0.75) =>
  strokeD(d, color, width, { opacity });

/** Soft contact shadow: blurred copies of the given silhouette paths. */
export function contactShadow(id, ds, { blur = 2.2, opacity = 0.4, dx = 0.8, dy = 1.4, grow = 1.5 } = {}) {
  const fid = id();
  return (
    `<filter id="${fid}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${blur}"/></filter>` +
    `<g filter="url(#${fid})" opacity="${opacity}" transform="translate(${r2(dx)},${r2(dy)})">` +
    ds.map((d) => `<path ${attr({ d, fill: T.shadow, stroke: T.shadow, 'stroke-width': grow * 2, 'stroke-linejoin': 'round' })}/>`).join('') +
    `</g>`
  );
}

/** Radial glow gradient defs for a colour (bright core → transparent). */
export function glowDefs(idName, core, color) {
  return rad(idName, 0.5, 0.5, 0.5, [
    [0, core, 1],
    [0.28, color, 0.95],
    [0.55, color, 0.45],
    [1, color, 0],
  ]);
}

/** A glowing light: soft halo + outlined lamp with a hot core. */
export function lamp(cx, cy, r, glowId, color, core, { halo = 2.6, line = 0.7 } = {}) {
  return (
    `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r * halo)}" fill="url(#${glowId})"/>` +
    `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r)}" fill="${color}" stroke="${T.ink}" stroke-width="${line}"/>` +
    `<circle cx="${r2(cx - r * 0.25)}" cy="${r2(cy - r * 0.25)}" r="${r2(r * 0.45)}" fill="${core}"/>`
  );
}

/** A glowing slit/strip light (rounded rect) with a halo. */
export function stripLight(x, y, w, h, glowId, color, core) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rr = Math.min(w, h) / 2;
  return (
    `<ellipse cx="${r2(cx)}" cy="${r2(cy)}" rx="${r2(w / 2 + 3)}" ry="${r2(h / 2 + 3)}" fill="url(#${glowId})"/>` +
    fill(dRect(x, y, w, h, rr), color, { stroke: T.ink, 'stroke-width': 0.7 }) +
    fill(dRect(x + w * 0.2, y + h * 0.25, w * 0.6, h * 0.35, rr * 0.4), core)
  );
}

/** Linear exhaust plume gradient (hot at x2 → transparent at x1), userSpace. */
export function plumeDefs(idName, x1, x2, color, core) {
  return lin(idName, x1, 0, x2, 0, [[0, color, 0], [0.55, color, 0.55], [0.85, core, 0.9], [1, core, 1]], 'userSpaceOnUse');
}
