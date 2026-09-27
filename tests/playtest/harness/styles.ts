import type { FlightStyle } from './tasks';

/** Transit at Medium, gun runs at Low, level bombing from Medium. The "sensible" default. */
export const BALANCED: FlightStyle = {
  name: 'balanced',
  transitBand: 'medium',
  attackEntry: 1000,
  avoidSam: true,
  directWeapons: ['gun', 'rockets'],
  gunBand: 'low',
  bombBand: 'medium',
  popUpBombs: false,
  stick: 2,
};

/** Never leaves Low except to pop up for bombs. Below SAM radar the whole time. */
export const HUGGER: FlightStyle = {
  name: 'hugger',
  transitBand: 'low',
  attackEntry: 1000,
  avoidSam: false,
  directWeapons: ['gun', 'rockets'],
  gunBand: 'low',
  bombBand: 'medium',
  popUpBombs: true,
  stick: 2,
};

/** Transit High (fast, AA-proof), dive to Low for gun runs, toss bombs from High. */
export const HIGH_DIVER: FlightStyle = {
  name: 'highDiver',
  transitBand: 'high',
  attackEntry: 1100,
  avoidSam: true,
  directWeapons: ['gun', 'rockets'],
  gunBand: 'low',
  bombBand: 'high',
  popUpBombs: false,
  stick: 3,
};

/** Sits at Medium and plinks with Mavericks first, then rockets, then the gun from Medium. */
export const MEDIUM_SNIPER: FlightStyle = {
  name: 'mediumSniper',
  transitBand: 'medium',
  attackEntry: 1000,
  avoidSam: true,
  directWeapons: ['maverick', 'rockets', 'gun'],
  gunBand: 'medium',
  bombBand: 'medium',
  popUpBombs: false,
  stick: 2,
};

export const STYLES: readonly FlightStyle[] = [BALANCED, HUGGER, HIGH_DIVER, MEDIUM_SNIPER];
