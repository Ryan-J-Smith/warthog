/** Between-wave draft cards: after every wave but the last, pick one of three. */
export type PerkId =
  | 'warBonds'
  | 'veterans'
  | 'sandbags'
  | 'discount'
  | 'supplyDrop'
  | 'gunOverdrive'
  | 'hardpoints'
  | 'reinforcedBase'
  | 'quickTurnaround'
  | 'longFlak'
  | 'reinforcements';

export interface PerkDefinition {
  id: PerkId;
  name: string;
  blurb: string;
  /** Can be offered again after being taken. */
  repeatable: boolean;
}

export const PERKS: Record<PerkId, PerkDefinition> = {
  warBonds: { id: 'warBonds', name: 'WAR BONDS', blurb: 'Your kills pay +50% gold', repeatable: false },
  veterans: { id: 'veterans', name: 'VETERAN CREWS', blurb: 'All structure units hit 30% harder', repeatable: true },
  sandbags: { id: 'sandbags', name: 'SANDBAGS', blurb: 'All structure units are 40% tougher', repeatable: true },
  discount: { id: 'discount', name: 'REQUISITIONS', blurb: 'Structures cost 25% less', repeatable: false },
  supplyDrop: { id: 'supplyDrop', name: 'SUPPLY DROP', blurb: '+150 gold right now', repeatable: true },
  gunOverdrive: { id: 'gunOverdrive', name: 'DEPLETED URANIUM', blurb: 'GAU-8 damage +40%', repeatable: true },
  hardpoints: { id: 'hardpoints', name: 'EXTRA PYLONS', blurb: '+4 bombs and +2 Mavericks', repeatable: true },
  reinforcedBase: { id: 'reinforcedBase', name: 'REINFORCED BASE', blurb: 'Base integrity +25% and patched up', repeatable: true },
  quickTurnaround: { id: 'quickTurnaround', name: 'HOT SPARE', blurb: 'Respawn in 3 s instead of 8', repeatable: false },
  longFlak: { id: 'longFlak', name: 'RADAR-GUIDED FLAK', blurb: 'Flak range +30%, fires faster', repeatable: false },
  reinforcements: { id: 'reinforcements', name: 'REINFORCEMENTS', blurb: 'Barracks and depots send +2 units', repeatable: true },
};

export const PERK_ORDER: readonly PerkId[] = Object.keys(PERKS) as PerkId[];

/** Cards per draft. */
export const DRAFT_SIZE = 3;

/** Run-wide modifiers the perks build up. */
export interface DefenseModifiers {
  goldMultiplier: number;
  unitDamage: number;
  unitHp: number;
  costMultiplier: number;
  gunDamage: number;
  flakRange: number;
  flakRate: number;
  sortieExtra: number;
}

export function baseModifiers(): DefenseModifiers {
  return { goldMultiplier: 1, unitDamage: 1, unitHp: 1, costMultiplier: 1, gunDamage: 1, flakRange: 1, flakRate: 1, sortieExtra: 0 };
}
