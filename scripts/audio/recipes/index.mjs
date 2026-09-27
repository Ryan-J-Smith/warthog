// Registry: every AUDIO key → recipe + mastering spec. build.mjs checks this against src/assets/audioKeys.ts.
//
// Loudness targets (LUFS-ish, K-weighted): one-shots use the loudest 400 ms window, loops and music the
// gated integrated level. They set the relative mix baked into the files:
// explosions > gun > weapons > warnings > UI. The AudioDirector applies distance/voice gains on top.
import * as gun from './gun.mjs';
import * as ex from './explosions.mjs';
import * as wp from './weapons.mjs';
import * as th from './threats.mjs';
import * as pl from './player.mjs';
import * as tn from './tones.mjs';
import * as ui from './ui.mjs';
import * as mu from './music.mjs';

// Loops ship as WAV only: Chromium's Vorbis decoder pads short files by a few ms (it ignores the
// end-trim granule), which puts a gap in every loop cycle. PCM WAV is sample-exact everywhere.
const LOOP_FORMATS = ['wav'];
const ONE_SHOT_FORMATS = ['ogg', 'mp3'];
const MUSIC_FORMATS = ['ogg', 'mp3'];

/**
 * @typedef {{ build: () => Float32Array[], credits: {source: string, use: string}[], method: string }} Recipe
 * @param {string} file recipe module (for credits)
 * @param {Recipe} r
 * @param {number} lufs loudness target
 */
const oneShot = (file, r, lufs, extra = {}) => ({
  file, kind: 'sfx', loop: false, formats: ONE_SHOT_FORMATS, measure: 'momentary', lufs, ...r, ...extra,
});
const loop = (file, r, lufs, extra = {}) => ({
  file, kind: 'sfx', loop: true, formats: LOOP_FORMATS, measure: 'integrated', lufs, ...r, ...extra,
});
const music = (r, lufs, isLoop, measure = 'integrated') => ({
  file: 'music.mjs', kind: 'music', loop: isLoop, formats: MUSIC_FORMATS, measure, lufs, ...r,
});

export const RECIPES = {
  // Music
  musicTitle: music(mu.musicTitle, -16, true),
  musicMission: music(mu.musicMission, -16, true),
  stingVictory: music(mu.stingVictory, -13, false, 'momentary'),
  stingDefeat: music(mu.stingDefeat, -15, false, 'momentary'),

  // Player aircraft & weapons
  engineLoop: loop('player.mjs', pl.engineLoop, -20),
  gunLoop: loop('gun.mjs', gun.gunLoop, -11),
  gunTail: oneShot('gun.mjs', gun.gunTail, -12),
  gunImpacts: oneShot('gun.mjs', gun.gunImpacts, -15),
  rocketLaunch: oneShot('weapons.mjs', wp.rocketLaunch, -12),
  missileLaunch: oneShot('weapons.mjs', wp.missileLaunch, -11),
  bombRelease: oneShot('weapons.mjs', wp.bombRelease, -16),
  bombWhistle: oneShot('weapons.mjs', wp.bombWhistle, -17),
  lockTone: oneShot('tones.mjs', tn.lockTone, -17),
  flare: oneShot('weapons.mjs', wp.flare, -15),
  dryFire: oneShot('ui.mjs', ui.dryFire, -18),
  weaponSwitch: oneShot('ui.mjs', ui.weaponSwitch, -18),

  // Explosions & impacts
  explosionSmall: oneShot('explosions.mjs', ex.explosionSmall, -11.5),
  explosionMedium: oneShot('explosions.mjs', ex.explosionMedium, -10),
  explosionLarge: oneShot('explosions.mjs', ex.explosionLarge, -9),
  explosionHuge: oneShot('explosions.mjs', ex.explosionHuge, -8.5),

  // Enemy fire & threats
  aaFire: oneShot('threats.mjs', th.aaFire, -15),
  samLaunch: oneShot('threats.mjs', th.samLaunch, -12),
  rwrLock: oneShot('tones.mjs', tn.rwrLock, -16),
  rwrLaunch: loop('tones.mjs', tn.rwrLaunch, -15),
  tankFire: oneShot('threats.mjs', th.tankFire, -15),
  smallArms: oneShot('threats.mjs', th.smallArms, -19),
  // Low-passed at 1.5 kHz, so a 22.05 kHz WAV loses nothing and halves the size.
  battleAmbience: loop('threats.mjs', th.battleAmbience, -26, { wavRate: 22050 }),

  // Player state
  playerHit: oneShot('player.mjs', pl.playerHit, -12),
  playerExplode: oneShot('explosions.mjs', ex.playerExplode, -8.5),
  rearmLoop: loop('player.mjs', pl.rearmLoop, -21),
  rearmComplete: oneShot('tones.mjs', tn.rearmComplete, -16),
  lowHealth: oneShot('tones.mjs', tn.lowHealth, -17),

  // Radio & UI
  radioIn: oneShot('tones.mjs', tn.radioIn, -19),
  radioOut: oneShot('tones.mjs', tn.radioOut, -20),
  objectiveComplete: oneShot('tones.mjs', tn.objectiveComplete, -14),
  objectiveFailed: oneShot('tones.mjs', tn.objectiveFailed, -14),
  uiMove: oneShot('ui.mjs', ui.uiMove, -22),
  uiConfirm: oneShot('ui.mjs', ui.uiConfirm, -19),
  uiBack: oneShot('ui.mjs', ui.uiBack, -20),
  scoreTick: oneShot('ui.mjs', ui.scoreTick, -23),
};
