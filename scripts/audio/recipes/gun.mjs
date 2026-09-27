// GAU-8 Avenger: the BRRRT. Built from real GAU-8 round transients (public-domain A-10 footage)
// re-sequenced on an exact 65 rounds/s grid, layered with a synthesized pulse train for weight.
import * as d from '../lib/dsp.mjs';
import { loadMono } from '../sources.mjs';

const { SR } = d;
export const FIRE_RATE = 65; // rounds per second (GAU-8: ~3900 rpm)
const LOOP_ROUNDS = 130; // 2.0 s loop
const LOOP_LEN = Math.round((LOOP_ROUNDS / FIRE_RATE) * SR); // 88200 samples

/** Extract individual round transients from the real A-10 burst (79.2–80.6 s, ~64 Hz fire rate). */
function extractGrains() {
  const t0 = 79.2;
  const burst = loadMono('a10', { start: t0, duration: 1.4 });
  const hp = d.highpass4(burst, 250);
  const env = d.lowpass(hp.map(Math.abs), 350);
  const minGap = Math.round(SR / 90);
  const onsets = [];
  // Local maxima of the envelope, at least minGap apart, above the local mean.
  const win = Math.round(SR * 0.03);
  for (let i = win; i < env.length - win; i++) {
    let isMax = true;
    for (let j = i - minGap / 2; j <= i + minGap / 2; j++) {
      if (env[j] > env[i]) {
        isMax = false;
        break;
      }
    }
    if (!isMax) continue;
    let mean = 0;
    for (let j = i - win; j < i + win; j++) mean += env[j];
    mean /= 2 * win;
    if (env[i] > mean * 1.25 && (onsets.length === 0 || i - onsets[onsets.length - 1] >= minGap)) onsets.push(i);
  }
  // Align every grain on its real attack (first rise of the >1 kHz envelope before its peak),
  // so the re-sequenced rounds land exactly on the fire-rate grid.
  const hf = d.lowpass(d.highpass4(burst, 1000).map(Math.abs), 2000);
  const len = Math.round(SR / FIRE_RATE) + Math.round(SR * 0.004);
  const grains = [];
  for (const o of onsets) {
    const a0 = o - Math.round(SR * 0.012);
    const a1 = o + Math.round(SR * 0.004);
    if (a0 < 0 || a1 + len >= burst.length) continue;
    let pk = a0;
    for (let i = a0; i < a1; i++) if (hf[i] > hf[pk]) pk = i;
    let attack = pk;
    while (attack > a0 && hf[attack] > hf[pk] * 0.2) attack--;
    const s0 = attack - Math.round(SR * 0.001);
    let g = burst.slice(s0, s0 + len);
    g = d.fadeIn(g, 0.0008);
    // Decay each round so neighbouring rounds stay distinct (the BRRRT is a pulse train, not a hiss).
    g = d.applyEnv(g, d.adEnv(len / SR, 0.001, 0.0075));
    g = d.fadeOut(g, 0.004);
    const r = d.rms(g);
    if (r > 1e-4) grains.push(d.scale(g, 0.25 / r));
  }
  if (grains.length < 20) throw new Error(`gun: only ${grains.length} grains extracted`);
  return grains;
}

/** One synthesized round: sub thump + body + supersonic crack. */
function synthRound(rng) {
  const len = 0.03;
  const f0 = rng.range(125, 150);
  const thump = d.applyEnv(
    d.osc(len, (t) => 52 + (f0 - 52) * Math.exp(-t / 0.004), 'sine'),
    d.adEnv(len, 0.0004, 0.006),
  );
  const body = d.applyEnv(d.bandpass(d.whiteNoise(len, rng), rng.range(380, 720), 1.1), d.adEnv(len, 0.0003, 0.005));
  const crack = d.applyEnv(d.lowpass(d.highpass(d.whiteNoise(len, rng), 1800), 7000), d.adEnv(len, 0.0001, 0.0012));
  return d.mix(len, [
    [thump, 0, 0.42 * rng.range(0.85, 1.1)],
    [body, 0, 0.8 * rng.range(0.8, 1.2)],
    [crack, 0, 0.55 * rng.range(0.7, 1.3)],
  ]);
}

/** Lay `count` rounds on the 65 Hz grid into a buffer; wrap=true for circular (loop) placement. */
function layRounds(n, count, rng, grains, { wrap, gainFn = () => 1, rateFn = () => FIRE_RATE }) {
  const real = d.zeros(n);
  const synth = d.zeros(n);
  let t = 0;
  for (let k = 0; k < count; k++) {
    const pos = wrap ? Math.round((k * n) / count) : Math.round(t * SR);
    const g = gainFn(k);
    const grain = grains[(k * 7 + rng.int(0, grains.length - 1)) % grains.length];
    const place = wrap ? d.mixIntoWrap : d.mixInto;
    place(real, grain, pos, g * rng.range(0.85, 1.1));
    place(synth, synthRound(rng), pos, g);
    t += 1 / rateFn(k);
  }
  return { real, synth };
}

/** Continuous tearing noise bed, amplitude-modulated by the fire rate (circular for loops). */
function tearingBed(n, rng) {
  const noise = d.bandpass(d.pinkNoise(n / SR, rng), 900, 0.5);
  const out = new Float32Array(n);
  const period = n / LOOP_ROUNDS;
  for (let i = 0; i < n; i++) {
    const ph = (i % period) / period;
    out[i] = noise[i] * (0.12 + 0.88 * Math.exp(-ph * 7));
  }
  return out;
}

/** Shared tone shaping: tearing saturation + weight + presence. */
function voice(sig) {
  let s = d.highpass4(sig, 45);
  s = d.saturateAsym(s, 2.6, 0.25);
  s = d.highpass(s, 40);
  s = d.lowShelf(s, 85, 1.5);
  s = d.peakEq(s, 130, 4, 1.2);
  s = d.peakEq(s, 2600, 4, 0.8);
  s = d.lowpass(s, 11000, 0.6);
  return s;
}

function dryLoop(rng, grains) {
  const { real, synth } = layRounds(LOOP_LEN, LOOP_ROUNDS, rng, grains, { wrap: true });
  const bed = tearingBed(LOOP_LEN, rng);
  const sum = d.zeros(LOOP_LEN);
  d.mixInto(sum, real, 0, 1.0);
  d.mixInto(sum, synth, 0, 0.8);
  d.mixInto(sum, bed, 0, 0.35);
  return sum;
}

export const gunLoop = {
  credits: [{ source: 'a10', use: 'Real GAU-8 round transients cut from the burst at 1:19' }],
  method:
    'Round transients extracted from the real A-10 burst and re-sequenced on an exact 65 rounds/s grid (2 s, 130 rounds), ' +
    'layered with synthesized per-round sub thump/body/crack and a rate-modulated noise bed, asymmetric saturation, EQ, ' +
    'short stereo room; processed circularly for a sample-seamless loop.',
  build() {
    const rng = new d.Rng(65);
    const grains = extractGrains();
    const dry = dryLoop(rng, grains);
    // All filtering/saturation/reverb runs periodically so the loop seam is sample-continuous.
    const out = d.processPeriodic([dry], ([x]) => {
      const v = voice(x);
      const [l, r] = d.reverb(v, { room: 0.3, damp: 0.5, wet: 0.1, dry: 1, width: 1, tailSec: 0 });
      return [l, r];
    });
    return out;
  },
};

export const gunTail = {
  credits: [{ source: 'a10', use: 'Real GAU-8 round transients cut from the burst at 1:19' }],
  method:
    'Spin-down of the last 4 rounds (real transients + synthesized layer), a decorrelated stereo room ring-out, ' +
    'two delayed low-passed terrain echoes of the burst and a decaying low rumble.',
  build() {
    const rng = new d.Rng(66);
    const grains = extractGrains();
    const len = 2.4;
    const n = d.secs(len);
    // Last few rounds as the barrels spin down.
    const rounds = layRounds(n, 4, rng, grains, {
      wrap: false,
      gainFn: (k) => [0.9, 0.55, 0.3, 0.15][k],
      rateFn: (k) => FIRE_RATE - k * 6,
    });
    const lastRounds = voice(d.add(d.scale(rounds.real, 0.8), d.scale(rounds.synth, 0.9)));
    // Room ring-out after release: decorrelated decaying noise shaped like the gun's spectrum
    // (an algorithmic reverb fed a 65 Hz periodic signal rings at comb modes, which whistles).
    const ring = (seed) => {
      const r = new d.Rng(seed);
      let x = d.bandpass(d.pinkNoise(len, r), 450, 0.45);
      x = d.lowShelf(x, 120, 6);
      return d.applyEnv(x, d.adEnv(len, 0.01, 0.32));
    };
    const ringL = ring(101);
    const ringR = ring(202);
    // Distant terrain echo of the BRRRT: delayed, darker, rolling off.
    const echoSrc = d.lowpass4(d.fit(voice(dryLoop(new d.Rng(68), grains)), d.secs(0.7)), 1400);
    const echo1 = d.envelope(echoSrc, [[0, 0], [0.05, 1], [0.4, 0.5], [0.7, 0]]);
    const echo2 = d.lowpass(d.envelope(echoSrc, [[0, 0], [0.05, 0.6], [0.35, 0.25], [0.7, 0]]), 700);
    // Low rumble that decays after the trigger is released.
    const rumble = d.applyEnv(d.bandpass(d.lowpass4(d.brownNoise(len, rng), 140), 75, 0.7), d.adEnv(len, 0.03, 0.45));
    const L = d.zeros(n);
    const R = d.zeros(n);
    for (const [sig, at, gl, gr] of [
      [lastRounds, 0, 1, 1],
      [ringL, 0.02, 0.55, 0],
      [ringR, 0.02, 0, 0.55],
      [echo1, 0.28, 0.35, 0.22],
      [echo2, 0.62, 0.14, 0.22],
      [rumble, 0, 1.6, 1.6],
    ]) {
      d.mixInto(L, sig, d.secs(at), gl);
      d.mixInto(R, sig, d.secs(at), gr);
    }
    return [L, R];
  },
};

/** Explosive 30 mm rounds hitting dirt: a short crackle; the director retriggers it every ~100 ms. */
export const gunImpacts = {
  credits: [{ source: 'grenade', use: 'Transient of a real grenade blast, pitched up as one layer of the pops' }],
  method:
    'Nine small explosive pops (synthesized crack + thud, alternating with a pitched-up real grenade transient) ' +
    'scattered over 110 ms, plus granular dirt/fragment patter; saturated and EQ\'d.',
  build() {
    const rng = new d.Rng(69);
    const len = 0.5;
    const n = d.secs(len);
    const out = d.zeros(n);
    const grenade = d.fit(loadMono('grenade'), d.secs(0.12));
    const grenadePop = d.applyEnv(d.resample(grenade, 1.9), d.adEnv(0.07, 0.0005, 0.012));
    for (let k = 0; k < 9; k++) {
      const at = rng.range(0, 0.11) + (k === 0 ? 0 : 0.004);
      const pl = 0.05;
      const crackPop = d.applyEnv(d.bandpass(d.whiteNoise(pl, rng), rng.range(1100, 2600), 0.9), d.adEnv(pl, 0.0002, 0.005));
      const thud = d.applyEnv(d.osc(pl, (t) => 70 + 90 * Math.exp(-t / 0.008)), d.adEnv(pl, 0.0005, 0.012));
      const g = rng.range(0.55, 1);
      d.mixInto(out, crackPop, d.secs(at), 0.9 * g);
      d.mixInto(out, thud, d.secs(at), 0.6 * g);
      if (k % 2 === 0) d.mixInto(out, d.resample(grenadePop, rng.range(0.85, 1.2)), d.secs(at), 0.7 * g);
    }
    // Dirt and fragments pattering down.
    const grit = d.highpass(d.whiteNoise(len, rng), 1500);
    for (let i = 0; i < n; i++) grit[i] *= rng.next() < 0.02 ? rng.range(0.4, 1) : 0.06;
    const debris = d.applyEnv(d.lowpass(grit, 6000), d.adEnv(len, 0.03, 0.12));
    d.mixInto(out, debris, d.secs(0.02), 0.5);
    let s = d.saturate(out, 1.8);
    s = d.lowShelf(s, 120, 3);
    s = d.lowpass(s, 7500);
    return [s];
  },
};
