import { WEAPON_BANDS } from '../../config';
import { ALTITUDE_BANDS, type AltitudeBand, type WeaponId } from '../../sim/types';

/** Friendly weapon labels for toasts and menus (the HUD slots use `WEAPON_NAMES`). */
export const WEAPON_LABEL: Record<WeaponId, string> = {
  gun: 'GUN',
  rockets: 'ROCKETS',
  maverick: 'MAVERICK',
  bombs: 'BOMBS',
};

export type WeaponBlock = 'noAmmo' | 'tooLow' | 'tooHigh';

export interface WeaponSlotStatus {
  usable: boolean;
  block: WeaponBlock | null;
  /** Short reason for a greyed-out slot, e.g. "TOO LOW ▲". */
  reason: string | null;
}

/** Same rule as the simulation: ammo first, then the weapon's allowed bands. */
export function weaponBlock(weapon: WeaponId, band: AltitudeBand, ammo: number): WeaponBlock | null {
  if (ammo <= 0) return 'noAmmo';
  const allowed = WEAPON_BANDS[weapon];
  if (allowed.includes(band)) return null;
  const index = ALTITUDE_BANDS.indexOf(band);
  const minAllowed = Math.min(...allowed.map((b) => ALTITUDE_BANDS.indexOf(b)));
  return index < minAllowed ? 'tooLow' : 'tooHigh';
}

const SLOT_REASON: Record<WeaponBlock, string> = {
  noAmmo: 'EMPTY · REARM',
  tooLow: 'TOO LOW ▲',
  tooHigh: 'TOO HIGH ▼',
};

export function weaponSlotStatus(weapon: WeaponId, band: AltitudeBand, ammo: number): WeaponSlotStatus {
  const block = weaponBlock(weapon, band, ammo);
  if (block === null) return { usable: true, block: null, reason: null };
  if (weapon === 'maverick' && block !== 'noAmmo') return { usable: false, block, reason: 'MED ONLY' };
  return { usable: false, block, reason: SLOT_REASON[block] };
}

/** Toast shown when the trigger is pulled on a weapon that can't fire. */
export function weaponToast(weapon: WeaponId, reason: WeaponBlock | 'noTarget'): string {
  const label = WEAPON_LABEL[weapon];
  switch (reason) {
    case 'tooLow':
      return weapon === 'maverick' ? `${label}: TOO LOW — CLIMB TO MEDIUM [W]` : `${label}: TOO LOW — CLIMB [W]`;
    case 'tooHigh':
      if (weapon === 'maverick') return `${label}: TOO HIGH — DIVE TO MEDIUM [S]`;
      return weapon === 'gun' ? `${label}: OUT OF RANGE — DIVE [S]` : `${label}: TOO HIGH — DIVE [S]`;
    case 'noAmmo':
      return `${label}: EMPTY — REARM AT BASE`;
    case 'noTarget':
      return `${label}: NO LOCK — POINT THE NOSE AT A TARGET`;
  }
}
