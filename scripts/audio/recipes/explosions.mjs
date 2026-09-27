// Explosions: real ordnance recordings (US Government footage, CC0) layered with synthesized
// sub booms, cracks and debris for size and punch.
import * as d from '../lib/dsp.mjs';
import { loadMono } from '../sources.mjs';

/** Load a source mono, trimmed so its transient starts at t=0. */
const hit = (id, relDb = -26) => d.trimStart(loadMono(id), relDb, 1);

/** The "Blow Up" recording has a second, unrelated blast at ~2 s; use only the first one. */
const blowUp = () => d.fadeOut(d.fit(hit('blowUp'), d.secs(1.4)), 0.5);

function crack(rng, lengthSec = 0.03, hp = 2200) {
  return d.applyEnv(d.highpass(d.whiteNoise(lengthSec, rng), hp), d.adEnv(lengthSec, 0.0002, 0.004));
}

/** Common finishing: glue with saturation, then weight + bite. */
function finish(x, { drive = 1.6, lowDb = 3, presenceDb = 2, lpHz = 12000, squash = 2.5, clipDb = 6 } = {}) {
  // Tame the crest factor so the blast body (not just the first spike) carries the loudness:
  // compress, shave the initial spike with a fast limiter, then saturate for grit.
  let [s] = d.compress([d.normalize(x, -1)], -16, squash, 4, 160);
  [s] = d.limit([d.normalize(s, -1)], -1 - clipDb, 1, 40);
  s = d.saturate(d.normalize(s, -2), drive);
  s = d.highpass4(s, 34);
  s = d.lowShelf(s, 90, lowDb);
  s = d.peakEq(s, 2500, presenceDb, 0.9);
  return d.lowpass(s, lpHz, 0.6);
}

export const explosionSmall = {
  credits: [
    { source: 'fireExplosion', use: 'Main blast' },
    { source: 'distantGrenade', use: 'Low body layer' },
  ],
  method: 'Real blast layered with a distant grenade body, a synthesized crack and a small sub boom; saturated and EQ\'d.',
  build() {
    const rng = new d.Rng(101);
    const len = 1.1;
    const out = d.mix(len, [
      [hit('fireExplosion'), 0, 1.0],
      [d.lowpass(hit('distantGrenade'), 900), 0.005, 0.6],
      [crack(rng), 0, 0.35],
      [d.subBoom(len, 110, 45, 0.05, 0.12), 0, 0.45],
    ]);
    return [d.fadeOut(finish(out, { lowDb: 2 }), 0.25)];
  },
};

export const explosionMedium = {
  credits: [
    { source: 'explosive', use: 'Main blast' },
    { source: 'blast', use: 'Low-passed body layer' },
  ],
  method: 'Real blast layered with a low-passed second blast, synthesized crack, sub boom and debris patter; saturated and EQ\'d.',
  build() {
    const rng = new d.Rng(102);
    const len = 1.9;
    const out = d.mix(len, [
      [hit('explosive'), 0, 1.0],
      [d.lowpass(hit('blast'), 450), 0.004, 0.8],
      [crack(rng, 0.04, 1800), 0, 0.4],
      [d.subBoom(len, 95, 38, 0.07, 0.25), 0, 0.6],
      [d.debris(1.2, rng, { density: 0.01, tau: 0.35 }), 0.12, 0.25],
    ]);
    return [d.fadeOut(finish(out, { lowDb: 3.5 }), 0.4)];
  },
};

export const explosionLarge = {
  credits: [
    { source: 'explosion', use: 'Main blast' },
    { source: 'blowUp', use: 'Second blast layer for size' },
  ],
  method:
    'Two real blasts stacked, synthesized crack, deep sub boom, falling-debris patter and a short dark reverb tail; ' +
    'saturated and EQ\'d.',
  build() {
    const rng = new d.Rng(103);
    const len = 3.0;
    const dry = d.mix(len, [
      [hit('explosion', -20), 0, 1.0],
      [blowUp(), 0.01, 0.8],
      [crack(rng, 0.05, 1600), 0, 0.5],
      [d.subBoom(len, 80, 36, 0.1, 0.5), 0, 0.85],
      [d.debris(2.0, rng, { density: 0.012, tau: 0.6 }), 0.25, 0.3],
    ]);
    const [wet] = d.reverb(d.lowpass(dry, 1500), { room: 0.8, damp: 0.6, wet: 1, dry: 0, tailSec: 0 });
    const out = d.add(dry, d.scale(d.fit(wet, dry.length), 0.25));
    return [d.fadeOut(finish(out, { drive: 1.8, lowDb: 4 }), 0.6)];
  },
};

export const explosionHuge = {
  credits: [
    { source: 'eod', use: 'Main detonation' },
    { source: 'explosion', use: 'Delayed second blast' },
    { source: 'mclc', use: 'Crackling chain-detonation layer' },
    { source: 'fireExplosion', use: 'Pitched-down secondary cook-offs' },
  ],
  method:
    'EOD detonation + delayed second blast + crackling line-charge layer, two pitched-down secondary cook-offs, ' +
    'a long synthesized rumble and sub boom, debris and a rolling thunder-like reverb; saturated and EQ\'d.',
  build() {
    const rng = new d.Rng(104);
    const len = 5.0;
    const rumble = d.applyEnv(d.bandpass(d.lowpass4(d.brownNoise(len, rng), 220), 90, 0.6), d.adEnv(len, 0.1, 0.9));
    const cook = d.lowpass(d.resample(hit('fireExplosion'), 0.7), 2500);
    const dry = d.mix(len, [
      [hit('eod'), 0, 1.0],
      [hit('explosion', -20), 0.09, 0.8],
      [d.lowpass(hit('mclc'), 6000), 0.02, 0.6],
      [crack(rng, 0.06, 1500), 0, 0.5],
      [cook, 0.75, 0.5],
      [cook, 1.35, 0.35],
      [d.subBoom(len, 72, 36, 0.14, 0.8), 0, 0.8],
      [rumble, 0.05, 1.6],
      [d.debris(3.0, rng, { density: 0.012, tau: 0.9 }), 0.35, 0.35],
    ]);
    const [wet] = d.reverb(d.lowpass(dry, 900), { room: 0.9, damp: 0.7, wet: 1, dry: 0, tailSec: 0 });
    const out = d.add(dry, d.scale(d.fit(wet, dry.length), 0.35));
    return [d.fadeOut(finish(out, { drive: 2.0, lowDb: 3 }), 1.2)];
  },
};

export const playerExplode = {
  credits: [
    { source: 'blowUp', use: 'Main blast' },
    { source: 'explosive', use: 'Second blast layer' },
    { source: 'metalCrash', use: 'Airframe breaking up' },
    { source: 'kenneyImpact:impactMetal_heavy_001.ogg', use: 'Falling-debris clank (pitched down)' },
    { source: 'kenneyImpact:impactMetal_heavy_003.ogg', use: 'Falling-debris clank (pitched down)' },
  ],
  method:
    'Two real blasts, a metal crash for the airframe, a synthesized engine-death whine drop, sub boom, ' +
    'pitched-down metal clanks as debris lands, and a short reverb.',
  build() {
    const rng = new d.Rng(105);
    const len = 3.4;
    const whine = d.applyEnv(
      d.lowpass(d.osc(1.0, (t) => 2600 * Math.exp(-t * 2.4) + 180, 'saw'), 4000),
      d.adEnv(1.0, 0.005, 0.35),
    );
    const clank1 = d.resample(loadMono('kenneyImpact:impactMetal_heavy_001.ogg'), 0.7);
    const clank2 = d.resample(loadMono('kenneyImpact:impactMetal_heavy_003.ogg'), 0.6);
    const dry = d.mix(len, [
      [blowUp(), 0, 1.0],
      [hit('explosive'), 0.015, 0.7],
      [hit('metalCrash'), 0.0, 0.6],
      [whine, 0, 0.12],
      [d.subBoom(len, 85, 36, 0.1, 0.55), 0, 0.9],
      [clank1, 0.55, 0.35],
      [clank2, 0.95, 0.28],
      [d.debris(2.2, rng, { density: 0.012, tau: 0.6 }), 0.3, 0.3],
    ]);
    const [wet] = d.reverb(d.lowpass(dry, 2000), { room: 0.75, damp: 0.5, wet: 1, dry: 0, tailSec: 0 });
    const out = d.add(dry, d.scale(d.fit(wet, dry.length), 0.25));
    return [d.fadeOut(finish(out, { drive: 1.8, lowDb: 4 }), 0.8)];
  },
};
