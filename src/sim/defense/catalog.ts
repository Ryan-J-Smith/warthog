import type { EntityKind } from '../types';

export type StructureId = 'barracks' | 'depot' | 'bunker' | 'flak';
export type ArmoryId = 'gun' | 'ordnance' | 'repair';

/** What a pad structure does at each level (index 0 = level 1). */
export interface StructureDefinition {
  id: StructureId;
  name: string;
  /** Short HUD blurb. */
  blurb: string;
  /** Cost to build (level 1), then to upgrade to each further level. */
  costs: readonly number[];
  /**
   * Units sent up the pad's road at the start of every wave (`sortie`), or dug in on the pad and
   * replaced between waves (`garrison`), or a flak battery that shoots gunships (`flak`).
   */
  mode: 'sortie' | 'garrison' | 'flak';
  /** The unit fielded (sortie / garrison). */
  unit: EntityKind;
  /** Units per level. */
  count: readonly number[];
  /** The units are tougher and hit harder than the stock friendly kinds (per level). */
  hpMultiplier: readonly number[];
  damageMultiplier: readonly number[];
  /** Flak battery guns, per level. */
  flak?: { range: readonly number[]; damage: readonly number[]; cooldown: readonly number[] };
}

export const STRUCTURES: Record<StructureId, StructureDefinition> = {
  barracks: {
    id: 'barracks',
    name: 'BARRACKS',
    blurb: 'Infantry squad marches out each wave',
    costs: [60, 90],
    mode: 'sortie',
    unit: 'friendlyInfantry',
    count: [4, 8],
    hpMultiplier: [1.5, 1.5],
    damageMultiplier: [2.5, 3],
  },
  depot: {
    id: 'depot',
    name: 'TANK DEPOT',
    blurb: 'Tanks roll out each wave',
    costs: [110, 140],
    mode: 'sortie',
    unit: 'friendlyTank',
    count: [2, 4],
    hpMultiplier: [1.5, 2],
    damageMultiplier: [3, 3.5],
  },
  bunker: {
    id: 'bunker',
    name: 'BUNKER',
    blurb: 'Dug-in guns hold the road; rebuilt between waves',
    costs: [80, 100],
    mode: 'garrison',
    unit: 'friendlyTank',
    count: [3, 5],
    hpMultiplier: [1.6, 2],
    damageMultiplier: [1.5, 2],
  },
  flak: {
    id: 'flak',
    name: 'FLAK BATTERY',
    blurb: 'Shoots down gunships in range; ignores ground units',
    costs: [90, 110],
    mode: 'flak',
    unit: 'aaGun',
    count: [0, 0],
    hpMultiplier: [1, 1],
    damageMultiplier: [1, 1],
    flak: { range: [700, 850], damage: [8, 11], cooldown: [0.8, 0.55] },
  },
};

/** Build menu order on an empty pad: keys 1–4. */
export const STRUCTURE_ORDER: readonly StructureId[] = ['barracks', 'depot', 'bunker', 'flak'];

/** Aircraft and base upgrades bought over the home base between waves. */
export interface ArmoryDefinition {
  id: ArmoryId;
  name: string;
  blurb: string;
  costs: readonly number[];
}

export const ARMORY: Record<ArmoryId, ArmoryDefinition> = {
  gun: { id: 'gun', name: 'GAU-8 ROUNDS', blurb: '+50% gun damage', costs: [70, 110, 160] },
  ordnance: { id: 'ordnance', name: 'HARDPOINTS', blurb: '+4 bombs, +2 Mavericks, +4 rockets', costs: [70, 110, 160] },
  repair: { id: 'repair', name: 'REPAIR BASE', blurb: 'Restore 30% base integrity', costs: [60, 60, 60, 60, 60, 60, 60, 60] },
};

export const ARMORY_ORDER: readonly ArmoryId[] = ['gun', 'ordnance', 'repair'];

/** Gun damage multiplier per armory gun level. */
export const GUN_DAMAGE_STEP = 0.5;
/** Hardpoint capacity per armory ordnance level. */
export const ORDNANCE_STEP = { bombs: 4, maverick: 2, rockets: 4 } as const;
/** Share of the base's max integrity restored per repair. */
export const REPAIR_FRACTION = 0.3;
