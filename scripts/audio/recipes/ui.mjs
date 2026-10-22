// Menu and cockpit UI sounds, from Kenney's CC0 interface packs (lightly processed, some with synthesized layers).
import * as d from '../lib/dsp.mjs';
import { loadMono } from '../sources.mjs';

const kenney = (pack, file) => loadMono(`${pack}:${file}`);
const passthrough = (pack, file, use) => ({
  credits: [{ source: `${pack}:${file}`, use }],
  method: 'Used as-is apart from trimming and level matching.',
  build() {
    return [kenney(pack, file)];
  },
});

export const uiMove = passthrough('kenneyInterface', 'select_002.ogg', 'Menu move blip');
export const uiConfirm = passthrough('kenneyInterface', 'confirmation_003.ogg', 'Menu confirm');
export const uiBack = passthrough('kenneyInterface', 'back_003.ogg', 'Menu back');
export const scoreTick = passthrough('kenneyInterface', 'tick_002.ogg', 'Score count tick');

export const weaponSwitch = {
  credits: [{ source: 'kenneyUi:switch22.ogg', use: 'Mechanical selector click (pitched down)' }],
  method: 'A real switch click pitched down 15% with a short synthesized servo thunk underneath.',
  build() {
    const rng = new d.Rng(601);
    const thunk = d.applyEnv(d.lowpass(d.whiteNoise(0.08, rng), 400), d.adEnv(0.08, 0.002, 0.015));
    return [d.mix(0.25, [
      [d.resample(kenney('kenneyUi', 'switch22.ogg'), 0.85), 0, 1],
      [thunk, 0.003, 0.5],
    ])];
  },
};

export const dryFire = {
  credits: [
    { source: 'kenneyUi:click3.ogg', use: 'Dry trigger click' },
    { source: 'kenneyInterface:error_004.ogg', use: 'Denied blip' },
  ],
  method: 'A dry mechanical click followed 40 ms later by a low "denied" blip (pitched down 10%).',
  build() {
    return [d.mix(0.25, [
      [kenney('kenneyUi', 'click3.ogg'), 0, 0.8],
      [d.resample(kenney('kenneyInterface', 'error_004.ogg'), 0.9), 0.04, 0.6],
    ])];
  },
};

export const uiError = {
  credits: [{ source: 'kenneyInterface:error_002.ogg', use: 'Menu error / denied' }],
  method: 'Used as-is apart from trimming and level matching.',
  build() {
    return [kenney('kenneyInterface', 'error_002.ogg')];
  },
};

export const upgradeBuy = {
  credits: [{ source: 'kenneyUi:click3.ogg', use: 'Register "ka" click' }],
  method:
    'Purchase "ka-ching": a real mechanical click and a synthesized low thunk, then two bright inharmonic ' +
    'bell strikes (C7, then G7) with a short room.',
  build() {
    const rng = new d.Rng(602);
    const len = 0.75;
    const thunk = d.applyEnv(d.lowpass(d.whiteNoise(0.06, rng), 500), d.adEnv(0.06, 0.001, 0.012));
    const ching = (hz, tau) =>
      d.applyEnv(
        d.additive(len, hz, [
          [1, 0.55, tau],
          [2.76, 0.25, tau * 0.6],
          [5.4, 0.12, tau * 0.35],
          [8.93, 0.05, tau * 0.2],
        ]),
        d.adEnv(len, 0.001, tau * 1.5),
      );
    const dry = d.mix(len, [
      [kenney('kenneyUi', 'click3.ogg'), 0, 0.8],
      [thunk, 0, 0.5],
      [ching(2093, 0.18), 0.07, 0.45],
      [ching(3136, 0.24), 0.14, 0.4],
    ]);
    const [l, r] = d.reverb(dry, { room: 0.45, damp: 0.45, wet: 0.15, dry: 1, tailSec: 0.25 });
    return [l, r];
  },
};
