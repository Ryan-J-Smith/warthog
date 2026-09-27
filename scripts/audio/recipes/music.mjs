// Music: Kevin MacLeod (incompetech.com), CC BY 4.0. Tracks are trimmed and looped; not remixed.
import * as d from '../lib/dsp.mjs';
import { load } from '../sources.mjs';

const { SR } = d;

export const musicTitle = {
  credits: [{ source: 'atLaunch', use: 'Title / briefing theme' }],
  method: 'Full track; trailing silence trimmed and a 0.4 s fade-out added so it loops back to the intro.',
  build() {
    const chs = load('atLaunch', { channels: 2 });
    return d.trimTrailing(chs, -60, 400);
  },
};

export const musicMission = {
  credits: [{ source: 'darkling', use: 'In-mission theme' }],
  method:
    'Cut to exactly 96 bars at 140 BPM (164.571 s) so it loops on the downbeat; the first 20 ms crossfade from ' +
    'the natural continuation into the intro so the seam is click-free.',
  build() {
    const chs = load('darkling', { channels: 2 });
    const loopLen = Math.round(((96 * 4 * 60) / 140) * SR); // 7,257,600 samples
    return d.loopCrossfade(chs, loopLen, d.secs(0.02));
  },
};

export const stingVictory = {
  credits: [{ source: 'discoveryHit', use: 'Victory sting' }],
  method: 'Trimmed; natural decay kept.',
  build() {
    return d.trimTrailing(load('discoveryHit', { channels: 2 }), -60, 300);
  },
};

export const stingDefeat = {
  credits: [{ source: 'gretaSting', use: 'Defeat sting' }],
  method: 'Trimmed; natural decay kept.',
  build() {
    return d.trimTrailing(load('gretaSting', { channels: 2 }), -60, 300);
  },
};
