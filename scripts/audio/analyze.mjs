#!/usr/bin/env node
// Quality report for the delivered audio in public/assets/audio/:
// duration, channels, peak dBFS, clipped samples, RMS, loudness (LUFS-ish momentary max and
// integrated), leading silence, and for loops the seam discontinuity (jump between the last and
// first sample relative to the 99th-percentile sample-to-sample step; < ~1.5 is inaudible).
//
// Usage: FFMPEG_PATH=/path/to/ffmpeg node scripts/audio/analyze.mjs [--json]
import { readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyse } from './lib/analysis.mjs';
import { decode, probeChannels } from './lib/ffmpeg.mjs';
import { readWav } from './lib/wav.mjs';
import { SR } from './lib/dsp.mjs';
import { RECIPES } from './recipes/index.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIO_DIR = join(ROOT, 'public', 'assets', 'audio');
const json = process.argv.includes('--json');

function load(path) {
  if (extname(path) === '.wav') {
    const { sampleRate, channels } = readWav(path);
    if (sampleRate === SR) return channels;
  }
  // Compressed formats (and non-44.1 kHz WAVs) are decoded/resampled by ffmpeg.
  return decode(path, { channels: probeChannels(path) });
}

const rows = [];
let total = 0;
for (const sub of ['music', 'sfx']) {
  const dir = join(AUDIO_DIR, sub);
  for (const file of readdirSync(dir).sort()) {
    const path = join(dir, file);
    const key = basename(file, extname(file));
    const bytes = statSync(path).size;
    total += bytes;
    const a = analyse(load(path));
    const loop = RECIPES[key]?.loop ?? false;
    rows.push({ file: `${sub}/${file}`, key, bytes, loop, ...a });
  }
}

if (json) {
  console.log(JSON.stringify({ totalBytes: total, rows }, null, 2));
} else {
  const f = (n, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : '-');
  console.log('file                              size      dur   ch  peak  clip   rms  M-LUFS I-LUFS lead(ms) seam');
  for (const r of rows) {
    console.log(
      `${r.file.padEnd(32)} ${(r.bytes / 1024).toFixed(0).padStart(6)}kB ${f(r.durationSec, 2).padStart(7)} ${String(r.channels).padStart(3)} ` +
        `${f(r.peakDb).padStart(5)} ${String(r.clipped).padStart(5)} ${f(r.rmsDb).padStart(5)} ${f(r.momentaryMax).padStart(6)} ` +
        `${f(r.integrated).padStart(6)} ${f(r.leadingSilenceMs).padStart(8)} ${r.loop ? f(r.seamRatio, 2) : ''}`,
    );
  }
  const warn = rows.filter((r) => r.clipped > 0 || r.peakDb > -0.5 || (!r.loop && r.leadingSilenceMs > 30) || (r.loop && r.seamRatio > 1.5));
  console.log(`\n${rows.length} files, ${(total / 1e6).toFixed(2)} MB total`);
  console.log(warn.length ? `Check: ${warn.map((r) => r.file).join(', ')}` : 'No clipping, no hot peaks, no long leading silence, all loop seams clean.');
}
