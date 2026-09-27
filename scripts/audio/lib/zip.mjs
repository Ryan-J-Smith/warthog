// Minimal ZIP reader (stored + deflate) so the build needs no unzip binary.
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

/**
 * List and read entries of a zip archive.
 * @param {string} path
 * @returns {Map<string, () => Buffer>} entry name → lazy reader
 */
export function readZip(path) {
  const buf = readFileSync(path);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error(`${path}: not a zip file`);
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let e = 0; e < count; e++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error(`${path}: bad central directory`);
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    entries.set(name, () => {
      const ln = buf.readUInt16LE(local + 26);
      const lx = buf.readUInt16LE(local + 28);
      const start = local + 30 + ln + lx;
      const data = buf.subarray(start, start + compSize);
      if (method === 0) return Buffer.from(data);
      if (method === 8) return inflateRawSync(data);
      throw new Error(`${path}:${name}: unsupported compression ${method}`);
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}
