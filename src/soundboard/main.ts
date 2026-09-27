// Dev-only soundboard: audition every AUDIO key, see its size, duration and credit.
// Served by Vite at /soundboard.html. Plain DOM + WebAudio (no Phaser).
import { AUDIO, AUDIO_KEYS, AUDIO_URLS, type AudioKey } from '../assets';
// The assets barrel does not re-export the manifest yet; switch to '../assets' once it does.
import { SOUND_CREDITS, type SoundCredit } from './credits';

const GROUPS: [string, AudioKey[]][] = [
  ['Music', ['musicTitle', 'musicMission', 'stingVictory', 'stingDefeat']],
  [
    'Player aircraft & weapons',
    ['engineLoop', 'gunLoop', 'gunTail', 'gunImpacts', 'rocketLaunch', 'missileLaunch', 'bombRelease', 'bombWhistle', 'lockTone', 'flare', 'dryFire', 'weaponSwitch'],
  ],
  ['Explosions', ['explosionSmall', 'explosionMedium', 'explosionLarge', 'explosionHuge']],
  ['Enemy fire & threats', ['aaFire', 'samLaunch', 'rwrLock', 'rwrLaunch', 'tankFire', 'smallArms', 'battleAmbience']],
  ['Player state', ['playerHit', 'playerExplode', 'rearmLoop', 'rearmComplete', 'lowHealth']],
  ['Radio & UI', ['radioIn', 'radioOut', 'objectiveComplete', 'objectiveFailed', 'uiMove', 'uiConfirm', 'uiBack', 'scoreTick']],
];

const MIME: Record<string, string> = {
  ogg: 'audio/ogg; codecs="vorbis"',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4; codecs="mp4a.40.2"',
};

/** Per-key load/decode status; exposed on window for automated checks. */
interface SoundStatus {
  url: string;
  bytes: number;
  /** Size of every format on disk (url → bytes). */
  formatBytes: Record<string, number>;
  duration?: number;
  channels?: number;
  length?: number;
  sampleRate?: number;
  error?: string;
}

const status = new Map<AudioKey, SoundStatus>();
const buffers = new Map<AudioKey, AudioBuffer>();
const playing = new Map<AudioKey, Set<AudioBufferSourceNode>>();
const ctx = new AudioContext();
const master = ctx.createGain();
master.connect(ctx.destination);

declare global {
  interface Window {
    __soundboard?: { status: Map<AudioKey, SoundStatus>; ready: Promise<void>; contextRate: number };
  }
}

function extOf(url: string): string {
  return url.slice(url.lastIndexOf('.') + 1).toLowerCase();
}

/** First URL whose format this browser can play (same rule as Phaser's loader). */
function pickUrl(urls: readonly string[]): string {
  const probe = document.createElement('audio');
  return urls.find((u) => probe.canPlayType(MIME[extOf(u)] ?? '') !== '') ?? urls[urls.length - 1] ?? '';
}

function fmtBytes(n: number): string {
  return n >= 1e6 ? `${(n / 1e6).toFixed(2)} MB` : `${(n / 1e3).toFixed(1)} kB`;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const c of children) node.append(c);
  return node;
}

function licenseBadges(credit: SoundCredit): HTMLElement[] {
  if (credit.sources.length === 0) return [el('span', { className: 'lic orig', textContent: 'ORIGINAL' })];
  const licenses = [...new Set(credit.sources.map((s) => s.license))];
  return licenses.map((l) => el('span', { className: `lic ${l.startsWith('CC0') ? 'cc0' : 'by'}`, textContent: l }));
}

function creditBlock(credit: SoundCredit): HTMLElement {
  const block = el('div', { className: 'credit' });
  block.append(...licenseBadges(credit), credit.method);
  for (const s of credit.sources) {
    const line = el('div');
    line.append('↳ ', el('a', { href: s.page, target: '_blank', rel: 'noopener', textContent: s.title }), ` — ${s.author} (${s.license}): ${s.use}`);
    block.append(line);
  }
  if (credit.sources.length === 0) block.append(el('div', { textContent: `↳ ${credit.recipe}` }));
  return block;
}

async function sizeOf(url: string): Promise<number> {
  const res = await fetch(url, { method: 'HEAD' });
  const len = Number(res.headers.get('content-length'));
  if (Number.isFinite(len) && len > 0) return len;
  return (await (await fetch(url)).arrayBuffer()).byteLength;
}

async function loadSound(key: AudioKey, meta: HTMLElement): Promise<void> {
  const urls = AUDIO_URLS[key];
  const url = pickUrl(urls);
  const st: SoundStatus = { url, bytes: 0, formatBytes: {} };
  status.set(key, st);
  try {
    await Promise.all(urls.map(async (u) => (st.formatBytes[u] = await sizeOf(u))));
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const data = await res.arrayBuffer();
    st.bytes = data.byteLength;
    const buf = await ctx.decodeAudioData(data);
    buffers.set(key, buf);
    st.duration = buf.duration;
    st.channels = buf.numberOfChannels;
    st.length = buf.length;
    st.sampleRate = buf.sampleRate;
    const sizes = urls.map((u) => `${extOf(u)} ${fmtBytes(st.formatBytes[u] ?? 0)}`).join(' · ');
    meta.textContent = `${buf.duration.toFixed(2)} s · ${buf.numberOfChannels === 1 ? 'mono' : 'stereo'} · playing ${extOf(url)} · ${sizes}`;
  } catch (e) {
    st.error = e instanceof Error ? e.message : String(e);
    meta.textContent = `failed: ${st.error}`;
    meta.classList.add('err');
    console.error(`[soundboard] ${key}: ${st.error}`);
  }
}

function stop(key: AudioKey): void {
  for (const src of playing.get(key) ?? []) src.stop();
  playing.get(key)?.clear();
}

function play(key: AudioKey, loop: boolean, row: HTMLElement): void {
  const buf = buffers.get(key);
  if (!buf) return;
  void ctx.resume();
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = loop;
  src.connect(master);
  const set = playing.get(key) ?? new Set<AudioBufferSourceNode>();
  playing.set(key, set);
  set.add(src);
  row.classList.add('playing');
  src.onended = () => {
    set.delete(src);
    if (set.size === 0) row.classList.remove('playing');
  };
  src.start();
}

function buildRow(key: AudioKey): { row: HTMLElement; meta: HTMLElement } {
  const spec = AUDIO[key];
  const credit = SOUND_CREDITS[key];
  const loopBox = el('input', { type: 'checkbox', checked: spec.loop });
  const meta = el('div', { className: 'meta', textContent: 'loading…' });
  const row = el('section', { className: 'row' });
  row.dataset['key'] = key;
  const playBtn = el('button', { textContent: '▶ play' });
  const stopBtn = el('button', { className: 'stop', textContent: '■ stop' });
  playBtn.addEventListener('click', () => play(key, loopBox.checked, row));
  stopBtn.addEventListener('click', () => stop(key));
  row.append(
    el('div', {}, el('div', { className: 'key', textContent: key }), el('div', { className: 'kind', textContent: `${spec.kind}${spec.loop ? ' · loop' : ''}` })),
    el('div', { className: 'controls' }, el('div', { className: 'buttons' }, playBtn, stopBtn), el('label', { className: 'meta' }, loopBox, ' loop')),
    el('div', {}, el('div', { className: 'note', textContent: spec.note }), meta, creditBlock(credit)),
  );
  return { row, meta };
}

async function main(): Promise<void> {
  const board = document.getElementById('board');
  const summary = document.getElementById('summary');
  const volume = document.getElementById('volume');
  const stopAll = document.getElementById('stopAll');
  if (!board || !summary || !(volume instanceof HTMLInputElement) || !stopAll) throw new Error('soundboard: page markup missing');

  master.gain.value = Number(volume.value);
  volume.addEventListener('input', () => (master.gain.value = Number(volume.value)));
  stopAll.addEventListener('click', () => AUDIO_KEYS.forEach(stop));

  const listed = new Set(GROUPS.flatMap(([, keys]) => keys));
  const groups: [string, AudioKey[]][] = [...GROUPS, ['Other', AUDIO_KEYS.filter((k) => !listed.has(k))]];
  const jobs: [AudioKey, HTMLElement][] = [];
  for (const [title, keys] of groups) {
    if (keys.length === 0) continue;
    board.append(el('h2', { textContent: title }));
    for (const key of keys) {
      const { row, meta } = buildRow(key);
      board.append(row);
      jobs.push([key, meta]);
    }
  }

  // Decode a few at a time.
  const queue = [...jobs];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) await loadSound(job[0], job[1]);
    }),
  );

  const all = [...status.values()];
  const totalBytes = all.reduce((acc, s) => acc + Object.values(s.formatBytes).reduce((a, b) => a + b, 0), 0);
  const credits = AUDIO_KEYS.map((k) => SOUND_CREDITS[k]);
  const original = credits.filter((c) => c.sources.length === 0).length;
  const cc0 = credits.filter((c) => c.sources.length > 0 && c.sources.every((s) => s.license.startsWith('CC0'))).length;
  const ccby = credits.length - original - cc0;
  const failed = all.filter((s) => s.error).length;
  summary.textContent =
    `${AUDIO_KEYS.length} sounds · ${fmtBytes(totalBytes)} on disk (all formats) · ` +
    `${cc0} CC0 · ${ccby} CC BY · ${original} original` +
    (failed ? ` · ${failed} FAILED` : '');
}

const ready = main().catch((e: unknown) => {
  console.error('[soundboard]', e);
});
window.__soundboard = { status, ready: ready.then(() => undefined), contextRate: ctx.sampleRate };
