// ffmpeg helpers. The project does not depend on ffmpeg; point FFMPEG_PATH at any ffmpeg
// binary (e.g. from `npm i ffmpeg-static` in a scratch directory outside the repo).
import { spawnSync } from 'node:child_process';
import { SR } from './dsp.mjs';

let cached = null;

export function ffmpegPath() {
  if (cached) return cached;
  const candidates = [process.env.FFMPEG_PATH, 'ffmpeg'].filter(Boolean);
  for (const c of candidates) {
    const r = spawnSync(c, ['-version'], { encoding: 'utf8' });
    if (r.status === 0) {
      cached = c;
      return c;
    }
  }
  throw new Error(
    'ffmpeg not found. Set FFMPEG_PATH to an ffmpeg binary, e.g.\n' +
      '  npm i --no-save ffmpeg-static && FFMPEG_PATH="$(node -p \\"require(\'ffmpeg-static\')\\")" node scripts/audio/build.mjs',
  );
}

function run(args, input) {
  const r = spawnSync(ffmpegPath(), ['-hide_banner', '-v', 'error', ...args], {
    input,
    maxBuffer: 1 << 30,
  });
  if (r.status !== 0) throw new Error(`ffmpeg ${args.join(' ')} failed:\n${r.stderr}`);
  return r.stdout;
}

/** Native channel count of an audio file (parsed from ffmpeg's stream info). */
export function probeChannels(path) {
  const r = spawnSync(ffmpegPath(), ['-hide_banner', '-i', path], { encoding: 'utf8' });
  const m = /Audio: [^\n]*?, (mono|stereo|(\d+) channels)/.exec(r.stderr);
  if (!m) throw new Error(`cannot read channel layout of ${path}`);
  return m[1] === 'mono' ? 1 : m[1] === 'stereo' ? 2 : Number(m[2]);
}

/**
 * Decode any audio file to float channels at the build sample rate.
 * @param {string} path
 * @param {{ channels?: number, start?: number, duration?: number }} [o]
 * @returns {Float32Array[]}
 */
export function decode(path, o = {}) {
  const ch = o.channels ?? 1;
  const args = [];
  if (o.start !== undefined) args.push('-ss', String(o.start));
  if (o.duration !== undefined) args.push('-t', String(o.duration));
  args.push('-i', path, '-f', 'f32le', '-acodec', 'pcm_f32le', '-ac', String(ch), '-ar', String(SR), '-');
  const raw = run(args);
  const f = new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.byteLength / 4));
  const frames = Math.floor(f.length / ch);
  const out = Array.from({ length: ch }, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++) for (let c = 0; c < ch; c++) out[c][i] = f[i * ch + c];
  return out;
}

/**
 * Encode a WAV master into a delivery format.
 * @param {string} wavPath
 * @param {string} outPath
 * @param {'ogg'|'mp3'|'m4a'} format
 * @param {{ music?: boolean, channels?: number }} o
 */
export function encode(wavPath, outPath, format, o = {}) {
  const stereo = (o.channels ?? 1) > 1;
  const args = ['-y', '-i', wavPath, '-map_metadata', '-1'];
  if (format === 'ogg') {
    // Vorbis: gapless (granule positions), so loops stay seamless in Chrome/Firefox.
    args.push('-c:a', 'libvorbis', '-q:a', o.music ? '3' : stereo ? '4' : '4');
  } else if (format === 'mp3') {
    args.push('-c:a', 'libmp3lame', '-b:a', o.music ? '112k' : stereo ? '128k' : '80k');
  } else if (format === 'm4a') {
    args.push('-c:a', 'aac', '-b:a', o.music ? '112k' : '96k', '-movflags', '+faststart');
  } else {
    throw new Error(`unknown format ${format}`);
  }
  args.push(outPath);
  run(args);
}
