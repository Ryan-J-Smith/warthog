// Enemy fire and the distant ground war: AA bursts, SAM launch, tank guns, small arms, ambience, MLRS ripple, helicopter rotor.
import * as d from '../lib/dsp.mjs';
import { loadMono } from '../sources.mjs';

const { SR } = d;
const hit = (id, relDb = -26) => d.trimStart(loadMono(id), relDb, 1);

/** Cut the `count` strongest transients (≥ minGap apart) out of a recording as short grains. */
function grainsFrom(x, count, lengthSec, minGapSec = 0.08) {
  const env = d.lowpass(d.highpass(x, 400).map(Math.abs), 60);
  const gap = d.secs(minGapSec);
  const idx = [];
  for (let i = 1; i < env.length - 1; i++) if (env[i] >= env[i - 1] && env[i] > env[i + 1]) idx.push(i);
  idx.sort((a, b) => env[b] - env[a]);
  const picked = [];
  for (const i of idx) {
    if (picked.every((p) => Math.abs(p - i) >= gap)) picked.push(i);
    if (picked.length >= count) break;
  }
  const n = d.secs(lengthSec);
  return picked
    .sort((a, b) => a - b)
    .map((p) => {
      const s = Math.max(0, p - d.secs(0.015));
      const g = d.trimStart(x.slice(s, s + n), -24, 1);
      return d.fadeOut(d.fit(g, n), lengthSec * 0.4);
    });
}

/** "Heard from a distance": less top end, less low rumble, more room. */
function distant(x, { lp = 2200, hp = 70, wet = 0.35, room = 0.75, tailSec = 1.2 } = {}) {
  const filtered = d.highpass(d.lowpass(x, lp), hp);
  const [l] = d.reverb(filtered, { room, damp: 0.6, wet, dry: 1, tailSec });
  return l;
}

export const aaFire = {
  credits: [{ source: 'mk46Single', use: 'Single 30 mm shot, re-sequenced into a 12-round burst' }],
  method:
    'Shilka-style burst: a real 30 mm cannon shot re-sequenced as 12 rounds over 0.6 s with timing, gain and ' +
    'pitch variation, then distance-processed (low-pass, room reverb).',
  build() {
    const rng = new d.Rng(301);
    const shot = hit('mk46Single');
    const transient = d.fadeOut(d.fit(shot, d.secs(0.14)), 0.08);
    const len = 1.9;
    const out = d.zeros(d.secs(len));
    for (let k = 0; k < 12; k++) {
      const at = k * 0.05 + rng.range(-0.003, 0.003);
      const g = rng.range(0.75, 1);
      d.mixInto(out, d.resample(k === 11 ? shot : transient, rng.range(0.92, 1.06)), d.secs(at), g);
    }
    let s = distant(out, { lp: 2600, hp: 60, wet: 0.3, tailSec: 0.8 });
    s = d.peakEq(s, 150, 3, 1);
    return [d.fadeOut(d.fit(s, d.secs(len)), 0.4)];
  },
};

export const samLaunch = {
  credits: [{ source: 'hawkLaunch', use: 'MIM-23 Hawk SAM launch' }],
  method: 'Real SAM launch with extra low-end weight, gentle saturation and a touch of distance reverb.',
  build() {
    let s = hit('hawkLaunch', -30);
    s = d.saturate(d.lowShelf(d.highpass(s, 35), 100, 4), 1.5);
    const [l] = d.reverb(s, { room: 0.7, damp: 0.5, wet: 0.18, dry: 1, tailSec: 0.8 });
    return [d.fadeOut(l, 0.6)];
  },
};

export const tankFire = {
  credits: [{ source: 'tankFiring', use: 'Tank main-gun shot' }],
  method: 'Real tank gun shot, distance-processed (low-pass, reverb) with a synthesized sub boom for weight.',
  build() {
    const len = 1.8;
    const shot = d.mix(len, [
      [hit('tankFiring'), 0, 1],
      [d.subBoom(len, 90, 40, 0.06, 0.3), 0, 0.5],
    ]);
    return [d.fadeOut(d.fit(distant(shot, { lp: 2000, wet: 0.4, tailSec: 1.2 }), d.secs(len)), 0.5)];
  },
};

export const smallArms = {
  credits: [
    { source: 'mgBurst', use: 'Machine-gun burst' },
    { source: 'rifleFirefight', use: 'Individual rifle shots' },
  ],
  method: 'A real MG burst plus a few rifle shots from a firefight recording, distance-processed.',
  build() {
    const rng = new d.Rng(302);
    const len = 1.6;
    const rifles = grainsFrom(loadMono('rifleFirefight'), 6, 0.25);
    const layers = [[hit('mgBurst'), 0, 0.9]];
    for (let k = 0; k < 3; k++) layers.push([rng.pick(rifles), 0.2 + k * 0.23 + rng.range(0, 0.08), 0.6]);
    const out = d.mix(len, layers);
    return [d.fadeOut(d.fit(distant(out, { lp: 3200, hp: 120, wet: 0.35 }), d.secs(len)), 0.4)];
  },
};

export const battleAmbience = {
  credits: [
    { source: 'rifleFirefight', use: 'Rifle shots (grains)' },
    { source: 'mgBurst', use: 'Machine-gun bursts' },
    { source: 'tankFiring', use: 'Distant tank fire' },
    { source: 'distantGrenade', use: 'Distant explosions' },
    { source: 'mk46Single', use: 'Distant cannon' },
  ],
  method:
    '20 s seamless loop of a distant ground battle: real gunshot/MG/tank/explosion grains scheduled at random ' +
    '(circularly) across a stereo field, heavily distance-processed (low-pass, long reverb), over a low rumble bed.',
  build() {
    const rng = new d.Rng(303);
    const loopSec = 20;
    const n = d.secs(loopSec);
    const L = d.zeros(n);
    const R = d.zeros(n);
    const rifles = grainsFrom(loadMono('rifleFirefight'), 10, 0.3);
    const mg = hit('mgBurst');
    const tank = hit('tankFiring');
    const boom = hit('distantGrenade');
    const cannon = d.fit(hit('mk46Single'), d.secs(0.5));
    const place = (sig, t, g, p) => {
      const [a, b] = d.pan(sig, p);
      d.mixIntoWrap(L, a, d.secs(t), g);
      d.mixIntoWrap(R, b, d.secs(t), g);
    };
    // Rifle fire comes in clusters (exchanges of fire).
    for (let c = 0; c < 14; c++) {
      const t0 = rng.range(0, loopSec);
      const p = rng.range(-0.9, 0.9);
      const shots = rng.int(2, 6);
      for (let k = 0; k < shots; k++) place(d.resample(rng.pick(rifles), rng.range(0.9, 1.1)), t0 + k * rng.range(0.12, 0.35), rng.range(0.25, 0.6), p + rng.range(-0.1, 0.1));
    }
    for (let k = 0; k < 6; k++) place(d.resample(mg, rng.range(0.9, 1.05)), rng.range(0, loopSec), rng.range(0.3, 0.55), rng.range(-0.8, 0.8));
    for (let k = 0; k < 4; k++) place(tank, rng.range(0, loopSec), rng.range(0.5, 0.8), rng.range(-0.7, 0.7));
    for (let k = 0; k < 4; k++) place(d.resample(boom, rng.range(0.7, 0.9)), rng.range(0, loopSec), rng.range(0.5, 0.9), rng.range(-0.8, 0.8));
    for (let k = 0; k < 3; k++) place(cannon, rng.range(0, loopSec), rng.range(0.3, 0.5), rng.range(-0.6, 0.6));
    // Distance: everything is far away. Process circularly so the loop seam stays seamless.
    const wet = d.processPeriodic([L, R], ([l, r]) => {
      const fl = d.highpass(d.lowpass4(l, 1500), 60);
      const fr = d.highpass(d.lowpass4(r, 1500), 60);
      return d.reverb([fl, fr], { room: 0.88, damp: 0.7, wet: 0.55, dry: 0.7, width: 1, tailSec: 0 });
    });
    // Low rumble bed (periodic via crossfade).
    const bedLen = loopSec + 2;
    const bedL = d.lowpass4(d.brownNoise(bedLen, rng), 180);
    const bedR = d.lowpass4(d.brownNoise(bedLen, rng), 180);
    const [bl, br] = d.loopCrossfade([bedL, bedR], n, d.secs(2));
    return [d.add(wet[0], d.scale(bl, 0.35)), d.add(wet[1], d.scale(br, 0.35))];
  },
};

export const mlrsLaunch = {
  credits: [
    { source: 'rpgLaunch', use: 'Rocket launch, re-sequenced into an 8-round ripple' },
    { source: 'hellfire', use: 'Rocket motor roar under the ripple' },
  ],
  method:
    'Rocket-artillery ripple: a real rocket launch re-sequenced as 8 rounds ~0.14 s apart with timing, gain ' +
    'and pitch variation, over a real missile-motor roar, then distance-processed (low-pass, room reverb).',
  build() {
    const rng = new d.Rng(304);
    const len = 2.6;
    const shot = d.fadeOut(d.fit(hit('rpgLaunch'), d.secs(0.7)), 0.35);
    const roar = d.fadeOut(d.fit(hit('hellfire', -30), d.secs(1.6)), 0.8);
    const out = d.zeros(d.secs(len));
    d.mixInto(out, d.resample(roar, 0.85), d.secs(0.05), 0.45);
    for (let k = 0; k < 8; k++) {
      const at = k * 0.14 + rng.range(-0.015, 0.015);
      d.mixInto(out, d.resample(shot, rng.range(0.82, 0.98)), d.secs(at), rng.range(0.6, 0.85));
    }
    const s = distant(out, { lp: 2800, hp: 50, wet: 0.3, tailSec: 0.9 });
    return [d.fadeOut(d.fit(d.lowShelf(s, 120, 3), d.secs(len)), 0.6)];
  },
};

export const heliLoop = {
  credits: [],
  method:
    'Original: attack-helicopter rotor loop: 11 Hz main-rotor blade slaps (low noise thump + mid slap, ' +
    'slightly uneven per blade), a 58 Hz tail-rotor buzz and a quiet turbine whine; tones complete whole ' +
    'cycles and filtering/room run circularly, so the 2 s loop is seamless.',
  build() {
    const rng = new d.Rng(305);
    const loopSec = 2;
    const n = d.secs(loopSec);
    // Round a frequency to whole cycles per loop (seamless tones).
    const loopHz = (hz) => Math.round(hz * loopSec) / loopSec;
    const out = d.zeros(n);
    const bladeHz = 11;
    const slaps = Math.round(bladeHz * loopSec);
    const bladeGain = [1, 0.86, 0.94, 0.8];
    for (let k = 0; k < slaps; k++) {
      const thump = d.applyEnv(d.lowpass(d.whiteNoise(0.09, rng), 380), d.adEnv(0.09, 0.004, 0.022));
      const slap = d.applyEnv(d.bandpass(d.whiteNoise(0.04, rng), 1100, 0.9), d.adEnv(0.04, 0.001, 0.008));
      const g = bladeGain[k % bladeGain.length];
      const at = d.secs(k / bladeHz);
      d.mixIntoWrap(out, thump, at, g);
      d.mixIntoWrap(out, slap, at, g * 0.35);
    }
    const tail = d.osc(loopSec, loopHz(58), 'saw');
    const tailAm = loopHz(bladeHz);
    for (let i = 0; i < n; i++) tail[i] *= 0.7 + 0.3 * Math.sin((2 * Math.PI * tailAm * i) / SR);
    d.mixInto(out, tail, 0, 0.06);
    for (const [hz, amp] of [[1650, 0.015], [3300, 0.006]]) d.mixInto(out, d.osc(loopSec, loopHz(hz), 'sine'), 0, amp);
    const [l] = d.processPeriodic([out], ([x]) => {
      const [rl] = d.reverb(d.highpass(d.lowpass(x, 2400), 35), { room: 0.35, damp: 0.6, wet: 0.15, dry: 1, tailSec: 0 });
      return [rl];
    });
    return [l];
  },
};
