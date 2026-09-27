// Player ordnance: rockets, Maverick, bombs, flares.
import * as d from '../lib/dsp.mjs';
import { loadMono } from '../sources.mjs';

const hit = (id, relDb = -26) => d.trimStart(loadMono(id), relDb, 1);

/** Noise whoosh whose band sweeps upward then fades (motor burn moving away). */
function whoosh(rng, lengthSec, f0, f1, tau) {
  const n = d.whiteNoise(lengthSec, rng);
  const swept = d.filter(n, 'bandpass', (t) => f0 + (f1 - f0) * Math.min(1, t / (lengthSec * 0.6)), 1.4);
  return d.applyEnv(swept, d.adEnv(lengthSec, 0.01, tau));
}

export const rocketLaunch = {
  credits: [{ source: 'rpgLaunch', use: 'Launch bang/whoosh, used three times for the salvo' }],
  method:
    'Hydra salvo: the real launch recording tripled at 0/70/140 ms with ±8% pitch, plus a synthesized ' +
    'rising motor whoosh; saturated and EQ\'d.',
  build() {
    const rng = new d.Rng(201);
    const len = 1.3;
    const base = hit('rpgLaunch');
    const out = d.mix(len, [
      [d.resample(base, 1.04), 0, 0.8],
      [d.resample(base, 0.95), 0.07, 0.7],
      [d.resample(base, 1.1), 0.14, 0.65],
      [whoosh(rng, 0.9, 700, 3200, 0.25), 0.01, 0.35],
      [whoosh(rng, 0.9, 900, 3600, 0.22), 0.08, 0.3],
      [whoosh(rng, 0.9, 800, 3400, 0.2), 0.15, 0.3],
    ]);
    let s = d.saturate(out, 1.6);
    s = d.lowShelf(d.highpass(s, 50), 120, 2);
    return [d.fadeOut(s, 0.3)];
  },
};

export const missileLaunch = {
  credits: [{ source: 'hellfire', use: 'Missile launch roar' }],
  method:
    'Real missile launch with a synthesized ignition thump, a low roar layer and extra presence; saturated.',
  build() {
    const rng = new d.Rng(202);
    const len = 2.8;
    const roar = d.applyEnv(d.lowpass(d.pinkNoise(len, rng), 700), d.adEnv(len, 0.05, 0.9));
    const out = d.mix(len, [
      [hit('hellfire', -30), 0, 1.0],
      [d.subBoom(0.6, 120, 50, 0.05, 0.12), 0, 0.5],
      [roar, 0.02, 0.45],
      [whoosh(rng, 1.6, 500, 2600, 0.5), 0.03, 0.25],
    ]);
    let s = d.saturate(out, 1.7);
    s = d.peakEq(d.lowShelf(d.highpass(s, 40), 110, 3), 2200, 2, 1);
    // Let the motor roar recede into the distance after the recording's own fade.
    const [l] = d.reverb(s, { room: 0.8, damp: 0.5, wet: 0.22, dry: 1, tailSec: 0.9 });
    return [d.fadeOut(l, 0.6)];
  },
};

export const bombRelease = {
  credits: [
    { source: 'kenneyImpact:impactMetal_heavy_000.ogg', use: 'Pylon clunk (pitched down)' },
    { source: 'kenneyImpact:impactPlate_heavy_000.ogg', use: 'Rack body (pitched down)' },
  ],
  method: 'Two pitched-down metal impacts for the ejector-rack clunk, a synthesized latch click and air thump.',
  build() {
    const rng = new d.Rng(203);
    const len = 0.6;
    const click = d.applyEnv(d.highpass(d.whiteNoise(0.01, rng), 3000), d.adEnv(0.01, 0.0002, 0.0015));
    const thump = d.applyEnv(d.lowpass(d.whiteNoise(0.2, rng), 300), d.adEnv(0.2, 0.003, 0.05));
    const out = d.mix(len, [
      [click, 0, 0.5],
      [d.resample(loadMono('kenneyImpact:impactMetal_heavy_000.ogg'), 0.72), 0.004, 0.9],
      [d.resample(loadMono('kenneyImpact:impactPlate_heavy_000.ogg'), 0.6), 0.01, 0.6],
      [thump, 0.006, 0.6],
      [d.subBoom(0.25, 140, 60, 0.02, 0.05), 0.004, 0.35],
    ]);
    return [d.fadeOut(d.saturate(out, 1.4), 0.12)];
  },
};

export const bombWhistle = {
  credits: [],
  method:
    'Original: descending whistle (1.7 kHz → 620 Hz) with vibrato, a faint octave partial and breathy ' +
    'band-passed noise tracking the pitch; swells as the bomb falls.',
  build() {
    const rng = new d.Rng(204);
    const len = 2.0;
    const f = (t) => (620 + 1080 * Math.exp(-t * 1.25)) * (1 + 0.012 * Math.sin(2 * Math.PI * 6.5 * t));
    const tone = d.osc(len, f, 'sine');
    const octave = d.osc(len, (t) => 2 * f(t), 'sine');
    const breath = d.filter(d.whiteNoise(len, rng), 'bandpass', f, 6);
    const body = d.mix(len, [
      [tone, 0, 0.6],
      [octave, 0, 0.06],
      [breath, 0, 0.9],
    ]);
    const env = d.envelope(d.zeros(d.secs(len)).fill(1), [[0, 0], [0.12, 0.35], [1.6, 1], [1.95, 1], [2.0, 0]]);
    return [d.applyEnv(body, env)];
  },
};

export const flare = {
  credits: [],
  method:
    'Original: pyrotechnic pop (sub thump + crack), a burning magnesium hiss with crackle, and a short air whoosh.',
  build() {
    const rng = new d.Rng(205);
    const len = 1.4;
    const crackle = d.whiteNoise(len, rng);
    for (let i = 0; i < crackle.length; i++) if (rng.next() < 0.003) crackle[i] *= 8;
    const hiss = d.applyEnv(d.bandpass(crackle, 4200, 0.7), d.adEnv(len, 0.03, 0.45));
    const pop = d.applyEnv(d.bandpass(d.whiteNoise(0.05, rng), 1500, 0.8), d.adEnv(0.05, 0.0003, 0.008));
    const whoosh = d.applyEnv(d.lowpass(d.whiteNoise(0.35, rng), 900), d.adEnv(0.35, 0.01, 0.08));
    const out = d.mix(len, [
      [d.subBoom(0.2, 160, 70, 0.015, 0.04), 0, 0.7],
      [pop, 0, 0.6],
      [whoosh, 0.005, 0.5],
      [hiss, 0.01, 0.35],
    ]);
    return [d.fadeOut(d.saturate(out, 1.3), 0.3)];
  },
};
