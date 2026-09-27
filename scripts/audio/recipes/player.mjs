// The player's aircraft: TF34 engine loop, armour hits, and ground crew rearming.
import * as d from '../lib/dsp.mjs';
import { loadMono } from '../sources.mjs';

const { SR } = d;

/** Round a frequency so it completes an integer number of cycles in `loopSec` (seamless tones). */
const loopHz = (hz, loopSec) => Math.round(hz * loopSec) / loopSec;

export const engineLoop = {
  credits: [{ source: 'kc135Wind', use: 'Real jet air/wind noise layer' }],
  method:
    'TF34 turbofan: synthesized fan blade-pass whine (2.4 kHz + harmonics), buzz-saw side tones, compressor ' +
    'whistle and roar, layered with a real jet wind-noise recording; every tone completes whole cycles in the ' +
    '4 s loop and noise is filtered circularly, so the loop is seamless and pitch-shiftable.',
  build() {
    const rng = new d.Rng(401);
    const loopSec = 4;
    const n = d.secs(loopSec);
    const tone = (hz, amp, wobble = 0) => {
      const f = loopHz(hz, loopSec);
      const w = loopHz(0.5, loopSec);
      return d.scale(d.osc(loopSec, (t) => f * (1 + wobble * Math.sin(2 * Math.PI * w * t))), amp);
    };
    // Whine: fan blade-pass, its harmonic, and "buzz-saw" multiple-pure-tones around it.
    const whine = d.zeros(n);
    for (const [hz, amp] of [
      [2400, 1.0],
      [4800, 0.22],
      [2160, 0.18],
      [2640, 0.14],
      [1920, 0.1],
      [5350, 0.08],
      [800, 0.12],
    ]) {
      d.mixInto(whine, tone(hz, amp), 0, 1);
    }
    // Gentle amplitude flutter (whole cycles per loop).
    const flutterHz = loopHz(3, loopSec);
    for (let i = 0; i < n; i++) whine[i] *= 0.85 + 0.15 * Math.sin((2 * Math.PI * flutterHz * i) / SR);
    const noiseL = d.pinkNoise(loopSec, rng);
    const noiseR = d.pinkNoise(loopSec, rng);
    const rumbleSrc = d.brownNoise(loopSec, rng);
    const [roarL, roarR, rumble] = d.processPeriodic([noiseL, noiseR, rumbleSrc], ([a, b, c]) => [
      d.peakEq(d.lowpass(a, 2500), 450, 5, 0.8),
      d.peakEq(d.lowpass(b, 2500), 450, 5, 0.8),
      d.lowpass4(d.highpass(c, 40), 160),
    ]);
    // Real jet air noise, made seamless with a crossfade.
    const wind = loadMono('kc135Wind');
    const [windLoop] = d.loopCrossfade([d.highpass(wind, 80)], n, d.secs(0.8));
    const [whineShaped] = d.processPeriodic([whine], ([w]) => [d.bandpass(w, 2400, 0.35)]);
    const L = d.zeros(n);
    const R = d.zeros(n);
    for (const [sig, gl, gr] of [
      [whineShaped, 0.3, 0.3],
      [roarL, 0.5, 0],
      [roarR, 0, 0.5],
      [rumble, 0.6, 0.6],
      [windLoop, 0.45, 0.4],
    ]) {
      d.mixInto(L, sig, 0, gl);
      d.mixInto(R, sig, 0, gr);
    }
    return [L, R];
  },
};

export const playerHit = {
  credits: [
    { source: 'kenneyImpact:impactMetal_heavy_002.ogg', use: 'Armour clank' },
    { source: 'kenneyImpact:impactMetal_medium_001.ogg', use: 'Armour clank' },
    { source: 'kenneyImpact:impactPlate_medium_001.ogg', use: 'Panel impact' },
  ],
  method: 'Three metal impacts as a quick 3-round stitch, a synthesized ricochet ping and low thud; saturated.',
  build() {
    const rng = new d.Rng(402);
    const len = 0.7;
    const ping = d.applyEnv(
      d.additive(0.35, 1, [
        [2150, 0.5, 0.06],
        [3420, 0.35, 0.05],
        [5230, 0.2, 0.03],
      ]),
      d.adEnv(0.35, 0.001, 0.12),
    );
    const thud = d.applyEnv(d.lowpass(d.whiteNoise(0.15, rng), 250), d.adEnv(0.15, 0.002, 0.03));
    const out = d.mix(len, [
      [d.resample(loadMono('kenneyImpact:impactMetal_heavy_002.ogg'), 1.0), 0, 0.9],
      [d.resample(loadMono('kenneyImpact:impactMetal_medium_001.ogg'), 0.9), 0.042, 0.75],
      [d.resample(loadMono('kenneyImpact:impactPlate_medium_001.ogg'), 1.1), 0.083, 0.7],
      [ping, 0.045, 0.18],
      [thud, 0, 0.8],
      [thud, 0.083, 0.5],
    ]);
    return [d.fadeOut(d.saturate(out, 1.8), 0.2)];
  },
};

export const rearmLoop = {
  credits: [
    { source: 'kenneyImpact:impactMetal_light_001.ogg', use: 'Tool clank' },
    { source: 'kenneyImpact:impactMetal_light_003.ogg', use: 'Tool clank' },
    { source: 'kenneyImpact:impactPlate_light_002.ogg', use: 'Panel clank' },
    { source: 'kenneyImpact:impactMining_001.ogg', use: 'Ammo-can thunk' },
  ],
  method:
    '4 s seamless loop of ground crew at work: real metal clanks placed circularly, synthesized ratchet ' +
    'bursts and pneumatic impact-wrench whirrs over a generator hum; circular filtering/reverb.',
  build() {
    const rng = new d.Rng(403);
    const loopSec = 4;
    const n = d.secs(loopSec);
    const out = d.zeros(n);
    // Generator hum (whole cycles per loop).
    for (const [hz, amp] of [[50, 0.05], [100, 0.035], [150, 0.02], [250, 0.008]]) {
      d.mixInto(out, d.osc(loopSec, hz, 'sine'), 0, amp);
    }
    const click = () =>
      d.applyEnv(d.bandpass(d.whiteNoise(0.02, rng), rng.range(2800, 3600), 3), d.adEnv(0.02, 0.0002, 0.004));
    const ratchet = (t0, count, rate) => {
      for (let k = 0; k < count; k++) d.mixIntoWrap(out, click(), d.secs(t0 + k / rate), rng.range(0.5, 0.8));
    };
    ratchet(0.25, 12, 16);
    ratchet(2.45, 9, 14);
    const wrench = (t0, dur) => {
      const w = d.mix(dur, [
        [d.bandpass(d.whiteNoise(dur, rng), 1800, 1.2), 0, 0.5],
        [d.osc(dur, (t) => 900 + 250 * Math.min(1, t / 0.05), 'saw'), 0, 0.06],
      ]);
      const am = d.osc(dur, 38, 'sine').map((v) => 0.6 + 0.4 * v);
      d.mixIntoWrap(out, d.applyEnv(d.multiply(w, am), d.envelope(d.zeros(d.secs(dur)).fill(1), [[0, 0], [0.02, 1], [dur - 0.05, 1], [dur, 0]])), d.secs(t0), 0.6);
    };
    wrench(1.15, 0.55);
    wrench(3.35, 0.35);
    const clank = (id, t, rate, g) => d.mixIntoWrap(out, d.resample(loadMono(`kenneyImpact:${id}`), rate), d.secs(t), g);
    clank('impactMetal_light_001.ogg', 0.95, 1, 0.5);
    clank('impactPlate_light_002.ogg', 1.85, 0.9, 0.45);
    clank('impactMining_001.ogg', 2.2, 0.8, 0.55);
    clank('impactMetal_light_003.ogg', 3.05, 1.1, 0.45);
    clank('impactMetal_light_001.ogg', 3.85, 0.85, 0.35);
    const [l] = d.processPeriodic([out], ([x]) => {
      const [rl] = d.reverb(d.highpass(x, 45), { room: 0.4, damp: 0.5, wet: 0.2, dry: 1, tailSec: 0 });
      return [rl];
    });
    return [l];
  },
};
