// Catalogue of every third-party recording the audio build uses, with licence details.
// Each licence was verified on the linked source page. build.mjs downloads these into a cache
// directory (AUDIO_CACHE_DIR, default <tmp>/warthog-audio-cache) and generates CREDITS.md from them.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decode } from './lib/ffmpeg.mjs';
import { readZip } from './lib/zip.mjs';

const CC0 = 'CC0 1.0';
const CCBY4 = 'CC BY 4.0';

const qubodup = (id, title, previewPath) => ({
  title,
  author: 'qubodup (Freesound)',
  page: `https://freesound.org/s/${id}/`,
  url: `https://cdn.freesound.org/previews/${previewPath}-hq.mp3`,
  license: CC0,
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  note: 'US Government (DoD/DVIDS) footage audio, public domain; released as CC0 by the uploader.',
});

const kenney = (slug, title, zipUrl) => ({
  title,
  author: 'Kenney (kenney.nl)',
  page: `https://kenney.nl/assets/${slug}`,
  url: zipUrl,
  zip: true,
  license: CC0,
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
});

const macleod = (title, isrc) => ({
  title,
  author: 'Kevin MacLeod (incompetech.com)',
  page: `https://incompetech.com/music/royalty-free/index.html?isrc=${isrc}`,
  url: `https://incompetech.com/music/royalty-free/mp3-royaltyfree/${encodeURIComponent(title)}.mp3`,
  license: CCBY4,
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  attribution: `"${title}" Kevin MacLeod (incompetech.com) Licensed under Creative Commons: By Attribution 4.0 License http://creativecommons.org/licenses/by/4.0/`,
});

/** @type {Record<string, {title:string, author:string, page:string, url:string, license:string, licenseUrl:string, zip?:boolean, note?:string, attribution?:string}>} */
export const SOURCES = {
  // --- Freesound: qubodup's military sounds (US Government footage, CC0) -------------
  a10: qubodup(205582, 'A-10.ogg (A-10 Warthog flyby and shooting)', '205/205582_71257'),
  hawkLaunch: qubodup(67544, 'mim-23_hawk_missile_launch_1.flac', '67/67544_71257'),
  hellfire: qubodup(162368, 'AGM-114 Hellfire Rocket Missile Launch.flac', '162/162368_71257'),
  rpgLaunch: qubodup(162361, 'Launching/Shooting Propelled Grenade', '162/162361_71257'),
  mk46Single: qubodup(162258, 'Mk 46 30mm gun - single shot', '162/162258_71257'),
  tankFiring: qubodup(168707, 'Tank Firing', '168/168707_71257'),
  mgBurst: qubodup(67582, 'machine_gun_burst_1.flac', '67/67582_71257'),
  rifleFirefight: qubodup(67593, 'rifle_firefight_1.flac', '67/67593_71257'),
  explosive: qubodup(162265, 'Explosive', '162/162265_71257'),
  explosion: qubodup(174281, 'Explosion gMPnaYlErS0', '174/174281_71257'),
  mclc: qubodup(162261, 'Explosion of mine-clearing line charge (MCLC)', '162/162261_71257'),
  grenade: qubodup(67472, 'M67 Fragmentation Grenade Explosion 3', '67/67472_71257'),
  eod: qubodup(855798, 'EOD Explosion', '855/855798_71257'),
  blast: qubodup(855893, 'Blast', '855/855893_71257'),
  blowUp: qubodup(855896, 'Blow Up Sound', '855/855896_71257'),
  fireExplosion: qubodup(855898, 'Fire Explosion', '855/855898_71257'),
  distantGrenade: qubodup(162363, 'Distant Explosion of Propelled Grenade', '162/162363_71257'),
  metalCrash: qubodup(67617, 'Metal Crash Collision', '67/67617_71257'),
  kc135Wind: qubodup(162417, 'Jet Plane Wind Noise Loop of a KC-135 Stratotanker 1.flac', '162/162417_71257'),

  // --- Kenney audio packs (CC0) ---------------------------------------------------------
  kenneyImpact: kenney(
    'impact-sounds',
    'Impact Sounds',
    'https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip',
  ),
  kenneyInterface: kenney(
    'interface-sounds',
    'Interface Sounds',
    'https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip',
  ),
  kenneyUi: kenney(
    'ui-audio',
    'UI Audio',
    'https://kenney.nl/media/pages/assets/ui-audio/490d233f68-1677590494/kenney_ui-audio.zip',
  ),

  // --- Kevin MacLeod / incompetech (CC BY 4.0) -----------------------------------------
  atLaunch: macleod('At Launch', 'USUAN1100539'),
  darkling: macleod('Darkling', 'USUAN1700050'),
  discoveryHit: macleod('Discovery Hit', 'USUAN1300023'),
  gretaSting: macleod('Greta Sting', 'USUAN1100530'),
  clashDefiant: macleod('Clash Defiant', 'USUAN1600003'),
  blownAway: macleod('Blown Away', 'USUAN1200100'),
};

export const CACHE_DIR = process.env.AUDIO_CACHE_DIR ?? join(tmpdir(), 'warthog-audio-cache');

/** Download a source (once) and return its local path. */
export async function fetchSource(id) {
  const src = SOURCES[id];
  if (!src) throw new Error(`unknown source ${id}`);
  mkdirSync(CACHE_DIR, { recursive: true });
  const ext = src.zip ? 'zip' : src.url.split('.').pop();
  const path = join(CACHE_DIR, `${id}.${ext}`);
  if (!existsSync(path)) {
    process.stdout.write(`  downloading ${id} …\n`);
    const res = await fetch(src.url, { headers: { 'User-Agent': 'Mozilla/5.0 (warthog audio build)' } });
    if (!res.ok) throw new Error(`download ${src.url}: HTTP ${res.status}`);
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  return path;
}

/** Download every source (or just `ids`) up front so recipes can load synchronously. */
export async function fetchAll(ids = Object.keys(SOURCES)) {
  for (const id of ids) await fetchSource(id);
}

const decodedCache = new Map();

/**
 * Load a source (or a member of a zip source) as mono or stereo float channels at the build rate.
 * Call fetchAll() first.
 * @param {string} id  source id, or "id:path/inside.zip"
 * @param {{ channels?: number, start?: number, duration?: number }} [o]
 * @returns {Float32Array[]}
 */
export function load(id, o = {}) {
  const key = `${id}|${o.channels ?? 1}|${o.start ?? ''}|${o.duration ?? ''}`;
  if (decodedCache.has(key)) return decodedCache.get(key).map((c) => c.slice());
  const [srcId, member] = id.split(':');
  const src = SOURCES[srcId];
  if (!src) throw new Error(`unknown source ${srcId}`);
  const ext = src.zip ? 'zip' : src.url.split('.').pop();
  let path = join(CACHE_DIR, `${srcId}.${ext}`);
  if (!existsSync(path)) throw new Error(`source ${srcId} not downloaded; call fetchAll() first`);
  if (src.zip) {
    if (!member) throw new Error(`${srcId} is a zip; use "${srcId}:path/in/zip"`);
    const entries = readZip(path);
    const hit = [...entries.keys()].find((k) => k === member || k.endsWith(`/${member}`));
    if (!hit) throw new Error(`${srcId}: no zip member ${member}`);
    const out = join(CACHE_DIR, `${srcId}__${hit.replace(/[\\/]/g, '_')}`);
    if (!existsSync(out)) writeFileSync(out, entries.get(hit)());
    path = out;
  }
  const chs = decode(path, o);
  decodedCache.set(key, chs);
  return chs.map((c) => c.slice());
}

/** Mono convenience wrapper. */
export function loadMono(id, o = {}) {
  return load(id, { ...o, channels: 1 })[0];
}
