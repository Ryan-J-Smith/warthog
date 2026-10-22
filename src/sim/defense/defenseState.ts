import type { DefenseWaveDefinition, LevelDefinition } from '../level';
import type { Vec2 } from '../math';
import { STRUCTURES, type ArmoryId, type StructureId } from './catalog';
import { baseModifiers, type DefenseModifiers, type PerkId } from './perks';

export type DefensePhase = 'build' | 'wave' | 'won' | 'lost';

/** Runtime state of one build pad. */
export interface PadState {
  id: string;
  pos: Vec2;
  laneId: string;
  structure: StructureId | null;
  /** 0 = empty. */
  level: number;
  /** Garrison unit ids standing on this pad. */
  garrison: number[];
}

/** The base-defence game state the HUD and world overlay read. */
export interface DefenseState {
  phase: DefensePhase;
  /** Index of the current wave (during `wave`) or the next one (during `build`). */
  wave: number;
  totalWaves: number;
  gold: number;
  pads: PadState[];
  armory: Record<ArmoryId, number>;
  /** The pad last flown over during the build phase, which takes the number keys (`'armory'` = the home base). */
  activePad: string | null;
  /** Latest build feedback ("BUNKER BUILT", "NOT ENOUGH GOLD"), with the sim time it was set. */
  notice: { text: string; good: boolean; at: number } | null;
  /** Enemy wave units still alive this wave. */
  remaining: number;
  /** Draft cards on offer (pick one before launching the next wave), or null. */
  offer: PerkId[] | null;
  /** Perks taken this run, in order. */
  perks: PerkId[];
  mods: DefenseModifiers;
  /** Seconds out of the fight after being shot down. */
  respawnDelay: number;
  /** This run's waves (the level's, with roads shuffled when the level asks for it). */
  waves: DefenseWaveDefinition[];
}

/** Radius the player must be within (on the ground plane) to use a pad. */
export const PAD_RADIUS = 150;
/** Radius around the home base that opens the armory. */
export const ARMORY_RADIUS = 260;

/** Initial defence state for a level (null if it isn't a base-defence level). */
export function initDefense(level: LevelDefinition): DefenseState | null {
  const def = level.defense;
  if (!def) return null;
  return {
    phase: 'build',
    wave: 0,
    totalWaves: def.waves.length,
    gold: def.startGold,
    pads: def.pads.map((p) => ({ id: p.id, pos: { ...p.pos }, laneId: p.laneId, structure: null, level: 0, garrison: [] })),
    armory: { gun: 0, ordnance: 0, repair: 0 },
    activePad: null,
    notice: null,
    remaining: 0,
    offer: null,
    perks: [],
    mods: baseModifiers(),
    respawnDelay: def.respawnDelay,
    waves: def.waves.map((w) => ({ lanes: w.lanes.map((l) => ({ laneId: l.laneId, units: [...l.units] })) })),
  };
}

/** What building (or upgrading to) the next level of `id` costs right now, or undefined when maxed. */
export function structureCost(state: Readonly<DefenseState>, id: StructureId, currentLevel: number): number | undefined {
  const cost = STRUCTURES[id].costs[currentLevel];
  return cost === undefined ? undefined : Math.round(cost * state.mods.costMultiplier);
}
