// Movement tools: afterburner boost (loop, ignition, sputter) and the air brake.
import * as d from '../lib/dsp.mjs';
import { loadMono } from '../sources.mjs';

const { SR } = d;

/** Round a frequency so it completes an integer number of cycles in `loopSec` (seamless tones). */
const loopHz = (hz, loopSec) => Math.round(hz * loopSec) / loopSec;

/** Piecewise-linear envelope as a gain curve of `lengthSec`. */
const shape = (lengthSec, points) => d.envelope(d.zeros(d.secs(lengthSec)).fill(1), points);

export const boostLoop = {
  credits: [{ source: 'kc135Wind', use: 'Real jet air/wind noise layer' }],
  method:
    'Afterburner roar: circularly filtered stereo pink-noise roar with a low-mid bump, brown-noise rumble, ' +
    'turbulence amplitude flutter and sparse combustion crackle, a faint low howl, and a real jet wind ' +
    'recording crossfaded into the 2 s loop; every modulation completes whole cycles, so it is seamless.',
  build() {
    const rng = new d.Rng(701);
    const loopSec = 2;
    const n = d.secs(loopSec);
    const roarSrcL = d.pinkNoise(loopSec, rng);
    const roarSrcR = d.pinkNoise(loopSec, rng);
    const rumbleSrc = d.brownNoise(loopSec, rng);
    // Combustion crackle: sparse random impulses.
    const crackSrc = d.zeros(n);
    for (let i = 0; i < n; i++) if (rng.next() < 0.0012) crackSrc[i] = rng.range(-1, 1);
    const [roarL, roarR, rumble, crackle] = d.processPeriodic([roarSrcL, roarSrcR, rumbleSrc, crackSrc], ([a, b, c, k]) => [
      d.peakEq(d.highpass(d.lowpass(a, 1900), 60), 320, 6, 0.8),
      d.peakEq(d.highpass(d.lowpass(b, 1900), 60), 320, 6, 0.8),
      d.lowpass4(d.highpass(c, 30), 130),
      d.bandpass(k, 2600, 0.7),
    ]);
    // Turbulence: two incommensurate-sounding flutters, both whole cycles per loop.
    const f1 = loopHz(7, loopSec);
    const f2 = loopHz(11.5, loopSec);
    const flutter = (i) => 0.82 + 0.1 * Math.sin((2 * Math.PI * f1 * i) / SR) + 0.08 * Math.sin((2 * Math.PI * f2 * i) / SR + 1.3);
    const howl = d.mix(loopSec, [
      [d.osc(loopSec, loopHz(85, loopSec), 'sine'), 0, 0.06],
      [d.osc(loopSec, loopHz(170, loopSec), 'sine'), 0, 0.03],
    ]);
    const wind = loadMono('kc135Wind');
    const [windLoop] = d.loopCrossfade([d.highpass(wind, 300)], n, d.secs(0.5));
    const L = d.zeros(n);
    const R = d.zeros(n);
    for (let i = 0; i < n; i++) {
      const fl = flutter(i);
      const common = rumble[i] * 0.7 + howl[i] + crackle[i] * 0.5 + windLoop[i] * 0.3;
      L[i] = roarL[i] * 0.55 * fl + common;
      R[i] = roarR[i] * 0.55 * fl + common;
    }
    return [L, R];
  },
};

export const boostStart = {
  credits: [],
  method:
    'Original: afterburner light-off "whump": a falling sub boom, an ignition pop, and a noise burst whose ' +
    'low-pass opens from 400 Hz to 3.5 kHz, settling into a roar that hands over to the boost loop.',
  build() {
    const rng = new d.Rng(702);
    const len = 0.9;
    const whump = d.subBoom(len, 120, 42, 0.05, 0.16);
    const pop = d.applyEnv(d.bandpass(d.whiteNoise(0.03, rng), 1400, 0.8), d.adEnv(0.03, 0.0005, 0.006));
    const burst = d.applyEnv(
      d.filter(d.pinkNoise(len, rng), 'lowpass', (t) => 400 + 3100 * Math.min(1, t / 0.18), 0.9),
      shape(len, [[0, 0], [0.03, 1], [0.2, 0.7], [0.5, 0.35], [len, 0]]),
    );
    const out = d.mix(len, [
      [whump, 0, 0.95],
      [pop, 0.004, 0.6],
      [burst, 0, 0.8],
    ]);
    return [d.fadeOut(d.saturate(d.highpass(out, 28), 1.4), 0.15)];
  },
};

export const boostEmpty = {
  credits: [],
  method: 'Original: afterburner flame-out sputter: four fading low pops at uneven intervals over a falling whine.',
  build() {
    const rng = new d.Rng(703);
    const len = 0.65;
    const pop = (g) =>
      d.mix(0.12, [
        [d.applyEnv(d.lowpass(d.whiteNoise(0.12, rng), 900), d.adEnv(0.12, 0.002, 0.025)), 0, g],
        [d.subBoom(0.12, 95, 50, 0.03, 0.03), 0, g * 0.6],
      ]);
    const whine = d.applyEnv(
      d.lowpass(d.osc(len, (t) => 620 * Math.exp(-t / 0.3) + 140, 'saw'), 1600),
      shape(len, [[0, 0.8], [0.4, 0.3], [len, 0]]),
    );
    return [d.mix(len, [
      [pop(1), 0, 1],
      [pop(0.7), 0.085, 1],
      [pop(0.5), 0.2, 1],
      [pop(0.3), 0.36, 1],
      [whine, 0, 0.07],
    ])];
  },
};

export const airbrake = {
  credits: [],
  method:
    'Original: speed-brake deploy: a low actuator thunk, a pneumatic hiss, and an air-rush whoosh whose ' +
    'band-pass sweeps from 2.6 kHz down to 800 Hz.',
  build() {
    const rng = new d.Rng(704);
    const len = 0.6;
    const thunk = d.applyEnv(d.lowpass(d.whiteNoise(0.09, rng), 300), d.adEnv(0.09, 0.002, 0.02));
    const hiss = d.applyEnv(d.highpass(d.whiteNoise(0.3, rng), 4200), d.adEnv(0.3, 0.004, 0.07));
    const rush = d.applyEnv(
      d.filter(d.whiteNoise(len, rng), 'bandpass', (t) => 800 + 1800 * Math.exp(-t / 0.18), 0.8),
      shape(len, [[0, 0], [0.05, 1], [0.22, 0.75], [len, 0]]),
    );
    const [l, r] = d.reverb(
      d.mix(len, [
        [thunk, 0, 0.9],
        [hiss, 0.01, 0.25],
        [rush, 0.015, 0.75],
      ]),
      { room: 0.3, damp: 0.6, wet: 0.12, dry: 1, tailSec: 0.15 },
    );
    return [l, r];
  },
};
