// Skill rewards: SAM evaded, pickups, kill-chain blips.
import * as d from '../lib/dsp.mjs';
import { loadMono } from '../sources.mjs';

const { SR } = d;

/** Piecewise-linear envelope as a gain curve of `lengthSec`. */
const shape = (lengthSec, points) => d.envelope(d.zeros(d.secs(lengthSec)).fill(1), points);

/** A clean arcade blip: band-limited pulse softened by a low-pass, with click-free edges. */
function blip(lengthSec, hz, { type = 'square', lp = 5000, tau = 0.06 } = {}) {
  const b = d.applyEnv(d.lowpass(d.osc(lengthSec, hz, type), lp), d.adEnv(lengthSec, 0.002, tau));
  return d.fadeOut(b, 0.004);
}

export const samEvaded = {
  credits: [],
  method:
    'Original: a missile whooshing past (noise band falling 3.2 kHz → 700 Hz with a Doppler-falling motor ' +
    'tone, panned left → right) followed by a short positive C6 → G6 blip.',
  build() {
    const rng = new d.Rng(901);
    const len = 1.0;
    const passAt = 0.32;
    const doppler = (t) => 0.7 + 0.3 * (1 - Math.tanh((t - passAt) / 0.08));
    const whoosh = d.applyEnv(
      d.filter(d.whiteNoise(0.8, rng), 'bandpass', (t) => 700 + 2500 * (1 - Math.tanh((t - passAt) / 0.1)) / 2, 1.1),
      shape(0.8, [[0, 0], [passAt, 1], [0.75, 0]]),
    );
    const motor = d.applyEnv(
      d.lowpass(d.osc(0.8, (t) => 380 * doppler(t), 'saw'), 2500),
      shape(0.8, [[0, 0], [passAt, 1], [0.7, 0]]),
    );
    const pass = d.mix(0.8, [
      [whoosh, 0, 0.8],
      [motor, 0, 0.12],
    ]);
    // Pan left → right as it goes by (equal power, per sample).
    const L = d.zeros(d.secs(len));
    const R = d.zeros(d.secs(len));
    for (let i = 0; i < pass.length; i++) {
      const p = Math.tanh((i / SR - passAt) / 0.12) * 0.8;
      const a = ((p + 1) * Math.PI) / 4;
      L[i] += pass[i] * Math.cos(a) * Math.SQRT2;
      R[i] += pass[i] * Math.sin(a) * Math.SQRT2;
    }
    const ding = d.mix(0.3, [
      [blip(0.07, 1046.5, { type: 'tri', tau: 0.04 }), 0, 0.5],
      [blip(0.2, 1568, { type: 'tri', tau: 0.08 }), 0.07, 0.5],
    ]);
    d.mixInto(L, ding, d.secs(0.45), 0.6);
    d.mixInto(R, ding, d.secs(0.45), 0.6);
    return [L, R];
  },
};

export const pickupCollect = {
  credits: [{ source: 'kenneyUi:switch3.ogg', use: 'Mechanical latch click' }],
  method:
    'A real mechanical latch click (magazine-seat feel) under an original fast G5–C6–E6–G6 pulse-wave ' +
    'arpeggio with a ringing top note and a short room.',
  build() {
    const notes = [783.99, 1046.5, 1318.5, 1568];
    const step = 0.045;
    const dry = d.mix(0.6, [
      [d.resample(loadMono('kenneyUi:switch3.ogg'), 0.9), 0, 0.55],
      ...notes.map((hz, k) => [blip(k === notes.length - 1 ? 0.35 : 0.06, hz, { tau: k === notes.length - 1 ? 0.12 : 0.03 }), 0.01 + k * step, 0.32]),
    ]);
    const [l, r] = d.reverb(dry, { room: 0.4, damp: 0.5, wet: 0.14, dry: 1, tailSec: 0.25 });
    return [l, r];
  },
};

export const pickupSpawn = {
  credits: [],
  method: 'Original: tiny sparkle: three quick high sine pings (E7, A7, C8).',
  build() {
    const ping = (hz) => d.applyEnv(d.osc(0.2, hz, 'sine'), d.adEnv(0.2, 0.001, 0.04));
    return [d.mix(0.32, [
      [ping(2637), 0, 0.4],
      [ping(3520), 0.045, 0.35],
      [ping(4186), 0.09, 0.3],
    ])];
  },
};

export const comboUp = {
  credits: [],
  method: 'Original: short rising pulse-wave blip (880 → 1320 Hz); the game raises its pitch with the chain.',
  build() {
    const len = 0.13;
    const b = d.applyEnv(
      d.lowpass(d.osc(len, (t) => 880 + 440 * Math.min(1, t / 0.06), 'square', 0, 0.35), 4500),
      shape(len, [[0, 0], [0.004, 1], [0.07, 0.8], [len, 0]]),
    );
    return [b];
  },
};

export const comboEnd = {
  credits: [],
  method: 'Original: soft descending triangle blip (880 → 440 Hz) when the kill chain lapses.',
  build() {
    const len = 0.32;
    const b = d.applyEnv(
      d.lowpass(d.osc(len, (t) => 440 + 440 * Math.exp(-t / 0.09), 'tri'), 3000),
      shape(len, [[0, 0], [0.006, 1], [0.12, 0.6], [len, 0]]),
    );
    return [b];
  },
};
