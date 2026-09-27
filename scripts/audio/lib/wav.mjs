// Minimal WAV reader/writer for the audio build scripts.
// Channels are represented as an array of Float32Array in [-1, 1].
import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Read a PCM (8/16/24/32-bit int) or IEEE float (32/64-bit) WAV file.
 * @param {string} path
 * @returns {{ sampleRate: number, channels: Float32Array[] }}
 */
export function readWav(path) {
  const buf = readFileSync(path);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${path}: not a RIFF/WAVE file`);
  }
  let pos = 12;
  let fmt = null;
  let data = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    let size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;
    // ffmpeg writes 0xFFFFFFFF sizes when streaming; clamp to file length.
    if (body + size > buf.length) size = buf.length - body;
    if (id === 'fmt ') {
      let format = buf.readUInt16LE(body);
      const numChannels = buf.readUInt16LE(body + 2);
      const sampleRate = buf.readUInt32LE(body + 4);
      const bitsPerSample = buf.readUInt16LE(body + 14);
      if (format === 0xfffe && size >= 26) format = buf.readUInt16LE(body + 24); // WAVE_FORMAT_EXTENSIBLE
      fmt = { format, numChannels, sampleRate, bitsPerSample };
    } else if (id === 'data') {
      data = { start: body, size };
    }
    pos = body + size + (size & 1);
  }
  if (!fmt || !data) throw new Error(`${path}: missing fmt or data chunk`);
  const { format, numChannels, sampleRate, bitsPerSample } = fmt;
  const bytes = bitsPerSample / 8;
  const frames = Math.floor(data.size / (bytes * numChannels));
  const channels = Array.from({ length: numChannels }, () => new Float32Array(frames));
  let p = data.start;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < numChannels; c++) {
      let v;
      if (format === 3) {
        v = bitsPerSample === 64 ? buf.readDoubleLE(p) : buf.readFloatLE(p);
      } else if (bitsPerSample === 16) {
        v = buf.readInt16LE(p) / 32768;
      } else if (bitsPerSample === 24) {
        v = buf.readIntLE(p, 3) / 8388608;
      } else if (bitsPerSample === 32) {
        v = buf.readInt32LE(p) / 2147483648;
      } else if (bitsPerSample === 8) {
        v = (buf.readUInt8(p) - 128) / 128;
      } else {
        throw new Error(`${path}: unsupported bit depth ${bitsPerSample}`);
      }
      channels[c][i] = v;
      p += bytes;
    }
  }
  return { sampleRate, channels };
}

/**
 * Write 16-bit PCM (default) or 32-bit float WAV. 16-bit output is TPDF-dithered.
 * @param {string} path
 * @param {Float32Array[]} channels
 * @param {number} sampleRate
 * @param {{ float?: boolean, seed?: number }} [opts]
 */
export function writeWav(path, channels, sampleRate, opts = {}) {
  const float = opts.float === true;
  const numChannels = channels.length;
  const frames = channels[0].length;
  const bytes = float ? 4 : 2;
  const dataSize = frames * numChannels * bytes;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(float ? 3 : 1, 20);
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * numChannels * bytes, 28);
  buf.writeUInt16LE(numChannels * bytes, 32);
  buf.writeUInt16LE(bytes * 8, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataSize, 40);
  // Deterministic dither so rebuilding produces identical files.
  let s = (opts.seed ?? 0x9e3779b9) >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let p = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const v = channels[c][i];
      if (float) {
        buf.writeFloatLE(v, p);
      } else {
        const d = (rnd() - rnd()) / 32768;
        const q = Math.round(Math.max(-1, Math.min(1, v + d)) * 32767);
        buf.writeInt16LE(q, p);
      }
      p += bytes;
    }
  }
  writeFileSync(path, buf);
}
