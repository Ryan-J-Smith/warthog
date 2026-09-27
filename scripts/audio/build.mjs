#!/usr/bin/env node
// WARTHOG audio build: downloads the licensed source recordings, renders every AUDIO key
// (sourced, processed or synthesized), masters it, encodes delivery formats into
// public/assets/audio/, and regenerates src/assets/audioManifest.ts, src/soundboard/credits.ts
// and CREDITS.md.
//
// Usage:
//   FFMPEG_PATH=/path/to/ffmpeg node scripts/audio/build.mjs            # build everything
//   FFMPEG_PATH=… node scripts/audio/build.mjs --only gunLoop,gunTail    # rebuild some keys
//   FFMPEG_PATH=… node scripts/audio/build.mjs --preview <out-dir>    # masters only, no repo writes
//
// Deterministic: every random choice is seeded, so rebuilding yields identical audio.
import { mkdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as d from './lib/dsp.mjs';
import { writeWav } from './lib/wav.mjs';
import { encode } from './lib/ffmpeg.mjs';
import { analyse } from './lib/analysis.mjs';
import { SOURCES, CACHE_DIR, fetchAll } from './sources.mjs';
import { RECIPES } from './recipes/index.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_AUDIO = join(ROOT, 'public', 'assets', 'audio');

const args = process.argv.slice(2);
const argVal = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = argVal('--only')?.split(',').map((s) => s.trim());
const previewDir = argVal('--preview');

/** Keys declared in src/assets/audioKeys.ts (the contract), parsed without a TS toolchain. */
function contractKeys() {
  const src = readFileSync(join(ROOT, 'src', 'assets', 'audioKeys.ts'), 'utf8');
  const body = src.slice(src.indexOf('export const AUDIO = {'), src.indexOf('} as const'));
  return [...body.matchAll(/^\s+(\w+):\s*\{\s*kind:\s*'(music|sfx)',\s*loop:\s*(true|false)/gm)].map((m) => ({
    key: m[1],
    kind: m[2],
    loop: m[3] === 'true',
  }));
}

/**
 * Master a rendered sound: trim, loudness-normalise, peak-limit.
 * Loops are only gain-adjusted (plus a circular limiter) so their seams stay intact.
 */
function master(chs, spec) {
  let out = chs.map((c) => Float32Array.from(c));
  if (!spec.loop) {
    out = d.trimLeading(out, -54, 0.5);
    out = d.trimTrailing(out, -66, spec.kind === 'music' ? 400 : 30);
  }
  // Lossy codecs overshoot peaks by ~0.5 dB, so compressed one-shots master to -1.5 dBFS to land
  // near -1 dBFS after encoding; loops ship as PCM WAV and can use -1 dBFS directly.
  const ceiling = spec.peakDb ?? (spec.loop ? -1 : -1.5);
  const ceilLin = d.dbToGain(ceiling);
  // One pass: gain to the loudness target, but never ask the limiter for more than `maxLimitDb`
  // of gain reduction (repeated gain+limit passes flatten decays into a wall of sound).
  const a = analyse(out);
  const measured = spec.measure === 'integrated' ? a.integrated : a.momentaryMax;
  let gain = d.dbToGain(spec.lufs - measured);
  const maxOver = d.dbToGain(spec.maxLimitDb ?? (spec.loop ? 3 : 6));
  const pk = d.peakAll(out) * gain;
  if (pk > ceilLin * maxOver) gain *= (ceilLin * maxOver) / pk;
  out = out.map((c) => d.scale(c, gain));
  if (d.peakAll(out) > ceilLin && spec.kind !== 'music') {
    out = spec.loop
      ? d.processPeriodic(out, (x) => d.limit(x, ceiling, 2, 60), 2)
      : d.limit(out, ceiling, 1.5, 80);
  }
  // Final safety: never exceed the ceiling (loops: tiny overshoots from the periodic limiter).
  const p = d.peakAll(out);
  if (p > d.dbToGain(ceiling)) out = out.map((c) => d.scale(c, d.dbToGain(ceiling) / p));
  return out;
}

/**
 * Integer-factor downsample of a seamless loop, done circularly (tile ×3, filter + decimate,
 * keep the middle) so the anti-alias filter does not break the seam.
 */
function downsampleLoop(chs, factor) {
  if (!Number.isInteger(factor)) throw new Error(`downsampleLoop: factor ${factor} must be an integer`);
  return chs.map((c) => {
    const n = c.length;
    if (n % factor !== 0) throw new Error(`downsampleLoop: length ${n} not divisible by ${factor}`);
    const tiled = new Float32Array(n * 3);
    for (let r = 0; r < 3; r++) tiled.set(c, r * n);
    const filtered = d.lowpass4(d.lowpass4(tiled, (d.SR / factor) * 0.45), (d.SR / factor) * 0.45);
    const out = new Float32Array(n / factor);
    for (let i = 0; i < out.length; i++) out[i] = filtered[n + i * factor];
    return out;
  });
}

function fmtBytes(n) {
  return n > 1e6 ? `${(n / 1e6).toFixed(2)} MB` : `${(n / 1e3).toFixed(1)} kB`;
}

async function main() {
  const contract = contractKeys();
  const missing = contract.filter((c) => !RECIPES[c.key]).map((c) => c.key);
  if (missing.length && !only) throw new Error(`No recipe for: ${missing.join(', ')}`);
  for (const c of contract) {
    const r = RECIPES[c.key];
    if (!r) continue;
    if (r.kind !== c.kind || r.loop !== c.loop) {
      throw new Error(`${c.key}: recipe kind/loop (${r.kind}/${r.loop}) disagrees with audioKeys.ts (${c.kind}/${c.loop})`);
    }
  }
  await fetchAll();

  const keys = contract.map((c) => c.key).filter((k) => !only || only.includes(k));
  const mastersDir = previewDir ?? join(CACHE_DIR, 'masters');
  mkdirSync(mastersDir, { recursive: true });
  const report = [];
  for (const key of keys) {
    const spec = RECIPES[key];
    const t0 = Date.now();
    const chs = master(spec.build(), spec);
    const masterPath = join(mastersDir, `${key}.wav`);
    writeWav(masterPath, chs, d.SR);
    const a = analyse(chs);
    let files = [];
    if (!previewDir) {
      const dir = join(OUT_AUDIO, spec.kind === 'music' ? 'music' : 'sfx');
      mkdirSync(dir, { recursive: true });
      for (const fmt of spec.formats) {
        const out = join(dir, `${key}.${fmt}`);
        if (fmt === 'wav') {
          const rate = spec.wavRate ?? d.SR;
          writeWav(out, rate === d.SR ? chs : downsampleLoop(chs, d.SR / rate), rate);
        }
        else encode(masterPath, out, fmt, { music: spec.kind === 'music', channels: chs.length });
        files.push(out);
      }
    }
    report.push({ key, a, files, ms: Date.now() - t0 });
    const size = files.reduce((acc, f) => acc + statSync(f).size, 0);
    console.log(
      `${key.padEnd(18)} ${a.durationSec.toFixed(2).padStart(6)}s ${chs.length}ch peak ${a.peakDb.toFixed(1).padStart(5)} ` +
        `M ${a.momentaryMax.toFixed(1).padStart(5)} I ${a.integrated.toFixed(1).padStart(5)} ` +
        `${spec.loop ? `seam ${a.seamRatio.toFixed(2)}` : `lead ${a.leadingSilenceMs.toFixed(1)}ms`} ` +
        `${files.length ? fmtBytes(size) : ''} (${Date.now() - t0} ms)`,
    );
  }

  if (previewDir) return;
  if (missing.length) {
    console.log(`Skipping manifest/credits: no recipe yet for ${missing.join(', ')}`);
    return;
  }
  writeManifest(contract);
  writeCredits(contract);
  const total = contract
    .flatMap((c) => RECIPES[c.key].formats.map((f) => join(OUT_AUDIO, RECIPES[c.key].kind === 'music' ? 'music' : 'sfx', `${c.key}.${f}`)))
    .filter(existsSync)
    .reduce((acc, f) => acc + statSync(f).size, 0);
  console.log(`\nTotal audio payload on disk: ${fmtBytes(total)}`);
}

function urlsFor(key) {
  const spec = RECIPES[key];
  return spec.formats.map((f) => `assets/audio/${spec.kind === 'music' ? 'music' : 'sfx'}/${key}.${f}`);
}

function writeManifest(contract) {
  const lines = contract.map((c) => `  ${c.key}: [${urlsFor(c.key).map((u) => `'${u}'`).join(', ')}],`);
  const ts = `import type { AudioKey } from './audioKeys';

/**
 * Audio key → candidate URLs (relative to the site root) in preference order.
 * Phaser's loader picks the first format the browser can decode:
 * - loops: PCM WAV only, because browsers' Ogg/MP3 decoders pad short files and break the seam,
 * - one-shots and music: Ogg Vorbis with an MP3 fallback (Safari).
 *
 * Generated by scripts/audio/build.mjs — do not edit by hand.
 */
export const AUDIO_URLS: Record<AudioKey, string[]> = {
${lines.join('\n')}
};
`;
  writeFileSync(join(ROOT, 'src', 'assets', 'audioManifest.ts'), ts);
}

/** Credit rows per key: one per third-party source, or one "original" row. */
function creditRows(key) {
  const spec = RECIPES[key];
  const meta = spec;
  const recipeFile = `scripts/audio/recipes/${spec.file}`;
  const rows = meta.credits.map((c) => {
    const s = SOURCES[c.source.split(':')[0]];
    const member = c.source.includes(':') ? ` — ${c.source.split(':')[1]}` : '';
    return {
      title: `${s.title}${member}`,
      author: s.author,
      page: s.page,
      license: s.license,
      licenseUrl: s.licenseUrl,
      use: c.use,
      attribution: s.attribution ?? null,
    };
  });
  return { rows, method: meta.method, recipeFile, original: rows.length === 0 };
}

function writeCredits(contract) {
  const esc = (s) => s.replace(/\|/g, '\\|');
  const md = [];
  md.push('# Credits');
  md.push('');
  md.push('WARTHOG\'s audio combines recordings released under **CC0** (public domain), music released under');
  md.push('**CC BY 4.0** (attribution required), and original sounds synthesized by the scripts in');
  md.push('`scripts/audio/` (run `node scripts/audio/build.mjs` to regenerate every file, this document and the');
  md.push('audio manifest).');
  md.push('');
  md.push('## Music attribution (CC BY 4.0)');
  md.push('');
  const attributions = new Set();
  for (const c of contract) for (const r of creditRows(c.key).rows) if (r.attribution) attributions.add(r.attribution);
  for (const a of attributions) md.push(`- ${a}`);
  md.push('');
  md.push('## Audio assets');
  md.push('');
  md.push('| Key | File(s) | Title | Author | Source | License | Modifications |');
  md.push('|---|---|---|---|---|---|---|');
  const soundboard = {};
  for (const c of contract) {
    const files = urlsFor(c.key).map((u) => `\`public/${u}\``).join('<br>');
    const cr = creditRows(c.key);
    soundboard[c.key] = {
      method: cr.method,
      recipe: cr.recipeFile,
      sources: cr.rows.map((r) => ({ title: r.title, author: r.author, page: r.page, license: r.license, use: r.use })),
    };
    if (cr.original) {
      md.push(
        `| \`${c.key}\` | ${files} | ${esc(c.key)} (original) | WARTHOG project | original, synthesized by \`${cr.recipeFile}\` | Original work (project) | ${esc(cr.method)} |`,
      );
      continue;
    }
    cr.rows.forEach((r, i) => {
      const mods = i === 0 ? esc(cr.method) + ` (\`${cr.recipeFile}\`)` : `↑ ${esc(r.use)}`;
      md.push(
        `| \`${c.key}\` | ${i === 0 ? files : '〃'} | ${esc(r.title)} | ${esc(r.author)} | ${r.page} | [${r.license}](${r.licenseUrl}) | ${i === 0 ? `${esc(r.use)}. ${mods}` : mods} |`,
      );
    });
  }
  md.push('');
  md.push('## Sources');
  md.push('');
  md.push('- **qubodup (Freesound)** — military recordings extracted from US Government (DoD/DVIDS) footage, public');
  md.push('  domain, released as CC0: <https://freesound.org/people/qubodup/packs/4366/>. Files were taken from');
  md.push('  Freesound\'s high-quality previews.');
  md.push('- **Kenney** — Impact Sounds, Interface Sounds and UI Audio packs, CC0: <https://kenney.nl/assets>.');
  md.push('- **Kevin MacLeod** — <https://incompetech.com>, CC BY 4.0.');
  md.push('');
  md.push('## Fonts (SIL Open Font License 1.1)');
  md.push('');
  md.push('- *Black Ops One* by The Black-Ops Project Authors (James Grieshaber, Eben Sorkin). License text: `public/assets/fonts/BlackOpsOne-OFL.txt`.');
  md.push('- *Share Tech Mono* by Carrois Type Design (Ralph du Carrois). License text: `public/assets/fonts/ShareTechMono-OFL.txt`.');
  md.push('- Sources and checksums: `public/assets/fonts/FONTS_CREDITS.md`.');
  md.push('');
  md.push('## Art and engine');
  md.push('');
  md.push('- All sprites are original SVGs generated by `scripts/art/` (WARTHOG project). Terrain is procedurally baked at runtime.');
  md.push('- [Phaser](https://phaser.io) 3 — MIT License.');
  md.push('');
  writeFileSync(join(ROOT, 'CREDITS.md'), md.join('\n'));

  const ts = `/** Per-key audio credits for the soundboard. Generated by scripts/audio/build.mjs — do not edit by hand. */
import type { AudioKey } from '../assets';

export interface SoundSourceCredit {
  title: string;
  author: string;
  page: string;
  license: string;
  use: string;
}

export interface SoundCredit {
  /** How the sound was made (processing / synthesis summary). */
  method: string;
  /** Build recipe that produces it. */
  recipe: string;
  /** Third-party recordings used; empty for fully original sounds. */
  sources: SoundSourceCredit[];
}

export const SOUND_CREDITS: Record<AudioKey, SoundCredit> = ${JSON.stringify(soundboard, null, 2).replace(/"(\w+)":/g, '$1:')};
`;
  mkdirSync(join(ROOT, 'src', 'soundboard'), { recursive: true });
  writeFileSync(join(ROOT, 'src', 'soundboard', 'credits.ts'), ts);
  console.log(`Wrote ${relative(ROOT, join(ROOT, 'CREDITS.md'))}, src/assets/audioManifest.ts, src/soundboard/credits.ts`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
