// Fun-pass pickups + the player shield shimmer (art direction v1: bold outlined, flat cel fills).
//
// Pickups are 40 × 40 and must read instantly at Medium zoom (0.72 → ~29 px on screen) over the
// desert: each is a crate or canister with a white rim OUTSIDE the dark ink outline (reads on
// light and dark ground alike), a soft colour halo, a distinct body colour per kind and one big
// glyph. Crates (ammo, repair) are square; canisters (boost, overdrive) are round, so the two
// families differ by silhouette as well as colour.
import { svg, r2, rad } from './lib.mjs';
import { T, OW, dRect, dEllipse, dRound, ids, fill, strokeD, outline, cel, glint } from './style.mjs';

const W = 40;
const H = 40;
const CX = 20;
const CY = 20;
/** White rim width outside the ink outline. */
const RIM = 1.4;

/** White rim + ink outline around the given silhouette paths. */
function rimmed(ds) {
  return outline(ds, OW + RIM, '#ffffff') + outline(ds, OW);
}

/** Soft colour halo gradient behind a pickup (bright core → transparent). */
const haloDefs = (gid, color) => rad(gid, 0.5, 0.5, 0.5, [[0, color, 0.8], [0.6, color, 0.45], [1, color, 0]]);

/** Square crate body with a recessed lid, corner brackets and a top-left gloss. */
function crate(id, base, shade, frame, bracket) {
  const body = dRect(7, 7, 26, 26, 3.2);
  const lid = dRect(10.4, 10.4, 19.2, 19.2, 2);
  const p = [];
  p.push(rimmed([body]));
  p.push(cel(id, body, base, shade, { s: 2.2 }));
  p.push(fill(lid, frame, { stroke: T.ink, 'stroke-width': 0.8 }));
  for (const [x, y] of [[7.6, 7.6], [27.4, 7.6], [7.6, 27.4], [27.4, 27.4]]) {
    p.push(fill(dRect(x, y, 5, 5, 1.2), bracket, { stroke: T.ink, 'stroke-width': 0.7 }));
  }
  return p.join('');
}

/** Round canister body (top-down): rim ring, inner cap, top-left gloss. */
function canister(id, base, shade, cap, ring) {
  const body = dEllipse(CX, CY, 13.6);
  const p = [];
  p.push(rimmed([body]));
  p.push(cel(id, body, base, shade, { s: 2.4 }));
  p.push(strokeD(dEllipse(CX, CY, 10.6), ring, 2.2));
  p.push(fill(dEllipse(CX, CY, 9.4), cap, { stroke: T.ink, 'stroke-width': 0.8 }));
  // Four clamp lugs on the rim.
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const x = CX + Math.cos(a) * 12;
    const y = CY + Math.sin(a) * 12;
    p.push(fill(dEllipse(x, y, 1.5), ring, { stroke: T.ink, 'stroke-width': 0.6 }));
  }
  return p.join('');
}

/** Ammo: olive crate with brass corners, amber band, three big brass rounds. */
export function pickupAmmo() {
  const id = ids('pa');
  const p = [`<circle cx="${CX}" cy="${CY}" r="19.6" fill="url(#hA)"/>`];
  p.push(crate(id, '#7d8a45', '#56602c', '#606b33', '#d9a93e'));
  p.push(fill(dRect(10.4, 26.2, 19.2, 3.4, 0), '#ffb21e', { opacity: 0.95 }));
  p.push(strokeD(dRect(10.4, 10.4, 19.2, 19.2, 2), T.ink, 0.8));
  // Three rounds: brass case, copper tip, dark base rim.
  for (const x of [13.4, 20, 26.6]) {
    const round = `M${x - 2.4},25 V16.4 Q${x - 2.4},11.6 ${x},10.6 Q${x + 2.4},11.6 ${x + 2.4},16.4 V25Z`;
    p.push(outline([round], 1));
    p.push(cel(id, round, '#f2c54e', '#b8862a', { s: 1, line: 0.7 }));
    p.push(fill(`M${x - 2.4},16.4 Q${x - 2.4},11.6 ${x},10.6 Q${x + 2.4},11.6 ${x + 2.4},16.4Z`, '#d9773a', { stroke: T.ink, 'stroke-width': 0.6 }));
    p.push(fill(dRect(x - 2.6, 23.4, 5.2, 1.8, 0.4), '#8a6420', { stroke: T.ink, 'stroke-width': 0.5 }));
    p.push(strokeD(`M${x - 1.1},17.6 V22.4`, '#fff3c4', 0.8, { opacity: 0.85 }));
  }
  p.push(glint('M9.6,9.4 L22,9.4', 1.2, '#ffffff', 0.55));
  return svg(W, H, haloDefs('hA', '#ffb21e'), p.join(''));
}

/** Repair: white field case with a green band and a big green cross. */
export function pickupRepair() {
  const id = ids('pr');
  const p = [`<circle cx="${CX}" cy="${CY}" r="19.6" fill="url(#hR)"/>`];
  p.push(crate(id, '#f1f3ee', '#bfc6bd', '#e3e8e1', '#2fbf5b'));
  const cross = dRound([[16.6, 9.8], [23.4, 9.8], [23.4, 16.6], [30.2, 16.6], [30.2, 23.4], [23.4, 23.4], [23.4, 30.2], [16.6, 30.2], [16.6, 23.4], [9.8, 23.4], [9.8, 16.6], [16.6, 16.6]], 1);
  p.push(outline([cross], 1.1));
  p.push(cel(id, cross, '#34c860', '#1d8a3e', { s: 1.4, line: 0 }));
  p.push(glint('M18,12 V15.4 M12,18 H15.4', 1, '#d8ffe2', 0.8));
  p.push(glint('M9.6,9.4 L15,9.4', 1.2, '#ffffff', 0.7));
  return svg(W, H, haloDefs('hR', '#4dff7c'), p.join(''));
}

/** Boost: deep-blue canister with a cyan ring and a white double chevron (afterburner). */
export function pickupBoost() {
  const id = ids('pb');
  const p = [`<circle cx="${CX}" cy="${CY}" r="19.6" fill="url(#hB)"/>`];
  p.push(canister(id, '#2a6fd0', '#173f86', '#1b4f9e', T.cyan));
  const chev = (x) => `M${x},12.6 L${x + 6.6},20 L${x},27.4 L${x - 3.4},27.4 L${x + 3},20 L${x - 3.4},12.6Z`;
  for (const x of [15.4, 22]) {
    p.push(outline([chev(x)], 1));
    p.push(fill(chev(x), '#ffffff'));
    p.push(fill(`M${x},12.6 L${x + 6.6},20 L${x + 3},20 L${x - 3.4},12.6Z`, T.cyanHi));
  }
  p.push(glint('M11.2,14.4 Q13.6,10.6 18,9.4', 1.3, '#ffffff', 0.6));
  return svg(W, H, haloDefs('hB', T.cyan), p.join(''));
}

/** Overdrive: hot orange/red canister with a yellow-white lightning bolt. */
export function pickupOverdrive() {
  const id = ids('po');
  const p = [`<circle cx="${CX}" cy="${CY}" r="19.6" fill="url(#hO)"/>`];
  p.push(canister(id, '#ff6a1a', '#c0261a', '#d8391f', '#ffd35a'));
  const bolt = 'M22.6,9.6 L13.4,21.6 L19,21.6 L16.8,30.6 L27,17.8 L21.2,17.8Z';
  p.push(outline([bolt], 1.1));
  p.push(fill(bolt, '#fff3b0'));
  p.push(fill('M22.6,9.6 L13.4,21.6 L16,21.6 L21.6,13.4Z', '#ffffff'));
  p.push(glint('M11.2,14.4 Q13.6,10.6 18,9.4', 1.3, '#ffffff', 0.6));
  return svg(W, H, haloDefs('hO', '#ff7a1a'), p.join(''));
}

// ---------------------------------------------------------------------------
// Shield shimmer — 200 × 200 white hex-mesh ring with alpha (tinted at runtime).
// ---------------------------------------------------------------------------
export function shieldRing() {
  const S = 200;
  const c = S / 2;
  const R = 96;
  // Hex grid (pointy-top) covering the sprite; masked to a soft annulus.
  const hr = 7.2;
  const hw = Math.sqrt(3) * hr;
  let mesh = '';
  for (let row = -1; row * hr * 1.5 < S + hr; row++) {
    const y = row * hr * 1.5;
    for (let col = -1; col * hw < S + hw; col++) {
      const x = col * hw + (row % 2 ? hw / 2 : 0);
      const pts = [];
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 6 + (k * Math.PI) / 3;
        pts.push(`${r2(x + Math.cos(a) * hr)},${r2(y + Math.sin(a) * hr)}`);
      }
      mesh += `M${pts.join('L')}Z`;
    }
  }
  const defs =
    rad('sF', 0.5, 0.5, 0.5, [[0, '#ffffff', 0], [0.6, '#ffffff', 0], [0.86, '#ffffff', 0.22], [0.95, '#ffffff', 0.5], [1, '#ffffff', 0]]) +
    rad('sM', 0.5, 0.5, 0.5, [[0, '#ffffff', 0], [0.55, '#ffffff', 0], [0.8, '#ffffff', 0.55], [0.94, '#ffffff', 1], [1, '#ffffff', 0]]) +
    `<mask id="sK" maskUnits="userSpaceOnUse" x="0" y="0" width="${S}" height="${S}"><circle cx="${c}" cy="${c}" r="${R + 3}" fill="url(#sM)"/></mask>`;
  const body =
    `<circle cx="${c}" cy="${c}" r="${R + 3}" fill="url(#sF)"/>` +
    `<path d="${mesh}" fill="none" stroke="#ffffff" stroke-width="1.1" stroke-linejoin="round" mask="url(#sK)" opacity="0.9"/>` +
    `<circle cx="${c}" cy="${c}" r="${R - 1.5}" fill="none" stroke="#ffffff" stroke-width="2.2" opacity="0.85"/>` +
    `<circle cx="${c}" cy="${c}" r="${R - 6}" fill="none" stroke="#ffffff" stroke-width="0.8" opacity="0.4"/>`;
  return svg(S, S, defs, body);
}
