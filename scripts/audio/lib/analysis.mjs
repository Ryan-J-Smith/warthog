// Loudness / quality measurements used by build.mjs (for normalisation) and analyze.mjs (reporting).
import { SR, filter, gainToDb } from './dsp.mjs';

/** K-weighting (ITU-R BS.1770 pre-filter + RLB high-pass), approximated with RBJ biquads. */
function kWeight(x) {
  return filter(filter(x, 'highshelf', 1681.97, 0.7072, 4.0), 'highpass', 38.135, 0.5003);
}

/**
 * Loudness figures in LUFS-ish units (BS.1770 K-weighting, no channel weights beyond 1.0).
 * - momentaryMax: loudest 400 ms window (good for one-shots)
 * - integrated: gated (-70 abs, -10 rel) mean (good for loops and music)
 * @param {Float32Array[]} chs
 */
export function loudness(chs) {
  const k = chs.map(kWeight);
  const n = k[0].length;
  const win = Math.round(0.4 * SR);
  const hop = Math.round(0.1 * SR);
  const blocks = [];
  if (n <= win) {
    let s = 0;
    for (const c of k) for (let i = 0; i < n; i++) s += c[i] * c[i];
    blocks.push(s / win); // pad short sounds with silence to a full 400 ms block
  } else {
    // prefix sums for speed
    const pre = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (const c of k) s += c[i] * c[i];
      pre[i + 1] = pre[i] + s;
    }
    for (let i = 0; i + win <= n; i += hop) blocks.push((pre[i + win] - pre[i]) / win);
  }
  const lufs = (ms) => -0.691 + 10 * Math.log10(ms + 1e-20);
  const momentaryMax = Math.max(...blocks.map(lufs));
  const abs = blocks.filter((b) => lufs(b) > -70);
  const meanAbs = abs.reduce((a, b) => a + b, 0) / Math.max(1, abs.length);
  const rel = abs.filter((b) => lufs(b) > lufs(meanAbs) - 10);
  const integrated = rel.length ? lufs(rel.reduce((a, b) => a + b, 0) / rel.length) : -Infinity;
  return { momentaryMax, integrated };
}

/**
 * Full quality report for a decoded sound.
 * @param {Float32Array[]} chs
 */
export function analyse(chs) {
  const n = chs[0].length;
  let pk = 0;
  let clipped = 0;
  let sumSq = 0;
  for (const c of chs) {
    for (let i = 0; i < n; i++) {
      const a = Math.abs(c[i]);
      if (a > pk) pk = a;
      if (a >= 0.999) clipped++;
      sumSq += c[i] * c[i];
    }
  }
  const rmsDb = gainToDb(Math.sqrt(sumSq / Math.max(1, n * chs.length)));
  // Leading silence: first sample above -50 dBFS.
  let lead = n;
  for (const c of chs) {
    for (let i = 0; i < n; i++) {
      if (Math.abs(c[i]) > 0.00316) {
        lead = Math.min(lead, i);
        break;
      }
    }
  }
  // Loop seam: jump from last sample to first compared with typical sample-to-sample steps.
  let seamRatio = 0;
  let seamLevelDiffDb = 0;
  if (n > 2000) {
    for (const c of chs) {
      const diffs = [];
      for (let i = 1; i < n; i += 7) diffs.push(Math.abs(c[i] - c[i - 1]));
      diffs.sort((a, b) => a - b);
      const p99 = diffs[Math.floor(diffs.length * 0.99)] || 1e-9;
      seamRatio = Math.max(seamRatio, Math.abs(c[0] - c[n - 1]) / p99);
      const w = Math.round(0.02 * SR);
      const r = (a, b) => {
        let s = 0;
        for (let i = a; i < b; i++) s += c[i] * c[i];
        return Math.sqrt(s / (b - a));
      };
      seamLevelDiffDb = Math.max(seamLevelDiffDb, Math.abs(gainToDb(r(n - w, n)) - gainToDb(r(0, w))));
    }
  }
  return {
    durationSec: n / SR,
    channels: chs.length,
    peakDb: gainToDb(pk),
    rmsDb,
    clipped,
    leadingSilenceMs: (lead / SR) * 1000,
    seamRatio,
    seamLevelDiffDb,
    ...loudness(chs),
  };
}
