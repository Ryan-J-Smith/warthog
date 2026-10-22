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
  PERKS,
  PERK_ORDER,
  DRAFT_SIZE,
  structureCost,
  type ArmoryId,
  type PerkId,
  type DefenseState,
  type PadState,
  type StructureDefinition,
  type StructureId,
} from '../defense';
import { ENTITY_STATS } from '../../config';
import type { Entity } from '../entities';
import type { DefenseDefinition } from '../level';
import type { PlayerLoadout } from '../loadout';
import { angleOf, degToRad, distance, normalize, rotateToward, sub, type Vec2 } from '../math';
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
/**
 * Leaks, tower-defence style: a wave unit that gets this close to the base breaks through. It
 * chips a fixed share of the base's integrity and is gone, so the base bleeds instead of
 * surviving at 100 % until a parked column kills it in one go.
 */
const LEAK_RADIUS = 560;
const LEAK_SHARE: Partial<Record<EntityKind, number>> = { infantry: 0.04, truck: 0.04, mobileAa: 0.06, tank: 0.1, mlrs: 0.08 };
const LEAK_SHARE_DEFAULT = 0.06;
/**
 * A squad fights any wave ground unit that comes this close to its post (well past weapon range),
 * MOBA creep style, then walks back to its post.
 */
const LEASH_RADIUS = 520;
const ORDERS_INTERVAL = 0.25;
/** Squad formations: ranks of up to LINE_WIDTH abreast, LINE_SPACING apart, RANK_GAP between ranks. */
const LINE_WIDTH = 5;
const LINE_SPACING = 56;
const RANK_GAP = 56;
/** A squad's firing line forms this fraction of weapon range short of the enemy, so the rear rank still reaches. */
const STANDOFF = 0.65;
/** A unit this close to its slot is there. */
const AT_SLOT = 8;

/** A barracks / depot squad: where it holds, which way it faces, and its units. */
interface Squad {
  post: Vec2;
  /** Up the road, toward where the enemy comes from. */
  facing: Vec2;
  ids: number[];
  /** Fighting (an enemy is inside the leash) rather than holding the post. */
  engaged: boolean;
}
/** Once a wave's ground units are gone, its gunships break off after this long (a wave never stalls). */
const GUNSHIP_BINGO = 40;
/** An idle wave gunship further than this from the base heads straight back to it. */
const RALLY_DISTANCE = 1500;

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
  /** This wave's sortie squads, by pad id. */
  private readonly squads = new Map<string, Squad>();
  private nextOrders = 0;
  /** Sim time the current wave was down to gunships only, or null. */
  private airOnlySince: number | null = null;
  /** Roads dealt out for this run (once, on the first step). */
  private dealt = false;
  /** Fractional gold owed from kill points (perks multiply it). */
  private goldCarry = 0;
  /** The weapon selected before this step (a build key also selects a weapon; this undoes that). */
  private lastWeapon: WeaponId | null = null;
  /** Next time each flak pad may fire. */
  private readonly flakReady = new Map<string, number>();

  update({ world, input, dt }: StepContext): void {
    const def = world.level.defense;
    const state = world.defense;
    if (!def || !state || world.ended) return;
    this.baseLoadout ??= world.loadout;
    if (!this.dealt) {
      this.dealt = true;
      if (def.shuffleLanes) shuffleLanes(world, def, state);
    }
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
      if (option !== undefined && (state.offer || state.activePad)) {
        // A draft on offer takes the number keys first.
        if (state.offer) this.takePerk(world, def, state, option);
        else if (state.activePad) this.choose(world, def, state, state.activePad, option);
        // The number key was a build order, not a weapon change.
        if (weaponBefore) {
          world.player.selectedWeapon = weaponBefore;
          this.lastWeapon = weaponBefore;
        }
      }
      if (input.ready && state.offer) notice(world, state, 'PICK A CARD FIRST (1-3)', false);
      else if (input.ready) this.launchWave(world, def, state);
    } else if (state.phase === 'wave') {
      state.activePad = null;
      this.updateFlak(world, state);
      leaks(world, state, base);
      if (!base.alive) return;
      rallyGunships(world, base.pos);
      this.orderSquads(world);
      this.faceUpRoad(world, dt);
      this.bingo(world, state);
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
      const range = (flak.range[i] ?? 0) * state.mods.flakRange;
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
      this.flakReady.set(pad.id, world.time + (flak.cooldown[i] ?? 1) / state.mods.flakRate);
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
    this.goldCarry += (points - this.paidKillPoints) * def.goldPerKillPoint * state.mods.goldMultiplier;
    this.paidKillPoints = points;
    const owed = Math.floor(this.goldCarry);
    if (owed > 0) {
      state.gold += owed;
      this.goldCarry -= owed;
    }
  }

  /** Gunships left on their own break off after `GUNSHIP_BINGO` seconds. */
  private bingo(world: World, state: DefenseState): void {
    const wave = world.entities.filter((e) => e.alive && e.tags.includes(DEFENSE_WAVE_TAG));
    const airOnly = wave.length > 0 && wave.every((e) => e.heli !== null);
    if (!airOnly) {
      this.airOnlySince = null;
      return;
    }
    this.airOnlySince ??= world.time;
    if (world.time - this.airOnlySince < GUNSHIP_BINGO) return;
    const gone = new Set(wave.map((e) => e.id));
    world.entities = world.entities.filter((e) => !gone.has(e.id));
    this.airOnlySince = null;
    notice(world, state, 'GUNSHIPS BINGO FUEL · BREAKING OFF', true);
  }

  /** Take draft card `option` and apply it. */
  private takePerk(world: World, def: DefenseDefinition, state: DefenseState, option: number): void {
    const id = state.offer?.[option];
    if (!id) return;
    const m = state.mods;
    const base = world.findByRef(def.baseRefId);
    switch (id) {
      case 'warBonds':
        m.goldMultiplier *= 1.5;
        break;
      case 'veterans':
        m.unitDamage *= 1.3;
        break;
      case 'sandbags':
        m.unitHp *= 1.4;
        break;
      case 'discount':
        m.costMultiplier *= 0.75;
        break;
      case 'supplyDrop':
        state.gold += 150;
        break;
      case 'gunOverdrive':
        m.gunDamage *= 1.4;
        this.applyGun(world, state);
        break;
      case 'hardpoints': {
        const ammo = { ...world.loadout.ammo, bombs: world.loadout.ammo.bombs + 4, maverick: world.loadout.ammo.maverick + 2 };
        world.loadout = { ...world.loadout, ammo };
        world.player.ammo = { ...world.player.ammo, bombs: world.player.ammo.bombs + 4, maverick: world.player.ammo.maverick + 2 };
        break;
      }
      case 'reinforcedBase':
        if (base) {
          base.maxHp *= 1.25;
          base.hp = Math.min(base.maxHp, base.hp + base.maxHp * 0.25);
        }
        break;
      case 'quickTurnaround':
        state.respawnDelay = 3;
        break;
      case 'longFlak':
        m.flakRange *= 1.3;
        m.flakRate *= 1.3;
        break;
      case 'reinforcements':
        m.sortieExtra += 2;
        break;
    }
    state.perks.push(id);
    state.offer = null;
    // Garrisons pick up toughness / firepower perks at once.
    for (const pad of state.pads) if (pad.structure && STRUCTURES[pad.structure].mode === 'garrison') this.reform(world, def, pad, state);
    notice(world, state, `${PERKS[id].name} — ${PERKS[id].blurb.toUpperCase()}`, true);
    world.emit({ type: 'perkTaken', perk: id });
  }

  /** GAU damage from the armory level and perks. */
  private applyGun(world: World, state: DefenseState): void {
    const stock = this.baseLoadout ?? world.loadout;
    const armory = 1 + GUN_DAMAGE_STEP * state.armory.gun;
    world.loadout = { ...world.loadout, gunDamageMultiplier: stock.gunDamageMultiplier * armory * state.mods.gunDamage };
  }

  /** Re-form a garrison from scratch (after an upgrade or a perk that changes its units). */
  private reform(world: World, def: DefenseDefinition, pad: PadState, state: DefenseState): void {
    const old = new Set(pad.garrison);
    world.entities = world.entities.filter((e) => !old.has(e.id));
    pad.garrison = [];
    refillGarrison(world, def, pad, state);
  }

  /** Three different cards from the pool (non-repeatables already taken are left out). */
  private draft(world: World, state: DefenseState): PerkId[] {
    const pool = PERK_ORDER.filter((id) => PERKS[id].repeatable || !state.perks.includes(id));
    const picks: PerkId[] = [];
    while (picks.length < DRAFT_SIZE && pool.length > 0) {
      const i = world.rng.int(0, pool.length - 1);
      const [id] = pool.splice(i, 1);
      if (id) picks.push(id);
    }
    return picks;
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
    const cost = structureCost(state, id, pad.level);
    if (cost === undefined) return notice(world, state, `${s.name} IS FULLY UPGRADED`, false);
    if (state.gold < cost) return notice(world, state, `NEED ${cost} GOLD FOR ${s.name}`, false);
    state.gold -= cost;
    const upgrade = pad.level > 0;
    pad.structure = id;
    pad.level += 1;
    // An upgrade re-forms the garrison on the bigger slot ring.
    if (s.mode === 'garrison') this.reform(world, def, pad, state);
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
    const p = world.player;
    if (id === 'gun') {
      this.applyGun(world, state);
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
    const wave = state.waves[state.wave];
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
    for (const pad of state.pads) if (pad.structure) this.sortie(world, def, pad, state);
    state.remaining = world.entities.filter((e) => e.alive && e.tags.includes(DEFENSE_WAVE_TAG)).length;
    world.emit({ type: 'defenseWaveStarted', wave: state.wave, total: state.totalWaves });
  }

  /** A barracks or depot turns its squad out onto its road, formed up beside the pad. */
  private sortie(world: World, def: DefenseDefinition, pad: PadState, state: DefenseState): void {
    const s = STRUCTURES[pad.structure ?? 'barracks'];
    if (s.mode !== 'sortie') return;
    const { post, facing } = sortiePost(world, def, pad);
    const count = (s.count[pad.level - 1] ?? 0) + state.mods.sortieExtra;
    const ids: number[] = [];
    for (const slot of lineSlots(post, facing, count).flat()) {
      // Out of the door in a loose row, then to the slot.
      const pos = { x: pad.pos.x + (slot.x - post.x) * 0.3, y: pad.pos.y + (slot.y - post.y) * 0.3 };
      const unit = createEntity(world, s.unit, pos, {
        headingRad: angleOf(sub(slot, pos)),
        tags: [DEFENSE_SORTIE_TAG, `pad:${pad.id}`],
        path: [slot],
        speed: SORTIE_SPEED[s.unit] ?? 30,
      });
      if (unit.mover) unit.mover.formation = true;
      strengthen(unit, s, pad.level, state);
      world.entities.push(unit);
      ids.push(unit.id);
    }
    this.squads.set(pad.id, { post, facing, ids, engaged: false });
  }

  /**
   * Squads hold their post. When a wave ground unit comes inside the leash, the squad spreads into
   * a firing line short of it (every unit in range, none queued behind a friend), and walks back
   * to its post once the area is clear.
   */
  private orderSquads(world: World): void {
    if (world.time < this.nextOrders) return;
    this.nextOrders = world.time + ORDERS_INTERVAL;
    const foes = world.entities.filter((e) => e.alive && !e.hidden && !e.heli && e.tags.includes(DEFENSE_WAVE_TAG));
    for (const squad of this.squads.values()) {
      const units = squadUnits(world, squad);
      const lead = units[0];
      if (!lead) continue;
      let foe: Entity | null = null;
      let best = LEASH_RADIUS;
      for (const f of foes) {
        const d = distance(f.pos, squad.post);
        if (d < best) {
          best = d;
          foe = f;
        }
      }
      squad.engaged = foe !== null;
      let orders: Array<[Entity, Vec2]>;
      if (foe) {
        const c = centroid(units);
        const toward = normalize(sub(foe.pos, c));
        const forward = toward.x === 0 && toward.y === 0 ? squad.facing : toward;
        const standoff = (lead.attacker?.range ?? 0) * STANDOFF;
        orders = formUp(units, { x: foe.pos.x - forward.x * standoff, y: foe.pos.y - forward.y * standoff }, forward);
      } else {
        orders = formUp(units, squad.post, squad.facing);
      }
      // A unit already shooting stays put; the rest take their slots around it.
      for (const [unit, slot] of orders) if (unit.attacker?.targetId === null) moveTo(unit, slot);
    }
  }

  /** Units standing at their post turn to face up the road. */
  private faceUpRoad(world: World, dt: number): void {
    for (const squad of this.squads.values()) {
      if (squad.engaged) continue;
      const angle = angleOf(squad.facing);
      for (const unit of squadUnits(world, squad)) {
        if (!unit.mover?.halted || unit.attacker?.targetId !== null) continue;
        const before = unit.heading;
        unit.heading = rotateToward(unit.heading, angle, degToRad(ENTITY_STATS[unit.kind].turnRateDeg) * dt);
        unit.turretHeading += unit.heading - before;
      }
    }
  }

  private waveCleared(world: World, def: DefenseDefinition, state: DefenseState): void {
    const bonus = def.waveBonus + def.waveBonusStep * state.wave;
    this.flakShells = [];
    this.squads.clear();
    state.gold += bonus;
    // Sorties return to base; old wrecks are cleared away.
    world.entities = world.entities.filter((e) => {
      if (e.alive) return !e.tags.includes(DEFENSE_SORTIE_TAG);
      const ours = e.tags.some((t) => t === DEFENSE_WAVE_TAG || t === DEFENSE_SORTIE_TAG || t === DEFENSE_GARRISON_TAG);
      return !ours || e.diedAt === null || world.time - e.diedAt < WRECK_KEEP;
    });
    for (const pad of state.pads) if (pad.structure && STRUCTURES[pad.structure].mode === 'garrison') refillGarrison(world, def, pad, state);
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
    state.offer = this.draft(world, state);
    notice(world, state, `WAVE CLEARED · +${bonus} GOLD · PICK A CARD`, true);
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

/** Where a pad's squad holds: on its road at the point nearest the pad, facing up the road. */
function sortiePost(world: World, def: DefenseDefinition, pad: PadState): { post: Vec2; facing: Vec2 } {
  const lane = def.lanes.find((l) => l.id === pad.laneId);
  const path = lane ? world.level.paths[lane.pathId] : undefined;
  if (!path || path.length < 2) return { post: { ...pad.pos }, facing: { x: 0, y: -1 } };
  let best = { seg: 0, point: { ...(path[0] as Vec2) }, d: Infinity };
  for (let i = 0; i + 1 < path.length; i++) {
    const point = closestOnSegment(pad.pos, path[i] as Vec2, path[i + 1] as Vec2);
    const d = distance(point, pad.pos);
    if (d < best.d) best = { seg: i, point, d };
  }
  // The road runs edge → base, so up the road is back along the segment.
  return { post: best.point, facing: normalize(sub(path[best.seg] as Vec2, path[best.seg + 1] as Vec2)) };
}

/**
 * Formation slots for n units facing `forward`, by rank: up to LINE_WIDTH abreast centred on
 * `front`, each rank further back and staggered so it isn't stood straight behind the one ahead.
 */
function lineSlots(front: Vec2, forward: Vec2, n: number): Vec2[][] {
  const side = { x: -forward.y, y: forward.x };
  const firstWidth = Math.min(LINE_WIDTH, n);
  const ranks: Vec2[][] = [];
  for (let placed = 0, rank = 0; placed < n; rank++) {
    const width = Math.min(LINE_WIDTH, n - placed);
    const stagger = rank % 2 === 1 && width % 2 === firstWidth % 2 ? LINE_SPACING / 2 : 0;
    const row: Vec2[] = [];
    for (let i = 0; i < width; i++) {
      const lateral = (i - (width - 1) / 2) * LINE_SPACING + stagger;
      row.push({
        x: front.x + side.x * lateral - forward.x * RANK_GAP * rank,
        y: front.y + side.y * lateral - forward.y * RANK_GAP * rank,
      });
    }
    ranks.push(row);
    placed += width;
  }
  return ranks;
}

/** Slot each unit into a formation without crossing paths: the foremost take the front rank, left to right as they stand. */
function formUp(units: readonly Entity[], front: Vec2, forward: Vec2): Array<[Entity, Vec2]> {
  const side = { x: -forward.y, y: forward.x };
  const along = (p: Vec2, axis: Vec2): number => p.x * axis.x + p.y * axis.y;
  const queue = [...units].sort((a, b) => along(b.pos, forward) - along(a.pos, forward));
  const orders: Array<[Entity, Vec2]> = [];
  for (const rank of lineSlots(front, forward, units.length)) {
    const row = queue.splice(0, rank.length).sort((a, b) => along(a.pos, side) - along(b.pos, side));
    row.forEach((unit, i) => orders.push([unit, rank[i] as Vec2]));
  }
  return orders;
}

/** Send a ground unit to a point, unless it's there or already on its way. */
function moveTo(unit: Entity, to: Vec2): void {
  const mover = unit.mover;
  if (!mover || distance(unit.pos, to) <= AT_SLOT) return;
  const goal = mover.path[mover.waypoint];
  if (!mover.halted && goal && distance(goal, to) < 1) return;
  mover.path = [{ ...to }];
  mover.waypoint = 0;
  mover.halted = false;
  mover.stopAtWaypoint = null;
}

function squadUnits(world: World, squad: Squad): Entity[] {
  return squad.ids.map((id) => world.findById(id)).filter((e): e is Entity => e?.alive === true && e.mover !== null);
}

function centroid(units: readonly Entity[]): Vec2 {
  const n = Math.max(1, units.length);
  return { x: units.reduce((s, u) => s + u.pos.x, 0) / n, y: units.reduce((s, u) => s + u.pos.y, 0) / n };
}

/** Bunker slot ring radius per level (matches the hull-down slots drawn in the structure art). */
const SLOT_RADIUS = [62, 74] as const;

/** Replace a bunker's fallen garrison (and add units after an upgrade), one per free slot. */
function refillGarrison(world: World, def: DefenseDefinition, pad: PadState, state: DefenseState): void {
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
    strengthen(unit, s, pad.level, state);
    world.entities.push(unit);
    pad.garrison.push(unit.id);
  }
}

/** Apply a structure's per-level toughness and firepower to one of its units. */
function strengthen(unit: Entity, s: StructureDefinition, level: number, state: DefenseState): void {
  const hp = (s.hpMultiplier[level - 1] ?? 1) * state.mods.unitHp;
  unit.maxHp *= hp;
  unit.hp = unit.maxHp;
  if (unit.attacker) unit.attacker.damageMultiplier = (s.damageMultiplier[level - 1] ?? 1) * state.mods.unitDamage;
}

/** Deal each wave's road groups to a random permutation of the roads (seeded, then previewed). */
function shuffleLanes(world: World, def: DefenseDefinition, state: DefenseState): void {
  const ids = def.lanes.map((l) => l.id);
  for (const wave of state.waves) {
    const perm = [...ids];
    for (let i = perm.length - 1; i > 0; i--) {
      const j = world.rng.int(0, i);
      [perm[i], perm[j]] = [perm[j] as string, perm[i] as string];
    }
    for (const group of wave.lanes) {
      const k = ids.indexOf(group.laneId);
      group.laneId = perm[k] ?? group.laneId;
    }
  }
}

/** Wave ground units that reach the base break through: chip its integrity and leave the field. */
function leaks(world: World, state: DefenseState, base: Entity): void {
  const through = world.entities.filter(
    (e) => e.alive && !e.heli && e.tags.includes(DEFENSE_WAVE_TAG) && distance(e.pos, base.pos) <= LEAK_RADIUS,
  );
  if (through.length === 0) return;
  let share = 0;
  for (const unit of through) {
    const s = LEAK_SHARE[unit.kind] ?? LEAK_SHARE_DEFAULT;
    share += s;
    world.emit({ type: 'baseBreached', kind: unit.kind, pos: { ...unit.pos }, share: s });
  }
  const gone = new Set(through.map((e) => e.id));
  world.entities = world.entities.filter((e) => !gone.has(e.id));
  damageEntity(world, base, base.maxHp * share, 'ground');
  const pct = Math.round(share * 100);
  notice(world, state, `${through.length === 1 ? 'A UNIT' : `${through.length} UNITS`} BROKE THROUGH · BASE −${pct}%`, false);
}

/**
 * Wave gunships with nothing to shoot go for the base: they circle it instead of loitering where
 * they spawned, and one that drifted far off (chasing the aircraft) flies straight back.
 */
function rallyGunships(world: World, basePos: Vec2): void {
  for (const e of world.entities) {
    const h = e.heli;
    if (!e.alive || !h || !e.tags.includes(DEFENSE_WAVE_TAG) || h.targetId !== null) continue;
    if (!h.path) h.loiter = { ...basePos };
    else if (distance(e.pos, basePos) > RALLY_DISTANCE) {
      h.path = [{ ...basePos }];
      h.waypoint = 0;
    }
  }
}

function closestOnSegment(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2)) : 0;
  return { x: a.x + abx * t, y: a.y + aby * t };
}
