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

/**
 * Cut a `bars`-bar loop (4/4 at `bpm`) that starts on the downbeat of bar `startBar` (0-based, bar 0
 * at the start of the file), crossfading the first 20 ms from the natural continuation after the
 * loop end, as musicMission does. Loop points were picked where the bar after the seam best matches
 * the bar after the loop start (24-band spectral distance), so the seam sounds like the next bar.
 */
function barLoop(source, bpm, startBar, bars) {
  const chs = load(source, { channels: 2 });
  const barLen = ((4 * 60) / bpm) * SR;
  const start = Math.round(startBar * barLen);
  const loopLen = Math.round(bars * barLen);
  const xfade = d.secs(0.02);
  return d.loopCrossfade(chs.map((c) => c.subarray(start, start + loopLen + xfade)), loopLen, xfade);
}

export const musicThreeRoads = {
  credits: [{ source: 'clashDefiant', use: 'Three Roads in-mission theme' }],
  method:
    'Cut to exactly 132 bars at 170 BPM (186.353 s) starting on the downbeat of bar 26 (36.706 s) so it loops on ' +
    'the downbeat; the first 20 ms crossfade from the natural continuation into the loop start so the seam is click-free.',
  build() {
    return barLoop('clashDefiant', 170, 26, 132);
  },
};

export const musicIronSleet = {
  credits: [{ source: 'blownAway', use: 'Iron Sleet in-mission theme' }],
  method:
    'Cut to exactly 112 bars at 170 BPM (158.118 s) starting on the downbeat of bar 6 (8.471 s) so it loops on ' +
    'the downbeat; the first 20 ms crossfade from the natural continuation into the loop start so the seam is click-free.',
  build() {
    return barLoop('blownAway', 170, 6, 112);
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
