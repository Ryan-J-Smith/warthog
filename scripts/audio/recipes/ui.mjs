// Menu and cockpit UI sounds, from Kenney's CC0 interface packs (lightly processed).
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
