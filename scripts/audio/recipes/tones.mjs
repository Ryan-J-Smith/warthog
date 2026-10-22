// Avionics tones, radio squelch and objective / zone stings (all original, synthesized).
import * as d from '../lib/dsp.mjs';

const { SR } = d;

/** A clean avionics beep: band-limited square softened by a low-pass, with click-free edges. */
function beep(lengthSec, hz, { type = 'square', lp = 4500, fade = 0.004 } = {}) {
  const b = d.lowpass(d.osc(lengthSec, hz, type), lp);
  return d.fadeOut(d.fadeIn(b, fade), fade);
}

export const lockTone = {
  credits: [],
  method: 'Original: two short 1.76 kHz band-limited square beeps (Maverick lock acquired).',
  build() {
    return [d.mix(0.24, [
      [beep(0.07, 1760), 0, 0.5],
      [beep(0.07, 1760), 0.115, 0.5],
    ])];
  },
};

export const rwrLock = {
  credits: [],
  method: 'Original: 120 ms 1.05 kHz radar-warning tone with a 60 Hz PRF rasp (repeated by code, faster as lock builds).',
  build() {
    const len = 0.12;
    const t = beep(len, 1050, { type: 'saw', lp: 3500, fade: 0.005 });
    const prf = d.osc(len, 60, 'square').map((v) => 0.8 + 0.2 * v);
    return [d.multiply(t, prf)];
  },
};

export const rwrLaunch = {
  credits: [],
  method:
    'Original: urgent MISSILE LAUNCH warble alternating 1.15/1.65 kHz at 10 Hz; the 0.5 s loop holds exactly ' +
    'five warble cycles and a whole number of carrier cycles, so it repeats without a seam.',
  build() {
    const loopSec = 0.5;
    const n = d.secs(loopSec);
    const warble = (t) => {
      // Smoothed square between the two pitches.
      const s = Math.tanh(6 * Math.sin(2 * Math.PI * 10 * t));
      return 1400 + 250 * s;
    };
    // Scale the frequency so the carrier phase completes a whole number of cycles over the loop.
    let cycles = 0;
    for (let i = 0; i < n; i++) cycles += warble(i / SR) / SR;
    const k = Math.round(cycles) / cycles;
    const tone = d.osc(loopSec, (t) => warble(t) * k, 'square');
    const [out] = d.processPeriodic([tone], ([x]) => [d.lowpass(x, 5000)]);
    return [d.scale(out, 0.6)];
  },
};

export const lowHealth = {
  credits: [],
  method: 'Original: master-caution style two-tone beep (1 kHz then 780 Hz).',
  build() {
    return [d.mix(0.3, [
      [beep(0.1, 1000, { type: 'tri', lp: 3000 }), 0, 0.9],
      [beep(0.12, 780, { type: 'tri', lp: 3000 }), 0.13, 0.9],
    ])];
  },
};

/** Radio-band shaping: 300 Hz–3.2 kHz, a little crushed. */
const radioBand = (x) => d.crush(d.lowpass(d.highpass(x, 350), 3200), 7, 2);

export const radioIn = {
  credits: [],
  method: 'Original: push-to-talk click plus a short band-limited squelch burst.',
  build() {
    const rng = new d.Rng(501);
    const click = d.applyEnv(d.whiteNoise(0.006, rng), d.adEnv(0.006, 0.0002, 0.0008));
    const burst = d.applyEnv(d.bandpass(d.whiteNoise(0.13, rng), 1600, 0.6), d.envelope(d.zeros(d.secs(0.13)).fill(1), [[0, 0], [0.004, 1], [0.05, 0.7], [0.13, 0]]));
    const chirp = d.applyEnv(d.osc(0.05, (t) => 1800 + 6000 * t, 'sine'), d.adEnv(0.05, 0.002, 0.015));
    return [radioBand(d.mix(0.16, [
      [click, 0, 0.9],
      [burst, 0.004, 0.5],
      [chirp, 0.006, 0.15],
    ]))];
  },
};

export const radioOut = {
  credits: [],
  method: 'Original: squelch tail (noise burst with falling band) and a key-release click.',
  build() {
    const rng = new d.Rng(502);
    const len = 0.32;
    const tail = d.applyEnv(
      d.filter(d.whiteNoise(len, rng), 'bandpass', (t) => 2200 - 2600 * t, 0.7),
      d.envelope(d.zeros(d.secs(len)).fill(1), [[0, 0], [0.01, 1], [0.2, 0.6], [0.3, 0]]),
    );
    const click = d.applyEnv(d.whiteNoise(0.006, rng), d.adEnv(0.006, 0.0002, 0.0008));
    return [radioBand(d.mix(len + 0.01, [
      [tail, 0, 0.55],
      [click, len - 0.01, 0.8],
    ]))];
  },
};

/** Bell-like chime note. */
const chime = (hz, len = 0.9) =>
  d.applyEnv(
    d.additive(len, hz, [
      [1, 0.6, 0.35],
      [2.01, 0.25, 0.2],
      [3.0, 0.12, 0.12],
      [4.17, 0.06, 0.08],
    ]),
    d.adEnv(len, 0.002, 0.5),
  );

export const rearmComplete = {
  credits: [],
  method: 'Original: rising two-note chime (E6 → A6) with bell partials and a short room.',
  build() {
    const dry = d.mix(1.1, [
      [chime(1318.5), 0, 0.5],
      [chime(1760), 0.12, 0.55],
    ]);
    const [l] = d.reverb(dry, { room: 0.5, damp: 0.4, wet: 0.2, dry: 1, tailSec: 0.4 });
    return [l];
  },
};

/** Brass-like synth voice: detuned saws through an enveloped low-pass. */
function brass(lengthSec, hz, { attack = 0.03, bright = 3200, rng }) {
  const det = [0.996, 1, 1.004].map((m) => d.osc(lengthSec, hz * m, 'saw', rng.next()));
  const sum = d.mix(lengthSec, det.map((s) => [s, 0, 0.33]));
  const f = (t) => 500 + (bright - 500) * Math.min(1, t / attack) * Math.exp(-Math.max(0, t - attack) * 1.2);
  const filtered = d.filter(sum, 'lowpass', f, 0.9);
  const env = d.envelope(d.zeros(d.secs(lengthSec)).fill(1), [[0, 0], [attack, 1], [attack + 0.15, 0.8], [lengthSec - 0.25, 0.7], [lengthSec, 0]]);
  return d.applyEnv(filtered, env);
}

export const objectiveComplete = {
  credits: [],
  method: 'Original: brass-style synth fanfare (G4–C5–E5 → C major chord) over a timpani-like hit, with reverb.',
  build() {
    const rng = new d.Rng(503);
    const len = 1.8;
    const timp = d.applyEnv(d.osc(len, (t) => 98 * (1 + 0.15 * Math.exp(-t / 0.03))), d.adEnv(len, 0.003, 0.35));
    const dry = d.mix(len, [
      [timp, 0, 0.7],
      [brass(0.22, 392, { rng }), 0, 0.35],
      [brass(0.22, 523.25, { rng }), 0.1, 0.35],
      [brass(1.35, 659.25, { rng }), 0.2, 0.3],
      [brass(1.35, 523.25, { rng }), 0.2, 0.3],
      [brass(1.35, 392, { rng }), 0.2, 0.3],
      [brass(1.35, 261.63, { rng, bright: 2000 }), 0.2, 0.3],
    ]);
    const [l] = d.reverb(dry, { room: 0.7, damp: 0.4, wet: 0.28, dry: 1, tailSec: 0.8 });
    return [l];
  },
};

export const objectiveFailed = {
  credits: [],
  method: 'Original: descending dark brass-style synth figure resolving to a low C minor chord over a low boom.',
  build() {
    const rng = new d.Rng(504);
    const len = 2.2;
    const opts = { rng, bright: 1600, attack: 0.05 };
    const dry = d.mix(len, [
      [d.subBoom(len, 70, 38, 0.08, 0.5), 0, 0.7],
      [brass(0.3, 311.13, opts), 0, 0.35],
      [brass(0.3, 293.66, opts), 0.18, 0.35],
      [brass(1.6, 261.63, opts), 0.36, 0.3],
      [brass(1.6, 196, opts), 0.36, 0.3],
      [brass(1.6, 155.56, opts), 0.36, 0.3],
      [brass(1.6, 130.81, opts), 0.36, 0.3],
    ]);
    const [l] = d.reverb(dry, { room: 0.75, damp: 0.5, wet: 0.3, dry: 1, tailSec: 0.9 });
    return [l];
  },
};

export const zoneCleared = {
  credits: [],
  method:
    'Original: punchy defence-zone-cleared sting (shorter than objectiveComplete): a timpani-like hit and ' +
    'noise snap under a quick brass-style G4 pickup into a C major chord, with reverb.',
  build() {
    const rng = new d.Rng(505);
    const len = 1.1;
    const timp = d.applyEnv(d.osc(len, (t) => 110 * (1 + 0.18 * Math.exp(-t / 0.025))), d.adEnv(len, 0.002, 0.22));
    const snap = d.applyEnv(d.bandpass(d.whiteNoise(0.12, rng), 2200, 0.7), d.adEnv(0.12, 0.001, 0.03));
    const opts = { rng, attack: 0.015, bright: 3600 };
    const dry = d.mix(len, [
      [timp, 0.08, 0.7],
      [snap, 0.08, 0.35],
      [brass(0.1, 392, opts), 0, 0.35],
      [brass(0.75, 659.25, opts), 0.08, 0.3],
      [brass(0.75, 523.25, opts), 0.08, 0.3],
      [brass(0.75, 392, opts), 0.08, 0.3],
      [brass(0.75, 261.63, { ...opts, bright: 2200 }), 0.08, 0.3],
    ]);
    const [l] = d.reverb(dry, { room: 0.6, damp: 0.4, wet: 0.24, dry: 1, tailSec: 0.5 });
    return [l];
  },
};
