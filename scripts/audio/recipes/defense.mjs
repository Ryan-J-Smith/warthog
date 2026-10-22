// Energy weapons and the player's shield: AA laser charge + beam, shield hit/down/regen/full.
import * as d from '../lib/dsp.mjs';
import { loadMono } from '../sources.mjs';

const { SR } = d;

/** Round a frequency so it completes an integer number of cycles in `loopSec` (seamless tones). */
const loopHz = (hz, loopSec) => Math.round(hz * loopSec) / loopSec;

/** Piecewise-linear envelope as a gain curve of `lengthSec`. */
const shape = (lengthSec, points) => d.envelope(d.zeros(d.secs(lengthSec)).fill(1), points);

/** AA telegraph timing (src/config/entities.ts: aimTime 1.0 s, of which the last lockTime 0.35 s holds). */
const AIM_SEC = 1.0;
const LOCK_SEC = 0.35;

export const aaCharge = {
  credits: [],
  method:
    'Original: laser charge-up for the AA telegraph: a sine+saw whine sweeping 260 Hz → 2.2 kHz with ' +
    'growing vibrato over the tracking phase, then a fast 22 Hz pulse at the top pitch for the final ' +
    '0.35 s lock (the dodge window), with a sub-octave body and a noise shimmer.',
  build() {
    const rng = new d.Rng(801);
    const len = AIM_SEC;
    const rise = AIM_SEC - LOCK_SEC;
    const f0 = 260;
    const f1 = 2200;
    const pitch = (t) => {
      const p = Math.min(1, t / rise);
      const base = f0 * Math.pow(f1 / f0, p * p * (3 - 2 * p) * 0.6 + p * 0.4);
      return base * (1 + 0.012 * p * Math.sin(2 * Math.PI * 9 * t));
    };
    const whine = d.mix(len, [
      [d.osc(len, pitch, 'sine'), 0, 0.6],
      [d.lowpass(d.osc(len, pitch, 'saw'), 5000), 0, 0.18],
      [d.osc(len, (t) => pitch(t) / 2, 'sine'), 0, 0.25],
    ]);
    const shimmer = d.filter(d.whiteNoise(len, rng), 'bandpass', (t) => pitch(t) * 2, 2);
    // Lock: amplitude chops at 22 Hz once the line stops tracking.
    const gate = new Float32Array(d.secs(len));
    for (let i = 0; i < gate.length; i++) {
      const t = i / SR;
      gate[i] = t < rise ? 1 : 0.55 + 0.45 * Math.tanh(4 * Math.sin(2 * Math.PI * 22 * (t - rise)));
    }
    const env = shape(len, [[0, 0], [0.04, 0.35], [rise, 0.85], [len - 0.03, 1], [len, 0]]);
    const out = d.applyEnv(d.multiply(d.add(whine, d.scale(shimmer, 0.12)), gate), env);
    return [out];
  },
};

export const aaBeamLoop = {
  credits: [],
  method:
    'Original: sizzling laser-beam hum: a 120 Hz saw drone with a fifth and octave, a 1.76 kHz whine with ' +
    'gentle vibrato, band-passed stereo noise sizzle chopped by three flutters, sparse crackle and an 8 Hz ' +
    'throb; every tone and modulation completes whole cycles and noise is filtered circularly (1 s loop).',
  build() {
    const rng = new d.Rng(802);
    const loopSec = 1;
    const n = d.secs(loopSec);
    const drone = d.mix(loopSec, [
      [d.osc(loopSec, loopHz(120, loopSec), 'saw'), 0, 0.5],
      [d.osc(loopSec, loopHz(180, loopSec), 'saw'), 0, 0.15],
      [d.osc(loopSec, loopHz(240, loopSec), 'sine'), 0, 0.2],
    ]);
    // Vibrato term integrates to zero over the loop, so the carrier still ends on a whole cycle.
    const vib = loopHz(5, loopSec);
    const whine = d.osc(loopSec, (t) => 1760 + 18 * Math.sin(2 * Math.PI * vib * t), 'sine');
    const sizzleL = d.whiteNoise(loopSec, rng);
    const sizzleR = d.whiteNoise(loopSec, rng);
    const crackSrc = d.zeros(n);
    for (let i = 0; i < n; i++) if (rng.next() < 0.002) crackSrc[i] = rng.range(-1, 1);
    const [droneF, szL, szR, crack] = d.processPeriodic([drone, sizzleL, sizzleR, crackSrc], ([a, b, c, k]) => [
      d.lowpass(a, 1500),
      d.bandpass(b, 4800, 0.7),
      d.bandpass(c, 5200, 0.7),
      d.bandpass(k, 3500, 1),
    ]);
    const m1 = loopHz(13, loopSec);
    const m2 = loopHz(23, loopSec);
    const m3 = loopHz(37, loopSec);
    const throb = loopHz(8, loopSec);
    const L = d.zeros(n);
    const R = d.zeros(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const chop = 0.55 + 0.2 * Math.sin(2 * Math.PI * m1 * t) + 0.15 * Math.sin(2 * Math.PI * m2 * t + 0.7) + 0.1 * Math.sin(2 * Math.PI * m3 * t + 2.1);
      const th = 0.85 + 0.15 * Math.sin(2 * Math.PI * throb * t);
      const common = (droneF[i] * 0.55 + whine[i] * 0.08 + crack[i] * 0.6) * th;
      L[i] = common + szL[i] * 0.5 * chop;
      R[i] = common + szR[i] * 0.5 * chop;
    }
    return [L, R];
  },
};

export const shieldHit = {
  credits: [],
  method:
    'Original: energy-shield crackle: a cluster of band-passed noise sparks, a falling square-wave zap and a ' +
    'soft 180 Hz thump (short, so it can repeat rate-limited while a beam is on the shield).',
  build() {
    const rng = new d.Rng(803);
    const len = 0.2;
    const out = d.zeros(d.secs(len));
    for (let k = 0; k < 6; k++) {
      const spark = d.applyEnv(d.bandpass(d.whiteNoise(0.03, rng), rng.range(3000, 6500), 1.5), d.adEnv(0.03, 0.0003, 0.006));
      d.mixInto(out, spark, d.secs(rng.range(0, 0.08)), rng.range(0.5, 1));
    }
    const zap = d.applyEnv(d.lowpass(d.osc(0.12, (t) => 1500 * Math.exp(-t / 0.04) + 450, 'square'), 6000), d.adEnv(0.12, 0.001, 0.03));
    const thump = d.applyEnv(d.osc(0.1, 180, 'sine'), d.adEnv(0.1, 0.001, 0.025));
    d.mixInto(out, zap, 0, 0.25);
    d.mixInto(out, thump, 0, 0.5);
    return [out];
  },
};

export const shieldDown = {
  credits: [
    { source: 'kenneyImpact:impactGlass_heavy_000.ogg', use: 'Shatter' },
    { source: 'kenneyImpact:impactGlass_medium_002.ogg', use: 'Shatter tail' },
  ],
  method:
    'Two real glass impacts (one pitched down) as the shield shattering, over a synthesized power-down: a ' +
    'saw falling 900 → 55 Hz through a closing low-pass, a sub thump and an electric crackle; short room.',
  build() {
    const rng = new d.Rng(804);
    const len = 1.2;
    const glassA = d.resample(loadMono('kenneyImpact:impactGlass_heavy_000.ogg'), 0.85);
    const glassB = d.resample(loadMono('kenneyImpact:impactGlass_medium_002.ogg'), 1.05);
    const fall = (t) => 55 + 845 * Math.exp(-t / 0.22);
    const powerDown = d.applyEnv(
      d.filter(d.osc(len, fall, 'saw'), 'lowpass', (t) => 300 + 3700 * Math.exp(-t / 0.3), 0.9),
      shape(len, [[0, 0], [0.01, 1], [0.5, 0.5], [len, 0]]),
    );
    const crackle = d.applyEnv(d.bandpass(d.whiteNoise(0.3, rng), 4000, 0.8), d.adEnv(0.3, 0.001, 0.06));
    const dry = d.mix(len, [
      [glassA, 0, 0.9],
      [glassB, 0.03, 0.6],
      [powerDown, 0, 0.3],
      [d.subBoom(0.5, 110, 45, 0.05, 0.12), 0, 0.6],
      [crackle, 0, 0.25],
    ]);
    const [l, r] = d.reverb(dry, { room: 0.45, damp: 0.5, wet: 0.16, dry: 1, tailSec: 0.3 });
    return [d.fadeOut(l, 0.3), d.fadeOut(r, 0.3)];
  },
};

export const shieldRegen = {
  credits: [],
  method: 'Original: soft rising hum as the shield starts recharging: a sine chord gliding up an octave with a quickening tremolo.',
  build() {
    const len = 0.9;
    const glide = (t) => 220 * Math.pow(2, Math.min(1, t / 0.8));
    const chord = d.mix(len, [
      [d.osc(len, glide, 'sine'), 0, 0.5],
      [d.osc(len, (t) => glide(t) * 1.5, 'sine'), 0, 0.2],
      [d.osc(len, (t) => glide(t) * 2, 'tri'), 0, 0.12],
    ]);
    const trem = new Float32Array(d.secs(len));
    let ph = 0;
    for (let i = 0; i < trem.length; i++) {
      const t = i / SR;
      ph += (8 + 10 * (t / len)) / SR;
      trem[i] = 0.75 + 0.25 * Math.sin(2 * Math.PI * ph);
    }
    const env = shape(len, [[0, 0], [0.35, 0.8], [0.7, 1], [len, 0]]);
    return [d.applyEnv(d.lowpass(d.multiply(chord, trem), 3000), env)];
  },
};

export const shieldFull = {
  credits: [],
  method: 'Original: subtle shield-charged chime: a soft E6 + B6 bell dyad with a short shimmer and room.',
  build() {
    const len = 0.7;
    const bell = (hz) =>
      d.applyEnv(
        d.additive(len, hz, [
          [1, 0.6, 0.22],
          [2.0, 0.15, 0.12],
          [2.76, 0.08, 0.06],
        ]),
        d.adEnv(len, 0.004, 0.3),
      );
    const dry = d.mix(len, [
      [bell(1318.5), 0, 0.45],
      [bell(1975.5), 0.06, 0.35],
    ]);
    const [l, r] = d.reverb(dry, { room: 0.5, damp: 0.4, wet: 0.2, dry: 1, tailSec: 0.3 });
    return [l, r];
  },
};
