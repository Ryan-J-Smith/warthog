import {
  ARMORY,
  ARMORY_ORDER,
  ARMORY_RADIUS,
  GUN_DAMAGE_STEP,
  ORDNANCE_STEP,
  PAD_RADIUS,
  REPAIR_FRACTION,
  STRUCTURES,
  STRUCTURE_ORDER,
  type ArmoryId,
  type DefenseState,
  type PadState,
  type StructureDefinition,
  type StructureId,
} from '../defense';
import type { Entity } from '../entities';
import type { DefenseDefinition } from '../level';
import type { PlayerLoadout } from '../loadout';
import { angleOf, distance, normalize, sub, type Vec2 } from '../math';
import { damageEntity } from '../combat';
import { createEntity } from '../spawning';
import type { EntityKind, WeaponId } from '../types';
import type { World } from '../world';
import { endMission } from './missionSystem';
import { SimSystem, type StepContext } from './simSystem';
import { offsetPath } from './waveSystem';

/** Enemy wave units (the wave is over when none are left alive). */
export const DEFENSE_WAVE_TAG = 'defenseWave';
/** Friendly units sent up a road by a barracks or depot (recalled when the wave ends). */
export const DEFENSE_SORTIE_TAG = 'defenseSortie';
/** Friendly units dug in on a bunker pad. */
export const DEFENSE_GARRISON_TAG = 'defenseGarrison';

/** Lateral offsets of a wave's files from the road centre line. */
const FILE_OFFSETS = [0, -50, 50] as const;
const RANK_SPACING = 70;
/** Sortie march speeds (friendly kinds have no default path speed). */
const SORTIE_SPEED: Partial<Record<EntityKind, number>> = { friendlyInfantry: 30, friendlyTank: 34 };
/** Wrecks older than this are cleared away when a wave ends. */
const WRECK_KEEP = 8;
/** Flak shell speed (world units / s) and how close to the aim point a gunship must be to be hit. */
const FLAK_SPEED = 900;
const FLAK_BURST_RADIUS = 70;

/** A flak shell in flight. */
interface FlakShell {
  landsAt: number;
  to: Vec2;
  targetId: number;
  damage: number;
}

/** Number keys 1–4 pick the build / armory option (they double as weapon keys in flight). */
const OPTION_INDEX: Partial<Record<WeaponId, number>> = { gun: 0, rockets: 1, maverick: 2, bombs: 3 };

/**
 * Base defence: a build phase with no clock (fly over a pad and press 1–3 to build or upgrade,
 * over the home base to buy aircraft upgrades, R to launch the wave), then a wave phase where the
 * previewed enemy wave drives down its roads at the base while your structures' units fight it.
 * Clearing the last wave wins; losing the base loses. Player kills pay gold.
 */
export class DefenseSystem extends SimSystem {
  private paidKillPoints = 0;
  private baseLoadout: Readonly<PlayerLoadout> | null = null;
  private flakShells: FlakShell[] = [];
  /** The weapon selected before this step (a build key also selects a weapon; this undoes that). */
  private lastWeapon: WeaponId | null = null;
  /** Next time each flak pad may fire. */
  private readonly flakReady = new Map<string, number>();

  update({ world, input }: StepContext): void {
    const def = world.level.defense;
    const state = world.defense;
    if (!def || !state || world.ended) return;
    this.baseLoadout ??= world.loadout;
    this.payKills(world, def, state);
    const weaponBefore = this.lastWeapon;
    this.lastWeapon = world.player.selectedWeapon;

    const base = world.findByRef(def.baseRefId);
    if (!base || !base.alive) {
      state.phase = 'lost';
      endMission(world, 'defeat');
      return;
    }
    this.updateObjective(world, def, state);

    if (state.phase === 'build') {
      // The aircraft can't hover, so the selection sticks: the last pad flown over stays selected
      // (and takes the number keys) until another pad is flown over.
      state.activePad = activePad(world, state) ?? state.activePad;
      const option = input.select ? OPTION_INDEX[input.select] : undefined;
      if (option !== undefined && state.activePad) {
        this.choose(world, def, state, state.activePad, option);
        // The number key was a build order, not a weapon change.
        if (weaponBefore) {
          world.player.selectedWeapon = weaponBefore;
          this.lastWeapon = weaponBefore;
        }
      }
      if (input.ready) this.launchWave(world, def, state);
    } else if (state.phase === 'wave') {
      state.activePad = null;
      this.updateFlak(world, state);
      state.remaining = world.entities.filter((e) => e.alive && e.tags.includes(DEFENSE_WAVE_TAG)).length;
      if (state.remaining === 0) this.waveCleared(world, def, state);
    }
  }

  /** Flak batteries fire led shells at gunships in range; shells burst after their flight time. */
  private updateFlak(world: World, state: DefenseState): void {
    const landed = this.flakShells.filter((s) => s.landsAt <= world.time);
    this.flakShells = this.flakShells.filter((s) => s.landsAt > world.time);
    for (const shell of landed) {
      const target = world.findById(shell.targetId);
      const hit = target !== undefined && target.alive && distance(target.pos, shell.to) <= FLAK_BURST_RADIUS + target.radius;
      if (hit && target) damageEntity(world, target, shell.damage, 'flak');
      world.emit({ type: 'flakBurst', pos: { ...shell.to }, hit });
    }
    for (const pad of state.pads) {
      const flak = pad.structure ? STRUCTURES[pad.structure].flak : undefined;
      if (!flak || (this.flakReady.get(pad.id) ?? 0) > world.time) continue;
      const i = pad.level - 1;
      const range = flak.range[i] ?? 0;
      let target: Entity | null = null;
      let best = range;
      for (const e of world.entities) {
        if (!e.alive || e.hidden || e.team !== 'enemy' || !e.heli) continue;
        const d = distance(e.pos, pad.pos);
        if (d <= best) {
          best = d;
          target = e;
        }
      }
      if (!target || !target.heli) continue;
      this.flakReady.set(pad.id, world.time + (flak.cooldown[i] ?? 1));
      // Lead the gunship by its current velocity over the shell's flight time.
      const flight = best / FLAK_SPEED;
      const to = { x: target.pos.x + target.heli.vel.x * flight, y: target.pos.y + target.heli.vel.y * flight };
      const flightTime = distance(pad.pos, to) / FLAK_SPEED;
      this.flakShells.push({ landsAt: world.time + flightTime, to, targetId: target.id, damage: flak.damage[i] ?? 0 });
      world.emit({ type: 'flakFired', from: { ...pad.pos }, to, flightTime });
    }
  }

  private payKills(world: World, def: DefenseDefinition, state: DefenseState): void {
    const points = world.stats.killPoints;
    const owed = Math.floor(points * def.goldPerKillPoint) - Math.floor(this.paidKillPoints * def.goldPerKillPoint);
    this.paidKillPoints = points;
    if (owed > 0) state.gold += owed;
  }

  private updateObjective(world: World, def: DefenseDefinition, state: DefenseState): void {
    const o = world.objectives.find((ob) => ob.kind === 'defend');
    const base = world.findByRef(def.baseRefId);
    if (!o || !base || o.status !== 'active') return;
    const pct = Math.ceil((base.hp / base.maxHp) * 100);
    const wave = Math.min(state.wave + 1, state.totalWaves);
    o.detail = state.phase === 'wave' ? `Wave ${wave}/${state.totalWaves} · ${state.remaining} left · ${pct}%` : `Build phase · next wave ${wave}/${state.totalWaves} · ${pct}%`;
  }

  private choose(world: World, def: DefenseDefinition, state: DefenseState, padId: string, option: number): void {
    if (padId === 'armory') {
      const id = ARMORY_ORDER[option];
      if (id) this.buyArmory(world, def, state, id);
      return;
    }
    const pad = state.pads.find((p) => p.id === padId);
    if (!pad) return;
    if (pad.structure === null) {
      const id = STRUCTURE_ORDER[option];
      if (id) this.build(world, def, state, pad, id);
    } else if (option === 0) {
      this.build(world, def, state, pad, pad.structure);
    }
  }

  private build(world: World, def: DefenseDefinition, state: DefenseState, pad: PadState, id: StructureId): void {
    const s = STRUCTURES[id];
    const cost = s.costs[pad.level];
    if (cost === undefined) return notice(world, state, `${s.name} IS FULLY UPGRADED`, false);
    if (state.gold < cost) return notice(world, state, `NEED ${cost} GOLD FOR ${s.name}`, false);
    state.gold -= cost;
    const upgrade = pad.level > 0;
    pad.structure = id;
    pad.level += 1;
    if (s.mode === 'garrison') {
      // An upgrade re-forms the garrison on the bigger slot ring.
      if (upgrade) {
        const old = new Set(pad.garrison);
        world.entities = world.entities.filter((e) => !old.has(e.id));
        pad.garrison = [];
      }
      refillGarrison(world, def, pad);
    }
    notice(world, state, upgrade ? `${s.name} UPGRADED TO LEVEL ${pad.level}` : `${s.name} BUILT`, true);
    world.emit({ type: 'structureBuilt', padId: pad.id, structure: id, level: pad.level, pos: { ...pad.pos } });
  }

  private buyArmory(world: World, def: DefenseDefinition, state: DefenseState, id: ArmoryId): void {
    const a = ARMORY[id];
    const level = state.armory[id];
    const cost = a.costs[level];
    if (cost === undefined) return notice(world, state, `${a.name} IS MAXED`, false);
    const base = world.findByRef(def.baseRefId);
    if (id === 'repair' && base && base.hp >= base.maxHp) return notice(world, state, 'BASE IS AT FULL INTEGRITY', false);
    if (state.gold < cost) return notice(world, state, `NEED ${cost} GOLD FOR ${a.name}`, false);
    state.gold -= cost;
    state.armory[id] = level + 1;
    const stock = this.baseLoadout ?? world.loadout;
    const p = world.player;
    if (id === 'gun') {
      world.loadout = { ...world.loadout, gunDamageMultiplier: stock.gunDamageMultiplier * (1 + GUN_DAMAGE_STEP * state.armory.gun) };
    } else if (id === 'ordnance') {
      const ammo = { ...world.loadout.ammo };
      ammo.bombs += ORDNANCE_STEP.bombs;
      ammo.maverick += ORDNANCE_STEP.maverick;
      ammo.rockets += ORDNANCE_STEP.rockets;
      world.loadout = { ...world.loadout, ammo };
      p.ammo = { ...ammo, gun: p.ammo.gun };
    } else if (base) {
      base.hp = Math.min(base.maxHp, base.hp + base.maxHp * REPAIR_FRACTION);
    }
    notice(world, state, `${a.name} — ${a.blurb.toUpperCase()}`, true);
    world.emit({ type: 'armoryBought', item: id, level: state.armory[id] });
  }

  private launchWave(world: World, def: DefenseDefinition, state: DefenseState): void {
    const wave = def.waves[state.wave];
    if (!wave) return;
    state.phase = 'wave';
    state.activePad = null;
    for (const group of wave.lanes) {
      const lane = def.lanes.find((l) => l.id === group.laneId);
      const path = lane ? world.level.paths[lane.pathId] : undefined;
      if (!lane || !path || path.length < 2) throw new Error(`Defence wave: bad lane ${group.laneId}`);
      group.units.forEach((kind, i) => {
        const filePath = offsetPath(path, FILE_OFFSETS[i % FILE_OFFSETS.length] ?? 0);
        const rank = Math.floor(i / FILE_OFFSETS.length);
        const [p0, p1] = filePath as [Vec2, Vec2, ...Vec2[]];
        const dir = normalize(sub(p1, p0));
        const pos = { x: p0.x - dir.x * RANK_SPACING * rank, y: p0.y - dir.y * RANK_SPACING * rank };
        world.entities.push(
          createEntity(world, kind, pos, {
            headingRad: angleOf(dir),
            tags: [DEFENSE_WAVE_TAG, `lane:${lane.id}`],
            path: filePath,
            speed: def.waveSpeed,
          }),
        );
      });
    }
    for (const pad of state.pads) if (pad.structure) this.sortie(world, def, pad);
    state.remaining = world.entities.filter((e) => e.alive && e.tags.includes(DEFENSE_WAVE_TAG)).length;
    world.emit({ type: 'defenseWaveStarted', wave: state.wave, total: state.totalWaves });
  }

  /** A barracks or depot sends its units up its road toward the enemy. */
  private sortie(world: World, def: DefenseDefinition, pad: PadState): void {
    const s = STRUCTURES[pad.structure ?? 'barracks'];
    if (s.mode !== 'sortie') return;
    const route = sortieRoute(world, def, pad);
    const count = s.count[pad.level - 1] ?? 0;
    for (let i = 0; i < count; i++) {
      const offset = FILE_OFFSETS[i % FILE_OFFSETS.length] ?? 0;
      const filePath = offsetPath(route, offset);
      const rank = Math.floor(i / FILE_OFFSETS.length);
      const start = filePath[0] ?? pad.pos;
      const next = filePath[1] ?? pad.pos;
      const dir = normalize(sub(next, start));
      const pos = { x: start.x - dir.x * 50 * rank, y: start.y - dir.y * 50 * rank };
      const unit = createEntity(world, s.unit, pos, {
        headingRad: angleOf(dir),
        tags: [DEFENSE_SORTIE_TAG, `pad:${pad.id}`],
        path: filePath,
        speed: SORTIE_SPEED[s.unit] ?? 30,
      });
      strengthen(unit, s, pad.level);
      world.entities.push(unit);
    }
  }

  private waveCleared(world: World, def: DefenseDefinition, state: DefenseState): void {
    const bonus = def.waveBonus + def.waveBonusStep * state.wave;
    this.flakShells = [];
    state.gold += bonus;
    // Sorties return to base; old wrecks are cleared away.
    world.entities = world.entities.filter((e) => {
      if (e.alive) return !e.tags.includes(DEFENSE_SORTIE_TAG);
      const ours = e.tags.some((t) => t === DEFENSE_WAVE_TAG || t === DEFENSE_SORTIE_TAG || t === DEFENSE_GARRISON_TAG);
      return !ours || e.diedAt === null || world.time - e.diedAt < WRECK_KEEP;
    });
    for (const pad of state.pads) if (pad.structure && STRUCTURES[pad.structure].mode === 'garrison') refillGarrison(world, def, pad);
    world.emit({ type: 'defenseWaveCleared', wave: state.wave, total: state.totalWaves, bonus });
    state.wave += 1;
    if (state.wave >= state.totalWaves) {
      state.phase = 'won';
      const o = world.objectives.find((ob) => ob.kind === 'defend');
      if (o && o.status === 'active') {
        o.status = 'completed';
        o.detail = 'Held';
      }
      endMission(world, 'victory');
      return;
    }
    state.phase = 'build';
    notice(world, state, `WAVE CLEARED · +${bonus} GOLD`, true);
  }
}

function notice(world: World, state: DefenseState, text: string, good: boolean): void {
  state.notice = { text, good, at: world.time };
}

/** The pad (or the armory) under the player, if any. */
function activePad(world: World, state: DefenseState): string | null {
  const p = world.player;
  if (!p.alive) return null;
  let best: PadState | null = null;
  let bestDist = Infinity;
  for (const pad of state.pads) {
    const d = distance(p.pos, pad.pos);
    if (d <= PAD_RADIUS && d < bestDist) {
      best = pad;
      bestDist = d;
    }
  }
  if (best) return best.id;
  return distance(p.pos, world.homeBasePos()) <= ARMORY_RADIUS ? 'armory' : null;
}

/** From the pad, up the road toward where the enemy comes from. */
function sortieRoute(world: World, def: DefenseDefinition, pad: PadState): Vec2[] {
  const lane = def.lanes.find((l) => l.id === pad.laneId);
  const path = lane ? world.level.paths[lane.pathId] : undefined;
  if (!path || path.length === 0) return [{ ...pad.pos }];
  // The road runs edge → base; march it backwards from the waypoint nearest the pad.
  let nearest = 0;
  path.forEach((pt, i) => {
    if (distance(pt, pad.pos) < distance(path[nearest] ?? pt, pad.pos)) nearest = i;
  });
  return [{ ...pad.pos }, ...path.slice(0, nearest + 1).reverse().map((pt) => ({ ...pt }))];
}

/** Bunker slot ring radius per level (matches the hull-down slots drawn in the structure art). */
const SLOT_RADIUS = [62, 74] as const;

/** Replace a bunker's fallen garrison (and add units after an upgrade), one per free slot. */
function refillGarrison(world: World, def: DefenseDefinition, pad: PadState): void {
  const s = STRUCTURES[pad.structure ?? 'bunker'];
  const want = s.count[pad.level - 1] ?? 0;
  const ring = SLOT_RADIUS[Math.min(pad.level, SLOT_RADIUS.length) - 1] ?? SLOT_RADIUS[0];
  const alive = pad.garrison.map((id) => world.findById(id)).filter((e): e is Entity => e?.alive === true);
  pad.garrison = alive.map((e) => e.id);
  const lane = def.lanes.find((l) => l.id === pad.laneId);
  const path = lane ? world.level.paths[lane.pathId] : undefined;
  const facing = path && path[0] ? angleOf(sub(path[0], pad.pos)) : -Math.PI / 2;
  for (let i = 0; i < want && pad.garrison.length < want; i++) {
    // Slots at -90° + i·360°/n, facing outward.
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / want;
    const pos = { x: pad.pos.x + Math.cos(a) * ring, y: pad.pos.y + Math.sin(a) * ring };
    if (alive.some((e) => distance(e.pos, pos) < 20)) continue;
    const unit = createEntity(world, s.unit, pos, { headingRad: facing, tags: [DEFENSE_GARRISON_TAG, `pad:${pad.id}`] });
    unit.heading = a;
    unit.turretHeading = facing;
    strengthen(unit, s, pad.level);
    world.entities.push(unit);
    pad.garrison.push(unit.id);
  }
}

/** Apply a structure's per-level toughness and firepower to one of its units. */
function strengthen(unit: Entity, s: StructureDefinition, level: number): void {
  const hp = s.hpMultiplier[level - 1] ?? 1;
  unit.maxHp *= hp;
  unit.hp = unit.maxHp;
  if (unit.attacker) unit.attacker.damageMultiplier = s.damageMultiplier[level - 1] ?? 1;
}
