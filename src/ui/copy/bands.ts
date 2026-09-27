import { BAND_PROFILES, WEAPON_BANDS } from '../../config';
import { ALTITUDE_BANDS, WEAPON_ORDER, type AltitudeBand } from '../../sim/types';
import { speedKnots } from '../format';
import { WEAPON_LABEL } from '../model';

export const BAND_LABEL: Record<AltitudeBand, string> = { low: 'LOW', medium: 'MED', high: 'HIGH' };
export const BAND_NAME: Record<AltitudeBand, string> = { low: 'LOW', medium: 'MEDIUM', high: 'HIGH' };

/** Which air defences can reach each band (mirrors the air-defence rules in the design doc). */
export const BAND_THREATS: Record<AltitudeBand, readonly ('AA' | 'SAM')[]> = {
  low: ['AA'],
  medium: ['AA', 'SAM'],
  high: ['SAM'],
};

/** Compact hints next to the HUD altitude ladder: what the band is good for, what can hit you. */
export const BAND_HINTS: Record<AltitudeBand, { good: string; threat: string }> = {
  low: { good: 'GUN · ROCKETS', threat: 'AA' },
  medium: { good: 'MAVERICK · BOMBS', threat: 'AA + SAM' },
  high: { good: 'BOMBS · FAST', threat: 'SAM' },
};

export interface BandPrimerRow {
  band: AltitudeBand;
  name: string;
  speed: string;
  weapons: string;
  threats: string;
  note: string;
}

const BAND_NOTE: Record<AltitudeBand, string> = {
  low: 'Nimble, under the SAM radar. Deadly gun runs \u2014 but AA guns shred you.',
  medium: 'Mavericks lock on, bombs land true. Everything can shoot at you.',
  high: 'Fast, wide view, spots threats early. Bombs scatter. Safe from AA.',
};

/** Altitude-band primer for How to Play, built from the tuning tables. */
export function bandPrimer(): BandPrimerRow[] {
  return [...ALTITUDE_BANDS].reverse().map((band) => ({
    band,
    name: BAND_NAME[band],
    speed: `${speedKnots(BAND_PROFILES[band].speed)} KT`,
    weapons: WEAPON_ORDER.filter((w) => WEAPON_BANDS[w].includes(band))
      .map((w) => WEAPON_LABEL[w])
      .join(' · '),
    threats: BAND_THREATS[band].join(' + '),
    note: BAND_NOTE[band],
  }));
}

export const PLAY_TIPS: readonly string[] = [
  'Rearm + repair: hold LOW over home base for 3 seconds.',
  'SAM locking you? Dive to LOW to break it, or pop flares [Q].',
  'Only bombs can drop the bridge. The clock never stops — triage.',
];
